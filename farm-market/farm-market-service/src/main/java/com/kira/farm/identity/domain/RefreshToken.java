package com.kira.farm.identity.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;
    @Column(nullable = false, unique = true, length = 64, columnDefinition = "CHAR(64)")
    private String tokenHash;
    @Column(nullable = false, length = 36, columnDefinition = "CHAR(36)")
    private String familyId;
    @Column(nullable = false)
    private Instant expiresAt;
    private Instant revokedAt;
    @Column(length = 64, columnDefinition = "CHAR(64)")
    private String replacedByHash;
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
