package com.matchmind.external;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.matchmind.external.ExternalAuditService.Entry;
import com.matchmind.external.ExternalDtos.ModelRef;
import com.matchmind.external.ExternalDtos.PredictionRequest;
import com.matchmind.external.ExternalDtos.PredictionResponse;
import com.matchmind.external.ExternalDtos.ResultRequest;
import com.matchmind.external.ExternalDtos.SettleRequest;
import com.matchmind.match.MatchResultService;
import com.matchmind.match.MatchResultService.ResultResponse;
import com.matchmind.prediction.PredictionEvents;
import com.matchmind.prediction.PredictionEvents.NewPrediction;
import com.matchmind.prediction.PredictionIngestionService;
import com.matchmind.provider.ProviderKeyService;
import com.matchmind.provider.ProviderService;
import com.matchmind.security.Principals.ProviderPrincipal;
import com.matchmind.settlement.SettlementService;
import com.matchmind.settlement.SettlementService.MatchSettlement;
import com.matchmind.settlement.SettlementService.UnsettledMatch;
import com.matchmind.shared.ApiException;
import com.matchmind.shared.TextRules;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Machine-to-machine callbacks for AI agents (per-provider X-Api-Key, or the legacy shared key + X-Provider). The body is read raw so the original payload can be
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
    /** Query-string fallbacks for agents that cannot set custom headers (e.g. ChatGPT Actions). */
    public static final String MODEL_PARAM = "model";
    public static final String MODEL_VERSION_PARAM = "modelVersion";
    private final PredictionIngestionService ingestion;
    private final MatchResultService resultService;
    private final SettlementService settlement;
    private final ExternalAuditService audit;
    private final PredictionEvents events;
    private final Validator validator;
    private final ObjectMapper mapper;
    private final ProviderService providers;

    /** A provider whose first request is rejected has no row yet (UX-077): its audit entry carries no provider. */
    private UUID auditedProvider(ProviderPrincipal caller) {
        return providers.exists(caller.providerId()) ? caller.providerId() : null;
    }

    @PostMapping("/predictions")
    @Operation(summary = "Insert an AI prediction (idempotent on eventId)")
    public ResponseEntity<PredictionResponse> prediction(@AuthenticationPrincipal ProviderPrincipal caller,
                                                         @RequestBody String body,
                                                         HttpServletRequest http) {
        return submitPrediction(caller, headerOrParam(http, MODEL_HEADER, MODEL_PARAM),
            headerOrParam(http, MODEL_VERSION_HEADER, MODEL_VERSION_PARAM), body, http);
    }

    private static String headerOrParam(HttpServletRequest http, String header, String param) {
        String value = http.getHeader(header);
        return value == null || value.isBlank() ? http.getParameter(param) : value;
    }

    /**
     * The whole prediction callback: strict binding, ingest, audit and the live event. Also used by the admin import
     * of JSON an agent printed because it could not reach the API.
     */
    public ResponseEntity<PredictionResponse> submitPrediction(ProviderPrincipal caller, String modelName,
                                                               String modelVersion, String body, HttpServletRequest http) {
        Instant received = Instant.now();
        JsonNode raw = parse(body, caller, http, received, null);
        String eventId = raw.path("eventId").isTextual() ? raw.path("eventId").asText() : null;
        return audited(caller, http, received, eventId, () -> {
            requireScope(caller, ProviderKeyService.PREDICTIONS);
            providers.requireEnabled(caller.providerId()); // the admin import does not pass the key filter
            PredictionRequest r = bind(raw, PredictionRequest.class);
            ModelRef model = modelOf(modelName, modelVersion, r);
            PredictionResponse response;
            try {
                response = ingestion.ingest(caller.providerId(), caller.providerCode(), model, r, raw);
            } catch (DataIntegrityViolationException race) {
                // A concurrent retry inserted the same eventId first: answer as a duplicate.
                response = ingestion.findDuplicate(caller.providerId(), r, raw).orElseThrow(() -> race);
            }
            if (!response.duplicate()) { // ingest has committed: browsers can already load it
                events.published(new NewPrediction(response.predictionId(), response.matchId(), r.match().homeTeam(),
                    r.match().awayTeam(), ingestion.modelNameOf(response.predictionId(), model.name()),
                    r.predictionType()));
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
        return audited(caller, http, received, matchRef(raw), () -> {
            requireScope(caller, ProviderKeyService.RESULTS);
            ResultRequest r = bind(raw, ResultRequest.class);
            // Only a per-provider key (it holds RESULTS here) is trusted to share across providers; the legacy key is not.
            return ResponseEntity.ok(resultService.apply(caller.providerId(), r, ExternalAuditService.requestId(http),
                caller.apiKeyId() != null));
        });
    }

    /** The Google Sheet SETTLE tab: matches of every provider still waiting for a result. Trusted results keys only. */
    @GetMapping(value = "/matches/unsettled", consumes = MediaType.ALL_VALUE)
    @Operation(summary = "List matches (all providers) with pending picks whose kick-off was over 2 hours ago")
    public ResponseEntity<List<UnsettledMatch>> unsettled(@AuthenticationPrincipal ProviderPrincipal caller,
                                                          HttpServletRequest http) {
        return audited(caller, http, Instant.now(), null, () -> {
            requireScope(caller, ProviderKeyService.RESULTS);
            if (caller.apiKeyId() == null) { // the legacy shared key is not a trusted source
                throw new ApiException(HttpStatus.FORBIDDEN, "SCOPE_REQUIRED",
                    "Only a per-provider key with the RESULTS scope may list every provider's matches");
            }
            return ResponseEntity.ok(settlement.unsettledMatches());
        });
    }

    @PostMapping("/predictions/settle")
    @Operation(summary = "Request backend settlement of a match's picks; AI calculations are stored as advisory only")
    public ResponseEntity<MatchSettlement> settle(@AuthenticationPrincipal ProviderPrincipal caller,
                                                  @RequestBody String body,
                                                  HttpServletRequest http) {
        Instant received = Instant.now();
        JsonNode raw = parse(body, caller, http, received, null);
        return audited(caller, http, received, matchRef(raw), () -> {
            requireScope(caller, ProviderKeyService.SETTLE_REQUEST);
            SettleRequest r = bind(raw, SettleRequest.class);
            UUID matchId = resultService.matchIdOf(caller.providerId(), r.externalMatchId(), r.matchId(), r.predictionId());
            return ResponseEntity.ok(settlement.settleMatch(matchId, "EXTERNAL_REQUEST", null, r.aiCalculations()));
        });
    }

    /** A per-provider key calls only what its scopes allow (RESULTS is granted by an admin to trusted feeders). */
    private static void requireScope(ProviderPrincipal caller, String scope) {
        if (!caller.scopes().contains(scope)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "SCOPE_REQUIRED",
                "This API key may not call this endpoint: it needs the " + scope + " scope");
        }
    }

    /** The id the API log shows for a results or settle call: whichever of the three match ids was sent. */
    private static String matchRef(JsonNode raw) {
        for (String field : new String[]{"externalMatchId", "matchId", "predictionId"}) {
            JsonNode v = raw.path(field);
            if (v.isTextual()) return v.asText(); // the audit truncates it
        }
        return null;
    }

    /** The model named in X-Model-Name (+ optional X-Model-Version, default "1") wins over {@code model} in the body. */
    static ModelRef modelOf(String name, String version, PredictionRequest r) {
        String headerName = TextRules.clean(name);
        if (headerName == null || headerName.isEmpty()) {
            ModelRef body = r.model() == null ? null
                : new ModelRef(TextRules.clean(r.model().name()), TextRules.clean(r.model().version()));
            if (body == null || body.name().isEmpty() || body.version().isEmpty()) {
                throw ApiException.badRequest("MODEL_REQUIRED", "Send the model name in the X-Model-Name header");
            }
            return body;
        }
        String headerVersion = TextRules.clean(version);
        ModelRef ref = new ModelRef(headerName, headerVersion == null || headerVersion.isEmpty() ? "1" : headerVersion);
        if (ref.name().length() > 128 || ref.version().length() > 64) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MODEL_HEADER", "Model name or version is too long",
                Map.of(MODEL_HEADER, "max 128 characters", MODEL_VERSION_HEADER, "max 64 characters"));
        }
        return ref;
    }

    private <T> ResponseEntity<T> audited(ProviderPrincipal caller, HttpServletRequest http, Instant received,
                                          String eventId, Supplier<ResponseEntity<T>> work) {
        try {
            ResponseEntity<T> response = work.get();
            boolean duplicate = response.getBody() instanceof PredictionResponse p && p.duplicate();
            audit.record(http, received, new Entry(auditedProvider(caller), eventId,
                response.getStatusCode().value(), duplicate ? "DUPLICATE" : "SUCCESS", summary(response.getBody()), null));
            return response;
        } catch (ApiException e) {
            JsonNode fields = e.getFieldErrors().isEmpty() ? null : mapper.valueToTree(Map.of("fieldErrors", e.getFieldErrors()));
            audit.record(http, received, new Entry(auditedProvider(caller), eventId, e.getStatus().value(),
                e.getStatus().is4xxClientError() ? "REJECTED" : "FAILED", fields, e.getCode() + ": " + e.getMessage()));
            throw e;
        } catch (RuntimeException e) {
            int status = statusOf(e);
            audit.record(http, received, new Entry(auditedProvider(caller), eventId, status,
                status < 500 ? "REJECTED" : "FAILED", null, "Unexpected error (" + e.getClass().getSimpleName() + ")"));
            throw e;
        }
    }

    /** Same status GlobalExceptionHandler answers with, so the API log shows what the provider saw. */
    private static int statusOf(RuntimeException e) {
        if (e instanceof DataIntegrityViolationException || e instanceof OptimisticLockingFailureException) return 409;
        if (e instanceof IllegalArgumentException || e instanceof ConstraintViolationException) return 400;
        return 500;
    }

    private JsonNode summary(Object body) {
        if (body == null) return null;
        if (body instanceof List<?> list) return mapper.valueToTree(Map.of("count", list.size())); // not the whole list
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
            audit.record(http, received, new Entry(auditedProvider(caller), eventId, 400, "REJECTED", null,
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
        } catch (JsonMappingException e) {
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

    private static String path(JsonMappingException e) {
        StringBuilder b = new StringBuilder();
        for (var ref : e.getPath()) {
            if (ref.getFieldName() != null) b.append(b.isEmpty() ? "" : ".").append(ref.getFieldName());
            else b.append('[').append(ref.getIndex()).append(']');
        }
        return b.isEmpty() ? "body" : b.toString();
    }
}
