package com.kira.bank.ai.application;

import com.kira.bank.ai.domain.AiProviderAccount;
import com.kira.bank.ai.domain.AiProviderAccountStatus;
import com.kira.bank.ai.infrastructure.AiCredentialCipher;
import com.kira.bank.ai.infrastructure.AiProviderAccountRepository;
import com.kira.bank.attachment.CloudflareR2ClientFactory;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiProviderAccountServiceTest {
    private final AiProviderAccountRepository repository = mock(AiProviderAccountRepository.class);
    private final AttachmentRepository attachments = mock(AttachmentRepository.class);
    private final AiCredentialCipher cipher = mock(AiCredentialCipher.class);
    private final AiProviderAccountService service = new AiProviderAccountService(
        repository, attachments, cipher, null, mock(CloudflareR2ClientFactory.class));

    @Test
    void returnsNoCredentialWhenDatabaseHasNoAccount() {
        when(repository.findByDeletedAtIsNullOrderByPriorityAscIdAsc()).thenReturn(List.of());
        when(cipher.isConfigured()).thenReturn(true);

        var credentials = service.availableCredentials();

        assertTrue(credentials.isEmpty());
    }

    @Test
    void disabledDatabaseAccountPreventsHiddenEnvironmentFallback() {
        AiProviderAccount disabled = account(1L, false, AiProviderAccountStatus.VERIFIED, 10);
        when(repository.findByDeletedAtIsNullOrderByPriorityAscIdAsc()).thenReturn(List.of(disabled));
        when(cipher.isConfigured()).thenReturn(true);

        assertTrue(service.availableCredentials().isEmpty());
    }

    @Test
    void returnsEnabledVerifiedAccountsInRepositoryPriorityOrder() {
        AiProviderAccount primary = account(1L, true, AiProviderAccountStatus.VERIFIED, 10);
        AiProviderAccount secondary = account(2L, true, AiProviderAccountStatus.VERIFIED, 20);
        when(repository.findByDeletedAtIsNullOrderByPriorityAscIdAsc()).thenReturn(List.of(primary, secondary));
        when(cipher.isConfigured()).thenReturn(true);
        when(cipher.decrypt("cipher-1")).thenReturn("token-1");
        when(cipher.decrypt("cipher-2")).thenReturn("token-2");

        var credentials = service.availableCredentials();

        assertEquals(List.of(1L, 2L), credentials.stream().map(AiProviderAccountService.RuntimeCredential::id).toList());
        assertEquals(List.of("token-1", "token-2"), credentials.stream()
            .map(AiProviderAccountService.RuntimeCredential::apiToken).toList());
    }

    private AiProviderAccount account(Long id, boolean enabled, AiProviderAccountStatus status, int priority) {
        AiProviderAccount account = new AiProviderAccount();
        account.setId(id);
        account.setDisplayName("Account " + id);
        account.setAccountId("account-" + id);
        account.setApiTokenCiphertext("cipher-" + id);
        account.setAiModel("model-" + id);
        account.setEnabled(enabled);
        account.setHealthStatus(status);
        account.setPriority(priority);
        return account;
    }
}
