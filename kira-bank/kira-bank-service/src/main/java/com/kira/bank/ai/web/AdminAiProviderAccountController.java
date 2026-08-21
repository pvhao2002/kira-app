package com.kira.bank.ai.web;

import com.kira.bank.ai.application.AiProviderAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import static com.kira.bank.ai.application.AiProviderAccountDtos.*;

@RestController
@RequestMapping("/api/v1/admin/ai-provider-accounts")
@RequiredArgsConstructor
public class AdminAiProviderAccountController {
    private final AiProviderAccountService service;

    @GetMapping
    Object list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    Object create(@AuthenticationPrincipal Long adminId, @Valid @RequestBody CreateRequest request) {
        return service.create(adminId, request);
    }

    @PutMapping("/{id}")
    Object update(@AuthenticationPrincipal Long adminId, @PathVariable Long id,
                  @Valid @RequestBody UpdateRequest request) {
        return service.update(adminId, id, request);
    }

    @PostMapping("/{id}/test")
    Object test(@AuthenticationPrincipal Long adminId, @PathVariable Long id,
                @Valid @RequestBody VersionRequest request) {
        return service.testAi(adminId, id, new AiTestRequest(request.version(), null, null));
    }

    @PostMapping("/{id}/enable")
    Object enable(@AuthenticationPrincipal Long adminId, @PathVariable Long id,
                  @Valid @RequestBody VersionRequest request) {
        return service.enableAi(adminId, id, request);
    }

    @PostMapping("/{id}/disable")
    Object disable(@AuthenticationPrincipal Long adminId, @PathVariable Long id,
                   @Valid @RequestBody VersionRequest request) {
        return service.disableAi(adminId, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Long adminId, @PathVariable Long id,
                @Valid @RequestBody VersionRequest request) {
        service.delete(adminId, id, request);
    }
}
