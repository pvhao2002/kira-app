package com.db.kiragateway.jobtracker;

import com.db.kiragateway.jobtracker.dto.CreateJobApplicationRequest;
import com.db.kiragateway.jobtracker.dto.JobApplicationResponse;
import com.db.kiragateway.jobtracker.dto.UpdateJobApplicationRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class JobApplicationService {

    public static final Set<String> STATUSES = Set.of("SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN");
    public static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH");

    private final JobApplicationRepository repo;

    public JobApplicationService(JobApplicationRepository repo) {
        this.repo = repo;
    }

    public List<JobApplicationResponse> list(int userId, String query, String status) {
        String normalizedStatus = status == null || status.isBlank() ? null : normalizeStatus(status);
        return repo.findAll(userId, query, normalizedStatus).stream().map(this::toResponse).toList();
    }

    public JobApplicationResponse create(int userId, CreateJobApplicationRequest request) {
        long id = repo.insert(userId,
                requiredText(request.companyName(), "Company name is required"),
                requiredText(request.positionTitle(), "Position is required"), optionalText(request.location()),
                optionalText(request.jobUrl()), optionalText(request.salary()), optionalText(request.employmentType()),
                normalizeStatus(request.status()), normalizePriority(request.priority()), request.deadline(),
                optionalText(request.contactName()), optionalText(request.contactEmail()), optionalText(request.notes()));
        return get(userId, id);
    }

    public JobApplicationResponse update(int userId, long jobId, UpdateJobApplicationRequest request) {
        var existing = repo.findById(jobId, userId).orElseThrow(() -> notFound("Job application not found"));
        int updated = repo.update(jobId, userId,
                request.companyName() != null ? requiredText(request.companyName(), "Company name is required") : existing.companyName(),
                request.positionTitle() != null ? requiredText(request.positionTitle(), "Position is required") : existing.positionTitle(),
                request.location() != null ? optionalText(request.location()) : existing.location(),
                request.jobUrl() != null ? optionalText(request.jobUrl()) : existing.jobUrl(),
                request.salary() != null ? optionalText(request.salary()) : existing.salary(),
                request.employmentType() != null ? optionalText(request.employmentType()) : existing.employmentType(),
                request.status() != null ? normalizeStatus(request.status()) : existing.status(),
                request.priority() != null ? normalizePriority(request.priority()) : existing.priority(),
                request.deadline() != null ? request.deadline() : existing.deadline(),
                request.contactName() != null ? optionalText(request.contactName()) : existing.contactName(),
                request.contactEmail() != null ? optionalText(request.contactEmail()) : existing.contactEmail(),
                request.notes() != null ? optionalText(request.notes()) : existing.notes());
        if (updated == 0) {
            throw notFound("Job application not found");
        }
        return get(userId, jobId);
    }

    public JobApplicationResponse get(int userId, long jobId) {
        return repo.findById(jobId, userId).map(this::toResponse)
                .orElseThrow(() -> notFound("Job application not found"));
    }

    public void delete(int userId, long jobId) {
        if (repo.delete(jobId, userId) == 0) {
            throw notFound("Job application not found");
        }
    }

    private JobApplicationResponse toResponse(JobApplicationRow row) {
        return new JobApplicationResponse(row.jobId(), row.companyName(), row.positionTitle(), row.location(),
                row.jobUrl(), row.salary(), row.employmentType(), row.status(), row.priority(), row.deadline(),
                row.contactName(), row.contactEmail(), row.notes(), row.createdAt(), row.updatedAt());
    }

    private static String normalizeStatus(String value) {
        var normalized = (value == null || value.isBlank() ? "SAVED" : value.trim()).toUpperCase(Locale.ROOT);
        if (!STATUSES.contains(normalized)) {
            throw badRequest("Invalid job application status");
        }
        return normalized;
    }

    private static String normalizePriority(String value) {
        var normalized = (value == null || value.isBlank() ? "MEDIUM" : value.trim()).toUpperCase(Locale.ROOT);
        if (!PRIORITIES.contains(normalized)) {
            throw badRequest("Invalid job application priority");
        }
        return normalized;
    }

    private static String requiredText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw badRequest(message);
        }
        return value.trim();
    }

    private static String optionalText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
