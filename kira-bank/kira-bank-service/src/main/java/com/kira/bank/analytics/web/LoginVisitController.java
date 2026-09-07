package com.kira.bank.analytics.web;

import com.kira.bank.analytics.application.LoginVisitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import static com.kira.bank.analytics.application.LoginVisitDtos.*;

@RestController
@RequiredArgsConstructor
public class LoginVisitController {
    private final LoginVisitService service;
    @PostMapping("/api/v1/public/login-visits")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void record(@Valid @RequestBody VisitWrite visit,HttpServletRequest request) { service.record(visit,request); }
    @GetMapping("/api/v1/admin/login-visits")
    @PreAuthorize("hasRole('ADMIN')")
    public Report report(@RequestParam Instant from,@RequestParam Instant to,@RequestParam(defaultValue="") String ip,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size,HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");
        return service.report(from,to,ip,page,size);
    }
    @GetMapping("/api/v1/admin/login-visits/events")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<Event> events(@RequestParam Instant from,@RequestParam Instant to,@RequestParam(defaultValue="") String ip,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size,HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");
        return service.events(from,to,ip,page,size);
    }
}
