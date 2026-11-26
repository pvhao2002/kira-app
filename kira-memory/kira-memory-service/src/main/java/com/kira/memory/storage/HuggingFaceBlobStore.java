package com.kira.memory.storage;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * A private Hugging Face dataset repo used as a blob store, over the same HTTP protocol huggingface_hub uses:
 * Git LFS batch upload (basic or multipart) to the presigned URL, then a commit of the LFS pointer.
 * Reads go through /resolve, whose redirect to the CDN is followed without the token.
 */
@Component
public class HuggingFaceBlobStore implements BlobStore {
    private static final String LFS_JSON = "application/vnd.git-lfs+json";
    private final String baseUrl;
    private final String repo;
    private final String token;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20))
        .followRedirects(HttpClient.Redirect.NEVER).build();

    public HuggingFaceBlobStore(@Value("${storage.hugging-face.base-url}") String baseUrl,
                                @Value("${storage.hugging-face.repo}") String repo,
                                @Value("${storage.hugging-face.token}") String token, ObjectMapper json) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.repo = repo;
        this.token = token;
        this.json = json;
    }

    @Override
    public StorageProvider provider() {
        return StorageProvider.HUGGING_FACE;
    }

    @Override
    public boolean configured() {
        return !repo.isBlank() && !token.isBlank();
    }

    @Override
    public void put(String key, Path file, String contentType) {
        requireConfigured();
        io("upload", () -> {
            long size = Files.size(file);
            String oid = sha256(file);
            JsonNode batch = json.readTree(send(HttpRequest.newBuilder(URI.create(baseUrl + "/datasets/" + repo + ".git/info/lfs/objects/batch"))
                .header("Authorization", "Bearer " + token).header("Accept", LFS_JSON).header("Content-Type", LFS_JSON)
                .POST(body(Map.of("operation", "upload", "transfers", List.of("basic", "multipart"), "hash_algo", "sha256",
                    "ref", Map.of("name", "main"), "objects", List.of(Map.of("oid", oid, "size", size))))), "LFS batch"));
            JsonNode object = batch.path("objects").path(0);
            if (object.has("error")) throw new StorageException("Hugging Face LFS batch rejected the object");
            JsonNode upload = object.path("actions").path("upload");
            // No upload action means the Hub already has this content.
            if (!upload.isMissingNode()) {
                if (upload.path("header").has("chunk_size")) uploadMultipart(upload, file, oid, size);
                else expectOk(http.send(HttpRequest.newBuilder(URI.create(upload.path("href").asText()))
                    .PUT(HttpRequest.BodyPublishers.ofFile(file)).build(), HttpResponse.BodyHandlers.discarding()), "LFS upload");
                JsonNode verify = object.path("actions").path("verify");
                if (!verify.isMissingNode()) {
                    send(HttpRequest.newBuilder(URI.create(verify.path("href").asText()))
                        .header("Authorization", "Bearer " + token).header("Accept", LFS_JSON).header("Content-Type", LFS_JSON)
                        .POST(body(Map.of("oid", oid, "size", size))), "LFS verify");
                }
            }
            commit("Add " + key, Map.of("key", "lfsFile", "value", Map.of("path", key, "algo", "sha256", "oid", oid, "size", size)));
            return null;
        });
    }

    @Override
    public Blob open(String key, String range) {
        requireConfigured();
        URI uri = URI.create(baseUrl + "/datasets/" + repo + "/resolve/main/" + key);
        String host = uri.getHost();
        return io("download", () -> {
            URI next = uri;
            for (int hop = 0; hop < 5; hop++) {
                HttpRequest.Builder b = HttpRequest.newBuilder(next).timeout(Duration.ofSeconds(60)).GET();
                // The token only goes to the Hub itself, never to the CDN it redirects to.
                if (host.equals(next.getHost())) b.header("Authorization", "Bearer " + token);
                if (range != null) b.header("Range", range);
                HttpResponse<InputStream> r = http.send(b.build(), HttpResponse.BodyHandlers.ofInputStream());
                int s = r.statusCode();
                if (s >= 300 && s < 400) {
                    r.body().close();
                    next = next.resolve(r.headers().firstValue("Location").orElseThrow(() -> new StorageException("redirect without Location")));
                    continue;
                }
                if (s == 200 || s == 206) {
                    long length = r.headers().firstValueAsLong("Content-Length").orElse(-1);
                    return new Blob(s, r.body(), length, s == 206 ? r.headers().firstValue("Content-Range").orElse(null) : null);
                }
                r.body().close();
                if (s == 404) throw new StorageNotFoundException();
                throw new StorageException("Hugging Face download failed with status " + s);
            }
            throw new StorageException("Hugging Face download redirected too many times");
        });
    }

    @Override
    public void delete(String key) {
        requireConfigured();
        io("delete", () -> {
            commit("Delete " + key, Map.of("key", "deletedFile", "value", Map.of("path", key)));
            return null;
        });
    }

    private void uploadMultipart(JsonNode upload, Path file, String oid, long size) throws IOException, InterruptedException {
        JsonNode header = upload.path("header");
        long chunk = Long.parseLong(header.path("chunk_size").asText());
        TreeMap<Integer, String> partUrls = new TreeMap<>();
        header.properties().forEach(e -> {
            if (e.getKey().matches("\\d+")) partUrls.put(Integer.parseInt(e.getKey()), e.getValue().asText());
        });
        List<Map<String, Object>> parts = new ArrayList<>();
        for (var part : partUrls.entrySet()) {
            long offset = (part.getKey() - 1) * chunk;
            long length = Math.min(chunk, size - offset);
            // Streamed from disk with a known length: presigned S3 URLs reject chunked transfer encoding.
            HttpRequest.BodyPublisher body = HttpRequest.BodyPublishers.fromPublisher(
                HttpRequest.BodyPublishers.ofInputStream(() -> FileSlice.open(file, offset, length)), length);
            HttpResponse<Void> r = http.send(HttpRequest.newBuilder(URI.create(part.getValue())).PUT(body).build(),
                HttpResponse.BodyHandlers.discarding());
            expectOk(r, "LFS part upload");
            parts.add(Map.of("partNumber", part.getKey(),
                "etag", r.headers().firstValue("ETag").orElseThrow(() -> new StorageException("LFS part without ETag"))));
        }
        send(HttpRequest.newBuilder(URI.create(upload.path("href").asText())).header("Accept", LFS_JSON)
            .header("Content-Type", LFS_JSON).POST(body(Map.of("oid", oid, "parts", parts))), "LFS multipart complete");
    }

    private void commit(String summary, Map<String, Object> operation) throws IOException, InterruptedException {
        String ndjson = json.writeValueAsString(Map.of("key", "header", "value", Map.of("summary", summary))) + "\n"
            + json.writeValueAsString(operation) + "\n";
        send(HttpRequest.newBuilder(URI.create(baseUrl + "/api/datasets/" + repo + "/commit/main"))
            .header("Authorization", "Bearer " + token).header("Content-Type", "application/x-ndjson")
            .POST(HttpRequest.BodyPublishers.ofString(ndjson)), "commit");
    }

    /** Returns the raw body: only the LFS batch answer is JSON (verify answers a plain-text "OK"). */
    private String send(HttpRequest.Builder request, String step) throws IOException, InterruptedException {
        HttpResponse<String> r = http.send(request.timeout(Duration.ofMinutes(10)).build(), HttpResponse.BodyHandlers.ofString());
        expectOk(r, step);
        return r.body();
    }

    private static void expectOk(HttpResponse<?> r, String step) {
        // Only the status is reported: provider bodies may echo request details.
        if (r.statusCode() / 100 != 2) throw new StorageException("Hugging Face " + step + " failed with status " + r.statusCode());
    }

    private HttpRequest.BodyPublisher body(Object value) throws IOException {
        return HttpRequest.BodyPublishers.ofString(json.writeValueAsString(value));
    }

    private interface HubCall<T> {
        T run() throws IOException, InterruptedException;
    }

    /** One place that turns transport failures into StorageException (keeping the interrupt flag). */
    private static <T> T io(String what, HubCall<T> call) {
        try {
            return call.run();
        } catch (IOException e) {
            throw new StorageException("Hugging Face " + what + " failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new StorageException("Hugging Face " + what + " interrupted", e);
        }
    }

    private void requireConfigured() {
        if (!configured()) throw new StorageException("Hugging Face is not configured");
    }

    static String sha256(Path file) throws IOException {
        try (InputStream in = Files.newInputStream(file)) {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] buf = new byte[1 << 16];
            for (int n; (n = in.read(buf)) > 0; ) md.update(buf, 0, n);
            return HexFormat.of().formatHex(md.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
