package com.kira.news.reading;

import com.kira.news.proto.v1.Dashboard;
import com.kira.news.proto.v1.ReadPage;
import com.kira.news.shared.Protobuf;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(produces = Protobuf.CONTENT_TYPE)
public class ReadingController {
    private final ReadingService service;

    public ReadingController(ReadingService service) {
        this.service = service;
    }

    /** Beacon from the reader's browser after it resolved ipinfo.io. remoteAddr honours X-Forwarded-For from the SSR proxy. */
    @PostMapping(path = "/api/v1/public/reads", consumes = Protobuf.CONTENT_TYPE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void record(@RequestBody com.kira.news.proto.v1.ReadEvent event, HttpServletRequest request) {
        // shortcut: per-request size/shape checks only; rate-limit /api/v1/public/reads per IP at nginx before going public.
        service.record(event, request.getRemoteAddr(), request.getHeader(HttpHeaders.USER_AGENT));
    }

    @GetMapping("/api/v1/admin/reads")
    public ReadPage reads(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        return service.page(page, size);
    }

    @GetMapping("/api/v1/admin/dashboard")
    public Dashboard dashboard() {
        return service.dashboard();
    }
}
