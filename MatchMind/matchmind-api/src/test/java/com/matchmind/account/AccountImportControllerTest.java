package com.matchmind.account;

import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountImportControllerTest {
    @Test
    void createsAnImportOwnedByTheSignedInUserAndAPromptForAttachedScreenshots() {
        var jdbc = mock(JdbcTemplate.class);
        var owner = new UserPrincipal(UUID.randomUUID(), "kim", "VIEWER");
        var result = new AccountImportController(jdbc, "https://sheet").create(owner);
        verify(jdbc).update("insert into account_images (id,user_id) values (?,?)", result.importId(), owner.id());
        assertThat(result.prompt()).contains(result.importId().toString(), "https://sheet", "ACCOUNT", "attached", "once");
    }

    @Test
    void needsTheSharedSheet() {
        var api = new AccountImportController(mock(JdbcTemplate.class), "");
        assertThatThrownBy(() -> api.create(new UserPrincipal(UUID.randomUUID(), "kim", "VIEWER")))
            .isInstanceOf(ApiException.class).hasMessageContaining("Google Sheet");
    }
}
