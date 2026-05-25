package kira.crawl.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.TimeoutError;
import kira.crawl.browser.BrowserApiType;
import kira.crawl.browser.BrowserSessionManager;
import kira.crawl.browser.CdpNetworkCapture.ApiUrlMatcher;
import kira.crawl.browser.CloudflareSupport;
import kira.crawl.dto.*;
import kira.crawl.mapper.MatchMapper;
import kira.crawl.mapper.OddsMapper;
import kira.crawl.protobuf.AiscoreProtobufService;
import kira.crawl.util.JsonRecords;
import kira.crawl.util.PlaywrightUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static kira.crawl.util.JsonRecords.*;

@Service
@RequiredArgsConstructor
public class MatchesService {

    private static final String API_BASE_URL = "https://api.aiscore.com/v1/web/api/matches";
    private static final String ODDS_LIST_API_BASE_URL = "https://api.aiscore.com/v1/web/api/match/odds_list";
    private static final String ODDS_DETAIL_API_BASE_URL = "https://api.aiscore.com/v1/web/api/match/odds/detail";
    private static final String TEAM_STATS_API_BASE_URL = "https://api.aiscore.com/v1/web/api/match/team_stats";

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final BrowserSessionManager browserSessionManager;
    private final AiscoreProtobufService protobufService;
    private final MatchMapper matchMapper;
    private final OddsMapper oddsMapper;

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

    public Object findMatchOdds(String eventLink) {
        var publicPageUrl = parseAndValidateEventLink(eventLink).toString();
        var oddsPublicPageUrl = buildOddsPublicPageUrl(publicPageUrl);
        var matchId = extractMatchIdFromEventLink(publicPageUrl);
        var oddsListApiUrl = buildOddsListApiUrl(matchId);
        var teamStatsApiUrl = buildTeamStatsApiUrl(matchId);

        return browserSessionManager.withPage(BrowserApiType.ODDS, oddsPublicPageUrl, (page, timeout) -> {
            var oddsListBody = captureApiResponseBodies(page, List.of(oddsListApiUrl), oddsPublicPageUrl, timeout).getFirst();
            var oddsList = protobufService.decodeMatchOdds(oddsListBody);
            if (!oddsMapper.hasBet365Company(oddsList)) {
                return Map.of();
            }

            var oddsDetails = captureWebOddsDetailBody(page, matchId, timeout, oddsMapper.hasCornerMarket(oddsList));
            var timelineOdds = oddsMapper.mapOddsTimelineForDatabase(oddsDetails);
            var pageInfo = readMatchPageInfo(page, timeout);
            var teamStatsBody = captureOptionalApiBody(page, teamStatsApiUrl, publicPageUrl, timeout);
            var eventResult = teamStatsBody == null
                    ? new CrawlEventResultDto(null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null, null, null)
                    : matchMapper.mapEventResultForDatabase(pageInfo.homeScores(), pageInfo.awayScores(),
                    protobufService.decodeMatchTeamStats(teamStatsBody));

            var aiscoreRaw = new LinkedHashMap<String, Object>();
            aiscoreRaw.put("oddsList", OBJECT_MAPPER.convertValue(oddsList, Map.class));
            aiscoreRaw.put("asia", toMapOrNull(oddsDetails.asia()));
            aiscoreRaw.put("eu", toMapOrNull(oddsDetails.eu()));
            aiscoreRaw.put("bs", toMapOrNull(oddsDetails.bs()));
            aiscoreRaw.put("corner", toMapOrNull(oddsDetails.corner()));
            aiscoreRaw.put("teamStats", teamStatsBody == null
                    ? null
                    : OBJECT_MAPPER.convertValue(protobufService.decodeMatchTeamStats(teamStatsBody), Map.class));

            return new MatchOddsResponseDto(
                    matchId,
                    new CrawlMatchOddsEventDto(pageInfo.status() != null ? pageInfo.status() : "-", pageInfo.statusId()),
                    eventResult,
                    !timelineOdds.isEmpty()
                            ? oddsMapper.mapOddsForDatabase(oddsDetails)
                            : oddsMapper.mapOddsListForDatabase(oddsList),
                    oddsMapper.groupOddsTimelineForResponse(timelineOdds),
                    aiscoreRaw
            );
        });
    }

    private Map<String, Object> toMapOrNull(JsonNode node) {
        if (JsonRecords.isEmptyObject(node)) {
            return null;
        }
        return OBJECT_MAPPER.convertValue(node, Map.class);
    }

    private OddsMapper.OddsDetails captureWebOddsDetailBody(
            Page page,
            String matchId,
            long timeout,
            boolean includeCorner
    ) {
        page.setDefaultTimeout(timeout);
        var detailConfigs = includeCorner
                ? List.of("asia", "bs", "corner")
                : List.of("asia", "bs");
        JsonNode asia = null;
        JsonNode bs = null;
        JsonNode corner = null;

        for (var oddsType : detailConfigs) {
            var apiUrl = buildOddsDetailApiUrl(matchId, oddsType);
            var body = captureOddsDetailResponse(page, matchId, oddsType, apiUrl, timeout);
            var decoded = decodeOddsDetailBody(body);
            if (decoded == null) {
                continue;
            }
            switch (oddsType) {
                case "asia" -> asia = decoded;
                case "bs" -> bs = decoded;
                case "corner" -> corner = decoded;
                default -> {
                }
            }
        }
        return new OddsMapper.OddsDetails(asia, null, bs, corner);
    }

    private byte[] captureOddsDetailResponse(
            Page page,
            String matchId,
            String oddsType,
            String apiUrl,
            long timeout
    ) {
        Response response;
        try {
            response = page.waitForResponse(
                    candidate -> ApiUrlMatcher.isSameApiRequest(candidate.url(), apiUrl),
                    () -> requestOddsDetailFromPage(page, matchId, oddsType, timeout)
            );
        } catch (TimeoutError ex) {
            throw new AiscoreBadGatewayException(
                    "AiScore API response was not found in page network traffic",
                    Map.of("apiUrl", apiUrl)
            );
        }
        if (!response.ok()) {
            throw new AiscoreBadGatewayException(
                    "AiScore upstream request failed",
                    Map.of("url", apiUrl, "status", response.status(), "statusText", response.statusText())
            );
        }
        return response.body();
    }

    private JsonNode decodeOddsDetailBody(byte[] body) {
        var decoded = protobufService.decodeMatchOddsDetail(body);
        return JsonRecords.isEmptyObject(decoded) ? null : decoded;
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
        var bodies = new java.util.ArrayList<byte[]>();
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
                                .setWaitUntil(com.microsoft.playwright.options.WaitUntilState.DOMCONTENTLOADED)
                                .setTimeout(timeout));
                    } else {
                        PlaywrightUtil.navigateForApiCapture(page, publicPageUrl, timeout);
                        CloudflareSupport.waitForClearance(page, timeout);
                    }
                }
        );
    }

    private void requestOddsDetailFromPage(Page page, String matchId, String oddsType, long timeout) {
        page.waitForFunction(
                """
                        () => {
                          const nuxt = window.$nuxt;
                          const queue = [...(nuxt?.$children ?? [])];
                          while (queue.length > 0) {
                            const vm = queue.shift();
                            if (!vm) continue;
                            if (typeof vm.$options?.methods?.getOddsDetail === 'function'
                                && vm.$data
                                && Object.prototype.hasOwnProperty.call(vm.$data, 'activeTab')) {
                              return true;
                            }
                            queue.push(...(vm.$children ?? []));
                          }
                          return false;
                        }
                        """,
                null,
                new Page.WaitForFunctionOptions().setTimeout(timeout)
        );

        page.evaluate(
                """
                        async ({ id, type }) => {
                          const nuxt = window.$nuxt;
                          const queue = [nuxt];
                          const visited = new Set();
                          let target;
                          while (queue.length > 0) {
                            const vm = queue.shift();
                            if (!vm) continue;
                            if (typeof vm._uid === 'number') {
                              if (visited.has(vm._uid)) continue;
                              visited.add(vm._uid);
                            }
                            const hasGetOddsDetail =
                              typeof vm.$options?.methods?.getOddsDetail === 'function'
                              && vm.$data
                              && Object.prototype.hasOwnProperty.call(vm.$data, 'activeTab');
                            if (hasGetOddsDetail) {
                              target = vm;
                              break;
                            }
                            queue.push(...(vm.$children ?? []));
                          }
                          if (!target || typeof target.getOddsDetail !== 'function') {
                            throw new Error('Cannot find AiScore odds detail component to trigger tab request');
                          }
                          target.activeTab = type;
                          target.countryId = 2;
                          if (!target.WebMatchData?.match?.id) {
                            target.WebMatchData = { match: { id } };
                          }
                          await target.getOddsDetail();
                        }
                        """,
                Map.of("id", matchId, "type", oddsType)
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
        var date = java.util.Arrays.stream(rawQuery.split("&"))
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
        var segments = new java.util.ArrayList<>(List.of(url.getPath().split("/")));
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
}
