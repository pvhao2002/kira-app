package com.kira.farm.account.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** One review per (user, product, order). Only the branch reply fields change after creation. */
@Getter
@Setter
@Entity
@Table(name = "reviews")
public class Review {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, updatable = false)
    private Long userId;
    @Column(nullable = false, updatable = false)
    private Long productId;
    @Column(nullable = false, updatable = false)
    private Long orderId;
    @Column(nullable = false, updatable = false)
    private int rating;
    @Column(updatable = false, length = 2000)
    private String body;
    @Column(nullable = false, updatable = false)
    private boolean hasPhoto;
    @Column(updatable = false, length = 500)
    private String photoUrl;
    @Column(length = 2000)
    private String replyBody;
    private Long replyByUserId;
    private Instant repliedAt;
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
