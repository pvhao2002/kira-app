package com.kira.farm.loyalty.application;

import com.kira.farm.promotion.domain.PromotionType;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Reward catalogue (app.loyalty.rewards in application.yml). These are business decisions, edit them in config.
 * Invalid values fail application startup (binding runs the constructors below).
 */
@ConfigurationProperties("app.loyalty")
public record LoyaltyProperties(List<Reward> rewards) {

    public LoyaltyProperties {
        rewards = rewards == null ? List.of() : List.copyOf(rewards);
        Set<String> ids = new HashSet<>();
        for (Reward r : rewards)
            if (!ids.add(r.id())) throw new IllegalArgumentException("Duplicate loyalty reward id: " + r.id());
    }

    /** value: percent (1-100) for PERCENT, VND for FIXED, ignored (0) for FREE_SHIP. */
    public record Reward(String id, String name, String description, int pointsCost, PromotionType type, long value,
                         long minOrder, int validDays) {
        public Reward {
            if (id == null || id.isBlank()) throw new IllegalArgumentException("Loyalty reward id is required");
            if (name == null || name.isBlank()) throw new IllegalArgumentException("Loyalty reward " + id + ": name is required");
            if (type == null) throw new IllegalArgumentException("Loyalty reward " + id + ": type is required");
            if (pointsCost <= 0) throw new IllegalArgumentException("Loyalty reward " + id + ": pointsCost must be > 0");
            if (validDays <= 0) throw new IllegalArgumentException("Loyalty reward " + id + ": validDays must be > 0");
            if (minOrder < 0) throw new IllegalArgumentException("Loyalty reward " + id + ": minOrder must be >= 0");
            if (type == PromotionType.PERCENT && (value < 1 || value > 100))
                throw new IllegalArgumentException("Loyalty reward " + id + ": PERCENT value must be 1-100");
            if (type == PromotionType.FIXED && value <= 0)
                throw new IllegalArgumentException("Loyalty reward " + id + ": FIXED value must be > 0");
        }
    }
}
