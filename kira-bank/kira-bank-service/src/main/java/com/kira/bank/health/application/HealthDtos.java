package com.kira.bank.health.application;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.List;

public final class HealthDtos {
    private HealthDtos() {}
    public record Profile(@NotNull @DecimalMin("80") @DecimalMax("250") Double heightCm,
        @NotNull LocalDate birthDate, @NotBlank @Pattern(regexp="MALE|FEMALE") String formulaSex,
        @NotBlank @Pattern(regexp="LOSE|MAINTAIN|GAIN") String goal,
        @NotBlank @Size(max=80) String timezone,
        @NotNull @DecimalMin("1.2") @DecimalMax("2.4") Double activityFactor,
        @NotNull @Min(-1000) @Max(1000) Integer calorieAdjustment,
        @NotNull @Size(max=2000) String foodPreferences, @NotNull @Size(max=1000) String allergies,
        @NotNull @Size(max=1000) String avoidedFoods, @Min(0) @Max(240) int preparationMinutes,
        @NotNull @Size(max=1000) String exerciseExperience, @NotNull @Size(max=1000) String equipment,
        @NotNull @Size(max=1000) String availability, @NotNull @Size(max=2000) String movementRestrictions) {}
    public record ProfileWrite(@NotNull @Valid Profile data, @Min(-1) long version) {}
    public record ProfileView(Profile data, long version) {}
    public record Weight(@NotNull LocalDate date, @NotNull @DecimalMin("20") @DecimalMax("500") Double kg) {}
    public record PlanItem(@NotNull LocalDate date, @NotBlank @Pattern(regexp="MEAL|WORKOUT|REST") String kind,
        @NotBlank @Size(max=200) String title, @NotNull @Size(max=1000) String portion,
        @NotNull @DecimalMin("0") @DecimalMax("10000") Double calories,
        @Min(0) @Max(1440) int minutes, @NotNull @Size(max=2000) String notes, boolean completed) {}
    public record PlanData(@NotBlank @Size(max=200) String title,
        @NotNull @Size(min=1,max=100) List<@NotNull @Valid PlanItem> items,
        @NotNull @Size(max=20) List<@NotBlank @Size(max=500) String> warnings) {}
    public record PlanWrite(@NotNull LocalDate weekStart, @NotNull @Valid PlanData data, @Min(-1) long version) {}
    public record PlanView(String id, LocalDate weekStart, String status, PlanData data, long version) {}
    public record Approval(@Min(0) long version, @AssertTrue boolean restrictionsReviewed) {}
    public record JournalData(@NotBlank @Pattern(regexp="MEAL|WORKOUT") String kind,
        @NotBlank @Size(max=200) String title, @NotNull @DecimalMin("0") @DecimalMax("10000") Double calories,
        @Min(0) @Max(1440) int minutes, @NotNull @Size(max=2000) String notes) {}
    public record JournalWrite(@NotNull LocalDate date, @NotNull @Valid JournalData data, @Min(-1) long version) {}
    public record JournalView(String id, LocalDate date, JournalData data, long version) {}
    public record Workout(@NotBlank @Pattern(regexp="[A-Fa-f0-9-]{36}") String id,
        @NotNull Instant start, @NotNull Instant end, @NotBlank @Size(max=100) String type,
        @DecimalMin("0") @DecimalMax("10000") Double calories, @NotBlank @Size(max=200) String source) {}
    public record Day(@NotNull LocalDate date, @DecimalMin("0") @DecimalMax("20000") Double activeCalories,
        @DecimalMin("0") @DecimalMax("20000") Double restingCalories, @Min(0) @Max(200000) Long steps,
        @NotNull @Size(max=300) List<@NotNull @Valid Workout> workouts,
        @NotBlank @Pattern(regexp="APPLE_HEALTH") String source) {}
    public record Connect(@NotNull java.util.UUID deviceId, @NotBlank @Size(max=80) String timezone) {}
    public record Device(String deviceId, String generation, String timezone, long lastRevision, Instant lastSyncedAt) {}
    public record Sync(@NotNull java.util.UUID deviceId, @NotNull java.util.UUID generation,
        @Min(1) long revision, @NotBlank @Size(max=80) String timezone,
        @NotNull @Size(min=1,max=31) List<@NotNull @Valid Day> days) {}
    public record Summary(LocalDate date, Double bmi, Double restingEstimate, double eatenCalories,
        Double targetCalories, Double activeCalories, Double restingCalories, Double totalBurned,
        Double netCalories, String targetSource, boolean provisional, Long steps, List<Workout> workouts) {}
    public record AiRequest(@NotNull LocalDate weekStart, @NotNull LocalDate fromDate,
        @AssertTrue boolean consent, @Pattern(regexp="en|vi") @NotNull String language) {}
    public record AiJob(String id, String status, String planId, String errorCode) {}
}
