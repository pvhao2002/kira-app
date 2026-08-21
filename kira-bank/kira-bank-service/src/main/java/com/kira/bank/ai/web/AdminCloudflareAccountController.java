package com.kira.bank.ai.web;

import com.kira.bank.ai.application.AiProviderAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import static com.kira.bank.ai.application.AiProviderAccountDtos.*;

@RestController
@RequestMapping("/api/v1/admin/cloudflare-accounts")
@RequiredArgsConstructor
public class AdminCloudflareAccountController {
    private final AiProviderAccountService service;

    @GetMapping Object list() { return service.list(); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    Object create(@AuthenticationPrincipal Long adminId, @Valid @RequestBody CreateRequest request) {
        return service.create(adminId, request);
    }

    @PutMapping("/{id}")
    Object update(@AuthenticationPrincipal Long adminId, @PathVariable Long id, @Valid @RequestBody UpdateRequest request) {
        return service.update(adminId, id, request);
    }

    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Long adminId, @PathVariable Long id, @Valid @RequestBody VersionRequest request) {
        service.delete(adminId, id, request);
    }

    @PostMapping("/{id}/ai/test")
    Object testAi(@AuthenticationPrincipal Long adminId, @PathVariable Long id, @Valid @RequestBody AiTestRequest request) {
        return service.testAi(adminId, id, request);
    }

    @PostMapping("/{id}/ai/enable")
    Object enableAi(@AuthenticationPrincipal Long adminId, @PathVariable Long id, @Valid @RequestBody VersionRequest request) {
        return service.enableAi(adminId, id, request);
    }

    @PostMapping("/{id}/ai/disable")
    Object disableAi(@AuthenticationPrincipal Long adminId, @PathVariable Long id, @Valid @RequestBody VersionRequest request) {
        return service.disableAi(adminId, id, request);
    }

    @PostMapping("/{id}/r2/test")
    Object testR2(@AuthenticationPrincipal Long adminId, @PathVariable Long id, @Valid @RequestBody R2TestRequest request) {
        return service.testR2(adminId, id, request);
    }

    @PostMapping("/{id}/r2/make-primary")
    Object makePrimary(@AuthenticationPrincipal Long adminId, @PathVariable Long id, @Valid @RequestBody VersionRequest request) {
        return service.makeR2Primary(adminId, id, request);
    }

    @PostMapping("/{id}/r2/stop-uploads")
    Object stopUploads(@AuthenticationPrincipal Long adminId, @PathVariable Long id, @Valid @RequestBody VersionRequest request) {
        return service.stopR2Uploads(adminId, id, request);
    }

    @PostMapping("/{id}/r2/adopt-legacy-attachments")
    Object adoptLegacy(@AuthenticationPrincipal Long adminId, @PathVariable Long id, @Valid @RequestBody VersionRequest request) {
        return service.adoptLegacyAttachments(adminId, id, request);
    }
}
