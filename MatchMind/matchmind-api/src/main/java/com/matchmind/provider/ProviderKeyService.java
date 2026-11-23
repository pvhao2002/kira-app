package com.matchmind.provider;

import com.matchmind.shared.AdminActions;
import com.matchmind.shared.AdminActions.Kind;
import com.matchmind.shared.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Per-provider API keys: {@code mmk_<keyId>_<secret>}. Only the SHA-256 of the 32-byte random secret is stored (a fast
 * hash is safe for a high-entropy secret, and every callback stays cheap). The full key is returned once, at issue.
 */
@Service
@RequiredArgsConstructor
public class ProviderKeyService {
    public static final String PREFIX = "mmk_";
    public static final String PREDICTIONS = "PREDICTIONS", SETTLE_REQUEST = "SETTLE_REQUEST", RESULTS = "RESULTS";
    public static final String ACCOUNT_IMPORT = "ACCOUNT_IMPORT";
    private static final List<String> SCOPE_ORDER = List.of(PREDICTIONS, SETTLE_REQUEST, RESULTS, ACCOUNT_IMPORT);
    public static final Set<String> ALL_SCOPES = Set.copyOf(SCOPE_ORDER);
    private static final List<String> DEFAULT_SCOPES = List.of(PREDICTIONS, SETTLE_REQUEST);
    private static final int KEY_ID_LENGTH = 12;
    private static final char[] BASE32 = "abcdefghijklmnopqrstuvwxyz234567".toCharArray();
    private static final byte[] NO_MATCH = new byte[64];
    private static final SecureRandom RANDOM = new SecureRandom();
    private final NamedParameterJdbcTemplate jdbc;
    private final AdminActions admin;

    public record IssuedKey(UUID id, String keyId, String label, String apiKey, List<String> scopes, Instant createdAt) {
    }

    public record KeyView(UUID id, String keyId, String label, List<String> scopes, String status, Instant createdAt,
                          Instant lastUsedAt, Instant revokedAt) {
    }

    public record KeyMatch(UUID keyRowId, UUID providerId, String providerCode, String providerStatus, Set<String> scopes) {
    }

    @Transactional
    public IssuedKey issue(UUID providerId, String label, List<String> scopes, UUID actor) {
        requireProvider(providerId);
        List<String> granted = validScopes(scopes == null ? DEFAULT_SCOPES : scopes);
        String keyId = randomKeyId();
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String secret = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String clean = label == null || label.isBlank() ? null : label.trim();
        var row = jdbc.queryForMap("""
                INSERT INTO provider_api_keys (provider_id, key_id, secret_hash, label, scopes, created_by)
                VALUES (:provider, :keyId, :hash, :label, CAST(:scopes AS varchar[]), :actor) RETURNING id, created_at""",
            new MapSqlParameterSource("provider", providerId).addValue("keyId", keyId).addValue("hash", sha256Hex(secret))
                .addValue("label", clean).addValue("scopes", pgArray(granted)).addValue("actor", actor));
        return new IssuedKey((UUID) row.get("id"), keyId, clean, PREFIX + keyId + "_" + secret, granted,
            ((Timestamp) row.get("created_at")).toInstant());
    }

    /** A new key with the old key's scopes; the old key keeps working until it is revoked (manual overlap). */
    @Transactional
    public IssuedKey rotate(UUID providerId, UUID keyRowId, String label, UUID actor) {
        KeyView old = active(providerId, keyRowId);
        return issue(providerId, label == null || label.isBlank() ? old.label() : label, old.scopes(), actor);
    }

    /** Idempotent: revoking a revoked key changes and logs nothing. Effective on the very next request (no cache). */
    @Transactional
    public void revoke(UUID providerId, UUID keyRowId, String reason, UUID actor) {
        KeyView key = get(providerId, keyRowId);
        int changed = jdbc.update("UPDATE provider_api_keys SET status = 'REVOKED', revoked_at = now() WHERE id = :id AND status = 'ACTIVE'",
            Map.of("id", keyRowId));
        if (changed > 0) admin.record(Kind.PROVIDER, providerId, "KEY_REVOKE", reason, actor, Map.of("keyId", key.keyId()));
    }

    @Transactional
    public KeyView setScopes(UUID providerId, UUID keyRowId, List<String> scopes, String reason, UUID actor) {
        KeyView key = active(providerId, keyRowId);
        List<String> granted = validScopes(scopes);
        if (jdbc.update("UPDATE provider_api_keys SET scopes = CAST(:scopes AS varchar[]) WHERE id = :id AND status = 'ACTIVE'",
            new MapSqlParameterSource("id", keyRowId).addValue("scopes", pgArray(granted))) == 0) {
            throw ApiException.conflict("KEY_REVOKED", "This API key is revoked; issue a new key instead");
        }
        admin.record(Kind.PROVIDER, providerId, "KEY_SCOPES", reason, actor,
            Map.of("keyId", key.keyId(), "from", key.scopes(), "to", granted));
        return get(providerId, keyRowId);
    }

    @Transactional(readOnly = true)
    public List<KeyView> list(UUID providerId) {
        requireProvider(providerId);
        return jdbc.query(KEY_SQL + " WHERE provider_id = :provider ORDER BY created_at DESC",
            Map.of("provider", providerId), (rs, i) -> view(rs));
    }

    /**
     * The active key and its provider for a presented {@code mmk_...} value, in one indexed lookup. The secret is
     * hashed and compared in constant time even when the key id is unknown, so timing does not reveal valid key ids.
     */
    @Transactional(readOnly = true)
    public Optional<KeyMatch> authenticate(String presented) {
        int split = PREFIX.length() + KEY_ID_LENGTH;
        boolean shaped = presented.startsWith(PREFIX) && presented.length() > split + 1 && presented.charAt(split) == '_';
        String keyId = shaped ? presented.substring(PREFIX.length(), split) : "";
        byte[] presentedHash = sha256Hex(shaped ? presented.substring(split + 1) : presented).getBytes(StandardCharsets.US_ASCII);
        List<Object[]> rows = shaped ? jdbc.query("""
                SELECT k.id, k.secret_hash, k.scopes, p.id AS provider_id, p.code, p.status
                FROM provider_api_keys k JOIN providers p ON p.id = k.provider_id
                WHERE k.key_id = :keyId AND k.status = 'ACTIVE'""", Map.of("keyId", keyId),
            (rs, i) -> new Object[] {new KeyMatch(rs.getObject("id", UUID.class), rs.getObject("provider_id", UUID.class),
                rs.getString("code"), rs.getString("status"), Set.copyOf(scopes(rs))), rs.getString("secret_hash")}) : List.of();
        byte[] stored = rows.isEmpty() ? NO_MATCH : ((String) rows.getFirst()[1]).getBytes(StandardCharsets.US_ASCII);
        boolean equal = MessageDigest.isEqual(presentedHash, stored);
        return equal && !rows.isEmpty() ? Optional.of((KeyMatch) rows.getFirst()[0]) : Optional.empty();
    }

    /** last_used_at, written at most once a minute per key so busy agents do not rewrite the row on every call. */
    public void touch(UUID keyRowId) {
        jdbc.update("""
            UPDATE provider_api_keys SET last_used_at = now()
            WHERE id = :id AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute')""", Map.of("id", keyRowId));
    }

    private static final String KEY_SQL = "SELECT id, key_id, label, scopes, status, created_at, last_used_at, revoked_at FROM provider_api_keys";

    private KeyView get(UUID providerId, UUID keyRowId) {
        return jdbc.query(KEY_SQL + " WHERE id = :id AND provider_id = :provider",
                Map.of("id", keyRowId, "provider", providerId), (rs, i) -> view(rs)).stream().findFirst()
            .orElseThrow(() -> ApiException.notFound("KEY_NOT_FOUND", "API key not found"));
    }

    /** A revoked key stays revoked: rotating it would issue a working key, re-scoping it would log a change that does nothing. */
    private KeyView active(UUID providerId, UUID keyRowId) {
        KeyView key = get(providerId, keyRowId);
        if (!"ACTIVE".equals(key.status())) throw ApiException.conflict("KEY_REVOKED", "This API key is revoked; issue a new key instead");
        return key;
    }

    private void requireProvider(UUID providerId) {
        if (jdbc.queryForList("SELECT 1 FROM providers WHERE id = :id", Map.of("id", providerId), Integer.class).isEmpty()) {
            throw Kind.PROVIDER.notFound();
        }
    }

    private static List<String> validScopes(List<String> scopes) {
        if (scopes == null || scopes.isEmpty() || !ALL_SCOPES.containsAll(scopes)) {
            throw ApiException.badRequest("INVALID_SCOPES", "Choose one or more scopes from " + String.join(", ", SCOPE_ORDER));
        }
        return SCOPE_ORDER.stream().filter(scopes::contains).toList();
    }

    private static List<String> scopes(ResultSet rs) throws SQLException {
        return Arrays.asList((String[]) rs.getArray("scopes").getArray());
    }

    private static KeyView view(ResultSet rs) throws SQLException {
        Timestamp used = rs.getTimestamp("last_used_at"), revoked = rs.getTimestamp("revoked_at");
        return new KeyView(rs.getObject("id", UUID.class), rs.getString("key_id"), rs.getString("label"), scopes(rs),
            rs.getString("status"), rs.getTimestamp("created_at").toInstant(), used == null ? null : used.toInstant(),
            revoked == null ? null : revoked.toInstant());
    }

    private static String pgArray(List<String> scopes) {
        return "{" + String.join(",", scopes) + "}";
    }

    private static String randomKeyId() {
        char[] id = new char[KEY_ID_LENGTH];
        for (int i = 0; i < id.length; i++) id[i] = BASE32[RANDOM.nextInt(BASE32.length)];
        return new String(id);
    }

    private static String sha256Hex(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
