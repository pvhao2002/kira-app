package com.kira.farm.identity.domain;

import com.kira.farm.shared.domain.BaseEntity;
import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "users")
public class User extends BaseEntity {
    @Column(nullable = false, unique = true, length = 190)
    private String email;
    @Column(length = 20, unique = true)
    private String phone;
    @Column(nullable = false, length = 100)
    private String passwordHash;
    @Column(nullable = false, length = 120)
    private String fullName;
    private LocalDate birthDate;
    @Enumerated(EnumType.STRING)
    @Column(length = 8)
    private Gender gender;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role = Role.CUSTOMER;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserStatus status = UserStatus.ACTIVE;
    /** AES-GCM encrypted base32 TOTP secret (see TotpCrypto); never serialised. */
    @Column(length = 128)
    private String totpSecret;
    @Column(nullable = false)
    private boolean totpEnabled;
    /** Last accepted TOTP time step; codes at or below it are replays. */
    private Long totpLastStep;
    /** Staff/manager branch assignments (user_branch_assignments). Admin ignores this and sees every branch. */
    @ElementCollection(fetch = FetchType.LAZY)
    @BatchSize(size = 50)
    @CollectionTable(name = "user_branch_assignments", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "branch_id")
    private Set<Long> branchIds = new HashSet<>();
}
