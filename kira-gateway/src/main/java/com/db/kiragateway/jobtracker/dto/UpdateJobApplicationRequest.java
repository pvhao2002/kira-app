package com.db.kiragateway.jobtracker.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdateJobApplicationRequest(
        @Size(max = 255) String companyName,
        @Size(max = 255) String positionTitle,
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
