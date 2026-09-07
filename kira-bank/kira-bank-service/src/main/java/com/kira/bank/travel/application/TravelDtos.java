package com.kira.bank.travel.application;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class TravelDtos {
    private TravelDtos() {}
    public record Member(@NotBlank @Size(max=36) String id, @NotBlank @Size(max=80) String name) {}
    public record Activity(@NotBlank @Size(max=36) String id, @NotNull LocalDate date,
        @NotNull @Pattern(regexp="^$|^([01][0-9]|2[0-3]):[0-5][0-9]$") String time,
        @NotBlank @Size(max=160) String title, @NotNull @Size(max=300) String location,
        @NotNull @Size(max=2000) String notes) {}
    public record Packing(@NotBlank @Size(max=36) String id, @NotBlank @Size(max=160) String name,
        @NotBlank @Size(max=80) String category, @Min(1) @Max(999) int quantity, boolean packed) {}
    public record Expense(@NotBlank @Size(max=36) String id, @NotBlank @Size(max=160) String title,
        @NotNull LocalDate date, @NotNull @DecimalMin("0.01") @DecimalMax("1000000000000") BigDecimal amount,
        @NotBlank String paidBy, @NotEmpty @Size(max=50) List<@NotBlank String> participants) {}
    public record Booking(@NotBlank @Size(max=36) String id, @NotBlank @Size(max=160) String title,
        @NotBlank @Pattern(regexp="FLIGHT|STAY|TRAIN|BUS|ACTIVITY|OTHER") String type,
        @NotNull @Size(max=120) String reference, @NotNull LocalDate date,
        @NotNull @Size(max=2000) String notes, @NotNull @Size(max=1000) String url) {}
    public record Place(@NotBlank @Size(max=36) String id, @NotBlank @Size(max=160) String name,
        @NotNull @Size(max=300) String address, @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
        @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
        @NotNull @Size(max=2000) String notes, boolean visited) {}
    public record TripData(@NotBlank @Size(max=160) String name, @NotBlank @Size(max=200) String destination,
        @NotNull LocalDate startDate, @NotNull LocalDate endDate, @NotBlank @Size(max=80) String timezone,
        @NotBlank @Pattern(regexp="VND|USD|EUR|JPY|THB|GBP|SGD") String currency,
        @NotNull @DecimalMin("0") @DecimalMax("1000000000000") BigDecimal budget,
        @NotNull @Size(max=4000) String notes,
        @NotEmpty @Size(max=50) List<@NotNull @Valid Member> members,
        @NotNull @Size(max=500) List<@NotNull @Valid Activity> activities,
        @NotNull @Size(max=500) List<@NotNull @Valid Packing> packing,
        @NotNull @Size(max=1000) List<@NotNull @Valid Expense> expenses,
        @NotNull @Size(max=200) List<@NotNull @Valid Booking> bookings,
        @NotNull @Size(max=300) List<@NotNull @Valid Place> places) {}
    public record TripWrite(@NotNull @Valid TripData data, @Min(-1) long version) {}
    public record Trip(String id, TripData data, long version) {}
    public record Balance(String memberId, BigDecimal paid, BigDecimal share, BigDecimal net) {}
    public record Transfer(String from, String to, BigDecimal amount) {}
    public record Summary(BigDecimal total, List<Balance> balances, List<Transfer> transfers) {}
    public record TripView(String id, TripData data, long version, Summary summary) {}
    public record FileView(String id, String name, String contentType, int size) {}
    public record FileContent(FileView metadata, byte[] content) {}
}
