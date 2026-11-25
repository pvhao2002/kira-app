package com.kira.memory.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** A tiny Hugging Face Hub: LFS batch (basic + multipart), verify, commit, resolve with a redirect to a "CDN". */
class HubStub {
    static final String TOKEN = "hf_test_token";
    final Map<String, byte[]> lfs = new ConcurrentHashMap<>();
    final Map<String, String> files = new ConcurrentHashMap<>();
    final Map<String, Map<Integer, byte[]>> parts = new ConcurrentHashMap<>();
    final List<String> cdnAuthHeaders = Collections.synchronizedList(new ArrayList<>());
    /** Objects at least this big are uploaded in multipart with this chunk size. */
    volatile int multipartChunk = 0;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpServer server;

    HubStub() {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        server.createContext("/", this::handle);
        server.start();
    }

    String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private void handle(HttpExchange x) throws IOException {
        String path = x.getRequestURI().getPath();
        String method = x.getRequestMethod();
        byte[] body = x.getRequestBody().readAllBytes();
        boolean hubAuth = ("Bearer " + TOKEN).equals(x.getRequestHeaders().getFirst("Authorization"));
        if (path.equals("/datasets/kira/memories.git/info/lfs/objects/batch") && hubAuth) {
            JsonNode o = json.readTree(body).path("objects").path(0);
            String oid = o.path("oid").asText();
            long size = o.path("size").asLong();
            Map<String, Object> obj = new LinkedHashMap<>(Map.of("oid", oid, "size", size));
            if (!lfs.containsKey(oid)) {
                Map<String, Object> header = new LinkedHashMap<>();
                if (multipartChunk > 0 && size > multipartChunk) {
                    header.put("chunk_size", String.valueOf(multipartChunk));
                    for (int i = 1; i <= (size + multipartChunk - 1) / multipartChunk; i++) header.put(String.valueOf(i), url() + "/part/" + oid + "/" + i);
                }
                obj.put("actions", Map.of("upload", Map.of("href", url() + "/upload/" + oid, "header", header),
                    "verify", Map.of("href", url() + "/verify")));
            }
            reply(x, 200, json.writeValueAsBytes(Map.of("objects", List.of(obj))));
        } else if (path.startsWith("/upload/") && method.equals("PUT")) {
            lfs.put(path.substring(8), body);
            reply(x, 200, new byte[0]);
        } else if (path.startsWith("/part/") && method.equals("PUT")) {
            String[] p = path.split("/");
            parts.computeIfAbsent(p[2], k -> new TreeMap<>()).put(Integer.parseInt(p[3]), body);
            x.getResponseHeaders().add("ETag", "\"etag-" + p[3] + "\"");
            reply(x, 200, new byte[0]);
        } else if (path.startsWith("/upload/") && method.equals("POST")) {
            String oid = path.substring(8);
            JsonNode done = json.readTree(body);
            var out = new java.io.ByteArrayOutputStream();
            for (JsonNode part : done.path("parts")) {
                if (!part.path("etag").asText().equals("\"etag-" + part.path("partNumber").asInt() + "\"")) {
                    reply(x, 400, new byte[0]);
                    return;
                }
                out.write(parts.get(oid).get(part.path("partNumber").asInt()));
            }
            lfs.put(oid, out.toByteArray());
            reply(x, 200, new byte[0]);
        } else if (path.equals("/verify") && hubAuth) {
            reply(x, lfs.containsKey(json.readTree(body).path("oid").asText()) ? 200 : 404, new byte[0]);
        } else if (path.equals("/api/datasets/kira/memories/commit/main") && hubAuth) {
            String[] lines = new String(body, StandardCharsets.UTF_8).split("\n");
            for (int i = 1; i < lines.length; i++) {
                JsonNode op = json.readTree(lines[i]);
                String file = op.path("value").path("path").asText();
                switch (op.path("key").asText()) {
                    case "lfsFile" -> {
                        if (!lfs.containsKey(op.path("value").path("oid").asText())) {
                            reply(x, 422, new byte[0]);
                            return;
                        }
                        files.put(file, op.path("value").path("oid").asText());
                    }
                    case "deletedFile" -> files.remove(file);
                    default -> {
                        reply(x, 400, new byte[0]);
                        return;
                    }
                }
            }
            reply(x, 200, "{\"commitOid\":\"abc\"}".getBytes());
        } else if (path.startsWith("/datasets/kira/memories/resolve/main/") && hubAuth) {
            String oid = files.get(path.substring("/datasets/kira/memories/resolve/main/".length()));
            if (oid == null) {
                reply(x, 404, new byte[0]);
                return;
            }
            // A different host name, like the real CDN.
            x.getResponseHeaders().add("Location", "http://localhost:" + server.getAddress().getPort() + "/cdn/" + oid);
            reply(x, 302, new byte[0]);
        } else if (path.startsWith("/cdn/")) {
            cdnAuthHeaders.add(String.valueOf(x.getRequestHeaders().getFirst("Authorization")));
            byte[] data = lfs.get(path.substring(5));
            String range = x.getRequestHeaders().getFirst("Range");
            if (range != null) {
                String[] r = range.substring(6).split("-");
                int from = Integer.parseInt(r[0]);
                int to = r.length > 1 ? Integer.parseInt(r[1]) : data.length - 1;
                x.getResponseHeaders().add("Content-Range", "bytes " + from + "-" + to + "/" + data.length);
                reply(x, 206, Arrays.copyOfRange(data, from, to + 1));
            } else {
                reply(x, 200, data);
            }
        } else {
            reply(x, 401, new byte[0]);
        }
    }

    private static void reply(HttpExchange x, int status, byte[] body) throws IOException {
        x.sendResponseHeaders(status, body.length == 0 ? -1 : body.length);
        if (body.length > 0) x.getResponseBody().write(body);
        x.close();
    }
}
