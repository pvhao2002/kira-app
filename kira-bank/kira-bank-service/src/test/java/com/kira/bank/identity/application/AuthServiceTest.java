package com.kira.bank.identity.application;

import com.kira.bank.identity.domain.Role;
import com.kira.bank.identity.domain.User;
import com.kira.bank.identity.infrastructure.RefreshTokenRepository;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.shared.web.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock
    UserRepository users;
    @Mock
    RefreshTokenRepository tokens;
    @InjectMocks
    AuthService auth;

    private User user(long id, String role) {
        User user = new User();
        user.setId(id);
        Role r = new Role();
        r.setName(role);
        user.getRoles().add(r);
        return user;
    }

    @Test
    void updateStatusLocksAnotherAdmin() {
        when(users.findByIdForUpdate(2L)).thenReturn(Optional.of(user(2, "ROLE_ADMIN")));
        var result = auth.updateStatus(1L, 2L, new AuthDtos.UpdateUserStatusRequest("LOCKED"));
        assertEquals("LOCKED", result.status());
    }

    @Test
    void updateStatusRejectsSelf() {
        ApiException ex = assertThrows(ApiException.class,
            () -> auth.updateStatus(1L, 1L, new AuthDtos.UpdateUserStatusRequest("LOCKED")));
        assertEquals("CANNOT_CHANGE_OWN_STATUS", ex.getCode());
    }

    @Test
    void deleteUserRejectsSelf() {
        ApiException ex = assertThrows(ApiException.class, () -> auth.deleteUser(1L, 1L));
        assertEquals("CANNOT_DELETE_SELF", ex.getCode());
        verifyNoInteractions(users);
    }

    @Test
    void deleteUserSoftDeletesAndRevokesTokens() {
        User target = user(2, "ROLE_USER");
        when(users.findByIdForUpdate(2L)).thenReturn(Optional.of(target));
        auth.deleteUser(1L, 2L);
        assertNotNull(target.getDeletedAt());
        verify(tokens).revokeAllByUserId(eq(2L), any(Instant.class));
    }

    @Test
    void deleteUserMissing() {
        when(users.findByIdForUpdate(9L)).thenReturn(Optional.empty());
        ApiException ex = assertThrows(ApiException.class, () -> auth.deleteUser(1L, 9L));
        assertEquals("USER_NOT_FOUND", ex.getCode());
    }
}
