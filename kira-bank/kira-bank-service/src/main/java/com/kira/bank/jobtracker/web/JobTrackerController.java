package com.kira.bank.jobtracker.web;

import com.kira.bank.jobtracker.application.JobTrackerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import static com.kira.bank.jobtracker.application.JobTrackerDtos.*;

@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
public class JobTrackerController {
    private final JobTrackerService service;

    @GetMapping
    public com.kira.bank.shared.web.ApiTypes.PageResponse<Job> list(
        @AuthenticationPrincipal Long user,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "") String search) {
        return service.list(user, page, size, search);
    }

    @GetMapping("/{id}")
    public Job get(@AuthenticationPrincipal Long user, @PathVariable long id) {
        return service.get(user, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Job create(@AuthenticationPrincipal Long user, @Valid @RequestBody JobCreate value) {
        return service.create(user, value);
    }

    @PutMapping("/{id}")
    public Job update(@AuthenticationPrincipal Long user, @PathVariable long id,
                      @Valid @RequestBody JobUpdate value) {
        return service.update(user, id, value);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Long user, @PathVariable long id, @RequestParam long version) {
        service.delete(user, id, version);
    }
}
