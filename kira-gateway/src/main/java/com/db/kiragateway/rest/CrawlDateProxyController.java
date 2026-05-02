package com.db.kiragateway.rest;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/crawl-dates")
public class CrawlDateProxyController {

    private final RestClient dataManagerRestClient;
    private final RestClient kiraProducerRestClient;

    public CrawlDateProxyController(
            @Qualifier("dataManagerRestClient") RestClient dataManagerRestClient,
            @Qualifier("kiraProducerRestClient") RestClient kiraProducerRestClient) {
        this.dataManagerRestClient = dataManagerRestClient;
        this.kiraProducerRestClient = kiraProducerRestClient;
    }

    @GetMapping
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDir
    ) {
        UriComponentsBuilder b = UriComponentsBuilder.fromPath("/crawl-dates")
                .queryParam("page", page)
                .queryParam("size", size);
        if (emptyToNull(status) != null) {
            b.queryParam("status", status.trim());
        }
        if (emptyToNull(date) != null) {
            b.queryParam("date", date.trim());
        }
        if (emptyToNull(dateFrom) != null) {
            b.queryParam("dateFrom", dateFrom.trim());
        }
        if (emptyToNull(dateTo) != null) {
            b.queryParam("dateTo", dateTo.trim());
        }
        if (emptyToNull(sortBy) != null) {
            b.queryParam("sortBy", sortBy.trim());
        }
        if (emptyToNull(sortDir) != null) {
            b.queryParam("sortDir", sortDir.trim());
        }
        URI uri = b.build(true).toUri();

        try {
            Map<String, Object> body = dataManagerRestClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(Map.class);
            return ResponseEntity.ok(body);
        } catch (RestClientResponseException ex) {
            Object errBody = ex.getResponseBodyAs(Map.class);
            return ResponseEntity.status(ex.getStatusCode()).body(errBody != null ? errBody : Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/{date}/requeue")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> requeue(@PathVariable String date) {
        try {
            Map<String, Object> body = kiraProducerRestClient.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/producer/crawl-dates/{date}/requeue")
                            .build(date))
                    .retrieve()
                    .body(Map.class);
            return ResponseEntity.ok(body);
        } catch (RestClientResponseException ex) {
            Object errBody = ex.getResponseBodyAs(Map.class);
            return ResponseEntity.status(ex.getStatusCode()).body(errBody != null ? errBody : Map.of("message", ex.getMessage()));
        }
    }

    private static String emptyToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
