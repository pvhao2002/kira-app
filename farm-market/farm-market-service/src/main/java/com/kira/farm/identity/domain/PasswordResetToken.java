package com.kira.farm.identity.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Hash of an emailed reset token; the raw token is never stored.
 * ponytail: rows go only on a new reset request (deleteByUserId) or user delete (FK cascade); add a scheduled purge
 * of expired rows plus an expires_at index in a new V8 migration if the table grows.
 */
@Getter
@Setter
@Entity
@Table(name = "password_reset_tokens")
public class PasswordResetToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long userId;
    @Column(nullable = false, unique = true, length = 64, columnDefinition = "CHAR(64)")
    private String tokenHash;
    @Column(nullable = false)
    private Instant expiresAt;
    private Instant usedAt;
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
