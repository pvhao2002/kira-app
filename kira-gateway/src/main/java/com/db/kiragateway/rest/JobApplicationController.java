package com.db.kiragateway.rest;

import com.db.kiragateway.jobtracker.JobApplicationService;
import com.db.kiragateway.jobtracker.dto.CreateJobApplicationRequest;
import com.db.kiragateway.jobtracker.dto.JobApplicationResponse;
import com.db.kiragateway.jobtracker.dto.UpdateJobApplicationRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/jobs")
public class JobApplicationController {

    private final JobApplicationService service;

    public JobApplicationController(JobApplicationService service) {
        this.service = service;
    }

    @GetMapping
    public List<JobApplicationResponse> list(@AuthenticationPrincipal Jwt jwt,
                                             @RequestParam(required = false) String q,
                                             @RequestParam(required = false) String status) {
        return service.list(currentUserId(jwt), q, status);
    }

    @PostMapping
    public ResponseEntity<JobApplicationResponse> create(@AuthenticationPrincipal Jwt jwt,
                                                         @Valid @RequestBody CreateJobApplicationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(currentUserId(jwt), request));
    }

    @PatchMapping("/{jobId:\\d+}")
    public JobApplicationResponse update(@AuthenticationPrincipal Jwt jwt,
                                         @PathVariable long jobId,
                                         @Valid @RequestBody UpdateJobApplicationRequest request) {
        return service.update(currentUserId(jwt), jobId, request);
    }

    @DeleteMapping("/{jobId:\\d+}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long jobId) {
        service.delete(currentUserId(jwt), jobId);
        return ResponseEntity.noContent().build();
    }

    private static int currentUserId(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        var uid = jwt.getClaim("uid");
        if (uid instanceof Number number && number.intValue() > 0) {
            return number.intValue();
        }
        throw new IllegalArgumentException("Missing user id in token");
    }
}
