package com.kira.news.identity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "news_user")
public class NewsUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String username;
    private String displayName;
    private String passwordHash;
    @Enumerated(EnumType.STRING)
    private Role role;
    private Instant createdAt;

    protected NewsUser() {
    }

    public NewsUser(String username, String displayName, String passwordHash, Role role) {
        this.username = username;
        this.displayName = displayName;
        this.passwordHash = passwordHash;
        this.role = role;
        this.createdAt = Instant.now();
    }

    public String getUsername() {
        return username;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Role getRole() {
        return role;
    }
}
