package com.db.kiragateway.service;

import com.db.kiragateway.dto.crawl.CrawlMatchOddsEventDto;
import com.db.kiragateway.dto.crawl.CrawlOddsResultRequest;
import com.db.kiragateway.dto.crawl.CrawlOddsSnapshotDto;
import com.db.kiragateway.dto.crawl.CrawlOddsTimelineGroupDto;
import com.db.kiragateway.dto.crawl.CrawlOddsTimelineItemDto;
import com.db.kiragateway.repository.EventClaimRepository;
import com.db.kiragateway.repository.OddsCrawlPersistRepository;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class OddsCrawlCallbackService {

    private static final Set<String> SUPPORTED_ODDS_MARKETS = Set.of("hdc", "ou", "corner");
    private static final Set<String> IN_PLAY_STATUS_FALLBACK = Set.of("1H", "HT", "2H", "ET", "Penalties");

    private final OddsCrawlPersistRepository persistRepository;
    private final EventClaimRepository eventClaimRepository;
    private final AiscoreMatchStatusLabelCache statusLabelCache;

    public OddsCrawlCallbackService(OddsCrawlPersistRepository persistRepository,
                                      EventClaimRepository eventClaimRepository,
                                      AiscoreMatchStatusLabelCache statusLabelCache) {
        this.persistRepository = persistRepository;
        this.eventClaimRepository = eventClaimRepository;
        this.statusLabelCache = statusLabelCache;
    }

    @Transactional
    public void persistOddsCrawlResult(long eventId, CrawlOddsResultRequest req) {
        updateEvent(eventId, req.event());
        if (req.eventResult() != null) {
            persistRepository.upsertEventResult(eventId, req.eventResult());
        }
        if (CollectionUtils.isEmpty(req.odds())) {
            persistRepository.clearEventOddsFlags(eventId);
        }
        persistOdds(eventId, req.odds(), req.oddsTimeline());
        handleClaimAfterSuccess(eventId);
    }

    private void updateEvent(long eventId, CrawlMatchOddsEventDto event) {
        if (event == null) {
            return;
        }
        persistRepository.updateEvent(
                eventId,
                statusLabelCache.resolveStatus(event.statusId(), event.status()),
                event.statusId()
        );
    }

    private void persistOdds(long eventId,
                             List<CrawlOddsSnapshotDto> odds,
                             CrawlOddsTimelineGroupDto timeline) {
        persistRepository.deleteOddsForEvent(eventId);

        if (!CollectionUtils.isEmpty(odds)) {
            var oddsParams = odds.stream()
                    .filter(o -> isSupportedMarket(o.market()))
                    .filter(o -> StringUtils.hasText(o.type()))
                    .map(o -> new MapSqlParameterSource()
                            .addValue("event_id", eventId)
                            .addValue("type", normalizeOddsType(o.type()))
                            .addValue("market", o.market())
                            .addValue("line", o.line())
                            .addValue("price_a", o.priceA())
                            .addValue("price_b", o.priceB()))
                    .toList();
            persistRepository.batchInsertEventOdds(oddsParams);
        }

        var timelineParams = flattenTimeline(eventId, timeline);
        if (!timelineParams.isEmpty()) {
            persistRepository.batchInsertEventOddsTimeline(timelineParams);
        }
    }

    private List<MapSqlParameterSource> flattenTimeline(long eventId, CrawlOddsTimelineGroupDto timeline) {
        if (timeline == null) {
            return List.of();
        }
        var params = new ArrayList<MapSqlParameterSource>();
        appendTimelineItems(eventId, params, timeline.hdc());
        appendTimelineItems(eventId, params, timeline.ou());
        appendTimelineItems(eventId, params, timeline.corner());
        return params;
    }

    private void appendTimelineItems(long eventId,
                                       List<MapSqlParameterSource> params,
                                       List<CrawlOddsTimelineItemDto> items) {
        if (CollectionUtils.isEmpty(items)) {
            return;
        }
        var defaultCrawledAt = LocalDateTime.now();
        for (CrawlOddsTimelineItemDto item : items) {
            if (!isSupportedMarket(item.market())) {
                continue;
            }
            params.add(new MapSqlParameterSource()
                    .addValue("event_id", eventId)
                    .addValue("market", item.market())
                    .addValue("line", item.line())
                    .addValue("price_a", item.priceA())
                    .addValue("price_b", item.priceB())
                    .addValue("match_minute", item.matchMinute())
                    .addValue("crawled_at", parseCrawledAt(item.crawledAt(), defaultCrawledAt)));
        }
    }

    private void handleClaimAfterSuccess(long eventId) {
        var playState = persistRepository.findEventPlayState(eventId)
                .orElse(new OddsCrawlPersistRepository.EventPlayState("-", 0, 0));
        if (shouldReleaseClaimAfterSuccess(playState)) {
            eventClaimRepository.releaseClaimByEventId(eventId);
        } else {
            eventClaimRepository.completeClaimByEventId(eventId);
        }
    }

    private static boolean shouldReleaseClaimAfterSuccess(OddsCrawlPersistRepository.EventPlayState state) {
        if (state.isInPlay() == 1) {
            return true;
        }
        if (state.isTerminal() == 1) {
            return false;
        }
        if (StringUtils.hasText(state.status())) {
            if (IN_PLAY_STATUS_FALLBACK.contains(state.status())) {
                return true;
            }
            if ("FT".equalsIgnoreCase(state.status())) {
                return false;
            }
        }
        return false;
    }

    private static boolean isSupportedMarket(String market) {
        return StringUtils.hasText(market) && SUPPORTED_ODDS_MARKETS.contains(market);
    }

    private static String normalizeOddsType(String type) {
        return "ht".equals(type) ? "half-time" : type;
    }

    private static LocalDateTime parseCrawledAt(String crawledAt, LocalDateTime fallback) {
        if (!StringUtils.hasText(crawledAt)) {
            return fallback;
        }
        try {
            return OffsetDateTime.parse(crawledAt).toLocalDateTime();
        } catch (Exception ignored) {
            return fallback;
        }
    }
}
