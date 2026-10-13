package com.kira.bank.storage.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Map;

/**
 * Month-to-date R2 operation counts for a whole Cloudflare account (the free tier is per account, not per bucket),
 * read from the GraphQL Analytics API. The account's API token needs the "Account Analytics: Read" permission.
 */
@Component
public class R2OperationsClient {
    private static final String QUERY = """
        query($account: string!, $start: Time!, $end: Time!) {
          viewer { accounts(filter: {accountTag: $account}) {
            r2OperationsAdaptiveGroups(limit: 10000, filter: {datetime_geq: $start, datetime_leq: $end}) {
              sum { requests }
              dimensions { actionType }
            }
          } }
        }""";

    private final RestClient client;

    public R2OperationsClient(@Qualifier("cloudflareAiRestClient") RestClient client) {
        this.client = client;
    }

    public Counts monthToDate(String accountId, String apiToken) {
        Instant now = Instant.now();
        Instant start = YearMonth.now(ZoneOffset.UTC).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        JsonNode body = client.post().uri("https://api.cloudflare.com/client/v4/graphql")
            .headers(h -> h.setBearerAuth(apiToken))
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("query", QUERY, "variables", Map.of("account", accountId, "start", start.toString(), "end", now.toString())))
            .retrieve().body(JsonNode.class);
        if (body == null || (body.hasNonNull("errors") && !body.path("errors").isEmpty())) {
            throw new IllegalStateException("R2 analytics query rejected");
        }
        long classA = 0;
        long classB = 0;
        for (JsonNode account : body.path("data").path("viewer").path("accounts")) {
            for (JsonNode group : account.path("r2OperationsAdaptiveGroups")) {
                long requests = group.path("sum").path("requests").asLong();
                switch (operationClass(group.path("dimensions").path("actionType").asText())) {
                    case 'A' -> classA += requests;
                    case 'B' -> classB += requests;
                    default -> { }
                }
            }
        }
        return new Counts(classA, classB);
    }

    /** Cloudflare pricing: deletes and aborts are free, Get and Head reads are Class B, everything else bills as Class A. */
    static char operationClass(String actionType) {
        if (actionType.startsWith("Delete") || actionType.equals("AbortMultipartUpload")) return '-';
        if (actionType.startsWith("Get") || actionType.startsWith("Head") || actionType.equals("UsageSummary")) return 'B';
        return 'A';
    }

    public record Counts(long classA, long classB) {
    }
}
