package com.kira.memory.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** The Cloudflare API's purge_cache endpoint: records each request's "files" list. */
class CloudflareStub {
    static final String ZONE = "zone-test";
    static final String TOKEN = "cf_test_token";
    final List<List<String>> purges = Collections.synchronizedList(new ArrayList<>());
    /** Answer every purge with a 500, like a Cloudflare outage. */
    volatile boolean fail;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpServer server;

    CloudflareStub() {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        server.createContext("/", this::handle);
        server.start();
    }

    String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/client/v4";
    }

    private void handle(HttpExchange x) throws IOException {
        boolean ok = x.getRequestMethod().equals("POST")
            && x.getRequestURI().getPath().equals("/client/v4/zones/" + ZONE + "/purge_cache")
            && ("Bearer " + TOKEN).equals(x.getRequestHeaders().getFirst("Authorization"));
        byte[] body = x.getRequestBody().readAllBytes();
        int status = !ok ? 403 : fail ? 500 : 200;
        if (status == 200) {
            List<String> files = new ArrayList<>();
            for (JsonNode f : json.readTree(body).path("files")) files.add(f.asText());
            purges.add(files);
        }
        byte[] out = ("{\"success\":" + (status == 200) + "}").getBytes(StandardCharsets.UTF_8);
        x.sendResponseHeaders(status, out.length);
        x.getResponseBody().write(out);
        x.close();
    }
}
