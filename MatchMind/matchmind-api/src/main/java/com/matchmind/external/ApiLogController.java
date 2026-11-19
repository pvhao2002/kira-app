package com.matchmind.external;

import com.fasterxml.jackson.databind.JsonNode;
import com.matchmind.shared.ApiException;
import com.matchmind.shared.ApiTypes.PageResponse;
import com.matchmind.shared.Paging;
import com.matchmind.shared.Sql;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Read-only view of the callback audit trail. Rows never contain API keys or auth headers. */
@RestController
@RequestMapping("/api/v1/api-logs")
@RequiredArgsConstructor
@Tag(name = "API logs")
public class ApiLogController {
    private final NamedParameterJdbcTemplate jdbc;
    private final ExternalApiRequestRepository requests;

    private static final String COLUMNS = """
        SELECT r.id AS "id", r.received_at AS "receivedAt", r.provider_id AS "providerId", pv.name AS "providerName",
               r.endpoint AS "endpoint", r.http_method AS "httpMethod", r.request_id AS "requestId", r.event_id AS "eventId",
               r.http_status AS "httpStatus", r.request_status AS "requestStatus", r.duration_ms AS "durationMs",
               r.error_message AS "errorMessage", r.client_ip AS "clientIp"
        FROM external_api_requests r LEFT JOIN providers pv ON pv.id = r.provider_id
        """;

    private static final Map<String, String> SORT = Map.of("receivedAt", "r.received_at", "durationMs", "r.duration_ms",
        "httpStatus", "r.http_status", "endpoint", "r.endpoint");

    @GetMapping
    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> list(@RequestParam(required = false) UUID providerId,
                                                  @RequestParam(required = false) String status,
                                                  @RequestParam(required = false) String endpoint,
                                                  @RequestParam(required = false) Integer httpStatus,
                                                  @RequestParam(required = false) String search,
                                                  @RequestParam(required = false) Instant from,
                                                  @RequestParam(required = false) Instant to,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size,
                                                  @RequestParam(required = false) String sort) {
        int pg = Paging.page(page), sz = Paging.size(size);
        Sql.Where w = new Sql.Where()
            .and("r.provider_id = :providerId", "providerId", providerId)
            .and("r.request_status = :status", "status", status)
            .and("r.endpoint = :endpoint", "endpoint", endpoint)
            .and("r.http_status = :httpStatus", "httpStatus", httpStatus)
            .and("(r.event_id ILIKE :q OR r.request_id ILIKE :q OR r.error_message ILIKE :q)", "q",
                search == null || search.isBlank() ? null : Paging.contains(search))
            .and("r.received_at >= :from", "from", from)
            .and("r.received_at < :to", "to", to);
        long total = jdbc.queryForObject("SELECT count(*) FROM external_api_requests r" + w.sql(), w.params, Long.class);
        Paging.limit(w.params, pg, sz);
        List<Map<String, Object>> rows = jdbc.query(COLUMNS + w.sql() + " ORDER BY "
            + Paging.orderBy(sort, SORT, "r.received_at DESC") + ", r.id LIMIT :limit OFFSET :offset", w.params, Sql.ROW);
        return Paging.response(rows, pg, sz, total);
    }

    @GetMapping("/endpoints")
    public List<String> endpoints() {
        return jdbc.queryForList("SELECT DISTINCT endpoint FROM external_api_requests ORDER BY endpoint", Map.of(), String.class);
    }

    public record LogDetail(UUID id, Instant receivedAt, UUID providerId, UUID apiKeyId, String requestId, String eventId,
                            String endpoint, String httpMethod, int httpStatus, String requestStatus,
                            JsonNode processingResult, String errorMessage, String clientIp, int durationMs) {
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public LogDetail detail(@PathVariable UUID id) {
        ExternalApiRequest r = requests.findById(id).orElseThrow(() -> ApiException.notFound("LOG_NOT_FOUND", "Log entry not found"));
        return new LogDetail(r.getId(), r.getReceivedAt(), r.getProviderId(), r.getApiKeyId(), r.getRequestId(), r.getEventId(),
            r.getEndpoint(), r.getHttpMethod(), r.getHttpStatus(), r.getRequestStatus(), r.getProcessingResult(),
            r.getErrorMessage(), r.getClientIp(), r.getDurationMs());
    }
}
