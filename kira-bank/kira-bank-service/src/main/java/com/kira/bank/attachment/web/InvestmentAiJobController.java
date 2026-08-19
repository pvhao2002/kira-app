package com.kira.bank.attachment.web;

import com.kira.bank.attachment.application.AttachmentService;
import com.kira.bank.attachment.application.InvestmentAiJobService;
import com.kira.bank.attachment.application.InvestmentAiManualRunService;
import com.kira.bank.attachment.domain.AttachmentAiStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/v1/investment/ai-jobs")
@RequiredArgsConstructor
public class InvestmentAiJobController {
    private final InvestmentAiJobService jobs;
    private final InvestmentAiManualRunService manualRuns;
    private final AttachmentService attachments;

    @GetMapping
    Object list(
        @AuthenticationPrincipal Long user,
        @RequestParam(required = false) List<AttachmentAiStatus> statuses,
        @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return jobs.mine(user, statuses, pageable);
    }

    @PostMapping("/{id}/cancel")
    Object cancel(@AuthenticationPrincipal Long user, @PathVariable Long id) {
        return jobs.cancelMine(user, id);
    }

    @PostMapping("/{id}/run")
    @ResponseStatus(HttpStatus.ACCEPTED)
    Object run(@AuthenticationPrincipal Long user, @PathVariable Long id) {
        return manualRuns.runMine(user, id);
    }

    @GetMapping("/{id}/content")
    ResponseEntity<byte[]> content(@AuthenticationPrincipal Long user, @PathVariable Long id) {
        return contentResponse(attachments.investmentJobContent(user, id));
    }

    static ResponseEntity<byte[]> contentResponse(AttachmentService.AttachmentContent content) {
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(content.mimeType()))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                .filename(content.originalName(), StandardCharsets.UTF_8).build().toString())
            .body(content.bytes());
    }
}
