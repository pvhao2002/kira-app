package com.kira.bank.jobtracker.application;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;

public final class JobTrackerDtos {
    private JobTrackerDtos() {
    }

    public record JobCreate(
        @NotBlank @Size(max = 255) String companyName,
        @NotBlank @Size(max = 255) String positionTitle,
        @Size(max = 255) String location,
        @Size(max = 1000) String jobUrl,
        @Size(max = 255) String salary,
        @Size(max = 100) String employmentType,
        @Size(max = 30) String status,
        @Size(max = 20) String priority,
        LocalDate deadline,
        @Size(max = 255) String contactName,
        @Email @Size(max = 255) String contactEmail,
        @Size(max = 10000) String notes
    ) {
    }

    public record JobUpdate(
        @NotBlank @Size(max = 255) String companyName,
        @NotBlank @Size(max = 255) String positionTitle,
        @Size(max = 255) String location,
        @Size(max = 1000) String jobUrl,
        @Size(max = 255) String salary,
        @Size(max = 100) String employmentType,
        @Size(max = 30) String status,
        @Size(max = 20) String priority,
        LocalDate deadline,
        @Size(max = 255) String contactName,
        @Email @Size(max = 255) String contactEmail,
        @Size(max = 10000) String notes,
        @Min(0) long version
    ) {
    }

    public record Job(
        long id,
        String companyName,
        String positionTitle,
        String location,
        String jobUrl,
        String salary,
        String employmentType,
        String status,
        String priority,
        LocalDate deadline,
        String contactName,
        String contactEmail,
        String notes,
        Instant createdAt,
        Instant updatedAt,
        long version
    ) {
    }
}
