package kira.crawl.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.TimeoutError;
import com.microsoft.playwright.options.WaitUntilState;
import kira.crawl.browser.AiscoreContextApiClient;
import kira.crawl.browser.AiscoreOddsDomInteractor;
import kira.crawl.browser.BrowserApiType;
import kira.crawl.browser.BrowserSessionManager;
import kira.crawl.browser.CloudflareSupport;
import kira.crawl.browser.CdpNetworkCapture.ApiUrlMatcher;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.dto.*;
import kira.crawl.mapper.MatchMapper;
import kira.crawl.mapper.OddsMapper;
import kira.crawl.protobuf.AiscoreProtobufService;
import kira.crawl.util.PlaywrightUtil;
import kira.crawl.util.PlaywrightUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

import static kira.crawl.util.JsonRecords.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class MatchesService {
    public static final String API_BASE_URL = "https://api.aiscore.com/v1/web/api/matches";
    public static final String ODDS_LIST_API_BASE_URL = "https://api.aiscore.com/v1/web/api/match/odds_list";
    public static final String ODDS_DETAIL_API_BASE_URL = "https://api.aiscore.com/v1/web/api/match/odds/detail";
    public static final String TEAM_STATS_API_BASE_URL = "https://api.aiscore.com/v1/web/api/match/team_stats";

    public static final String API_BASE_URL_V2 = "web/api/matches";
    public static final String ODDS_LIST_API_BASE_URL_V2 = "web/api/match/odds_list";
    public static final String ODDS_DETAIL_API_BASE_URL_V2 = "web/api/match/odds/detail";
    public static final String TEAM_STATS_API_BASE_URL_V2 = "web/api/match/team_stats";

    public static final long TIME_OUT = 30000;
    /** Navigation / odds_list capture for odds v5 (pooled browser). */
    public static final long ODDS_V5_NAV_TIMEOUT_MS = 5_500L;
    /** Per detail API / evaluate step after odds page is open. */
    public static final long ODDS_V5_API_TIMEOUT_MS = 4_000L;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final BrowserSessionManager browserSessionManager;
    private final AiscoreOddsDomInteractor oddsDomInteractor;
    private final AiscoreContextApiClient contextApiClient;
    private final AiscoreProtobufService protobufService;
    private final MatchMapper matchMapper;
    private final OddsMapper oddsMapper;
    private final PlaywrightProperties playwrightProperties;

    public Object findMatches(MatchQuery query) {
        var params = normalizeQuery(query);
        var apiUrl = buildApiUrl(params);
        var publicPageUrl = buildPublicPageUrl(apiUrl);

        return browserSessionManager.withPage(BrowserApiType.MATCHES, publicPageUrl, (page, timeout) -> {
            var bodies = captureApiResponseBodies(page, List.of(apiUrl), publicPageUrl, timeout);
            var decoded = protobufService.decodeMatches(bodies.getFirst());

            if (params.rawEnabled()) {
                return Map.of(
                        "query", params.toMap(),
                        "data", OBJECT_MAPPER.convertValue(decoded, Map.class)
                );
            }

            var matches = asArray(decoded.get("matches"));
            var filteredMatches = params.matchId() == null || params.matchId().isBlank()
                    ? matches
                    : matches.stream()
                    .filter(match -> params.matchId().equals(stringValue(asRecord(match).get("id"))))
                    .toList();

            var events = filteredMatches.stream()
                    .map(match -> matchMapper.mapDatabaseEvent(match, decoded))
                    .toList();

            return new MatchesResponseDto(
                    params.date(),
                    Integer.parseInt(params.sportId()),
                    Integer.parseInt(params.lang()),
                    params.tz(),
                    filteredMatches.size(),
                    events,
                    OBJECT_MAPPER.convertValue(decoded, Map.class)
            );
        });
    }

    public CrawlMatchOddsV2Dto getOdds(String eventLink, Boolean hasOddsCorner) {
        var matchId = extractMatchIdFromEventLink(parseAndValidateEventLink(eventLink).toString());
        var state = new MatchOddsV2CaptureState(matchId);
        PlaywrightUtils.withPlaywright(eventLink + "/odds", (p, l) -> {
            p.onResponse(res -> handleOddsResponseSafely(p, res, hasOddsCorner, state));
            p.navigate(l, new Page.NavigateOptions().setWaitUntil(WaitUntilState.DOMCONTENTLOADED));

            waitForInitialOddsCapture(p, state);

            if (state.needsOddsDetails && !state.oddsDone) {
                fetchMissingOddsDetails(p, eventLink, hasOddsCorner, state);
            }

            if (!state.teamStatsDone) {
                fetchMissingTeamStats(p, eventLink, state);
            }
        });
        return state.toDto();
    }

    /**
     * Odds v5: warm pooled ODDS browser lane (see {@code app.playwright.odds-concurrency}), API-first
     * capture (context request before navigation), bet365-only detail ({@code cid=2}). Response shape matches v2.
     */
    public CrawlMatchOddsV2Dto getOddsV5(String eventLink, Boolean hasOddsCorner) {
        var publicPageUrl = parseAndValidateEventLink(eventLink).toString();
        var oddsPageUrl = buildOddsPublicPageUrl(publicPageUrl);
        var matchId = extractMatchIdFromEventLink(publicPageUrl);
        var includeCorner = Boolean.TRUE.equals(hasOddsCorner);

        try {
            return browserSessionManager.withPage(BrowserApiType.ODDS, oddsPageUrl, (page, laneTimeout) -> {
                var navTimeout = Math.min(laneTimeout, ODDS_V5_NAV_TIMEOUT_MS);
                var apiTimeout = Math.min(laneTimeout, ODDS_V5_API_TIMEOUT_MS);
                page.setDefaultTimeout(apiTimeout);
                page.setDefaultNavigationTimeout(navTimeout);

                var capture = new MatchOddsV2CaptureState(matchId);
                page.onResponse(res -> handleOddsV5ResponseSafely(page, res, hasOddsCorner, capture));

                byte[] oddsListBody;
                try {
                    oddsListBody = captureSingleApiBody(page, buildOddsListApiUrl(matchId), oddsPageUrl, navTimeout);
                } catch (RuntimeException ex) {
                    log.debug("getOddsV5 odds_list capture failed matchId={}: {}", matchId, ex.getMessage());
                    return emptyOddsV2Dto();
                }

                var oddsList = protobufService.decodeMatchOdds(oddsListBody);
                if (!oddsMapper.hasBet365Company(oddsList) || !oddsMapper.hasAsiaMarketAndOverUnder(oddsList)) {
                    return emptyOddsV2Dto();
                }

                var oddsDetails = resolveOddsV5Details(
                        page, matchId, publicPageUrl, apiTimeout, includeCorner, capture);
                var timelineOdds = oddsMapper.mapOddsTimelineForDatabase(oddsDetails);
                if (timelineOdds.isEmpty()) {
                    return emptyOddsV2Dto();
                }

                var pageInfo = readMatchPageInfoBestEffort(page, 1_000L);
                var teamStatsBody = contextApiClient.getOptional(
                        page, buildTeamStatsApiUrl(matchId), publicPageUrl, apiTimeout);
                return buildOddsV2Dto(matchId, pageInfo, oddsDetails, timelineOdds, teamStatsBody);
            });
        } catch (TimeoutError ex) {
            log.warn("getOddsV5 timed out matchId={}", matchId);
            return emptyOddsV2Dto();
        }
    }

    private OddsMapper.OddsDetails resolveOddsV5Details(
            Page page,
            String matchId,
            String referer,
            long apiTimeout,
            boolean includeCorner,
            MatchOddsV2CaptureState capture
    ) {
        if (capture.oddsDone) {
            return new OddsMapper.OddsDetails(capture.asia, null, capture.bs, capture.corner);
        }
        if (capture.asia != null && capture.bs != null && (!includeCorner || capture.corner != null)) {
            return new OddsMapper.OddsDetails(capture.asia, null, capture.bs, capture.corner);
        }
        if (capture.asia != null && capture.bs != null) {
            var corner = capture.corner;
            if (corner == null) {
                var cornerUrl = buildOddsDetailApiUrl(matchId, "corner");
                var cornerBody = captureOddsDetailBody(
                        page, matchId, "corner", cornerUrl, referer, apiTimeout, true);
                corner = cornerBody == null ? null : decodeOddsDetailBody(cornerBody);
            }
            return new OddsMapper.OddsDetails(capture.asia, null, capture.bs, corner);
        }
        return captureOddsDetailTabs(page, matchId, referer, apiTimeout, includeCorner, false, true);
    }

    private void handleOddsV5ResponseSafely(
            Page page,
            Response response,
            Boolean hasOddsCorner,
            MatchOddsV2CaptureState state
    ) {
        var url = response.url();
        if (url.contains(ODDS_DETAIL_API_BASE_URL_V2) && !isBet365OddsDetailUrl(url)) {
            return;
        }
        if (url.contains(TEAM_STATS_API_BASE_URL_V2)) {
            handleOddsResponseSafely(page, response, hasOddsCorner, state);
            return;
        }
        if (url.contains(ODDS_DETAIL_API_BASE_URL_V2) || url.contains(ODDS_LIST_API_BASE_URL_V2)) {
            handleOddsResponseSafely(page, response, hasOddsCorner, state);
        }
    }

    private static boolean isBet365OddsDetailUrl(String url) {
        return url.contains("cid=2") || url.contains("cid%3D2");
    }

    private MatchPageInfo readMatchPageInfoBestEffort(Page page, long timeout) {
        try {
            return readMatchPageInfo(page, timeout);
        } catch (RuntimeException ex) {
            log.debug("getOddsV5 readMatchPageInfo skipped: {}", ex.getMessage());
            return new MatchPageInfo("-", null, List.of(), List.of());
        }
    }

    public CrawlMatchOddsV2Dto getOddsV4(String eventLink, Boolean hasOddsCorner) {
        var publicPageUrl = parseAndValidateEventLink(eventLink).toString();
        var matchId = extractMatchIdFromEventLink(publicPageUrl);
        var timeout = playwrightProperties.browserTimeoutMs();
        var session = new OddsV4Session(matchId, hasOddsCorner);

        PlaywrightUtils.withPlaywright(eventLink + "/odds", (page, url) -> {
            page.setDefaultTimeout(timeout);
            page.setDefaultNavigationTimeout(timeout);

            page.onResponse(session::onResponse);

            page.navigate(url, new Page.NavigateOptions()
                    .setWaitUntil(WaitUntilState.DOMCONTENTLOADED)
                    .setTimeout(timeout));

            waitForOddsList(page, session, timeout);

            if (session.shouldFetchOddsDetails()) {
                var includeCorner = !Boolean.FALSE.equals(hasOddsCorner);
                var oddsDetails = captureWebOddsDetailBody(page, matchId, publicPageUrl, timeout, includeCorner);
                session.applyOddsDetails(oddsDetails);
            }

            fetchTeamStats(page, session, publicPageUrl, eventLink, matchId, timeout);
        }, ex -> {
            if (ex instanceof TimeoutError) {
                log.warn("getOddsV4 timed out matchId={} timeoutMs={}", matchId, timeout);
                return;
            }
            throw ex instanceof RuntimeException re ? re : new RuntimeException(ex);
        });

        return session.toDto();
    }

    private void waitForOddsList(Page page, OddsV4Session session, long timeout) {
        try {
            page.waitForCondition(
                    session::isOddsListResolved,
                    new Page.WaitForConditionOptions().setTimeout(timeout)
            );
        } catch (TimeoutError ex) {
            log.debug("getOddsV4 odds_list not observed matchId={}", session.matchId());
            session.markNoOdds();
        }
    }

    private void fetchTeamStats(
            Page page,
            OddsV4Session session,
            String publicPageUrl,
            String oddsPageUrl,
            String matchId,
            long timeout
    ) {
        if (session.isTeamStatsComplete()) {
            return;
        }
        var teamStatsApiUrl = buildTeamStatsApiUrl(matchId);
        var fetchTimeout = Math.min(timeout, 10_000);
        var teamStatsBody = captureOptionalApiBody(page, teamStatsApiUrl, publicPageUrl, fetchTimeout);
        if (teamStatsBody != null) {
            session.applyTeamStats(
                    readMatchPageInfo(page, timeout),
                    protobufService.decodeMatchTeamStats(teamStatsBody)
            );
        }
    }

    /**
     * Self-contained capture session for v4 odds crawl.
     * Accumulates network responses registered before navigation.
     */
    private final class OddsV4Session {
        private final String matchId;
        private final Boolean hasOddsCorner;

        private boolean oddsListReceived;
        private boolean hasBet365;
        private boolean hasAsianOu;
        private boolean noOdds;

        private boolean oddsDone;
        private boolean teamStatsDone;

        private List<CrawlOddsSnapshotDto> odds;
        private CrawlOddsTimelineGroupDto timelineOdds;
        private CrawlEventResultDto eventResult;
        private CrawlMatchOddsEventDto event;

        OddsV4Session(String matchId, Boolean hasOddsCorner) {
            this.matchId = matchId;
            this.hasOddsCorner = hasOddsCorner;
        }

        String matchId() {
            return matchId;
        }

        void onResponse(Response response) {
            if (!response.ok()) {
                return;
            }
            try {
                var url = response.url();
                if (url.contains(ODDS_LIST_API_BASE_URL_V2)) {
                    handleOddsList(response);
                }
            } catch (RuntimeException ex) {
                log.warn("getOddsV4 response handling failed matchId={} url={}", matchId, response.url(), ex);
            }
        }

        private void handleOddsList(Response response) {
            ingestOddsListBody(response.body());
        }

        void ingestOddsListBody(byte[] body) {
            var oddsList = protobufService.decodeMatchOdds(body);
            hasBet365 = oddsMapper.hasBet365Company(oddsList);
            hasAsianOu = oddsMapper.hasAsiaMarketAndOverUnder(oddsList);
            oddsListReceived = true;
            if (!hasBet365 || !hasAsianOu) {
                noOdds = true;
            }
        }

        void applyOddsDetails(OddsMapper.OddsDetails oddsDetails) {
            var timeline = oddsMapper.mapOddsTimelineForDatabase(oddsDetails);
            if (timeline.isEmpty()) {
                return;
            }
            odds = oddsMapper.mapOddsForDatabase(oddsDetails);
            timelineOdds = oddsMapper.groupOddsTimelineForResponse(timeline);
            oddsDone = true;
        }

        void applyTeamStats(MatchPageInfo pageInfo, JsonNode stats) {
            eventResult = stats == null
                    ? CrawlEventResultDto.empty()
                    : matchMapper.mapEventResultForDatabase(pageInfo.homeScores(), pageInfo.awayScores(), stats);
            event = new CrawlMatchOddsEventDto(
                    pageInfo.status() != null ? pageInfo.status() : "-",
                    pageInfo.statusId()
            );
            teamStatsDone = true;
        }

        boolean isOddsListResolved() {
            return oddsListReceived || noOdds;
        }

        boolean shouldFetchOddsDetails() {
            return oddsListReceived && hasBet365 && hasAsianOu && !noOdds;
        }

        boolean isTeamStatsComplete() {
            return teamStatsDone;
        }

        void markNoOdds() {
            noOdds = true;
            oddsListReceived = true;
        }

        CrawlMatchOddsV2Dto toDto() {
            if (noOdds && !oddsDone && !teamStatsDone) {
                return emptyOddsV2Dto();
            }
            var id = (oddsDone || teamStatsDone) ? matchId : null;
            return new CrawlMatchOddsV2Dto(id, event, eventResult, odds, timelineOdds);
        }
    }

    private void handleOddsResponseSafely(
            Page page,
            Response response,
            Boolean hasOddsCorner,
            MatchOddsV2CaptureState state
    ) {
        try {
            handleOddsResponse(page, response, hasOddsCorner, state);
        } catch (AiscoreBadGatewayException ex) {
            if (state.needsOddsDetails && !state.oddsDone) {
                state.oddsFallbackReady = true;
            }
            log.debug("AiScore odds v2 response handling skipped; fallback may complete response");
        } catch (RuntimeException ex) {
            log.warn("AiScore odds v2 response handling failed url={}", response.url(), ex);
        }
    }

    private void waitForInitialOddsCapture(Page page, MatchOddsV2CaptureState state) {
        try {
            page.waitForCondition(
                    () -> state.oddsDone || state.teamStatsDone || state.noOdds || state.oddsFallbackReady,
                    new Page.WaitForConditionOptions().setTimeout(TIME_OUT)
            );
        } catch (TimeoutError ex) {
            log.debug("AiScore odds v2 initial capture timed out; returning best-effort response");
        }
    }

    private void handleOddsResponse(
            Page page,
            Response response,
            Boolean hasOddsCorner,
            MatchOddsV2CaptureState state
    ) {
        switch (response.url()) {
            case String url when url.contains(ODDS_LIST_API_BASE_URL_V2) ->
                    handleOddsListResponse(page, response, state);
            case String url when url.contains(ODDS_DETAIL_API_BASE_URL_V2) ->
                    handleOddsDetailResponse(response, hasOddsCorner, state);
            case String url when url.contains(TEAM_STATS_API_BASE_URL_V2) ->
                    handleTeamStatsResponse(page, response, state);
            default -> {
                // skip
            }
        }
    }

    private void handleOddsListResponse(Page page, Response response, MatchOddsV2CaptureState state) {
        var oddsList = protobufService.decodeMatchOdds(response.body());
        var hasOdds365 = oddsMapper.hasBet365Company(oddsList);
        var hasAsianAndOuOdds = oddsMapper.hasAsiaMarketAndOverUnder(oddsList);
        if (hasOdds365 && hasAsianAndOuOdds) {
            state.needsOddsDetails = true;
            state.oddsFallbackReady = true;
        } else {
            state.noOdds = true;
        }
    }

    private void handleOddsDetailResponse(Response response, Boolean hasOddsCorner, MatchOddsV2CaptureState state) {
        var url = response.url();
        if (ApiUrlMatcher.isUrlOddType(url, "asia")) {
            state.asia = decodeOddsDetailBody(response.body());
        } else if (ApiUrlMatcher.isUrlOddType(url, "bs")) {
            state.bs = decodeOddsDetailBody(response.body());
        } else if (ApiUrlMatcher.isUrlOddType(url, "corner")) {
            state.corner = decodeOddsDetailBody(response.body());
        }

        if (state.asia == null || state.bs == null || (state.corner == null && !Boolean.FALSE.equals(hasOddsCorner))) {
            return;
        }

        var oddsDetails = new OddsMapper.OddsDetails(state.asia, null, state.bs, state.corner);
        var timelineOdds = oddsMapper.mapOddsTimelineForDatabase(oddsDetails);
        if (timelineOdds.isEmpty()) {
            return;
        }

        state.odds = oddsMapper.mapOddsForDatabase(oddsDetails);
        state.timelineOdds = oddsMapper.groupOddsTimelineForResponse(timelineOdds);
        state.oddsDone = true;
    }

    private void fetchMissingOddsDetails(
            Page page,
            String eventLink,
            Boolean hasOddsCorner,
            MatchOddsV2CaptureState state
    ) {
        var publicPageUrl = parseAndValidateEventLink(eventLink).toString();
        var oddsPublicPageUrl = buildOddsPublicPageUrl(publicPageUrl);
        var matchId = extractMatchIdFromEventLink(publicPageUrl);
        var includeCorner = Boolean.TRUE.equals(hasOddsCorner);
        var oddsDetails = captureOddsDetailTabs(page, matchId, oddsPublicPageUrl, TIME_OUT, includeCorner, false);
        var timelineOdds = oddsMapper.mapOddsTimelineForDatabase(oddsDetails);
        if (timelineOdds.isEmpty()) {
            return;
        }
        state.odds = oddsMapper.mapOddsForDatabase(oddsDetails);
        state.timelineOdds = oddsMapper.groupOddsTimelineForResponse(timelineOdds);
        state.oddsDone = true;
    }

    private void handleTeamStatsResponse(Page page, Response response, MatchOddsV2CaptureState state) {
        var pageInfo = readMatchPageInfo(page, TIME_OUT);
        var teamStats = protobufService.decodeMatchTeamStats(response.body());
        applyEventResult(state, pageInfo, teamStats);
    }

    private void fetchMissingTeamStats(Page page, String eventLink, MatchOddsV2CaptureState state) {
        var publicPageUrl = parseAndValidateEventLink(eventLink).toString();
        var matchId = extractMatchIdFromEventLink(publicPageUrl);
        var teamStatsApiUrl = buildTeamStatsApiUrl(matchId);
        var pageInfo = readMatchPageInfo(page, TIME_OUT);
        var teamStatsBody = captureOptionalApiBody(page, teamStatsApiUrl, publicPageUrl, TIME_OUT);
        var teamStats = teamStatsBody == null ? null : protobufService.decodeMatchTeamStats(teamStatsBody);
        applyEventResult(state, pageInfo, teamStats);
    }

    private void applyEventResult(MatchOddsV2CaptureState state, MatchPageInfo pageInfo, JsonNode teamStats) {
        state.eventResult = teamStats == null
                ? CrawlEventResultDto.empty()
                : matchMapper.mapEventResultForDatabase(pageInfo.homeScores(), pageInfo.awayScores(), teamStats);
        state.event = new CrawlMatchOddsEventDto(
                pageInfo.status() != null ? pageInfo.status() : "-",
                pageInfo.statusId()
        );
        state.teamStatsDone = true;
    }

    private static final class MatchOddsV2CaptureState {
        private final String matchId;
        private JsonNode asia;
        private JsonNode bs;
        private JsonNode corner;
        private boolean oddsDone;
        private boolean teamStatsDone;
        private boolean noOdds;
        private boolean needsOddsDetails;
        private boolean oddsFallbackReady;
        private List<CrawlOddsSnapshotDto> odds;
        private CrawlOddsTimelineGroupDto timelineOdds;
        private CrawlEventResultDto eventResult;
        private CrawlMatchOddsEventDto event;

        MatchOddsV2CaptureState(String matchId) {
            this.matchId = matchId;
        }

        private CrawlMatchOddsV2Dto toDto() {
            var id = (oddsDone || teamStatsDone) ? matchId : null;
            return new CrawlMatchOddsV2Dto(id, event, eventResult, odds, timelineOdds);
        }
    }

    public CrawlMatchOddsV2Dto getOddsV3(String eventLink, Boolean hasOddsCorner) {
        var publicPageUrl = parseAndValidateEventLink(eventLink).toString();
        var oddsPublicPageUrl = buildOddsPublicPageUrl(publicPageUrl);
        var matchId = extractMatchIdFromEventLink(publicPageUrl);
        var oddsListApiUrl = buildOddsListApiUrl(matchId);
        var teamStatsApiUrl = buildTeamStatsApiUrl(matchId);
        var includeCorner = Boolean.TRUE.equals(hasOddsCorner);
        var timeout = playwrightProperties.browserTimeoutMs();

        var result = new AtomicReference<CrawlMatchOddsV2Dto>();
        PlaywrightUtils.withPlaywright(oddsPublicPageUrl, (page, referer) -> {
            var oddsListBody = captureSingleApiBody(page, oddsListApiUrl, referer, timeout);
            var oddsList = protobufService.decodeMatchOdds(oddsListBody);
            if (!oddsMapper.hasBet365Company(oddsList) || !oddsMapper.hasAsiaMarketAndOverUnder(oddsList)) {
                result.set(emptyOddsV2Dto());
                return;
            }

            var oddsDetails = captureOddsDetailTabs(page, matchId, referer, timeout, includeCorner, false);
            var timelineOdds = oddsMapper.mapOddsTimelineForDatabase(oddsDetails);
            var pageInfo = readMatchPageInfo(page, timeout);
            var teamStatsBody = captureOptionalApiBody(page, teamStatsApiUrl, publicPageUrl, timeout);

            result.set(buildOddsV2Dto(matchId, pageInfo, oddsDetails, timelineOdds, teamStatsBody));
        }, ex -> {
            if (ex instanceof TimeoutError) {
                log.warn("getOddsV3 timed out matchId={} timeoutMs={}", matchId, timeout);
                result.set(emptyOddsV2Dto());
                return;
            }
            throw ex instanceof RuntimeException re ? re : new RuntimeException(ex);
        });

        return result.get() != null ? result.get() : emptyOddsV2Dto();
    }

    private CrawlMatchOddsV2Dto buildOddsV2Dto(
            String matchId,
            MatchPageInfo pageInfo,
            OddsMapper.OddsDetails oddsDetails,
            List<CrawlOddsTimelineItemDto> timelineOdds,
            byte[] teamStatsBody
    ) {
        var eventResult = teamStatsBody == null
                ? CrawlEventResultDto.empty()
                : matchMapper.mapEventResultForDatabase(
                pageInfo.homeScores(), pageInfo.awayScores(),
                protobufService.decodeMatchTeamStats(teamStatsBody));
        var event = new CrawlMatchOddsEventDto(
                pageInfo.status() != null ? pageInfo.status() : "-",
                pageInfo.statusId()
        );
        var odds = timelineOdds.isEmpty()
                ? null
                : oddsMapper.mapOddsForDatabase(oddsDetails);
        var oddsTimeline = oddsMapper.groupOddsTimelineForResponse(timelineOdds);
        return new CrawlMatchOddsV2Dto(matchId, event, eventResult, odds, oddsTimeline);
    }

    private static CrawlMatchOddsV2Dto emptyOddsV2Dto() {
        return new CrawlMatchOddsV2Dto(null, null, null, null, null);
    }

    public Object findMatchOdds(String eventLink, Boolean hasOddsCorner) {
        var publicPageUrl = parseAndValidateEventLink(eventLink).toString();
        var oddsPublicPageUrl = buildOddsPublicPageUrl(publicPageUrl);
        var matchId = extractMatchIdFromEventLink(publicPageUrl);
        var oddsListApiUrl = buildOddsListApiUrl(matchId);
        var teamStatsApiUrl = buildTeamStatsApiUrl(matchId);

        return browserSessionManager.withPage(BrowserApiType.ODDS, oddsPublicPageUrl, (page, timeout) -> {
            long crawlStart = System.nanoTime();

            long stepStart = System.nanoTime();
            var oddsListBody = captureApiResponseBodies(page, List.of(oddsListApiUrl), oddsPublicPageUrl, timeout).getFirst();
            var oddsList = protobufService.decodeMatchOdds(oddsListBody);
            logOddsStep(matchId, "oddsList", stepStart);

            if (!oddsMapper.hasBet365Company(oddsList)) {
                log.info(
                        "MatchOdds timing summary matchId={} outcome=noBet365 totalSec={}",
                        matchId,
                        formatDurationSec(crawlStart)
                );
                return Map.of();
            }

            boolean includeCorner = Boolean.TRUE.equals(hasOddsCorner);

            stepStart = System.nanoTime();
            var oddsDetails = captureWebOddsDetailBody(page, matchId, oddsPublicPageUrl, timeout, includeCorner);
            logOddsStep(matchId, "oddsDetails", stepStart, "includeCorner", includeCorner);

            stepStart = System.nanoTime();
            var timelineOdds = oddsMapper.mapOddsTimelineForDatabase(oddsDetails);
            logOddsStep(matchId, "mapTimelineOdds", stepStart);

            stepStart = System.nanoTime();
            var pageInfo = readMatchPageInfo(page, timeout);
            logOddsStep(matchId, "readMatchPageInfo", stepStart);

            stepStart = System.nanoTime();
            var teamStatsBody = captureOptionalApiBody(page, teamStatsApiUrl, publicPageUrl, timeout);
            logOddsStep(matchId, "teamStats", stepStart, "found", teamStatsBody != null);

            stepStart = System.nanoTime();
            var eventResult = teamStatsBody == null
                    ? CrawlEventResultDto.empty()
                    : matchMapper.mapEventResultForDatabase(pageInfo.homeScores(), pageInfo.awayScores(),
                    protobufService.decodeMatchTeamStats(teamStatsBody));
            logOddsStep(matchId, "mapEventResult", stepStart);

            stepStart = System.nanoTime();
            var aiscoreRaw = new LinkedHashMap<String, Object>();
            aiscoreRaw.put("oddsList", OBJECT_MAPPER.convertValue(oddsList, Map.class));
            aiscoreRaw.put("asia", toMapOrNull(oddsDetails.asia()));
            aiscoreRaw.put("eu", toMapOrNull(oddsDetails.eu()));
            aiscoreRaw.put("bs", toMapOrNull(oddsDetails.bs()));
            aiscoreRaw.put("corner", toMapOrNull(oddsDetails.corner()));
            aiscoreRaw.put("teamStats", teamStatsBody == null
                    ? null
                    : OBJECT_MAPPER.convertValue(protobufService.decodeMatchTeamStats(teamStatsBody), Map.class));

            var response = new MatchOddsResponseDto(
                    matchId,
                    new CrawlMatchOddsEventDto(pageInfo.status() != null ? pageInfo.status() : "-", pageInfo.statusId()),
                    eventResult,
                    !timelineOdds.isEmpty()
                            ? oddsMapper.mapOddsForDatabase(oddsDetails)
                            : oddsMapper.mapOddsListForDatabase(oddsList),
                    oddsMapper.groupOddsTimelineForResponse(timelineOdds),
                    aiscoreRaw
            );
            logOddsStep(matchId, "buildResponse", stepStart);
            log.info(
                    "MatchOdds timing summary matchId={} outcome=success totalSec={} includeCorner={}",
                    matchId,
                    formatDurationSec(crawlStart),
                    includeCorner
            );
            return response;
        });
    }

    private Map<String, Object> toMapOrNull(JsonNode node) {
        if (isEmptyObject(node)) {
            return null;
        }
        return OBJECT_MAPPER.convertValue(node, Map.class);
    }

    private OddsMapper.OddsDetails captureWebOddsDetailBody(
            Page page,
            String matchId,
            String referer,
            long timeout,
            boolean includeCorner
    ) {
        page.setDefaultTimeout(timeout);

        var result = captureOddsDetailTabs(page, matchId, referer, timeout, includeCorner, false);
        if (hasAllExpectedOddsDetails(result, includeCorner)) {
            return result;
        }

        long modalStart = System.nanoTime();
        oddsDomInteractor.openBet365OddsModal(page, timeout);
        logOddsStep(matchId, "openBet365OddsModal", modalStart);

        var retry = captureOddsDetailTabs(page, matchId, referer, timeout, includeCorner, true);
        return mergeOddsDetails(result, retry);
    }

    private OddsMapper.OddsDetails captureOddsDetailTabs(
            Page page,
            String matchId,
            String referer,
            long timeout,
            boolean includeCorner,
            boolean failOnEvaluateError
    ) {
        return captureOddsDetailTabs(page, matchId, referer, timeout, includeCorner, failOnEvaluateError, false);
    }

    private OddsMapper.OddsDetails captureOddsDetailTabs(
            Page page,
            String matchId,
            String referer,
            long timeout,
            boolean includeCorner,
            boolean failOnEvaluateError,
            boolean warmEvaluateComponentOnce
    ) {
        JsonNode asia = null;
        JsonNode bs = null;
        JsonNode corner = null;
        var evaluateWarmed = false;

        for (var tab : AiscoreOddsDomInteractor.DETAIL_TABS) {
            if ("corner".equals(tab.oddsType()) && !includeCorner) {
                continue;
            }
            long tabStart = System.nanoTime();
            var apiUrl = buildOddsDetailApiUrl(matchId, tab.oddsType());
            byte[] body;
            try {
                body = captureOddsDetailBody(
                        page, matchId, tab.oddsType(), apiUrl, referer, timeout, warmEvaluateComponentOnce && !evaluateWarmed);
                if (warmEvaluateComponentOnce) {
                    evaluateWarmed = true;
                }
            } catch (AiscoreBadGatewayException ex) {
                logOddsStep(matchId, "oddsDetailTab", tabStart, "oddsType", tab.oddsType(), "decoded", false);
                if (failOnEvaluateError) {
                    throw ex;
                }
                continue;
            }
            var decoded = decodeOddsDetailBody(body);
            logOddsStep(matchId, "oddsDetailTab", tabStart, "oddsType", tab.oddsType(), "decoded", decoded != null);
            if (decoded == null) {
                continue;
            }
            switch (tab.oddsType()) {
                case "asia" -> asia = decoded;
                case "bs" -> bs = decoded;
                case "corner" -> corner = decoded;
                default -> {
                }
            }
        }
        return new OddsMapper.OddsDetails(asia, null, bs, corner);
    }

    private static boolean hasAllExpectedOddsDetails(OddsMapper.OddsDetails details, boolean includeCorner) {
        if (details.asia() == null || details.bs() == null) {
            return false;
        }
        return !includeCorner || details.corner() != null;
    }

    private static OddsMapper.OddsDetails mergeOddsDetails(
            OddsMapper.OddsDetails first,
            OddsMapper.OddsDetails second
    ) {
        return new OddsMapper.OddsDetails(
                first.asia() != null ? first.asia() : second.asia(),
                null,
                first.bs() != null ? first.bs() : second.bs(),
                first.corner() != null ? first.corner() : second.corner()
        );
    }

    private byte[] captureOddsDetailBody(
            Page page,
            String matchId,
            String oddsType,
            String apiUrl,
            String referer,
            long timeout
    ) {
        return captureOddsDetailBody(page, matchId, oddsType, apiUrl, referer, timeout, false);
    }

    private byte[] captureOddsDetailBody(
            Page page,
            String matchId,
            String oddsType,
            String apiUrl,
            String referer,
            long timeout,
            boolean warmEvaluateComponent
    ) {
        long stepStart = System.nanoTime();
        var directTimeout = Math.min(timeout, 1_500L);
        var direct = contextApiClient.getOptional(page, apiUrl, referer, directTimeout);
        if (direct != null) {
            logOddsStep(matchId, "oddsDetailFetch", stepStart, "oddsType", oddsType, "method", "direct");
            return direct;
        }
        if (warmEvaluateComponent) {
            oddsDomInteractor.warmOddsDetailComponent(page, Math.min(timeout, 2_500L));
        }
        var body = oddsDomInteractor.captureOddsDetailViaEvaluate(page, matchId, oddsType, apiUrl, timeout);
        logOddsStep(matchId, "oddsDetailFetch", stepStart, "oddsType", oddsType, "method", "evaluate");
        return body;
    }

    private JsonNode decodeOddsDetailBody(byte[] body) {
        var decoded = protobufService.decodeMatchOddsDetail(body);
        return isEmptyObject(decoded) ? null : decoded;
    }

    private byte[] captureOptionalApiBody(Page page, String apiUrl, String publicPageUrl, long timeout) {
        try {
            return captureApiResponseBodies(page, List.of(apiUrl), publicPageUrl, timeout).getFirst();
        } catch (AiscoreBadGatewayException ex) {
            if ("AiScore API response was not found in page network traffic".equals(ex.getMessage())) {
                return null;
            }
            throw ex;
        }
    }

    private List<byte[]> captureApiResponseBodies(
            Page page,
            List<String> apiUrls,
            String publicPageUrl,
            long timeout
    ) {
        page.setDefaultTimeout(timeout);
        var bodies = new ArrayList<byte[]>();
        for (var apiUrl : apiUrls) {
            bodies.add(captureSingleApiBody(page, apiUrl, publicPageUrl, timeout));
        }
        return bodies;
    }

    private byte[] captureSingleApiBody(Page page, String apiUrl, String publicPageUrl, long timeout) {
        Response response;
        try {
            response = waitForApiResponse(page, apiUrl, publicPageUrl, timeout, false);
        } catch (TimeoutError ex) {
            response = waitForApiResponse(page, apiUrl, publicPageUrl, timeout, true);
        }
        if (!response.ok()) {
            throw new AiscoreBadGatewayException(
                    "AiScore upstream request failed",
                    Map.of("url", apiUrl, "status", response.status(), "statusText", response.statusText())
            );
        }
        return response.body();
    }

    private Response waitForApiResponse(
            Page page,
            String apiUrl,
            String publicPageUrl,
            long timeout,
            boolean reload
    ) {
        return page.waitForResponse(
                candidate -> ApiUrlMatcher.isSameApiRequest(candidate.url(), apiUrl),
                () -> {
                    if (reload) {
                        page.reload(new Page.ReloadOptions()
                                .setWaitUntil(WaitUntilState.DOMCONTENTLOADED)
                                .setTimeout(timeout));
                    } else {
                        PlaywrightUtil.navigateForApiCapture(page, publicPageUrl, timeout);
                        CloudflareSupport.waitForClearance(page, timeout);
                    }
                }
        );
    }

    private MatchPageInfo readMatchPageInfo(Page page, long timeout) {
        page.waitForFunction(
                """
                        () => {
                          const detail = window.$nuxt?.$store?.state?.football?.detail;
                          return !!detail?.WebMatchData?.match;
                        }
                        """,
                null,
                new Page.WaitForFunctionOptions().setTimeout(timeout)
        );

        @SuppressWarnings("unchecked")
        Map<String, Object> match = (Map<String, Object>) page.evaluate(
                """
                        () => {
                          const detail = window.$nuxt?.$store?.state?.football?.detail;
                          return detail?.WebMatchData?.match ?? null;
                        }
                        """
        );

        var matchNode = OBJECT_MAPPER.valueToTree(match == null ? Map.of() : match);
        return new MatchPageInfo(
                mapEventStatus(matchNode),
                numberValue(matchNode.get("statusId")),
                numberArray(matchNode.get("homeScores")),
                numberArray(matchNode.get("awayScores"))
        );
    }

    private String mapEventStatus(JsonNode match) {
        var statusId = numberValue(match.get("statusId"));
        if (statusId != null && statusId == 8) {
            return "FT";
        }
        if (statusId != null) {
            return String.valueOf(statusId);
        }
        var matchStatus = numberValue(match.get("matchStatus"));
        return matchStatus != null ? String.valueOf(matchStatus) : "-";
    }

    private MatchQuery normalizeQuery(MatchQuery query) {
        return new MatchQuery(
                query.date() == null || query.date().isBlank() ? "20180101" : query.date(),
                query.sportId() == null || query.sportId().isBlank() ? "1" : query.sportId(),
                query.lang() == null || query.lang().isBlank() ? "2" : query.lang(),
                query.tz() == null || query.tz().isBlank() ? "07:00" : query.tz(),
                query.matchId(),
                query.raw()
        );
    }

    private String buildApiUrl(MatchQuery params) {
        var query = new LinkedHashMap<String, String>();
        query.put("lang", params.lang());
        query.put("sport_id", params.sportId());
        query.put("date", params.date());
        query.put("tz", params.tz());
        return API_BASE_URL + "?" + encodeQuery(query);
    }

    private String buildPublicPageUrl(String apiUrl) {
        var rawQuery = URI.create(apiUrl).getQuery();
        if (rawQuery == null || rawQuery.isBlank()) {
            return "https://www.aiscore.com/20180101";
        }
        var date = Arrays.stream(rawQuery.split("&"))
                .map(part -> part.split("=", 2))
                .filter(parts -> parts.length == 2 && "date".equals(parts[0]))
                .map(parts -> parts[1])
                .findFirst()
                .orElse("20180101");
        return "https://www.aiscore.com/" + date;
    }

    private URI parseAndValidateEventLink(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new IllegalArgumentException("event_link query parameter is required");
        }
        URI url;
        try {
            url = URI.create(rawUrl);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid event_link: \"" + rawUrl + "\"");
        }
        if (!"https".equalsIgnoreCase(url.getScheme())) {
            throw new IllegalArgumentException("event_link protocol must be \"https:\", got \"" + url.getScheme() + ":\"");
        }
        var host = url.getHost();
        if (!"aiscore.com".equals(host) && !"www.aiscore.com".equals(host)) {
            throw new IllegalArgumentException("event_link host must be \"aiscore.com\" or \"www.aiscore.com\", got \"" + host + "\"");
        }
        return url;
    }

    private String extractMatchIdFromEventLink(String eventLink) {
        var segments = URI.create(eventLink).getPath().split("/");
        var matchId = segments.length == 0 ? null : segments[segments.length - 1];
        if (matchId == null || matchId.isBlank()) {
            throw new IllegalArgumentException("event_link must include an AiScore match ID in the last path segment");
        }
        return matchId;
    }

    private String buildOddsPublicPageUrl(String eventLink) {
        var url = URI.create(eventLink);
        var segments = new ArrayList<>(List.of(url.getPath().split("/")));
        segments.removeIf(String::isBlank);
        if (segments.isEmpty() || !"odds".equals(segments.getLast())) {
            segments.add("odds");
        }
        return "https://" + url.getHost() + "/" + String.join("/", segments);
    }

    private String buildOddsListApiUrl(String matchId) {
        return ODDS_LIST_API_BASE_URL + "?match_id=" + URLEncoder.encode(matchId, StandardCharsets.UTF_8);
    }

    private String buildOddsDetailApiUrl(String matchId, String oddsType) {
        var query = new LinkedHashMap<String, String>();
        query.put("match_id", matchId);
        query.put("odds_type", oddsType);
        query.put("cid", "2");
        return ODDS_DETAIL_API_BASE_URL + "?" + encodeQuery(query);
    }

    private String buildTeamStatsApiUrl(String matchId) {
        return TEAM_STATS_API_BASE_URL + "?match_id=" + URLEncoder.encode(matchId, StandardCharsets.UTF_8);
    }

    private String encodeQuery(Map<String, String> query) {
        var builder = new StringBuilder();
        query.forEach((key, value) -> {
            if (!builder.isEmpty()) {
                builder.append('&');
            }
            builder.append(URLEncoder.encode(key, StandardCharsets.UTF_8))
                    .append('=')
                    .append(URLEncoder.encode(value, StandardCharsets.UTF_8));
        });
        return builder.toString();
    }

    public record MatchQuery(
            String date,
            String sportId,
            String lang,
            String tz,
            String matchId,
            String raw
    ) {
        boolean rawEnabled() {
            return "true".equalsIgnoreCase(raw);
        }

        Map<String, Object> toMap() {
            var map = new HashMap<String, Object>();
            map.put("date", date);
            map.put("sport_id", sportId);
            map.put("lang", lang);
            map.put("tz", tz);
            map.put("match_id", matchId);
            map.put("raw", rawEnabled());
            return map;
        }
    }

    private record MatchPageInfo(
            String status,
            Integer statusId,
            List<Integer> homeScores,
            List<Integer> awayScores
    ) {
    }

    private static void logOddsStep(String matchId, String step, long startNano) {
        log.info(
                "MatchOdds timing matchId={} step={} durationSec={}",
                matchId,
                step,
                formatDurationSec(startNano)
        );
    }

    private static void logOddsStep(String matchId, String step, long startNano, String key, Object value) {
        log.info(
                "MatchOdds timing matchId={} step={} durationSec={} {}={}",
                matchId,
                step,
                formatDurationSec(startNano),
                key,
                value
        );
    }

    private static void logOddsStep(
            String matchId,
            String step,
            long startNano,
            String key1,
            Object value1,
            String key2,
            Object value2
    ) {
        log.info(
                "MatchOdds timing matchId={} step={} durationSec={} {}={} {}={}",
                matchId,
                step,
                formatDurationSec(startNano),
                key1,
                value1,
                key2,
                value2
        );
    }

    private static String formatDurationSec(long startNano) {
        return "%.3f".formatted((System.nanoTime() - startNano) / 1_000_000_000.0);
    }
}
