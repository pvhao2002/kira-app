package com.kira.farm.identity.infrastructure;

import com.kira.farm.identity.domain.Role;
import com.kira.farm.identity.domain.User;
import com.kira.farm.identity.domain.UserStatus;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BootstrapAdminRunnerTest {
    private static final String PASSWORD = "a-long-password-1";
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);

    private BootstrapAdminRunner runner(String email, String password, String name) {
        return new BootstrapAdminRunner(users, encoder, email, password, name);
    }

    private User runAndCaptureSaved(String email, String password, String name) {
        when(encoder.encode(any())).thenReturn("hashed");
        runner(email, password, name).run(null);
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).save(saved.capture());
        return saved.getValue();
    }

    private void assertSkipped(String email, String password) {
        runner(email, password, "").run(null);
        verify(users, never()).save(any());
        verify(encoder, never()).encode(any());
    }

    @Test
    void createsTheFirstAdminWithNormalizedEmailAndHashedPassword() {
        User u = runAndCaptureSaved("  Boss@Kira.VN ", PASSWORD, "");
        assertEquals("boss@kira.vn", u.getEmail());
        assertEquals(Role.ADMIN, u.getRole());
        assertEquals("hashed", u.getPasswordHash());
        verify(encoder).encode(PASSWORD);
        // TOTP is enrolled at first login, so nothing may be pre-set
        assertEquals(UserStatus.ACTIVE, u.getStatus());
        assertNull(u.getTotpSecret());
        assertFalse(u.isTotpEnabled());
    }

    @Test
    void usesDefaultNameWhenBlankAndCustomNameWhenGiven() {
        assertEquals("Quản trị viên", runAndCaptureSaved("boss@kira.vn", PASSWORD, "  ").getFullName());
    }

    @Test
    void usesCustomName() {
        assertEquals("Boss", runAndCaptureSaved("boss@kira.vn", PASSWORD, " Boss ").getFullName());
    }

    @Test
    void acceptsPasswordOfExactlyMinimumLength() {
        runAndCaptureSaved("boss@kira.vn", "a".repeat(BootstrapAdminRunner.MIN_PASSWORD), "");
    }

    @Test
    void skipsWhenEmailIsMissingOrBlank() {
        assertSkipped("", PASSWORD);
        assertSkipped("   ", PASSWORD);
    }

    @Test
    void skipsWhenPasswordIsMissing() {
        assertSkipped("boss@kira.vn", "");
    }

    @Test
    void skipsWhenPasswordIsOneCharBelowMinimum() {
        assertSkipped("boss@kira.vn", "a".repeat(BootstrapAdminRunner.MIN_PASSWORD - 1));
    }

    @Test
    void doesNotCreateWhenAnAdminAlreadyExists() {
        when(users.existsByRole(Role.ADMIN)).thenReturn(true);
        assertSkipped("boss@kira.vn", PASSWORD);
    }

    @Test
    void doesNotOverwriteWhenTheEmailAlreadyExists() {
        when(users.existsByEmailIgnoreCase("boss@kira.vn")).thenReturn(true);
        assertSkipped("boss@kira.vn", PASSWORD);
    }
}
