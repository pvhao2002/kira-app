package com.matchmind.external;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.matchmind.external.ExternalAuditService.Entry;
import com.matchmind.external.ExternalDtos.ModelRef;
import com.matchmind.external.ExternalDtos.PredictionRequest;
import com.matchmind.external.ExternalDtos.PredictionResponse;
import com.matchmind.external.ExternalDtos.ResultRequest;
import com.matchmind.external.ExternalDtos.SettleRequest;
import com.matchmind.match.MatchRepository;
import com.matchmind.match.MatchResultService;
import com.matchmind.match.MatchResultService.ResultResponse;
import com.matchmind.prediction.PredictionIngestionService;
import com.matchmind.security.Principals.ProviderPrincipal;
import com.matchmind.settlement.SettlementService;
import com.matchmind.settlement.SettlementService.MatchSettlement;
import com.matchmind.shared.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Machine-to-machine callbacks for AI agents (shared X-Api-Key + X-Provider). The body is read raw so the original payload can be
 * stored verbatim, then bound strictly: unknown fields are rejected, never silently dropped. Every call is audited.
 */
@RestController
@RequestMapping(value = "/api/v1/external", consumes = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "External AI callbacks")
@SecurityRequirement(name = "apiKey")
public class ExternalController {
    private static final int MAX_BODY_CHARS = 1_000_000;
    public static final String MODEL_HEADER = "X-Model-Name";
    public static final String MODEL_VERSION_HEADER = "X-Model-Version";
    private final PredictionIngestionService ingestion;
    private final MatchResultService resultService;
    private final SettlementService settlement;
    private final MatchRepository matches;
    private final ExternalAuditService audit;
    private final Validator validator;
    private final ObjectMapper mapper;

    @PostMapping("/predictions")
    @Operation(summary = "Insert an AI prediction (idempotent on eventId)")
    public ResponseEntity<PredictionResponse> prediction(@AuthenticationPrincipal ProviderPrincipal caller,
                                                         @RequestBody String body,
                                                         HttpServletRequest http) {
        Instant received = Instant.now();
        JsonNode raw = parse(body, caller, http, received, null);
        String eventId = raw.path("eventId").isTextual() ? raw.path("eventId").asText() : null;
        return audited(caller, http, received, eventId, () -> {
            PredictionRequest r = bind(raw, PredictionRequest.class);
            PredictionResponse response;
            try {
                response = ingestion.ingest(caller.providerId(), modelOf(http, r), r, raw);
            } catch (DataIntegrityViolationException race) {
                // A concurrent retry inserted the same eventId first: answer as a duplicate.
                response = ingestion.findDuplicate(caller.providerId(), r.eventId(), raw).orElseThrow(() -> race);
            }
            return ResponseEntity.status(response.duplicate() ? HttpStatus.OK : HttpStatus.CREATED).body(response);
        });
    }

    @PostMapping("/matches/results")
    @Operation(summary = "Insert or update the actual result of a match owned by the caller")
    public ResponseEntity<ResultResponse> results(@AuthenticationPrincipal ProviderPrincipal caller,
                                                  @RequestBody String body,
                                                  HttpServletRequest http) {
        Instant received = Instant.now();
        JsonNode raw = parse(body, caller, http, received, null);
        String eventId = raw.path("externalMatchId").isTextual() ? raw.path("externalMatchId").asText() : null;
        return audited(caller, http, received, eventId, () -> {
            ResultRequest r = bind(raw, ResultRequest.class);
            return ResponseEntity.ok(resultService.apply(caller.providerId(), r, ExternalAuditService.requestId(http)));
        });
    }

    @PostMapping("/predictions/settle")
    @Operation(summary = "Request backend settlement of a match's picks; AI calculations are stored as advisory only")
    public ResponseEntity<MatchSettlement> settle(@AuthenticationPrincipal ProviderPrincipal caller,
                                                  @RequestBody String body,
                                                  HttpServletRequest http) {
        Instant received = Instant.now();
        JsonNode raw = parse(body, caller, http, received, null);
        String eventId = raw.path("externalMatchId").isTextual() ? raw.path("externalMatchId").asText() : null;
        return audited(caller, http, received, eventId, () -> {
            SettleRequest r = bind(raw, SettleRequest.class);
            return ResponseEntity.ok(settlement.settleMatch(
                resolveMatch(caller, r.externalMatchId()), "EXTERNAL_REQUEST", null, r.aiCalculations()));
        });
    }

    /** The model named in X-Model-Name (+ optional X-Model-Version, default "1") wins over {@code model} in the body. */
    static ModelRef modelOf(HttpServletRequest http, PredictionRequest r) {
        String name = http.getHeader(MODEL_HEADER);
        if (name == null || name.isBlank()) {
            if (r.model() == null) {
                throw ApiException.badRequest("MODEL_REQUIRED", "Send the model name in the X-Model-Name header");
            }
            return new ModelRef(r.model().name().trim(), r.model().version().trim());
        }
        String version = http.getHeader(MODEL_VERSION_HEADER);
        ModelRef ref = new ModelRef(name.trim(), version == null || version.isBlank() ? "1" : version.trim());
        if (ref.name().length() > 128 || ref.version().length() > 64) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MODEL_HEADER", "Model name or version is too long",
                Map.of(MODEL_HEADER, "max 128 characters", MODEL_VERSION_HEADER, "max 64 characters"));
        }
        return ref;
    }

    private java.util.UUID resolveMatch(ProviderPrincipal caller, String externalMatchId) {
        return matches.findByProviderIdAndExternalMatchId(caller.providerId(), externalMatchId).map(m -> m.getId())
            .orElseThrow(() -> ApiException.notFound("MATCH_NOT_FOUND", "No match with this externalMatchId exists for your provider"));
    }

    private <T> ResponseEntity<T> audited(ProviderPrincipal caller, HttpServletRequest http, Instant received,
                                          String eventId, Supplier<ResponseEntity<T>> work) {
        try {
            ResponseEntity<T> response = work.get();
            boolean duplicate = response.getBody() instanceof PredictionResponse p && p.duplicate();
            audit.record(http, received, new Entry(caller.providerId(), eventId,
                response.getStatusCode().value(), duplicate ? "DUPLICATE" : "SUCCESS", summary(response.getBody()), null));
            return response;
        } catch (ApiException e) {
            JsonNode fields = e.getFieldErrors().isEmpty() ? null : mapper.valueToTree(Map.of("fieldErrors", e.getFieldErrors()));
            audit.record(http, received, new Entry(caller.providerId(), eventId, e.getStatus().value(),
                e.getStatus().is4xxClientError() ? "REJECTED" : "FAILED", fields, e.getCode() + ": " + e.getMessage()));
            throw e;
        } catch (RuntimeException e) {
            int status = statusOf(e);
            audit.record(http, received, new Entry(caller.providerId(), eventId, status,
                status < 500 ? "REJECTED" : "FAILED", null, "Unexpected error (" + e.getClass().getSimpleName() + ")"));
            throw e;
        }
    }

    /** Same status GlobalExceptionHandler answers with, so the API log shows what the provider saw. */
    private static int statusOf(RuntimeException e) {
        if (e instanceof DataIntegrityViolationException || e instanceof OptimisticLockingFailureException) return 409;
        if (e instanceof IllegalArgumentException || e instanceof jakarta.validation.ConstraintViolationException) return 400;
        return 500;
    }

    private JsonNode summary(Object body) {
        if (body == null) return null;
        JsonNode tree = mapper.valueToTree(body);
        if (tree instanceof ObjectNode o && o.has("settlement") && o.get("settlement").isObject()) {
            ((ObjectNode) o.get("settlement")).remove("picks");
        }
        return tree;
    }

    private JsonNode parse(String body, ProviderPrincipal caller, HttpServletRequest http, Instant received, String eventId) {
        try {
            if (body == null || body.isBlank() || body.length() > MAX_BODY_CHARS) throw new IllegalArgumentException();
            JsonNode node = mapper.readTree(body);
            if (node == null || !node.isObject()) throw new IllegalArgumentException();
            return node;
        } catch (JsonProcessingException | IllegalArgumentException e) {
            ApiException error = ApiException.badRequest("MALFORMED_REQUEST", "Body must be a JSON object (max 1 MB)");
            audit.record(http, received, new Entry(caller.providerId(), eventId, 400, "REJECTED", null,
                error.getMessage()));
            throw error;
        }
    }

    private <T> T bind(JsonNode raw, Class<T> type) {
        T value;
        try {
            value = mapper.copy().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
                .treeToValue(raw, type);
        } catch (UnrecognizedPropertyException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UNKNOWN_FIELD", "Unknown field '" + e.getPropertyName() + "'",
                Map.of(path(e), "unknown field"));
        } catch (com.fasterxml.jackson.databind.JsonMappingException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FIELD_TYPE", "A field has the wrong type or format",
                Map.of(path(e), "wrong type or format"));
        } catch (JsonProcessingException e) {
            throw ApiException.badRequest("MALFORMED_REQUEST", "Body could not be read");
        }
        Set<ConstraintViolation<T>> violations = validator.validate(value);
        if (!violations.isEmpty()) {
            Map<String, String> fields = new LinkedHashMap<>();
            violations.forEach(v -> fields.putIfAbsent(v.getPropertyPath().toString(), v.getMessage()));
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Payload validation failed", fields);
        }
        return value;
    }

    private static String path(com.fasterxml.jackson.databind.JsonMappingException e) {
        StringBuilder b = new StringBuilder();
        for (var ref : e.getPath()) {
            if (ref.getFieldName() != null) b.append(b.isEmpty() ? "" : ".").append(ref.getFieldName());
            else b.append('[').append(ref.getIndex()).append(']');
        }
        return b.isEmpty() ? "body" : b.toString();
    }
}
