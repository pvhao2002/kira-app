package com.kira.bank.identity.application;
import com.kira.bank.identity.domain.User;
import org.junit.jupiter.api.Test;
import java.time.Duration;
import static org.assertj.core.api.Assertions.assertThat;
class JwtServiceTest {@Test void tokenRoundTripUsesUserIdAsSubject(){JwtService service=new JwtService("a-secure-test-secret-that-is-longer-than-32-bytes",Duration.ofMinutes(15));User user=new User();user.setId(42L);user.setEmail("user@kira.local");assertThat(service.subject(service.issue(user))).isEqualTo(42L);}}

