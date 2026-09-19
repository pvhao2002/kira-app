package com.kira.bank.jobtracker.application;

import com.kira.bank.jobtracker.infrastructure.JobTrackerRepository;
import com.kira.bank.shared.web.ApiException;
import com.kira.bank.shared.web.ApiTypes;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import static com.kira.bank.jobtracker.application.JobTrackerDtos.*;

@Service
@RequiredArgsConstructor
public class JobTrackerService {
    private static final Set<String> STATUSES = Set.of("SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN");
    private static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH");

    private final JobTrackerRepository repo;

    @Transactional(readOnly = true)
    public ApiTypes.PageResponse<Job> list(long user, int page, int size, String search) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(HttpStatus.BAD_REQUEST, "JOB_PAGE_INVALID", "Phân trang không hợp lệ");
        return repo.list(user, page, size, search);
    }

    @Transactional(readOnly = true)
    public Job get(long user, long id) {
        Job job = repo.find(user, id, false);
        if (job == null) throw notFound();
        return job;
    }

    @Transactional
    public Job create(long user, JobCreate value) {
        JobCreate clean = clean(value);
        return get(user, repo.insert(user, clean));
    }

    @Transactional
    public Job update(long user, long id, JobUpdate value) {
        JobUpdate clean = clean(value);
        if (repo.find(user, id, true) == null) throw notFound();
        if (repo.update(user, id, clean) != 1) throw conflict();
        return get(user, id);
    }

    @Transactional
    public void delete(long user, long id, long version) {
        if (repo.find(user, id, true) == null) throw notFound();
        if (repo.delete(user, id, version) != 1) throw conflict();
    }

    private JobCreate clean(JobCreate value) {
        return new JobCreate(required(value.companyName(), "JOB_COMPANY_REQUIRED"),
            required(value.positionTitle(), "JOB_POSITION_REQUIRED"), optional(value.location()), url(value.jobUrl()),
            optional(value.salary()), optional(value.employmentType()), status(value.status()), priority(value.priority()),
            value.deadline(), optional(value.contactName()), optional(value.contactEmail()), optional(value.notes()));
    }

    private JobUpdate clean(JobUpdate value) {
        return new JobUpdate(required(value.companyName(), "JOB_COMPANY_REQUIRED"),
            required(value.positionTitle(), "JOB_POSITION_REQUIRED"), optional(value.location()), url(value.jobUrl()),
            optional(value.salary()), optional(value.employmentType()), status(value.status()), priority(value.priority()),
            value.deadline(), optional(value.contactName()), optional(value.contactEmail()), optional(value.notes()), value.version());
    }

    private static String status(String value) {
        String normalized = value == null || value.isBlank() ? "SAVED" : value.trim().toUpperCase(Locale.ROOT);
        if (!STATUSES.contains(normalized))
            throw new ApiException(HttpStatus.BAD_REQUEST, "JOB_STATUS_INVALID", "Trạng thái job không hợp lệ");
        return normalized;
    }

    private static String priority(String value) {
        String normalized = value == null || value.isBlank() ? "MEDIUM" : value.trim().toUpperCase(Locale.ROOT);
        if (!PRIORITIES.contains(normalized))
            throw new ApiException(HttpStatus.BAD_REQUEST, "JOB_PRIORITY_INVALID", "Độ ưu tiên không hợp lệ");
        return normalized;
    }

    private static String required(String value, String code) {
        if (value == null || value.isBlank())
            throw new ApiException(HttpStatus.BAD_REQUEST, code, "Trường bắt buộc chưa được nhập");
        return value.trim();
    }

    private static String optional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String url(String value) {
        String normalized = optional(value);
        if (normalized == null) return null;
        try {
            URI uri = URI.create(normalized);
            if (!List.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
                throw new IllegalArgumentException();
            return normalized;
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "JOB_URL_INVALID", "Link công việc phải dùng HTTP hoặc HTTPS");
        }
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "JOB_NOT_FOUND", "Không tìm thấy job");
    }

    private static ApiException conflict() {
        return new ApiException(HttpStatus.CONFLICT, "JOB_VERSION_CONFLICT", "Job đã thay đổi. Vui lòng tải lại trước khi lưu");
    }
}
