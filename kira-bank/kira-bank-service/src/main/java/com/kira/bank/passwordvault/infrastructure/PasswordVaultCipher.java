package com.kira.bank.passwordvault.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.passwordvault.application.PasswordVaultDtos.VaultSecret;
import com.kira.bank.shared.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.*;
import java.util.regex.Pattern;

@Component
public class PasswordVaultCipher {
    public static final short CRYPTO_VERSION = 1;
    private static final int KEY_BYTES = 32;
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final Pattern KEY_ID = Pattern.compile("[A-Za-z0-9._-]{1,50}");

    private final SecureRandom random = new SecureRandom();
    private final ObjectMapper objectMapper;
    private final Map<String, byte[]> keys;
    private final String activeKeyId;

    public PasswordVaultCipher(ObjectMapper objectMapper,
                               @Value("${password-vault.encryption-keys:}") String configuredKeys,
                               @Value("${password-vault.active-key-id:}") String activeKeyId) {
        this.objectMapper = objectMapper;
        this.keys = parseKeys(configuredKeys);
        this.activeKeyId = activeKeyId == null ? "" : activeKeyId.trim();
        if (!this.activeKeyId.isBlank() && !this.keys.containsKey(this.activeKeyId)) {
            throw new IllegalStateException("Password vault active key ID is not present in the configured key ring");
        }
    }

    public EncryptedSecret encrypt(Long ownerId, Long moduleId, String accountUuid, VaultSecret secret) {
        requireActiveKey();
        byte[] dek = randomBytes(KEY_BYTES);
        byte[] secretNonce = randomBytes(NONCE_BYTES);
        byte[] wrapNonce = randomBytes(NONCE_BYTES);
        try {
            byte[] plaintext = objectMapper.writeValueAsBytes(secret);
            byte[] ciphertext = crypt(Cipher.ENCRYPT_MODE, dek, secretNonce,
                secretAad(ownerId, moduleId, accountUuid), plaintext);
            byte[] wrappedDek = crypt(Cipher.ENCRYPT_MODE, keys.get(activeKeyId), wrapNonce,
                wrapAad(ownerId, moduleId, accountUuid, activeKeyId), dek);
            return new EncryptedSecret(encode(ciphertext), encode(secretNonce), encode(wrappedDek), encode(wrapNonce),
                activeKeyId, CRYPTO_VERSION);
        } catch (GeneralSecurityException | JsonProcessingException ex) {
            throw cryptoFailure(ex);
        } finally {
            Arrays.fill(dek, (byte) 0);
        }
    }

    public VaultSecret decrypt(Long ownerId, Long moduleId, String accountUuid, String ciphertext,
                               String secretNonce, String wrappedDek, String wrapNonce,
                               String keyId, short cryptoVersion) {
        if (cryptoVersion != CRYPTO_VERSION) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "VAULT_CRYPTO_VERSION_UNSUPPORTED",
                "Phiên bản mã hóa password vault chưa được hỗ trợ");
        }
        byte[] kek = keys.get(keyId);
        if (kek == null) throw keyUnavailable();
        byte[] dek = null;
        try {
            dek = crypt(Cipher.DECRYPT_MODE, kek, decode(wrapNonce),
                wrapAad(ownerId, moduleId, accountUuid, keyId), decode(wrappedDek));
            byte[] plaintext = crypt(Cipher.DECRYPT_MODE, dek, decode(secretNonce),
                secretAad(ownerId, moduleId, accountUuid), decode(ciphertext));
            return objectMapper.readValue(plaintext, VaultSecret.class);
        } catch (GeneralSecurityException | IllegalArgumentException | IOException ex) {
            throw cryptoFailure(ex);
        } finally {
            if (dek != null) Arrays.fill(dek, (byte) 0);
        }
    }

    public boolean needsRotation(String keyId) {
        requireActiveKey();
        return !activeKeyId.equals(keyId);
    }

    private byte[] crypt(int mode, byte[] key, byte[] nonce, byte[] aad, byte[] input)
        throws GeneralSecurityException {
        if (nonce.length != NONCE_BYTES) throw new GeneralSecurityException("Invalid nonce length");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_BITS, nonce));
        cipher.updateAAD(aad);
        return cipher.doFinal(input);
    }

    private byte[] secretAad(Long ownerId, Long moduleId, String uuid) {
        return ("password-vault-secret|" + CRYPTO_VERSION + "|" + ownerId + "|" + moduleId + "|" + uuid)
            .getBytes(StandardCharsets.UTF_8);
    }

    private byte[] wrapAad(Long ownerId, Long moduleId, String uuid, String keyId) {
        return ("password-vault-dek|" + CRYPTO_VERSION + "|" + ownerId + "|" + moduleId + "|" + uuid + "|" + keyId)
            .getBytes(StandardCharsets.UTF_8);
    }

    private Map<String, byte[]> parseKeys(String configured) {
        if (configured == null || configured.isBlank()) return Map.of();
        Map<String, byte[]> parsed = new LinkedHashMap<>();
        for (String entry : configured.split(",")) {
            int separator = entry.indexOf(':');
            if (separator <= 0 || separator == entry.length() - 1) {
                throw new IllegalStateException("Password vault key ring must use keyId:base64 entries");
            }
            String id = entry.substring(0, separator).trim();
            if (!KEY_ID.matcher(id).matches() || parsed.containsKey(id)) {
                throw new IllegalStateException("Password vault key ID is invalid or duplicated");
            }
            byte[] key;
            try {
                key = Base64.getDecoder().decode(entry.substring(separator + 1).trim());
            } catch (IllegalArgumentException ex) {
                throw new IllegalStateException("Password vault encryption key must be Base64", ex);
            }
            if (key.length != KEY_BYTES) {
                throw new IllegalStateException("Password vault encryption keys must decode to 32 bytes");
            }
            parsed.put(id, key);
        }
        return Collections.unmodifiableMap(parsed);
    }

    private void requireActiveKey() {
        if (activeKeyId.isBlank() || !keys.containsKey(activeKeyId)) throw keyUnavailable();
    }

    private ApiException keyUnavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "VAULT_KEY_UNAVAILABLE",
            "Password vault chưa được cấu hình khóa mã hóa");
    }

    private ApiException cryptoFailure(Exception ex) {
        return new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "VAULT_DECRYPTION_FAILED",
            "Không thể xử lý dữ liệu password vault");
    }

    private byte[] randomBytes(int size) {
        byte[] value = new byte[size];
        random.nextBytes(value);
        return value;
    }

    private String encode(byte[] value) { return Base64.getEncoder().encodeToString(value); }
    private byte[] decode(String value) { return Base64.getDecoder().decode(value); }

    public record EncryptedSecret(String ciphertext, String secretNonce, String wrappedDek,
                                  String wrapNonce, String keyId, short cryptoVersion) {}
}
