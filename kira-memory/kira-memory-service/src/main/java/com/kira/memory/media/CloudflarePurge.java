package com.kira.memory.media;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Drops deleted media from Cloudflare's cache. Media URLs are cached for a year, so without this a deleted photo stays
 * reachable at its old URL. Off until the zone id, an API token with Zone → Cache Purge and the site URL are all set.
 * Best effort: a failed purge is logged, never thrown, because the bytes are already gone from storage.
 */
@Component
public class CloudflarePurge {
    /** Cloudflare's limit of URLs in one single-file purge request. */
    static final int MAX_URLS = 100;
    private static final Logger log = LoggerFactory.getLogger(CloudflarePurge.class);
    private final String api;
    private final String zone;
    private final String token;
    private final String site;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public CloudflarePurge(@Value("${cdn.cloudflare.api-base}") String api, @Value("${cdn.cloudflare.zone-id}") String zone,
                           @Value("${cdn.cloudflare.api-token}") String token, @Value("${cdn.cloudflare.site-url}") String site,
                           ObjectMapper json) {
        this.api = withoutTrailingSlash(api);
        this.zone = zone;
        this.token = token;
        this.site = withoutTrailingSlash(site);
        this.json = json;
    }

    /** @param urls media URLs as the API returns them: site paths ("/m/…") or absolute URLs. */
    public void purge(List<String> urls) {
        if (zone.isBlank() || token.isBlank() || site.isBlank() || urls.isEmpty()) return;
        List<String> files = urls.stream().map(u -> u.startsWith("/") ? site + u : u).toList();
        for (int i = 0; i < files.size(); i += MAX_URLS) {
            List<String> chunk = files.subList(i, Math.min(files.size(), i + MAX_URLS));
            try {
                HttpResponse<Void> r = http.send(HttpRequest.newBuilder(URI.create(api + "/zones/" + zone + "/purge_cache"))
                    .timeout(Duration.ofSeconds(20)).header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("files", chunk)))).build(),
                    HttpResponse.BodyHandlers.discarding());
                // Only the status is logged: Cloudflare's answer may echo the request.
                if (r.statusCode() / 100 != 2) log.warn("Cloudflare purge of {} URLs failed with status {}", chunk.size(), r.statusCode());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("Cloudflare purge interrupted");
                return;
            } catch (Exception e) {
                log.warn("Cloudflare purge of {} URLs failed: {}", chunk.size(), e.toString());
            }
        }
    }

    private static String withoutTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
