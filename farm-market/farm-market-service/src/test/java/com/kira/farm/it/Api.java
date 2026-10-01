package com.kira.farm.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

import java.util.Map;

/** Tiny JSON-over-HTTP helper for the ITs: never throws on 4xx/5xx, always hands back status + parsed body. */
public final class Api {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final TestRestTemplate http;

    public Api(TestRestTemplate http) {
        this.http = http;
    }

    public record Res(int status, JsonNode json, HttpHeaders headers) {
        /** Stable machine-readable error code of an error body. */
        public String code() {
            return json.path("code").asText();
        }

        public String str(String field) {
            return json.path(field).asText();
        }

        public long num(String field) {
            return json.path(field).asLong();
        }

        /** Value of a Set-Cookie header with the given name, or null. */
        public String cookie(String name) {
            var cookies = headers.get(HttpHeaders.SET_COOKIE);
            if (cookies == null) return null;
            for (String c : cookies) if (c.startsWith(name + "=")) return c.substring(name.length() + 1, c.indexOf(';'));
            return null;
        }
    }

    public Res get(String path, String token) {
        return call(HttpMethod.GET, path, token, null, Map.of());
    }

    public Res post(String path, String token, Object body) {
        return call(HttpMethod.POST, path, token, body, Map.of());
    }

    public Res post(String path, String token, Object body, Map<String, String> headers) {
        return call(HttpMethod.POST, path, token, body, headers);
    }

    public Res put(String path, String token, Object body) {
        return call(HttpMethod.PUT, path, token, body, Map.of());
    }

    public Res call(HttpMethod method, String path, String token, Object body, Map<String, String> extra) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) h.setBearerAuth(token);
        extra.forEach(h::set);
        var r = http.exchange(path, method, new HttpEntity<>(body, h), String.class);
        JsonNode json;
        try {
            json = r.getBody() == null || r.getBody().isBlank() ? JSON.createObjectNode() : JSON.readTree(r.getBody());
        } catch (Exception e) {
            throw new IllegalStateException("Non-JSON response " + r.getStatusCode() + ": " + r.getBody(), e);
        }
        return new Res(r.getStatusCode().value(), json, r.getHeaders());
    }

    public static Map<String, Object> map(Object... kv) {
        var m = new java.util.LinkedHashMap<String, Object>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }
}
