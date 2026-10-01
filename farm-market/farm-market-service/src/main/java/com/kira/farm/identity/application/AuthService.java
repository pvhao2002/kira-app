package com.kira.farm.identity.application;

import com.kira.farm.identity.domain.Gender;
import com.kira.farm.identity.domain.RefreshToken;
import com.kira.farm.identity.domain.Role;
import com.kira.farm.identity.domain.User;
import com.kira.farm.identity.domain.UserStatus;
import com.kira.farm.identity.infrastructure.RefreshTokenRepository;
import com.kira.farm.identity.infrastructure.UserRepository;
import com.kira.farm.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

import static com.kira.farm.identity.application.AuthDtos.*;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository users;
    private final RefreshTokenRepository tokens;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final LoginRateLimiter limiter;
    private final TotpCrypto totpCrypto;
    @Value("${app.jwt.refresh-ttl}")
    private Duration refreshTtl;
    private static final String OTP_ISSUER = "Doi Nang";
    private volatile String dummyHash;

    /** Public self-registration always creates a CUSTOMER; staff/manager/admin are provisioned by an admin. */
    @Transactional
    public Session register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String phone = normalizePhone(request.phone());
        if (users.existsByEmailIgnoreCase(email))
            throw ApiException.conflict("EMAIL_EXISTS", "Email đã được sử dụng");
        if (phone != null && users.existsByPhone(phone))
            throw ApiException.conflict("PHONE_EXISTS", "Số điện thoại đã được sử dụng");
        User user = new User();
        user.setEmail(email);
        user.setPhone(phone);
        user.setPasswordHash(encoder.encode(request.password()));
        user.setFullName(request.fullName().trim());
        user.setRole(Role.CUSTOMER);
        users.saveAndFlush(user);
        return newSession(user, UUID.randomUUID().toString());
    }

    @Transactional
    public LoginResult login(LoginRequest request) {
        String id = request.identifier().trim();
        limiter.check(id);
        String phone = normalizePhone(id);
        User user = (id.contains("@") ? users.findByEmailIgnoreCase(id.toLowerCase(Locale.ROOT))
            : phone == null ? java.util.Optional.<User>empty() : users.findByPhone(phone)).orElse(null);
        // Spend the same bcrypt cost for unknown users so timing does not reveal which accounts exist.
        boolean ok = encoder.matches(request.password(), user == null ? dummyHash() : user.getPasswordHash());
        if (user == null || !ok) {
            limiter.recordFailure(id);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Email/số điện thoại hoặc mật khẩu không đúng");
        }
        if (user.getStatus() != UserStatus.ACTIVE)
            throw ApiException.forbidden("ACCOUNT_LOCKED", "Tài khoản đã bị khóa");
        limiter.recordSuccess(id);
        // Back-office roles get no tokens until the second factor is verified.
        if (user.getRole().isBackoffice())
            return new LoginResult(null, new OtpChallenge(true, jwt.issueChallenge(user.getId()), user.isTotpEnabled()));
        return new LoginResult(newSession(user, UUID.randomUUID().toString()), null);
    }

    /** Creates (or replaces, while still unconfirmed) the user's TOTP secret. Enabled only by a valid verify. */
    @Transactional
    public OtpEnrollResponse enrollOtp(OtpEnrollRequest request) {
        User user = challengeUser(request.challengeToken());
        if (user.isTotpEnabled())
            throw ApiException.conflict("OTP_ALREADY_ENROLLED", "Tài khoản đã đăng ký xác thực hai lớp");
        String secret = Totp.newSecret();
        user.setTotpSecret(totpCrypto.encrypt(secret));
        user.setTotpLastStep(null);
        users.saveAndFlush(user);
        return new OtpEnrollResponse(secret, Totp.otpauthUri(OTP_ISSUER, user.getEmail(), secret));
    }

    @Transactional
    public Session verifyOtp(OtpVerifyRequest request) {
        User user = challengeUser(request.challengeToken());
        limiter.checkOtp(user.getId());
        long step = -1;
        if (user.getTotpSecret() != null) {
            byte[] key = Totp.fromBase32(totpCrypto.decrypt(user.getTotpSecret()));
            step = Totp.match(key, Totp.stepAt(Instant.now().getEpochSecond()), user.getTotpLastStep(), request.code().trim());
        }
        // advanceTotpStep is the atomic replay guard: it updates nothing if this step was already consumed.
        if (step < 0 || users.advanceTotpStep(user.getId(), step) == 0) {
            limiter.recordOtpFailure(user.getId());
            throw invalidOtp();
        }
        limiter.recordOtpSuccess(user.getId());
        User fresh = users.findById(user.getId()).orElseThrow(this::invalidOtp);
        if (!fresh.isTotpEnabled()) {
            fresh.setTotpEnabled(true);
            users.saveAndFlush(fresh);
        }
        return newSession(fresh, UUID.randomUUID().toString());
    }

    private User challengeUser(String token) {
        Long id;
        try {
            id = jwt.challengeSubject(token);
        } catch (RuntimeException e) {
            throw invalidOtp();
        }
        return users.findById(id).filter(u -> u.getStatus() == UserStatus.ACTIVE && u.getRole().isBackoffice())
            .orElseThrow(this::invalidOtp);
    }

    private ApiException invalidOtp() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "OTP_INVALID", "Mã xác thực không đúng hoặc đã hết hạn");
    }

    /** Rotates the refresh token; reuse of a revoked token revokes the whole family. */
    @Transactional(noRollbackFor = ApiException.class)
    public Session refresh(String raw) {
        RefreshToken old = tokens.findByTokenHash(hash(raw)).orElseThrow(this::invalidRefresh);
        if (old.getRevokedAt() != null || old.getExpiresAt().isBefore(Instant.now())) {
            tokens.findByFamilyIdAndRevokedAtIsNull(old.getFamilyId()).forEach(t -> t.setRevokedAt(Instant.now()));
            throw invalidRefresh();
        }
        if (old.getUser().getStatus() != UserStatus.ACTIVE) {
            old.setRevokedAt(Instant.now());
            throw invalidRefresh();
        }
        old.setRevokedAt(Instant.now());
        Session session = newSession(old.getUser(), old.getFamilyId());
        old.setReplacedByHash(hash(session.refreshToken()));
        return session;
    }

    @Transactional
    public void logout(String raw) {
        if (raw != null) tokens.findByTokenHash(hash(raw)).ifPresent(t -> t.setRevokedAt(Instant.now()));
    }

    @Transactional(readOnly = true)
    public UserProfile me(Long userId) {
        return profile(users.findById(userId).orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND",
            "Không tìm thấy người dùng")));
    }

    @Transactional
    public UserProfile updateProfile(Long userId, UpdateProfileRequest r) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND",
            "Không tìm thấy người dùng"));
        String phone = normalizePhone(r.phone());
        if (phone != null && users.existsByPhoneAndIdNot(phone, userId))
            throw ApiException.conflict("PHONE_EXISTS", "Số điện thoại đã được sử dụng");
        user.setFullName(r.fullName().trim());
        user.setPhone(phone);
        user.setBirthDate(r.birthDate());
        user.setGender(r.gender() == null ? null : Gender.valueOf(r.gender()));
        users.saveAndFlush(user);
        return profile(user);
    }

    public static String normalizePhone(String phone) {
        if (phone == null) return null;
        String p = phone.replaceAll("[ .]", "");
        return p.isEmpty() ? null : p;
    }

    private Session newSession(User user, String family) {
        String raw = UUID.randomUUID() + "." + UUID.randomUUID();
        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(hash(raw));
        token.setFamilyId(family);
        token.setExpiresAt(Instant.now().plus(refreshTtl));
        tokens.save(token);
        return new Session(new AuthResponse(jwt.issue(user), "Bearer", jwt.expiresInSeconds(), profile(user)), raw);
    }

    private UserProfile profile(User u) {
        return new UserProfile(u.getId(), u.getEmail(), u.getPhone(), u.getFullName(), u.getBirthDate(),
            u.getGender(), u.getRole(),
            u.getBranchIds().stream().sorted().toList());
    }

    private String dummyHash() {
        String h = dummyHash;
        if (h == null) dummyHash = h = encoder.encode(UUID.randomUUID().toString());
        return h;
    }

    private ApiException invalidRefresh() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN",
            "Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Exactly one of session (customers) or challenge (back-office, password ok, OTP pending) is set. */
    public record LoginResult(Session session, OtpChallenge challenge) {
    }

    public record Session(AuthResponse response, String refreshToken) {
    }
}
