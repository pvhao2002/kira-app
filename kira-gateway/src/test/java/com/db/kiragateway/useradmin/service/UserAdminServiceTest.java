package com.db.kiragateway.useradmin.service;

import com.db.kiragateway.useradmin.dto.CreateUserRequest;
import com.db.kiragateway.useradmin.model.UserAdminRow;
import com.db.kiragateway.useradmin.repository.UserAdminRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserAdminServiceTest {

    @Mock
    private UserAdminRepository userAdminRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserAdminService userAdminService;

    @BeforeEach
    void setUp() {
        userAdminService = new UserAdminService(userAdminRepository, passwordEncoder);
    }

    @Test
    void create_shouldReloadCreatedUserFromWriteDatabase() {
        var row = new UserAdminRow(
                42,
                "new_user",
                "active",
                "user",
                null,
                LocalDateTime.now(),
                LocalDateTime.now()
        );

        when(userAdminRepository.existsByUsernameForWrite("new_user")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("hash");
        when(userAdminRepository.insert("new_user", "hash", "active", "user")).thenReturn(1);
        when(userAdminRepository.findByUsernameForWrite("new_user")).thenReturn(Optional.of(row));

        var created = userAdminService.create(new CreateUserRequest(" new_user ", "secret123", null));

        assertEquals(row, created);
        verify(userAdminRepository, never()).existsByUsername("new_user");
        verify(userAdminRepository, never()).findByUsername("new_user");
    }

    @Test
    void create_shouldReturnConflictMessageWhenInsertHitsDuplicateKey() {
        when(userAdminRepository.existsByUsernameForWrite("taken")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("hash");
        when(userAdminRepository.insert("taken", "hash", "active", "user"))
                .thenThrow(new DuplicateKeyException("duplicate"));

        var ex = assertThrows(
                IllegalStateException.class,
                () -> userAdminService.create(new CreateUserRequest("taken", "secret123", "user"))
        );

        assertEquals("Username already exists", ex.getMessage());
    }
}
