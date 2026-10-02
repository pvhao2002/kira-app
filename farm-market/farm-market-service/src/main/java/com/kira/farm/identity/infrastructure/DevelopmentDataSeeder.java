package com.kira.farm.identity.infrastructure;

import com.kira.farm.branch.domain.Branch;
import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.identity.application.TotpCrypto;
import com.kira.farm.identity.domain.Role;
import com.kira.farm.identity.domain.User;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.stream.Collectors;

/** Dev-only demo accounts (match the UI demo users). Runs only when APP_SEED_DEVELOPMENT_USERS=true. Idempotent. */
@Component
@Order(1)
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app", name = "seed-development-users", havingValue = "true")
public class DevelopmentDataSeeder implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DevelopmentDataSeeder.class);
    private final UserRepository users;
    private final BranchRepository branches;
    private final PasswordEncoder encoder;
    private final TotpCrypto totpCrypto;
    @Value("${app.seed-development-totp-secret}")
    private String totpSecret;
    @Value("${app.seed-development-password}")
    private String password;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seed("lan.nguyen@gmail.com", "0903128456", "Nguyễn Thị Lan", Role.CUSTOMER);
        seed("minh.tran@kirafarm.vn", "0901000001", "Trần Văn Minh", Role.STAFF, "Q7");
        seed("ngoc.le@kirafarm.vn", "0901000002", "Lê Thị Ngọc", Role.MANAGER, "Q3", "TD");
        seed("admin@kirafarm.vn", "0901000003", "Quản trị viên", Role.ADMIN);
        log.warn("Development users seeded (APP_SEED_DEVELOPMENT_USERS=true). Never enable this in production.");
    }

    private void seed(String email, String phone, String fullName, Role role, String... branchCodes) {
        var existing = users.findByEmailIgnoreCase(email);
        if (existing.isPresent()) {
            enrollTotp(existing.get());
            return;
        }
        User u = new User();
        u.setEmail(email);
        u.setPhone(phone);
        u.setFullName(fullName);
        u.setRole(role);
        u.setPasswordHash(encoder.encode(password));
        Set<Long> ids = java.util.Arrays.stream(branchCodes)
            .map(code -> branches.findByCode(code).map(Branch::getId).orElseThrow())
            .collect(Collectors.toSet());
        u.setBranchIds(ids);
        enrollTotp(u);
        users.save(u);
    }

    /** Back-office demo users get the shared dev TOTP secret, already confirmed, so the demo login works. */
    private void enrollTotp(User u) {
        if (!u.getRole().isBackoffice() || u.isTotpEnabled()) return;
        u.setTotpSecret(totpCrypto.encrypt(totpSecret));
        u.setTotpEnabled(true);
        users.save(u);
    }
}
