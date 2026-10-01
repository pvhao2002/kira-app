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
    private AuthDtos() {
    }

    public record RegisterRequest(
        @NotBlank(message = "Vui lòng nhập họ tên") @Size(max = 120) String fullName,
        @NotBlank(message = "Vui lòng nhập email") @Email(message = "Email không hợp lệ") @Size(max = 190) String email,
        @Pattern(regexp = "^$|^(\\+84|0)[0-9 .]{8,12}$", message = "Số điện thoại không hợp lệ") String phone,
        @NotBlank(message = "Vui lòng nhập mật khẩu") @Size(min = 8, max = 72, message = "Mật khẩu từ 8 đến 72 ký tự") String password) {
    }

    /** identifier is an email or a phone number ("email" / "phone" are accepted as aliases). */
    public record LoginRequest(
        @NotBlank(message = "Vui lòng nhập email hoặc số điện thoại") @Size(max = 190)
        @JsonAlias({"email", "phone"}) String identifier,
        @NotBlank(message = "Vui lòng nhập mật khẩu") @Size(max = 72) String password) {
    }

    public record UserProfile(Long id, String email, String phone, String fullName, LocalDate birthDate, Gender gender,
                              Role role, List<Long> branchIds) {
    }

    /** Full replace of the editable profile fields; phone/birthDate/gender may be null to clear them. */
    public record UpdateProfileRequest(
        @NotBlank(message = "Vui lòng nhập họ tên") @Size(max = 120, message = "Họ tên tối đa 120 ký tự") String fullName,
        @Pattern(regexp = "^$|^(\\+84|0)[0-9 .]{8,12}$", message = "Số điện thoại không hợp lệ") String phone,
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
}
