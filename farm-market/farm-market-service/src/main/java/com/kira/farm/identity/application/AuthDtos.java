package com.kira.farm.identity.application;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.kira.farm.identity.domain.Gender;
import com.kira.farm.identity.domain.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public final class AuthDtos {
    public static final String PHONE_REGEX = "^$|^(\\+84|0)[0-9 .]{8,12}$";
    public static final String PHONE_MESSAGE = "Số điện thoại không hợp lệ";
    public static final String PASSWORD_MESSAGE = "Mật khẩu từ 8 đến 72 ký tự";

    private AuthDtos() {
    }

    public record RegisterRequest(
        @NotBlank(message = "Vui lòng nhập họ tên") @Size(max = 120) String fullName,
        @NotBlank(message = "Vui lòng nhập email") @Email(message = "Email không hợp lệ") @Size(max = 190) String email,
        @Pattern(regexp = PHONE_REGEX, message = PHONE_MESSAGE) String phone,
        @NotBlank(message = "Vui lòng nhập mật khẩu") @Size(min = 8, max = 72, message = PASSWORD_MESSAGE) String password) {
    }

    /** identifier is an email or a phone number ("email" / "phone" are accepted as aliases). */
    public record LoginRequest(
        @NotBlank(message = "Vui lòng nhập email hoặc số điện thoại") @Size(max = 190)
        @JsonAlias({"email", "phone"}) String identifier,
        @NotBlank(message = "Vui lòng nhập mật khẩu") @Size(max = 72) String password,
        /** Public IP the browser got from ipify; optional and self-reported, so informational only. */
        @Size(max = 45) String clientIp) {
    }

    public record UserProfile(Long id, String email, String phone, String fullName, LocalDate birthDate, Gender gender,
                              Role role, List<Long> branchIds) {
    }

    /** Full replace of the editable profile fields; phone/birthDate/gender may be null to clear them. */
    public record UpdateProfileRequest(
        @NotBlank(message = "Vui lòng nhập họ tên") @Size(max = 120, message = "Họ tên tối đa 120 ký tự") String fullName,
        @Pattern(regexp = PHONE_REGEX, message = PHONE_MESSAGE) String phone,
        @Past(message = "Ngày sinh không hợp lệ") LocalDate birthDate,
        @Pattern(regexp = "^(MALE|FEMALE|OTHER)$", message = "Giới tính không hợp lệ") String gender) {
    }

    public record AuthResponse(String accessToken, String tokenType, long expiresIn, UserProfile user) {
    }

    /** Returned by /auth/login for back-office roles instead of tokens. */
    public record OtpChallenge(boolean otpRequired, String challengeToken, boolean enrolled) {
    }

    public record OtpEnrollRequest(@NotBlank @Size(max = 2000) String challengeToken) {
    }

    public record OtpEnrollResponse(String secret, String otpauthUri) {
    }

    public record OtpVerifyRequest(@NotBlank @Size(max = 2000) String challengeToken,
                                   @NotBlank @Size(max = 10) String code) {
    }

    public record ChangePasswordRequest(
        @NotBlank(message = "Vui lòng nhập mật khẩu hiện tại") @Size(max = 72) String currentPassword,
        @NotBlank(message = "Vui lòng nhập mật khẩu mới") @Size(min = 8, max = 72, message = PASSWORD_MESSAGE) String newPassword) {
    }

    public record ForgotPasswordRequest(
        @NotBlank(message = "Vui lòng nhập email") @Email(message = "Email không hợp lệ") @Size(max = 190) String email) {
    }

    public record ResetPasswordRequest(
        @NotBlank(message = "Liên kết không hợp lệ") @Size(max = 200) String token,
        @NotBlank(message = "Vui lòng nhập mật khẩu mới") @Size(min = 8, max = 72, message = PASSWORD_MESSAGE) String newPassword) {
    }
}
