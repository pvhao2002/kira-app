package com.matchmind.it;

import com.matchmind.provider.ProviderService;
import com.matchmind.shared.CacheConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.interceptor.SimpleKey;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Cached read paths stay correct: provider ids are served from memory, the league list follows new predictions. */
class CachingIT extends IntegrationTestBase {
    @Autowired
    CacheManager caches;
    @Autowired
    ProviderService providers;

    @Test
    void providerIdIsResolvedOnceThenServedFromCache() {
        String code = newIntegration("m").provider();
        UUID first = providers.resolve(code);
        assertThat(caches.getCache(CacheConfig.PROVIDER_IDS).get(code)).isNotNull();
        providers.ensureExists(first, code); // resolve writes nothing; the first accepted prediction creates the row

        db.update("UPDATE providers SET name = 'Renamed' WHERE code = ?", code);
        assertThat(providers.resolve(code)).isEqualTo(first);
        assertThat(db.queryForObject("SELECT count(*) FROM providers WHERE code = ?", Long.class, code)).isEqualTo(1L);
    }

    @Test
    void leagueListIsCachedAndEvictedByANewPrediction() throws Exception {
        adminGet("/api/v1/matches/leagues");
        assertThat(caches.getCache(CacheConfig.LEAGUES).get(SimpleKey.EMPTY)).isNotNull();

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String league = "Cache League " + suffix;
        String body = Payloads.livePrediction("evt-" + suffix, "live-" + suffix, "cache-model")
            .replace("Premier League", league);
        assertThat(external(newIntegration("cache-model").provider(), "predictions", body).getResponse().getStatus()).isEqualTo(201);

        assertThat(caches.getCache(CacheConfig.LEAGUES).get(SimpleKey.EMPTY)).isNull();
        assertThat(adminGet("/api/v1/matches/leagues").toString()).contains(league);
    }
}
