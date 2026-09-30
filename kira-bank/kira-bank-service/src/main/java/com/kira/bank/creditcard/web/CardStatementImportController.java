package com.kira.bank.creditcard.web;

import com.kira.bank.creditcard.application.CardStatementImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

import static com.kira.bank.creditcard.application.CardStatementImportDtos.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CardStatementImportController {
    private final CardStatementImportService service;

    @PostMapping(path = "/credit-cards/{cardId}/statement-imports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    StatementImportResponse create(@AuthenticationPrincipal Long u, @PathVariable Long cardId,
                                   @RequestParam("files") List<MultipartFile> files) throws IOException {
        return service.create(u, cardId, files);
    }

    @GetMapping("/credit-cards/{cardId}/statement-imports")
    List<StatementImportResponse> list(@AuthenticationPrincipal Long u, @PathVariable Long cardId) {
        return service.list(u, cardId);
    }

    @GetMapping("/statement-imports/{id}")
    StatementImportResponse get(@AuthenticationPrincipal Long u, @PathVariable Long id) {
        return service.get(u, id);
    }

    @PostMapping("/statement-imports/{id}/retry")
    StatementImportResponse retry(@AuthenticationPrincipal Long u, @PathVariable Long id,
                                  @Valid @RequestBody VersionRequest r) {
        return service.retry(u, id, r);
    }

    @PostMapping("/statement-imports/{id}/cancel")
    StatementImportResponse cancel(@AuthenticationPrincipal Long u, @PathVariable Long id,
                                   @Valid @RequestBody VersionRequest r) {
        return service.cancel(u, id, r);
    }

    @PostMapping("/statement-imports/{id}/confirm")
    ConfirmResponse confirm(@AuthenticationPrincipal Long u, @PathVariable Long id,
                            @Valid @RequestBody ConfirmRequest r) {
        return service.confirm(u, id, r);
    }
}
