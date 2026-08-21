package com.kira.bank.lodging.application;

import com.kira.bank.lodging.domain.LodgingReviewStatus;
import com.kira.bank.lodging.domain.LodgingStatus;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class LodgingDtos {
    private LodgingDtos() {}
    public record FeeRequest(@PositiveOrZero BigDecimal amount, @Size(max = 30) String unit) {}
    public record ListingRequest(@NotBlank @Size(max = 500) String address, @NotNull @PositiveOrZero BigDecimal rentPrice,
                                 FeeRequest electricity, FeeRequest water, FeeRequest service, FeeRequest parking,
                                 @Size(max = 1000) String facebookUrl, @Size(max = 30) String phone,
                                 @Size(max = 1000) String videoUrl, @Size(max = 4000) String note,
                                 @NotEmpty @Size(max = 10) List<@NotNull Long> referenceLocationIds,
                                 @Min(0) Long version) {}
    public record ReferenceLocationRequest(@NotBlank @Size(max = 150) String name, @NotBlank @Size(max = 500) String address,
                                           @Min(0) Long version) {}
    public record ReviewRequest(@NotNull LodgingReviewStatus status, @Size(max = 1000) String reason) {}
    public record ImageResponse(Long attachmentId, String originalName, String contentUrl, int sortOrder) {}
    public record DistanceResponse(Long referenceLocationId, String name, String address, Long distanceMeters, LodgingStatus status,
                                   String errorCode, Instant calculatedAt) {}
    public record ReviewSummary(long okCount, long notOkCount, LodgingReviewStatus myStatus, String myReason) {}
    public record ListingResponse(Long id, String address, String formattedAddress, BigDecimal rentPrice,
                                  FeeRequest electricity, FeeRequest water, FeeRequest service, FeeRequest parking,
                                  String facebookUrl, String phone, String videoUrl, String note, LodgingStatus geocodeStatus,
                                  String geocodeError, OwnerResponse owner, boolean canEdit, boolean canDelete, long version,
                                  List<ImageResponse> images, List<DistanceResponse> distances, ReviewSummary reviewSummary,
                                  Instant createdAt, Instant updatedAt) {}
    public record OwnerResponse(Long userId, String fullName) {}
    public record ReviewResponse(Long userId, String fullName, LodgingReviewStatus status, String reason, Instant updatedAt) {}
    public record ReferenceLocationResponse(Long id, String name, String address, String formattedAddress, LodgingStatus geocodeStatus,
                                            String geocodeError, boolean canEdit, boolean canDelete, long version) {}
    public record AddressSuggestionResponse(String mapboxId, String label) {}
}
