package com.kira.bank.passwordvault.application;

import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.passwordvault.domain.PasswordVaultAccount;
import com.kira.bank.passwordvault.domain.PasswordVaultModule;
import com.kira.bank.passwordvault.domain.PasswordVaultUnlockSession;
import com.kira.bank.passwordvault.infrastructure.*;
import com.kira.bank.passwordvault.infrastructure.PasswordVaultAuditRepository.AuditContext;
import com.kira.bank.shared.web.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.kira.bank.passwordvault.application.PasswordVaultDtos.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordVaultServiceTest {
    @Mock PasswordVaultModuleRepository modules;
    @Mock PasswordVaultAccountRepository accounts;
    @Mock PasswordVaultUnlockSessionRepository sessions;
    @Mock PasswordVaultAuditRepository audit;
    @Mock PasswordVaultCipher cipher;
    @Mock UserRepository users;
    @Mock PasswordEncoder encoder;
    PasswordVaultService service;

    @BeforeEach
    void setUp() {
        service = new PasswordVaultService(modules, accounts, sessions, audit, cipher, users, encoder);
    }

    @Test
    void neverFallsBackToAnUnscopedModuleLookup() {
        when(modules.findByIdAndOwnerIdAndDeletedAtIsNull(44L, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.accounts(7L, 44L, ""))
            .isInstanceOf(ApiException.class).extracting("code").isEqualTo("VAULT_MODULE_NOT_FOUND");
        verify(modules).findByIdAndOwnerIdAndDeletedAtIsNull(44L, 7L);
        verifyNoInteractions(accounts);
    }

    @Test
    void listResponseContainsOnlyMaskedAccountMetadata() {
        PasswordVaultModule module = new PasswordVaultModule();
        module.setOwnerId(7L);
        PasswordVaultAccount account = new PasswordVaultAccount();
        account.setOwnerId(7L);
        account.setModuleId(44L);
        account.setDisplayName("Primary");
        account.setSecretCiphertext("ciphertext-must-not-leak");
        when(modules.findByIdAndOwnerIdAndDeletedAtIsNull(44L, 7L)).thenReturn(Optional.of(module));
        when(accounts.findByOwnerIdAndModuleIdAndDeletedAtIsNullOrderByDisplayNameAscIdAsc(7L, 44L))
            .thenReturn(List.of(account));

        List<AccountResponse> response = service.accounts(7L, 44L, "");

        assertThat(response).singleElement().satisfies(value -> {
            assertThat(value.displayName()).isEqualTo("Primary");
            assertThat(value.passwordMasked()).isEqualTo("••••••••");
            assertThat(value.toString()).doesNotContain("ciphertext-must-not-leak");
        });
        verifyNoInteractions(cipher);
    }

    @Test
    void blocksUnlockBeforeCheckingThePasswordAfterFiveRecentFailures() {
        when(audit.failedUnlocksSince(eq(7L), any(Instant.class))).thenReturn(5L);

        assertThatThrownBy(() -> service.unlock(7L, new UnlockRequest("current-password"), AuditContext.empty()))
            .isInstanceOf(ApiException.class).satisfies(error -> {
                ApiException api = (ApiException) error;
                assertThat(api.getCode()).isEqualTo("VAULT_UNLOCK_RATE_LIMITED");
                assertThat(api.getStatus().value()).isEqualTo(429);
            });
        verifyNoInteractions(users, encoder);
    }

    @Test
    void rejectsExpiredOrForeignUnlockTokenBeforeReadingAnAccount() {
        PasswordVaultUnlockSession expired = new PasswordVaultUnlockSession();
        expired.setUserId(7L);
        expired.setExpiresAt(Instant.now().minusSeconds(1));
        when(sessions.findByTokenHashAndUserIdAndRevokedAtIsNull(anyString(), eq(7L)))
            .thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> service.secret(7L, 99L, "opaque-token",
            new SecretRequest(SecretAction.REVEAL, null), AuditContext.empty()))
            .isInstanceOf(ApiException.class).extracting("code").isEqualTo("VAULT_LOCKED");
        verify(sessions).save(expired);
        verifyNoInteractions(accounts, cipher);
    }
}
