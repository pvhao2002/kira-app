package com.kira.farm.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.farm.it.Api.Res;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/** Image upload: magic bytes decide the type, names are random, only the right people may upload, files are public. */
class MediaUploadIT extends IntegrationTestBase {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String NAME_URL = "^/api/v1/files/[0-9a-f-]{36}\\.png$";
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 1, 2, 3, 4};

    private Res upload(String path, String token, byte[] content, String filename, String contentType) {
        HttpHeaders partHeaders = new HttpHeaders();
        partHeaders.setContentType(MediaType.parseMediaType(contentType));
        ByteArrayResource resource = new ByteArrayResource(content) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new HttpEntity<>(resource, partHeaders));
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.MULTIPART_FORM_DATA);
        if (token != null) h.setBearerAuth(token);
        ResponseEntity<String> r = rest.exchange(path, HttpMethod.POST, new HttpEntity<>(body, h), String.class);
        try {
            JsonNode json = r.getBody() == null || r.getBody().isBlank() ? JSON.createObjectNode() : JSON.readTree(r.getBody());
            return new Res(r.getStatusCode().value(), json, r.getHeaders());
        } catch (Exception e) {
            throw new IllegalStateException("Non-JSON response " + r.getStatusCode(), e);
        }
    }

    private Res productUpload(String token, byte[] content, String filename, String contentType) {
        return upload("/api/v1/admin/media/products", token, content, filename, contentType);
    }

    @Test
    void storesUnderARandomNameFromTheMagicBytesAndServesItPublicly() {
        String manager = staffToken("MANAGER", Q7);
        Res a = productUpload(manager, PNG, "../../evil.svg", "image/svg+xml");
        assertEquals(201, a.status(), a.json().toString());
        String url = a.str("url");
        assertTrue(url.matches(NAME_URL), url);
        assertNotEquals(url, productUpload(manager, PNG, "../../evil.svg", "image/svg+xml").str("url"));

        ResponseEntity<byte[]> file = rest.getForEntity(url, byte[].class); // no token: public
        assertEquals(200, file.getStatusCode().value());
        assertArrayEquals(PNG, file.getBody());
        assertEquals(MediaType.IMAGE_PNG, file.getHeaders().getContentType());
        assertEquals("nosniff", file.getHeaders().getFirst("X-Content-Type-Options"));
        String cache = String.valueOf(file.getHeaders().getCacheControl());
        assertTrue(cache.contains("public") && cache.contains("max-age=31536000") && cache.contains("immutable"), cache);
    }

    @Test
    void rejectsWrongMagicBytesEmptyAndOversizedFiles() {
        String manager = staffToken("MANAGER", Q7);
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes(StandardCharsets.UTF_8);
        Res bad = productUpload(manager, svg, "x.png", "image/png"); // claims PNG, is not
        assertEquals(415, bad.status());
        assertEquals("UNSUPPORTED_IMAGE", bad.code());
        assertEquals(400, productUpload(manager, new byte[0], "x.png", "image/png").status());

        byte[] big = new byte[5 * 1024 * 1024 + 1];
        System.arraycopy(PNG, 0, big, 0, PNG.length);
        Res tooBig = productUpload(manager, big, "big.png", "image/png");
        assertEquals(413, tooBig.status());
    }

    @Test
    void staffAndAnonymousCannotUploadProductImages() {
        assertEquals(403, productUpload(staffToken("STAFF", Q7), PNG, "a.png", "image/png").status());
        assertEquals(401, productUpload(null, PNG, "a.png", "image/png").status());
        assertEquals(201, productUpload(staffToken("ADMIN"), PNG, "a.png", "image/png").status());
    }

    @Test
    void reviewPhotosNeedADeliveredOrderAndMustBeOurOwnUrls() {
        Customer c = newCustomer();
        Res denied = upload("/api/v1/media/reviews", c.token(), PNG, "a.png", "image/png");
        assertEquals(403, denied.status());
        assertEquals("MEDIA_NOT_ALLOWED", denied.code());

        long productId = newProduct(Q7, 25_000, 5);
        assertEquals(201, checkout(c, productId, 1).status());
        long orderId = jdbc.queryForObject("SELECT id FROM orders WHERE user_id=?", Long.class, c.id());
        jdbc.update("UPDATE orders SET status='DELIVERED' WHERE id=?", orderId);

        Res ok = upload("/api/v1/media/reviews", c.token(), PNG, "a.png", "image/png");
        assertEquals(201, ok.status(), ok.json().toString());
        String url = ok.str("url");

        Res external = api.post("/api/v1/reviews", c.token(), Api.map("orderId", orderId, "productId", productId,
            "rating", 5, "photoUrl", "https://evil.example/x.png"));
        assertEquals(400, external.status());
        Res missing = api.post("/api/v1/reviews", c.token(), Api.map("orderId", orderId, "productId", productId,
            "rating", 5, "photoUrl", "/api/v1/files/00000000-0000-0000-0000-000000000000.png"));
        assertEquals(422, missing.status());
        Res review = api.post("/api/v1/reviews", c.token(), Api.map("orderId", orderId, "productId", productId,
            "rating", 5, "photoUrl", url));
        assertEquals(201, review.status(), review.json().toString());
        assertEquals(url, review.str("photoUrl"));
    }

    @Test
    void unknownOrMaliciousFileNamesAre404() {
        for (String name : new String[]{"00000000-0000-0000-0000-000000000000.png", "evil.svg",
            "00000000-0000-0000-0000-000000000000.svg"}) {
            assertEquals(404, rest.getForEntity("/api/v1/files/" + name, String.class).getStatusCode().value(), name);
        }
        // the encoded slash may be rejected by the firewall (400) before it reaches the controller (404); never 200
        int traversal = rest.getForEntity("/api/v1/files/..%2F..%2Fapplication.yml", String.class).getStatusCode().value();
        assertTrue(traversal == 404 || traversal == 400, "traversal -> " + traversal);
    }

    @Test
    void jpegAndWebpAreStoredWithTheirOwnExtensionAndContentType() {
        String manager = staffToken("MANAGER", Q7);
        byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0, 1, 2, 3, 4, 5};
        byte[] webp = {'R', 'I', 'F', 'F', 1, 2, 3, 4, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' '};
        assertTypeServed(manager, jpeg, ".jpg", MediaType.IMAGE_JPEG);
        assertTypeServed(manager, webp, ".webp", MediaType.parseMediaType("image/webp"));
    }

    private void assertTypeServed(String token, byte[] content, String ext, MediaType type) {
        Res r = productUpload(token, content, "x.png", "image/png"); // client name and type are ignored
        assertEquals(201, r.status(), r.json().toString());
        String url = r.str("url");
        assertTrue(url.endsWith(ext), url);
        ResponseEntity<byte[]> file = rest.getForEntity(url, byte[].class);
        assertEquals(type, file.getHeaders().getContentType());
        assertArrayEquals(content, file.getBody());
    }

    @Test
    void anonymousCannotUploadReviewPhotos() {
        assertEquals(401, upload("/api/v1/media/reviews", null, PNG, "a.png", "image/png").status());
    }

    @Test
    void uploadsAreRateLimitedPerUser() {
        String manager = staffToken("MANAGER", Q7);
        for (int i = 0; i < 20; i++) assertEquals(201, productUpload(manager, PNG, "a.png", "image/png").status());
        Res blocked = productUpload(manager, PNG, "a.png", "image/png");
        assertEquals(429, blocked.status());
        assertEquals("UPLOAD_RATE_LIMITED", blocked.code());
    }
}
