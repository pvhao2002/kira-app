package com.db.kiragateway.jobtracker.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record JobApplicationResponse(
        long jobId,
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
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
