package com.matchmind.shared;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.cache.transaction.TransactionAwareCacheManagerProxy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.List;

/**
 * In-process caches for read paths that are hot and nearly immutable. Each cache has an explicit size and TTL, so a
 * write the code does not know about (manual SQL) is picked up within the TTL. Nothing per-user, no secrets and no
 * settlement figures are cached. The manager is transaction-aware: an eviction made inside a transaction happens
 * after the commit, so a reader cannot re-fill the cache with the pre-commit value.
 */
@Configuration
@EnableCaching
public class CacheConfig {
    /** provider code to provider id (immutable: providers are never renamed or deleted). */
    public static final String PROVIDER_IDS = "providerIds";
    /** distinct league names for the filter dropdowns; evicted whenever a prediction can add one. */
    public static final String LEAGUES = "leagues";

    @Bean
    CacheManager cacheManager() {
        var manager = new SimpleCacheManager();
        manager.setCaches(List.of(
            cache(PROVIDER_IDS, 1_000, Duration.ofHours(1)),
            cache(LEAGUES, 1, Duration.ofMinutes(2))));
        manager.initializeCaches();
        return new TransactionAwareCacheManagerProxy(manager);
    }

    private static CaffeineCache cache(String name, long maxSize, Duration ttl) {
        return new CaffeineCache(name, Caffeine.newBuilder().maximumSize(maxSize).expireAfterWrite(ttl).build());
    }
}
