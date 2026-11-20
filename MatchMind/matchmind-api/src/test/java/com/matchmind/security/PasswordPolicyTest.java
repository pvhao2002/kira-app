package com.matchmind.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordPolicyTest {
    @Test
    void rejectsTrivialPasswords() {
        assertThat(PasswordPolicy.problem("aaaaaaaaaa", "bob")).contains("repeat");
        assertThat(PasswordPolicy.problem("1234567890", "bob")).contains("sequence");
        assertThat(PasswordPolicy.problem("9876543210", "bob")).contains("sequence");
        assertThat(PasswordPolicy.problem("abcdefghijkl", "bob")).contains("sequence");
        assertThat(PasswordPolicy.problem("ababababab", "bob")).contains("repeat");
        assertThat(PasswordPolicy.problem("Password123", "bob")).contains("common");
        assertThat(PasswordPolicy.problem("qwertyuiop", "bob")).contains("common");
        assertThat(PasswordPolicy.problem("PASSWORD1234", "bob")).contains("common");
        assertThat(PasswordPolicy.problem("matchmind2026", "bob")).contains("common");
        assertThat(PasswordPolicy.problem("bobbobbobbob", "bob")).isNotNull();
        assertThat(PasswordPolicy.problem("administrator", "bob")).contains("common");
    }

    @Test
    void rejectsPasswordEqualToUsername() {
        assertThat(PasswordPolicy.problem("alexander-the-great", "Alexander-The-Great")).contains("user name");
    }

    @Test
    void acceptsReasonablePasswords() {
        assertThat(PasswordPolicy.problem("viewer-password-1", "viewer1")).isNull();
        assertThat(PasswordPolicy.problem("target-password-1", "target")).isNull();
        assertThat(PasswordPolicy.problem("admin-password-123", "admin")).isNull();
        assertThat(PasswordPolicy.problem("correct horse battery staple", "bob")).isNull();
        assertThat(PasswordPolicy.problem("Tr0ub4dor&3xy", "bob")).isNull();
    }

    @Test
    void generatedPasswordsPassThePolicy() {
        for (int i = 0; i < 200; i++) {
            String p = PasswordPolicy.generate();
            assertThat(p).hasSize(16);
            assertThat(PasswordPolicy.problem(p, "bob")).isNull();
        }
        assertThat(PasswordPolicy.generate()).isNotEqualTo(PasswordPolicy.generate());
    }
}
