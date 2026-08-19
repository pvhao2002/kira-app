package com.kira.bank.attachment.web;

import com.kira.bank.attachment.application.AttachmentService;
import com.kira.bank.attachment.application.InvestmentAiJobService;
import com.kira.bank.attachment.application.InvestmentAiManualRunService;
import com.kira.bank.attachment.domain.AttachmentAiStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/investment/ai-jobs")
@RequiredArgsConstructor
public class AdminInvestmentAiJobController {
    private final InvestmentAiJobService jobs;
    private final InvestmentAiManualRunService manualRuns;
    private final AttachmentService attachments;

    @GetMapping
    Object list(
        @RequestParam(required = false) List<AttachmentAiStatus> statuses,
        @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return jobs.all(statuses, pageable);
    }

    @PostMapping("/{id}/cancel")
    Object cancel(@AuthenticationPrincipal Long admin, @PathVariable Long id) {
        return jobs.cancelAsAdmin(admin, id);
    }

    @PostMapping("/{id}/run")
    @ResponseStatus(HttpStatus.ACCEPTED)
    Object run(@AuthenticationPrincipal Long admin, @PathVariable Long id) {
        return manualRuns.runAsAdmin(admin, id);
    }

    @GetMapping("/{id}/content")
    ResponseEntity<byte[]> content(@PathVariable Long id) {
        return InvestmentAiJobController.contentResponse(attachments.investmentJobContentAsAdmin(id));
    }
}
