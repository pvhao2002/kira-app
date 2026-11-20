package com.matchmind.external;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

/** Request/response contracts of the three external callback APIs (see docs/API_DOCUMENTATION.md). */
public final class ExternalDtos {
    public static final String MARKETS = "1X2|AH|OU|CORNER_AH|CORNER_OU";
    public static final String STAGES = "OPENING|PRE_MATCH|LIVE";
    public static final String PICKS = "HOME|DRAW|AWAY|OVER|UNDER";
    public static final String BASIS = "FULL_MATCH|REMAINING_MATCH";
    public static final String RESULTS = "WIN|LOSS|HALF_WIN|HALF_LOSS|PUSH|VOID|PENDING";
    private static final String ID = "^[A-Za-z0-9._:-]{1,128}$";

    private ExternalDtos() {
    }

    public record Pair(@NotNull @Min(0) @Max(99) Integer home, @NotNull @Min(0) @Max(99) Integer away) {
        /** Hands both sides to the setters; an absent pair leaves them untouched. */
        public static void apply(Pair p, Consumer<Integer> home, Consumer<Integer> away) {
            if (p == null) return;
            home.accept(p.home());
            away.accept(p.away());
        }
    }

    public record PossessionPair(@NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal home,
                                 @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal away) {
    }

    public record ExpectedPair(@NotNull @DecimalMin("0") @DecimalMax("50") BigDecimal home,
                               @NotNull @DecimalMin("0") @DecimalMax("50") BigDecimal away) {
    }

    public record ModelRef(@NotBlank @Size(max = 128) String name, @NotBlank @Size(max = 64) String version) {
    }

    /**
     * Predictions may only report pre-match or in-play status; terminal statuses come from the results API. Only the
     * teams are required: agents reading a screenshot have no match id, and a LIVE screen shows the minute, not the
     * kick-off time.
     */
    public record MatchInfo(@Pattern(regexp = ID) String externalMatchId, // absent: matched by teams and kick-off
                            @Size(max = 160) String league,
                            @NotBlank @Size(max = 160) String homeTeam,
                            @NotBlank @Size(max = 160) String awayTeam,
                            Instant startTime, // absent: estimated from the match minute
                            @Pattern(regexp = "SCHEDULED|LIVE") String status) {
    }

    public record OddsInput(@NotBlank @Pattern(regexp = "^[A-Za-z0-9._:-]{1,64}$") String ref,
                            @NotBlank @Pattern(regexp = MARKETS) String market,
                            @NotBlank @Pattern(regexp = STAGES) String stage,
                            @Min(1) @Max(10_000) Integer snapshotOrder,
                            @DecimalMin("-20") @DecimalMax("50") BigDecimal line,
                            @Size(max = 32) String lineDisplay,
                            @DecimalMin(value = "1", inclusive = false) @DecimalMax("1000") BigDecimal homeOdds,
                            @DecimalMin(value = "1", inclusive = false) @DecimalMax("1000") BigDecimal drawOdds,
                            @DecimalMin(value = "1", inclusive = false) @DecimalMax("1000") BigDecimal awayOdds,
                            @DecimalMin(value = "1", inclusive = false) @DecimalMax("1000") BigDecimal overOdds,
                            @DecimalMin(value = "1", inclusive = false) @DecimalMax("1000") BigDecimal underOdds,
                            @Pattern(regexp = BASIS) String settlementBasis,
                            @Valid Pair scoreAtCapture,
                            @Valid Pair cornersAtCapture,
                            Instant capturedAt,
                            JsonNode extra) {
    }

    public record StatsInput(@Valid PossessionPair possession, @Valid Pair shots, @Valid Pair shotsOnTarget,
                             @Valid Pair shotsOffTarget, @Valid Pair corners, @Valid Pair yellowCards,
                             @Valid Pair redCards, JsonNode extra) {
    }

    public record SimulationInput(@Size(max = 64) String method,
                                  @Min(1) @Max(10_000_000) Integer simulationCount,
                                  Long randomSeed,
                                  @Valid ExpectedPair expectedRemainingGoals,
                                  @Valid ExpectedPair expectedRemainingCorners,
                                  @Size(max = 64) String algorithmVersion,
                                  JsonNode parameters,
                                  JsonNode probabilities,
                                  JsonNode correctScoreDistribution) {
    }

    public record PickInput(@NotBlank @Size(max = 64) String oddsRef,
                            @NotBlank @Pattern(regexp = MARKETS) String market,
                            @NotBlank @Pattern(regexp = PICKS) String pick,
                            @NotNull @DecimalMin("0") @DecimalMax("1") BigDecimal probability,
                            @NotNull @Min(1) @Max(50) Integer rank) {
    }

    public record CorrectScoreInput(@NotNull @Min(0) @Max(30) Integer home, @NotNull @Min(0) @Max(30) Integer away,
                                    @DecimalMin("0") @DecimalMax("1") BigDecimal probability) {
    }

    public record PredictionRequest(@Pattern(regexp = ID) String eventId, // absent: derived from the payload
                                    @Valid ModelRef model, // optional: the X-Model-Name header wins
                                    @NotNull @Valid MatchInfo match,
                                    @NotBlank @Pattern(regexp = "PRE_MATCH|LIVE") String predictionType,
                                    Instant predictedAt, // absent: the time the server received it
                                    @Min(0) @Max(150) Integer matchMinute,
                                    @Valid Pair currentScore,
                                    @Valid Pair currentCorners,
                                    @NotEmpty @Size(max = 200) List<@NotNull @Valid OddsInput> odds,
                                    @Valid StatsInput stats,
                                    @Valid SimulationInput simulation,
                                    @NotEmpty @Size(max = 20) List<@NotNull @Valid PickInput> picks,
                                    @NotNull @Valid CorrectScoreInput correctScore,
                                    JsonNode metadata) {
    }

    public record PickRef(UUID pickId, int rank, String market, String pick, UUID oddsId) {
    }

    /** {@code externalMatchId} is the id to send match results with, generated when the prediction had none. */
    public record PredictionResponse(UUID predictionId, UUID matchId, String externalMatchId, boolean duplicate,
                                     List<PickRef> picks, Map<String, UUID> odds) {
    }

    /**
     * Names the match by exactly one of {@code externalMatchId}, {@code matchId} or {@code predictionId}: agents that
     * let the server generate the external id ({@code auto-...}) only know the ids of the prediction response.
     */
    public record ResultRequest(@Pattern(regexp = ID) String externalMatchId,
                                UUID matchId,
                                UUID predictionId,
                                @NotBlank @Pattern(regexp = "SCHEDULED|LIVE|FINISHED|CANCELLED|POSTPONED") String status,
                                @Valid Pair finalScore,
                                @Valid Pair finalCorners,
                                @Valid Pair halfTimeScore,
                                @Valid Pair halfTimeCorners,
                                @NotNull Instant resultAt) {
    }

    public record AiCalculation(@NotNull UUID pickId, @NotBlank @Pattern(regexp = RESULTS) String result,
                                @Size(max = 4000) String explanation) {
    }

    /** Names the match like {@link ResultRequest}: exactly one of externalMatchId, matchId or predictionId. */
    public record SettleRequest(@Pattern(regexp = ID) String externalMatchId,
                                UUID matchId,
                                UUID predictionId,
                                @Size(max = 200) List<@NotNull @Valid AiCalculation> aiCalculations) {
    }
}
