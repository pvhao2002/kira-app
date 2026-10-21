package com.kira.bank.english.web;

import com.kira.bank.english.application.EnglishRewriteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.kira.bank.english.application.EnglishDtos.*;

@RestController
@RequestMapping("/api/v1/english")
@RequiredArgsConstructor
public class EnglishController {
    private final EnglishRewriteService service;

    @PostMapping("/rewrites")
    public Rewrite create(@AuthenticationPrincipal Long u, @Valid @RequestBody RewriteRequest r) {
        return service.create(u, r);
    }

    @GetMapping("/rewrites")
    public List<RewriteSummary> list(@AuthenticationPrincipal Long u, @RequestParam(required = false) Kind kind) {
        return service.list(u, kind);
    }

    @GetMapping("/rewrites/{id}")
    public Rewrite get(@AuthenticationPrincipal Long u, @PathVariable String id) {
        return service.get(u, id);
    }

    @DeleteMapping("/rewrites/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Long u, @PathVariable String id) {
        service.delete(u, id);
    }
}
