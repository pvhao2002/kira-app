package com.kira.bank.identity.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Getter @Setter @Entity @Table(name="refresh_tokens")
public class RefreshToken extends AuditedEntity {
    @ManyToOne(optional=false, fetch=FetchType.LAZY) @JoinColumn(name="user_id") private User user;
    @Column(name="token_hash", nullable=false, unique=true, length=64) private String tokenHash;
    @Column(name="family_id", nullable=false, length=36) private String familyId;
    @Column(name="expires_at", nullable=false) private Instant expiresAt;
    @Column(name="revoked_at") private Instant revokedAt;
    @Column(name="replaced_by_hash", length=64) private String replacedByHash;
}

