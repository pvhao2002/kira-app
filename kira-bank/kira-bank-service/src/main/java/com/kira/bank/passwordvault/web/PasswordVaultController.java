package com.kira.bank.passwordvault.web;

import com.kira.bank.passwordvault.application.PasswordVaultService;
import com.kira.bank.passwordvault.infrastructure.PasswordVaultAuditRepository.AuditContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.kira.bank.passwordvault.application.PasswordVaultDtos.*;

@RestController
@RequestMapping("/api/v1/password-vault")
@RequiredArgsConstructor
public class PasswordVaultController {
    private static final String UNLOCK_HEADER = "X-Vault-Unlock-Token";
    private final PasswordVaultService service;

    @GetMapping("/modules")
    List<ModuleResponse> modules(@AuthenticationPrincipal Long user, @RequestParam(defaultValue = "") String search) {
        return service.modules(user, search);
    }

    @PostMapping("/modules")
    @ResponseStatus(HttpStatus.CREATED)
    ModuleResponse createModule(@AuthenticationPrincipal Long user, @Valid @RequestBody ModuleRequest request,
                                HttpServletRequest http) {
        return service.createModule(user, request, context(http));
    }

    @PutMapping("/modules/{id}")
    ModuleResponse updateModule(@AuthenticationPrincipal Long user, @PathVariable Long id,
                                @Valid @RequestBody ModuleRequest request, HttpServletRequest http) {
        return service.updateModule(user, id, request, context(http));
    }

    @DeleteMapping("/modules/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteModule(@AuthenticationPrincipal Long user, @PathVariable Long id,
                      @Valid @RequestBody VersionRequest request, HttpServletRequest http) {
        service.deleteModule(user, id, request, context(http));
    }

    @GetMapping("/modules/{moduleId}/accounts")
    List<AccountResponse> accounts(@AuthenticationPrincipal Long user, @PathVariable Long moduleId,
                                   @RequestParam(defaultValue = "") String search) {
        return service.accounts(user, moduleId, search);
    }

    @PostMapping("/modules/{moduleId}/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    AccountResponse createAccount(@AuthenticationPrincipal Long user, @PathVariable Long moduleId,
                                  @Valid @RequestBody AccountRequest request, HttpServletRequest http) {
        return service.createAccount(user, moduleId, request, context(http));
    }

    @PutMapping("/accounts/{id}")
    AccountResponse updateAccount(@AuthenticationPrincipal Long user, @PathVariable Long id,
                                  @RequestHeader(UNLOCK_HEADER) String unlockToken,
                                  @Valid @RequestBody AccountRequest request, HttpServletRequest http) {
        return service.updateAccount(user, id, unlockToken, request, context(http));
    }

    @DeleteMapping("/accounts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteAccount(@AuthenticationPrincipal Long user, @PathVariable Long id,
                       @Valid @RequestBody VersionRequest request, HttpServletRequest http) {
        service.deleteAccount(user, id, request, context(http));
    }

    @PostMapping("/unlock")
    ResponseEntity<UnlockResponse> unlock(@AuthenticationPrincipal Long user, @Valid @RequestBody UnlockRequest request,
                                          HttpServletRequest http) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(service.unlock(user, request, context(http)));
    }

    @DeleteMapping("/unlock")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void lock(@AuthenticationPrincipal Long user,
              @RequestHeader(value = UNLOCK_HEADER, required = false) String unlockToken) {
        service.lock(user, unlockToken);
    }

    @PostMapping("/accounts/{id}/secret")
    ResponseEntity<SecretResponse> secret(@AuthenticationPrincipal Long user, @PathVariable Long id,
                                          @RequestHeader(UNLOCK_HEADER) String unlockToken,
                                          @Valid @RequestBody SecretRequest request, HttpServletRequest http) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(service.secret(user, id, unlockToken, request, context(http)));
    }

    private AuditContext context(HttpServletRequest request) {
        return new AuditContext(request.getRemoteAddr(), request.getHeader("User-Agent"));
    }
}
