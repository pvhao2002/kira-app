package com.kira.memory.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.LinkedMultiValueMap;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "app.jwt.secret=integration-test-secret-with-at-least-32-chars",
    "app.media-url-secret=integration-media-secret-with-at-least-32-chars",
    "storage.hugging-face.repo=kira/memories", "storage.hugging-face.token=" + HubStub.TOKEN,
    "storage.r2.bucket=memories", "storage.r2.access-key=test", "storage.r2.secret-key=test",
    "storage.r2.region=us-east-1", "storage.r2.part-size=5MB", "app.upload.chunk-size=1MB"})
class MemoryFlowIT {
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0");
    static final GenericContainer<?> S3 = new GenericContainer<>("adobe/s3mock:4.7.0")
        .withEnv("COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS", "memories").withExposedPorts(9090);
    static final HubStub HUB = new HubStub();

    static {
        MYSQL.start();
        S3.start();
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", MYSQL::getJdbcUrl);
        r.add("spring.datasource.username", MYSQL::getUsername);
        r.add("spring.datasource.password", MYSQL::getPassword);
        r.add("storage.hugging-face.base-url", HUB::url);
        r.add("storage.r2.endpoint", () -> "http://" + S3.getHost() + ":" + S3.getMappedPort(9090));
    }

    @Autowired TestRestTemplate rest;
    @Autowired JdbcClient jdbc;
    @Autowired com.kira.memory.identity.LoginRateLimiter limiter;
    @LocalServerPort int port;
    final ObjectMapper json = new ObjectMapper();

    @BeforeEach
    void clean() {
        jdbc.sql("DELETE FROM media").update();
        jdbc.sql("DELETE FROM memory_group").update();
        jdbc.sql("DELETE FROM message").update();
        jdbc.sql("UPDATE app_setting SET value = 'HUGGING_FACE' WHERE name = 'storage_provider'").update();
        jdbc.sql("DELETE FROM app_setting WHERE name = 'banner_media_id'").update();
        HUB.multipartChunk = 0;
    }

    // ---- auth ----

    @Test
    void onlyTheTwoSeededAccountsCanLogIn() throws Exception {
        assertEquals("ADMIN", login("admin").get("role"));
        ResponseEntity<String> love = rest.postForEntity("/api/auth/login", Map.of("username", "love", "password", "14062018"), String.class);
        assertEquals(200, love.getStatusCode().value());
        String cookie = love.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertTrue(cookie.contains("HttpOnly") && cookie.contains("SameSite=Strict"), cookie);
        assertEquals("VIEWER", json.readTree(love.getBody()).path("role").asText());

        assertEquals(401, rest.postForEntity("/api/auth/login", Map.of("username", "admin", "password", "wrong"), String.class).getStatusCode().value());
        assertEquals(401, rest.postForEntity("/api/auth/login", Map.of("username", "nobody", "password", "14062018"), String.class).getStatusCode().value());
        assertEquals(401, rest.postForEntity("/api/auth/register", Map.of("username", "x", "password", "y"), String.class).getStatusCode().value(),
            "there is no registration endpoint");
        assertEquals(401, rest.getForEntity("/api/media", String.class).getStatusCode().value());
        assertEquals(401, call(HttpMethod.GET, "/api/auth/me", "km_session=forged.token.value", null).getStatusCode().value());
    }

    @Test
    void wrongPasswordsLockTheAccountButUnknownNamesAreNotTracked() {
        // Unique per run: the limiter is shared by the whole test context.
        for (int i = 0; i < 12; i++) {
            assertEquals(401, rest.postForEntity("/api/auth/login",
                Map.of("username", "ghost" + i, "password", "x"), String.class).getStatusCode().value());
        }
        for (int i = 0; i < 10; i++) {
            assertEquals(401, rest.postForEntity("/api/auth/login",
                Map.of("username", "love", "password", "wrong"), String.class).getStatusCode().value());
        }
        ResponseEntity<String> locked = rest.postForEntity("/api/auth/login", Map.of("username", "love", "password", "14062018"), String.class);
        assertEquals(429, locked.getStatusCode().value(), "even the right password waits once the limit is hit");
        assertTrue(limiter.tracking("love"));
        assertFalse(limiter.tracking("ghost0"), "made-up names are never remembered");
        limiter.succeeded("love");
    }

    @Test
    void viewerCannotChangeAnything() {
        String love = (String) login("love").get("cookie");
        assertEquals(200, call(HttpMethod.GET, "/api/media", love, null).getStatusCode().value());
        assertEquals(403, upload(love, Map.of()).getStatusCode().value());
        assertEquals(403, call(HttpMethod.PUT, "/api/admin/settings", love, Map.of("widgetShape", "star")).getStatusCode().value());
        assertEquals(403, call(HttpMethod.POST, "/api/admin/groups", love, Map.of("name", "x", "pinned", false)).getStatusCode().value());
    }

    // ---- media + storage ----

    @Test
    void uploadToHuggingFaceAndServeCacheableBytes() throws Exception {
        String admin = (String) login("admin").get("cookie");
        byte[] photo = "fake-jpeg-photo-bytes-0123456789".getBytes();
        JsonNode m = body(upload(admin, Map.of("bytes", photo, "caption", "  Lần đầu hẹn hò ❤  ")));
        assertEquals("HUGGING_FACE", m.path("provider").asText());
        assertEquals("Lần đầu hẹn hò ❤", m.path("caption").asText());
        assertTrue(m.path("url").asText().matches("/m/\\d+/[A-Za-z0-9_-]{22}/o\\.jpg"), m.path("url").asText());
        assertEquals(2, HUB.files.size(), "original + thumbnail committed");

        ResponseEntity<byte[]> original = rest.getForEntity(m.path("url").asText(), byte[].class);
        assertEquals(200, original.getStatusCode().value());
        assertArrayEquals(photo, original.getBody());
        assertEquals("public, max-age=31536000, immutable", original.getHeaders().getCacheControl());
        assertEquals("image/jpeg", original.getHeaders().getContentType().toString());
        assertNull(original.getHeaders().get(HttpHeaders.SET_COOKIE), "a Set-Cookie would stop Cloudflare caching");
        assertTrue(HUB.cdnAuthHeaders.stream().allMatch("null"::equals), "the HF token must not follow the redirect");

        ResponseEntity<byte[]> thumb = rest.getForEntity(m.path("thumbUrl").asText(), byte[].class);
        assertArrayEquals("thumb".getBytes(), thumb.getBody());

        HttpHeaders range = new HttpHeaders();
        range.set("Range", "bytes=0-3");
        ResponseEntity<byte[]> part = rest.exchange(m.path("url").asText(), HttpMethod.GET, new HttpEntity<>(range), byte[].class);
        assertEquals(206, part.getStatusCode().value());
        assertArrayEquals("fake".getBytes(), part.getBody());
        assertEquals("bytes 0-3/" + photo.length, part.getHeaders().getFirst("Content-Range"));

        String tampered = m.path("url").asText().replaceAll("/m/(\\d+)/[^/]+/", "/m/$1/AAAAAAAAAAAAAAAAAAAAAA/");
        assertEquals(404, rest.getForEntity(tampered, byte[].class).getStatusCode().value());
        assertEquals(404, rest.getForEntity(m.path("url").asText().replace("o.jpg", "o.png"), byte[].class).getStatusCode().value());
        assertEquals(404, rest.getForEntity(m.path("thumbUrl").asText().replace("/t.jpg", "/o.jpg"), byte[].class).getStatusCode().value(),
            "the thumbnail signature must not unlock the original");

        assertEquals(200, call(HttpMethod.DELETE, "/api/admin/media/" + m.path("id").asLong(), admin, null).getStatusCode().value());
        assertEquals(0, HUB.files.size());
        assertEquals(404, rest.getForEntity(m.path("url").asText(), byte[].class).getStatusCode().value());
    }

    @Test
    void largeHuggingFaceUploadUsesMultipart() throws Exception {
        HUB.multipartChunk = 10;
        String admin = (String) login("admin").get("cookie");
        byte[] video = "0123456789abcdefghijklmnopqrstuvwxyz-video".getBytes();
        JsonNode m = body(upload(admin, Map.of("bytes", video, "type", "video/mp4", "name", "clip.mp4")));
        assertEquals("VIDEO", m.path("kind").asText());
        assertTrue(m.path("url").asText().endsWith("/o.mp4"));
        assertArrayEquals(video, rest.getForEntity(m.path("url").asText(), byte[].class).getBody());
    }

    @Test
    void adminSwitchesNewUploadsToR2AndOldOnesStillLoad() throws Exception {
        String admin = (String) login("admin").get("cookie");
        JsonNode onHf = body(upload(admin, Map.of("bytes", "hf-photo".getBytes())));
        JsonNode settings = body(call(HttpMethod.PUT, "/api/admin/settings", admin, Map.of("storageProvider", "R2")));
        assertEquals("R2", settings.path("storageProvider").asText());

        JsonNode onR2 = body(upload(admin, Map.of("bytes", "r2-photo".getBytes(), "type", "image/png", "name", "a.png")));
        assertEquals("R2", onR2.path("provider").asText());
        assertArrayEquals("r2-photo".getBytes(), rest.getForEntity(onR2.path("url").asText(), byte[].class).getBody());
        assertArrayEquals("hf-photo".getBytes(), rest.getForEntity(onHf.path("url").asText(), byte[].class).getBody());

        HttpHeaders range = new HttpHeaders();
        range.set("Range", "bytes=3-7");
        ResponseEntity<byte[]> part = rest.exchange(onR2.path("url").asText(), HttpMethod.GET, new HttpEntity<>(range), byte[].class);
        assertEquals(206, part.getStatusCode().value());
        assertArrayEquals("photo".getBytes(), part.getBody());

        assertEquals(200, call(HttpMethod.DELETE, "/api/admin/media/" + onR2.path("id").asLong(), admin, null).getStatusCode().value());
        assertEquals(404, rest.getForEntity(onR2.path("url").asText(), byte[].class).getStatusCode().value());
    }

    @Test
    void rejectsBadUploads() {
        String admin = (String) login("admin").get("cookie");
        assertEquals("UNSUPPORTED_FILE", code(upload(admin, Map.of("type", "application/x-msdownload", "name", "a.exe"))));
        assertEquals("INVALID_THUMB", code(upload(admin, Map.of("thumbType", "image/png"))));
        assertEquals("INVALID_GROUP", code(upload(admin, Map.of("groupId", "999999"))));
    }

    @Test
    void feedPagesByTakenDateAndFiltersByGroup() throws Exception {
        String admin = (String) login("admin").get("cookie");
        long g1 = body(call(HttpMethod.POST, "/api/admin/groups", admin, Map.of("name", "Đà Lạt", "pinned", false))).path("id").asLong();
        long a = body(upload(admin, Map.of("takenAt", "1000", "groupId", String.valueOf(g1)))).path("id").asLong();
        long b = body(upload(admin, Map.of("takenAt", "3000"))).path("id").asLong();
        long c = body(upload(admin, Map.of("takenAt", "2000"))).path("id").asLong();

        JsonNode page1 = body(call(HttpMethod.GET, "/api/media?limit=2", admin, null));
        assertEquals(List.of(b, c), ids(page1));
        JsonNode page2 = body(call(HttpMethod.GET, "/api/media?limit=2&cursor=" + page1.path("nextCursor").asText(), admin, null));
        assertEquals(List.of(a), ids(page2));
        assertTrue(page2.path("nextCursor").isNull());

        assertEquals(List.of(a), ids(body(call(HttpMethod.GET, "/api/media?groupId=" + g1, admin, null))));
        assertEquals(List.of(b, c), ids(body(call(HttpMethod.GET, "/api/media?ungrouped=true", admin, null))));

        assertEquals(2, body(call(HttpMethod.POST, "/api/admin/media/move", admin, Map.of("ids", List.of(b, c), "groupId", g1))).path("moved").asInt());
        assertEquals(List.of(b, c, a), ids(body(call(HttpMethod.GET, "/api/media?groupId=" + g1, admin, null))));

        Map<String, Object> edit = new java.util.HashMap<>();
        edit.put("caption", "Mãi bên nhau");
        edit.put("groupId", null);
        JsonNode edited = body(call(HttpMethod.PUT, "/api/admin/media/" + a, admin, edit));
        assertEquals("Mãi bên nhau", edited.path("caption").asText());
        assertTrue(edited.path("groupId").isNull());
    }

    @Test
    void pinnedGroupsComeFirstAndDeletingAGroupKeepsItsMedia() throws Exception {
        String admin = (String) login("admin").get("cookie");
        long older = body(call(HttpMethod.POST, "/api/admin/groups", admin, Map.of("name", "Cũ", "pinned", false))).path("id").asLong();
        long newer = body(call(HttpMethod.POST, "/api/admin/groups", admin, Map.of("name", "Mới", "pinned", false))).path("id").asLong();
        assertEquals(List.of(newer, older), ids(body(call(HttpMethod.GET, "/api/groups", admin, null))));

        call(HttpMethod.PUT, "/api/admin/groups/" + older, admin, Map.of("name", "Cũ", "pinned", true));
        JsonNode groups = body(call(HttpMethod.GET, "/api/groups", (String) login("love").get("cookie"), null));
        assertEquals(List.of(older, newer), ids(groups));
        assertTrue(groups.path(0).path("pinned").asBoolean());

        long m = body(upload(admin, Map.of("groupId", String.valueOf(older)))).path("id").asLong();
        groups = body(call(HttpMethod.GET, "/api/groups", admin, null));
        assertEquals(1, groups.path(0).path("count").asInt());
        assertTrue(groups.path(0).path("coverUrl").asText().endsWith("/t.jpg"));

        assertEquals(200, call(HttpMethod.DELETE, "/api/admin/groups/" + older, admin, null).getStatusCode().value());
        assertEquals(List.of(m), ids(body(call(HttpMethod.GET, "/api/media?ungrouped=true", admin, null))));
    }

    // ---- messages, realtime, settings ----

    @Test
    void messagesArePushedLiveToOtherTabs() throws Exception {
        String admin = (String) login("admin").get("cookie");
        String love = (String) login("love").get("cookie");
        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<java.io.InputStream> stream = client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/events"))
            .header("Cookie", admin).GET().build(), HttpResponse.BodyHandlers.ofInputStream());
        assertEquals(200, stream.statusCode());
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream.body(), StandardCharsets.UTF_8));
        CompletableFuture<String> received = CompletableFuture.supplyAsync(() -> {
            try {
                for (String line; (line = reader.readLine()) != null; ) {
                    if (line.equals("event:message")) return reader.readLine();
                }
                return null;
            } catch (java.io.IOException e) {
                throw new RuntimeException(e);
            }
        });
        Thread.sleep(300);
        JsonNode sent = body(call(HttpMethod.POST, "/api/messages", love, Map.of("body", "Em nhớ anh 💕")));
        assertEquals("love", sent.path("author").asText());
        String data = received.get(10, TimeUnit.SECONDS);
        assertEquals("Em nhớ anh 💕", json.readTree(data.substring(5)).path("body").asText());
        stream.body().close();

        assertEquals("Em nhớ anh 💕", body(call(HttpMethod.GET, "/api/messages", admin, null)).path(0).path("body").asText());
        assertEquals(400, call(HttpMethod.POST, "/api/messages", love, Map.of("body", "   ")).getStatusCode().value());
        assertEquals(400, call(HttpMethod.POST, "/api/messages", love, Map.of("body", "x".repeat(2001))).getStatusCode().value());
    }

    @Test
    void widgetShapeAndLoginBanner() throws Exception {
        String admin = (String) login("admin").get("cookie");
        String love = (String) login("love").get("cookie");
        assertEquals("heart", body(call(HttpMethod.GET, "/api/settings", love, null)).path("widgetShape").asText());
        assertEquals(400, call(HttpMethod.PUT, "/api/admin/settings", admin, Map.of("widgetShape", "<script>")).getStatusCode().value());
        call(HttpMethod.PUT, "/api/admin/settings", admin, Map.of("widgetShape", "star"));
        assertEquals("star", body(call(HttpMethod.GET, "/api/settings", love, null)).path("widgetShape").asText());
        call(HttpMethod.PUT, "/api/admin/settings", admin, Map.of("widgetShape", "auto"));
        assertEquals("auto", body(call(HttpMethod.GET, "/api/settings", love, null)).path("widgetShape").asText());

        JsonNode banner = json.readTree(rest.getForObject("/api/public/login-banner", String.class));
        assertEquals("2018-06-14", banner.path("since").asText());
        assertTrue(banner.path("imageUrl").isNull());
        long id = body(upload(admin, Map.of())).path("id").asLong();
        call(HttpMethod.PUT, "/api/admin/settings", admin, Map.of("bannerMediaId", id));
        banner = json.readTree(rest.getForObject("/api/public/login-banner", String.class));
        assertTrue(banner.path("imageUrl").asText().endsWith("/o.jpg"));
        call(HttpMethod.DELETE, "/api/admin/media/" + id, admin, null);
        assertTrue(json.readTree(rest.getForObject("/api/public/login-banner", String.class)).path("imageUrl").isNull());
    }

    @Test
    void chunkedUploadIsResumableAndChecksEveryChunk() throws Exception {
        String admin = (String) login("admin").get("cookie");
        byte[] big = new byte[2_500_000];
        new java.util.Random(7).nextBytes(big);
        JsonNode s = body(call(HttpMethod.POST, "/api/admin/uploads", admin, Map.of("contentType", "image/png", "size", big.length)));
        String id = s.path("uploadId").asText();
        int chunk = s.path("chunkSize").asInt();
        assertEquals(3, s.path("totalChunks").asInt());
        java.util.function.IntFunction<byte[]> slice = i -> java.util.Arrays.copyOfRange(big, i * chunk, Math.min(big.length, (i + 1) * chunk));

        assertEquals(200, putChunk(admin, id, 2, slice.apply(2)).getStatusCode().value());
        JsonNode st = read(putChunk(admin, id, 0, slice.apply(0)));
        assertEquals("[1]", st.path("missingChunks").toString(), "the browser resumes from what is missing");
        assertEquals("MISSING_CHUNKS", code(complete(admin, id, "image/png", Map.of())));
        assertEquals("CHUNK_SIZE_MISMATCH", code(putChunk(admin, id, 1, new byte[10])));
        assertEquals("CHUNK_SIZE_MISMATCH", code(putChunk(admin, id, 1, new byte[chunk + 1])));
        assertEquals("INVALID_CHUNK", code(putChunk(admin, id, 3, new byte[1])));
        assertEquals(200, putChunk(admin, id, 1, slice.apply(1)).getStatusCode().value());
        assertEquals(200, putChunk(admin, id, 1, slice.apply(1)).getStatusCode().value(), "re-sending a chunk is safe");

        assertEquals(202, complete(admin, id, "image/png", Map.of("caption", "Ảnh lớn")).getStatusCode().value());
        JsonNode m = body(awaitStored(admin, id));
        assertArrayEquals(big, rest.getForEntity(m.path("url").asText(), byte[].class).getBody());
        assertEquals(202, complete(admin, id, "image/png", Map.of()).getStatusCode().value(), "completing twice is harmless");
        assertEquals(1, body(call(HttpMethod.GET, "/api/media", admin, null)).path("items").size(), "and stores once");
        assertEquals(409, putChunk(admin, id, 0, slice.apply(0)).getStatusCode().value());

        assertEquals("FILE_TOO_LARGE", code(call(HttpMethod.POST, "/api/admin/uploads", admin,
            Map.of("contentType", "video/mp4", "size", 2L * 1024 * 1024 * 1024 + 1))));
        assertEquals(200, call(HttpMethod.POST, "/api/admin/uploads", admin,
            Map.of("contentType", "video/mp4", "size", 2L * 1024 * 1024 * 1024)).getStatusCode().value(), "2 GB itself is allowed");
        assertEquals(404, call(HttpMethod.GET, "/api/admin/uploads/nope", admin, null).getStatusCode().value());
        assertEquals("UPLOAD_NOT_FOUND", code(complete(admin, "nope", "image/png", Map.of())));
    }

    @Test
    void largeFileGoesToR2AsMultipart() throws Exception {
        String admin = (String) login("admin").get("cookie");
        call(HttpMethod.PUT, "/api/admin/settings", admin, Map.of("storageProvider", "R2"));
        byte[] video = new byte[11 * 1024 * 1024 + 123];
        new java.util.Random(3).nextBytes(video);
        JsonNode m = body(upload(admin, Map.of("bytes", video, "type", "video/mp4")));
        assertArrayEquals(video, rest.getForEntity(m.path("url").asText(), byte[].class).getBody(), "3 parts reassembled in order");
        HttpHeaders range = new HttpHeaders();
        range.set("Range", "bytes=6000000-6000009");
        ResponseEntity<byte[]> part = rest.exchange(m.path("url").asText(), HttpMethod.GET, new HttpEntity<>(range), byte[].class);
        assertArrayEquals(java.util.Arrays.copyOfRange(video, 6_000_000, 6_000_010), part.getBody());
    }

    // ---- helpers ----

    private Map<String, Object> login(String user) {
        ResponseEntity<Map> r = rest.postForEntity("/api/auth/login", Map.of("username", user, "password", "14062018"), Map.class);
        assertEquals(200, r.getStatusCode().value());
        String cookie = r.getHeaders().getFirst(HttpHeaders.SET_COOKIE).split(";")[0];
        Map<String, Object> m = new java.util.HashMap<>(r.getBody());
        m.put("cookie", cookie);
        return m;
    }

    private ResponseEntity<String> call(HttpMethod method, String path, String cookie, Object body) {
        HttpHeaders h = new HttpHeaders();
        if (cookie != null) h.set("Cookie", cookie);
        h.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(path, method, new HttpEntity<>(body, h), String.class);
    }

    /** The browser's flow: create a session, PUT the chunks, complete with the thumbnail, poll until stored. */
    private ResponseEntity<String> upload(String cookie, Map<String, Object> o) {
        byte[] bytes = (byte[]) o.getOrDefault("bytes", "photo".getBytes());
        String type = (String) o.getOrDefault("type", "image/jpeg");
        ResponseEntity<String> created = call(HttpMethod.POST, "/api/admin/uploads", cookie, Map.of("contentType", type, "size", bytes.length));
        if (created.getStatusCode().value() != 200) return created;
        JsonNode session = read(created);
        String id = session.path("uploadId").asText();
        int chunk = session.path("chunkSize").asInt();
        for (int i = 0; i * chunk < bytes.length; i++) {
            ResponseEntity<String> r = putChunk(cookie, id, i, java.util.Arrays.copyOfRange(bytes, i * chunk, Math.min(bytes.length, (i + 1) * chunk)));
            if (r.getStatusCode().value() != 200) return r;
        }
        ResponseEntity<String> done = complete(cookie, id, type, o);
        if (done.getStatusCode().value() != 202) return done;
        return awaitStored(cookie, id);
    }

    private ResponseEntity<String> putChunk(String cookie, String id, int index, byte[] data) {
        HttpHeaders h = new HttpHeaders();
        h.set("Cookie", cookie);
        h.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        return rest.exchange("/api/admin/uploads/" + id + "/chunks/" + index, HttpMethod.PUT, new HttpEntity<>(data, h), String.class);
    }

    private ResponseEntity<String> complete(String cookie, String id, String type, Map<String, Object> o) {
        var form = new LinkedMultiValueMap<String, Object>();
        form.add("thumb", part("thumb".getBytes(), "t.jpg", (String) o.getOrDefault("thumbType", "image/jpeg")));
        for (String k : List.of("caption", "groupId", "takenAt")) if (o.containsKey(k)) form.add(k, o.get(k));
        HttpHeaders h = new HttpHeaders();
        h.set("Cookie", cookie);
        h.setContentType(MediaType.MULTIPART_FORM_DATA);
        return rest.exchange("/api/admin/uploads/" + id + "/complete", HttpMethod.POST, new HttpEntity<>(form, h), String.class);
    }

    /** Returns the stored media as a 200, or the failure as a 502 carrying the session's error. */
    private ResponseEntity<String> awaitStored(String cookie, String id) {
        for (int i = 0; i < 200; i++) {
            JsonNode st = read(call(HttpMethod.GET, "/api/admin/uploads/" + id, cookie, null));
            switch (st.path("state").asText()) {
                case "DONE" -> {
                    return ResponseEntity.ok(st.path("media").toString());
                }
                case "FAILED" -> {
                    return ResponseEntity.status(502).body("{\"code\":\"STORE_FAILED\",\"message\":" + st.path("error") + "}");
                }
                default -> sleep(50);
            }
        }
        return fail("upload was not stored in time");
    }

    private JsonNode read(ResponseEntity<String> r) {
        try {
            return json.readTree(r.getBody());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static HttpEntity<ByteArrayResource> part(byte[] bytes, String name, String type) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.parseMediaType(type));
        return new HttpEntity<>(new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return name;
            }
        }, h);
    }

    private JsonNode body(ResponseEntity<String> r) throws Exception {
        assertEquals(200, r.getStatusCode().value(), r.getBody());
        return json.readTree(r.getBody());
    }

    private String code(ResponseEntity<String> r) {
        try {
            return json.readTree(r.getBody()).path("code").asText();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static List<Long> ids(JsonNode node) {
        JsonNode arr = node.has("items") ? node.path("items") : node;
        List<Long> out = new java.util.ArrayList<>();
        arr.forEach(n -> out.add(n.path("id").asLong()));
        return out;
    }
}
