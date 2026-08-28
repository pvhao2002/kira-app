package com.kira.bank.passwordvault.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.passwordvault.application.PasswordVaultDtos.VaultSecret;
import com.kira.bank.shared.web.ApiException;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PasswordVaultCipherTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String key1 = Base64.getEncoder().encodeToString(bytes(1));
    private final String key2 = Base64.getEncoder().encodeToString(bytes(33));
    private final VaultSecret secret = new VaultSecret("user@example.com", "S3cret!", "https://example.com", "private");

    @Test
    void encryptsWithRandomDekAndNonceAndDecryptsTheOriginalSecret() {
        PasswordVaultCipher cipher = new PasswordVaultCipher(objectMapper, "v1:" + key1, "v1");

        var first = cipher.encrypt(7L, 9L, "2aa4b2fd-06ba-4ed7-9c85-bad901c4c486", secret);
        var second = cipher.encrypt(7L, 9L, "2aa4b2fd-06ba-4ed7-9c85-bad901c4c486", secret);

        assertThat(first.ciphertext()).isNotEqualTo(second.ciphertext());
        assertThat(first.wrappedDek()).isNotEqualTo(second.wrappedDek());
        assertThat(decrypt(cipher, first, 7L)).isEqualTo(secret);
    }

    @Test
    void rejectsTamperedCiphertextAndDifferentOwnerAad() {
        PasswordVaultCipher cipher = new PasswordVaultCipher(objectMapper, "v1:" + key1, "v1");
        var encrypted = cipher.encrypt(7L, 9L, "2aa4b2fd-06ba-4ed7-9c85-bad901c4c486", secret);
        String tampered = encrypted.ciphertext().substring(0, encrypted.ciphertext().length() - 2) + "AA";

        assertThatThrownBy(() -> cipher.decrypt(7L, 9L, "2aa4b2fd-06ba-4ed7-9c85-bad901c4c486",
            tampered, encrypted.secretNonce(), encrypted.wrappedDek(), encrypted.wrapNonce(),
            encrypted.keyId(), encrypted.cryptoVersion()))
            .isInstanceOf(ApiException.class).extracting("code").isEqualTo("VAULT_DECRYPTION_FAILED");
        assertThatThrownBy(() -> decrypt(cipher, encrypted, 8L))
            .isInstanceOf(ApiException.class).extracting("code").isEqualTo("VAULT_DECRYPTION_FAILED");
    }

    @Test
    void readsOldKeyAndWritesWithTheActiveRotationKey() {
        PasswordVaultCipher old = new PasswordVaultCipher(objectMapper, "v1:" + key1, "v1");
        var oldValue = old.encrypt(7L, 9L, "2aa4b2fd-06ba-4ed7-9c85-bad901c4c486", secret);
        PasswordVaultCipher rotated = new PasswordVaultCipher(objectMapper,
            "v1:" + key1 + ",v2:" + key2, "v2");

        assertThat(decrypt(rotated, oldValue, 7L)).isEqualTo(secret);
        assertThat(rotated.needsRotation(oldValue.keyId())).isTrue();
        assertThat(rotated.encrypt(7L, 9L, "2aa4b2fd-06ba-4ed7-9c85-bad901c4c486", secret).keyId()).isEqualTo("v2");
    }

    @Test
    void failsClosedWithoutAnEncryptionKey() {
        PasswordVaultCipher cipher = new PasswordVaultCipher(objectMapper, "", "");
        assertThatThrownBy(() -> cipher.encrypt(7L, 9L, "uuid", secret))
            .isInstanceOf(ApiException.class).extracting("code").isEqualTo("VAULT_KEY_UNAVAILABLE");
    }

    private VaultSecret decrypt(PasswordVaultCipher cipher, PasswordVaultCipher.EncryptedSecret encrypted, Long ownerId) {
        return cipher.decrypt(ownerId, 9L, "2aa4b2fd-06ba-4ed7-9c85-bad901c4c486",
            encrypted.ciphertext(), encrypted.secretNonce(), encrypted.wrappedDek(), encrypted.wrapNonce(),
            encrypted.keyId(), encrypted.cryptoVersion());
    }

    private byte[] bytes(int start) {
        byte[] value = new byte[32];
        for (int index = 0; index < value.length; index++) value[index] = (byte) (start + index);
        return value;
    }
}
