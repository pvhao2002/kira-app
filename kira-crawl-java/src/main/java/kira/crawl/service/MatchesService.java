package kira.crawl.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.TimeoutError;
import com.microsoft.playwright.options.WaitUntilState;
import kira.crawl.browser.BrowserApiType;
import kira.crawl.browser.CloudflareSupport;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.dto.*;
import kira.crawl.mapper.MatchMapper;
import kira.crawl.mapper.OddsMapper;
import kira.crawl.protobuf.AiscoreProtobufService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.BiFunction;

import static kira.crawl.util.JsonRecords.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class MatchesService {
   public static final String API_BASE_URL = "https://api.aiscore.com/v1/web/api/matches";
   public static final String ODDS_LIST_API_BASE_URL = "https://api.aiscore.com/v1/web/api/match/odds_list";
   public static final String ODDS_DETAIL_API_BASE_URL = "https://api.aiscore.com/v1/web/api/match/odds/detail";
   public static final String TEAM_STATS_API_BASE_URL = "https://api.aiscore.com/v1/web/api/match/team_stats";
   public static final String MATCH_DETAIL_API_BASE_URL = "https://api.aiscore.com/v1/web/api/match/detail";

   /** Opening the rendered Bet365 odds modal should fail fast and fall back to odds_list. */
   public static final long ODDS_MODAL_OPEN_TIMEOUT_MS = 8_000L;
   /** Per-tab odds detail capture timeout after the Bet365 modal is open. */
   public static final long ODDS_DETAIL_TAB_TIMEOUT_MS = 1_500L;

   private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

   private final BrowserSessionManager browserSessionManager;
   private final AiscoreOddsDomInteractor oddsDomInteractor;
   private final AiscoreContextApiClient contextApiClient;
   private final AiscoreMatchPageReader matchPageReader;
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


   public Object findMatchOdds(String eventLink, Boolean hasOddsCorner) {
       var publicPageUrl = AiscoreOddsUrls.parseAndValidateEventLink(eventLink).toString();
       var oddsPublicPageUrl = AiscoreOddsUrls.buildOddsPublicPageUrl(publicPageUrl);
       var matchId = AiscoreOddsUrls.extractMatchIdFromEventLink(publicPageUrl);
       var oddsListApiUrl = AiscoreOddsUrls.buildOddsListApiUrl(matchId);
       var teamStatsApiUrl = AiscoreOddsUrls.buildTeamStatsApiUrl(matchId);

       return withIsolatedPlaywrightPage(oddsPublicPageUrl, (page, timeout) ->
               crawlMatchOdds(
                       page,
                       timeout,
                       publicPageUrl,
                       oddsPublicPageUrl,
                       matchId,
                       oddsListApiUrl,
                       teamStatsApiUrl,
                       hasOddsCorner
               ));
   }

   private Object crawlMatchOdds(
           Page page,
           long timeout,
           String publicPageUrl,
           String oddsPublicPageUrl,
           String matchId,
           String oddsListApiUrl,
           String teamStatsApiUrl,
           Boolean hasOddsCorner
   ) {
       long crawlStart = System.nanoTime();

       var oddsListBody = captureApiResponseBodies(page, List.of(oddsListApiUrl), oddsPublicPageUrl, timeout).getFirst();
       var oddsList = protobufService.decodeMatchOdds(oddsListBody);

       if (!oddsMapper.hasBet365Company(oddsList)) {
           log.info(
                   "MatchOdds timing summary matchId={} outcome=noBet365 totalSec={}",
                   matchId,
                   formatDurationSec(crawlStart)
           );
           return Map.of();
       }

       boolean includeCorner = Boolean.TRUE.equals(hasOddsCorner);

       var oddsDetails = captureWebOddsDetailBody(page, matchId, oddsPublicPageUrl, timeout, includeCorner);

       var timelineOdds = oddsMapper.mapOddsTimelineForDatabase(oddsDetails);

       var pageInfo = matchPageReader.readMatchPageInfoFromNuxt(page, timeout);

       var teamStatsBody = captureOptionalApiBody(page, teamStatsApiUrl, publicPageUrl, timeout);

       var teamStats = teamStatsBody == null ? null : protobufService.decodeMatchTeamStats(teamStatsBody);
       var eventResult = matchMapper.mapEventResultFromCrawl(
               pageInfo.homeScores(),
               pageInfo.awayScores(),
               teamStats
       );

       var response = new MatchOddsResponseDto(
               matchId,
               new CrawlMatchOddsEventDto(pageInfo.status() != null ? pageInfo.status() : "-", pageInfo.statusId()),
               eventResult,
               !timelineOdds.isEmpty()
                       ? oddsMapper.mapOddsForDatabase(oddsDetails)
                       : oddsMapper.mapOddsListForDatabase(oddsList),
               oddsMapper.groupOddsTimelineForResponse(timelineOdds),
               null
       );
       log.info(
               "MatchOdds timing summary matchId={} outcome=success totalSec={} includeCorner={}",
               matchId,
               formatDurationSec(crawlStart),
               includeCorner
       );
       return response;
   }

   private <T> T withIsolatedPlaywrightPage(
           String publicPageUrl,
           BiFunction<Page, Long, T> handler
   ) {
       var timeout = playwrightProperties.browserTimeoutMs();
       var headers = Map.of(
               "referer", publicPageUrl,
               "origin", "https://www.aiscore.com",
               "accept-language", playwrightProperties.acceptLanguage()
       );
       log.info("Opening isolated crawl page for {} at {}", BrowserApiType.ODDS, publicPageUrl);

       try (var playwright = Playwright.create();
            var browser = PlaywrightBrowserSupport.launchBrowser(
                    playwright, playwrightProperties.headless(), playwrightProperties.channel());
            var context = PlaywrightBrowserSupport.createPreparedContext(browser, playwrightProperties)) {
           var page = context.newPage();
           page.setDefaultTimeout(timeout);
           page.setDefaultNavigationTimeout(timeout);
           page.setExtraHTTPHeaders(headers);
           try {
               return handler.apply(page, timeout);
           } finally {
               PlaywrightBrowserSupport.closePageQuietly(page);
           }
       }
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

       long modalStart = System.nanoTime();
       var modalTimeout = Math.min(timeout, ODDS_MODAL_OPEN_TIMEOUT_MS);
       try {
           oddsDomInteractor.openBet365OddsModal(page, modalTimeout);
           logOddsStep(matchId, "openBet365OddsModal", modalStart, Map.of(
                   "outcome", "success",
                   "timeoutMs", modalTimeout,
                   "url", page.url()
           ));
       } catch (AiscoreBadGatewayException ex) {
           logOddsStep(matchId, "openBet365OddsModal", modalStart, Map.of(
                   "outcome", "failed",
                   "timeoutMs", modalTimeout,
                   "url", page.url(),
                   "error", ex.getMessage()
           ));
           return new OddsMapper.OddsDetails(null, null, null, null);
       }

       var tabTimeout = Math.min(timeout, ODDS_DETAIL_TAB_TIMEOUT_MS);
       return captureOddsDetailTabs(page, matchId, referer, tabTimeout, includeCorner, false, true);
   }

   private OddsMapper.OddsDetails captureOddsDetailTabs(
           Page page,
           String matchId,
           String referer,
           long timeout,
           boolean includeCorner,
           boolean failOnEvaluateError,
           boolean clickModalTabs
   ) {
       JsonNode asia = null;
       JsonNode bs = null;
       JsonNode corner = null;

       for (var tab : AiscoreOddsDomInteractor.DETAIL_TABS) {
           if ("corner".equals(tab.oddsType()) && !includeCorner) {
               continue;
           }
           long tabStart = System.nanoTime();
           var apiUrl = AiscoreOddsUrls.buildOddsDetailApiUrl(matchId, tab.oddsType());
           byte[] body;
           try {
               logOddsStep(matchId, "oddsDetailTabStart", tabStart, Map.of(
                       "oddsType", tab.oddsType(),
                       "tabLabel", tab.tabLabel(),
                       "apiUrl", apiUrl,
                       "timeoutMs", timeout,
                       "clickModalTabs", clickModalTabs
               ));
               body = clickModalTabs
                       ? captureOddsDetailBodyViaModalTab(page, matchId, tab, apiUrl, referer, timeout)
                       : captureOddsDetailBody(page, matchId, tab.oddsType(), apiUrl, referer, timeout);
           } catch (AiscoreBadGatewayException ex) {
               logOddsStep(matchId, "oddsDetailTab", tabStart, Map.of(
                       "oddsType", tab.oddsType(),
                       "tabLabel", tab.tabLabel(),
                       "apiUrl", apiUrl,
                       "decoded", false,
                       "outcome", "failed",
                       "error", ex.getMessage()
               ));
               if (failOnEvaluateError) {
                   throw ex;
               }
               continue;
           }
           if (body == null) {
               logOddsStep(matchId, "oddsDetailTab", tabStart, Map.of(
                       "oddsType", tab.oddsType(),
                       "tabLabel", tab.tabLabel(),
                       "apiUrl", apiUrl,
                       "decoded", false,
                       "outcome", "skipped",
                       "reason", "detailBodyUnavailable"
               ));
               continue;
           }
           var decoded = decodeOddsDetailBody(body);
           logOddsStep(matchId, "oddsDetailTab", tabStart, Map.of(
                   "oddsType", tab.oddsType(),
                   "tabLabel", tab.tabLabel(),
                   "apiUrl", apiUrl,
                   "decoded", decoded != null,
                   "outcome", decoded != null ? "success" : "emptyDecoded"
           ));
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

   private byte[] captureOddsDetailBodyViaModalTab(
           Page page,
           String matchId,
           AiscoreOddsDomInteractor.DetailTab tab,
           String apiUrl,
           String referer,
           long timeout
   ) {
       page.setDefaultTimeout(timeout);
       long networkStart = System.nanoTime();
       try {
           Response response = page.waitForResponse(
                   candidate -> ApiUrlMatcher.isSameApiRequest(candidate.url(), apiUrl),
                   () -> {
                       long clickStart = System.nanoTime();
                       try {
                           oddsDomInteractor.clickOddsDetailTab(page, tab, timeout);
                       } catch (AiscoreBadGatewayException ex) {
                           logOddsStep(matchId, "oddsDetailClick", clickStart, Map.of(
                                   "oddsType", tab.oddsType(),
                                   "tabLabel", tab.tabLabel(),
                                   "selector", AiscoreOddsDomInteractor.MODAL_TAB_SELECTOR,
                                   "timeoutMs", timeout,
                                   "outcome", "failed",
                                   "error", ex.getMessage()
                           ));
                           throw ex;
                       }
                       logOddsStep(matchId, "oddsDetailClick", clickStart, Map.of(
                               "oddsType", tab.oddsType(),
                               "tabLabel", tab.tabLabel(),
                               "selector", AiscoreOddsDomInteractor.MODAL_TAB_SELECTOR,
                               "timeoutMs", timeout,
                               "method", "modalTab",
                               "outcome", "success"
                       ));
                   }
           );
           if (response.ok()) {
               logOddsStep(matchId, "oddsDetailFetch", networkStart, Map.of(
                       "oddsType", tab.oddsType(),
                       "tabLabel", tab.tabLabel(),
                       "apiUrl", apiUrl,
                       "referer", referer,
                       "method", "networkAfterModalClick",
                       "timeoutMs", timeout,
                       "outcome", "success"
               ));
               return response.body();
           }
           logOddsStep(matchId, "oddsDetailFetch", networkStart, Map.of(
                   "oddsType", tab.oddsType(),
                   "tabLabel", tab.tabLabel(),
                   "apiUrl", apiUrl,
                   "referer", referer,
                   "method", "networkAfterModalClick",
                   "timeoutMs", timeout,
                   "outcome", "badStatus",
                   "status", response.status()
           ));
       } catch (TimeoutError ex) {
           logOddsStep(matchId, "oddsDetailFetch", networkStart, Map.of(
                   "oddsType", tab.oddsType(),
                   "tabLabel", tab.tabLabel(),
                   "apiUrl", apiUrl,
                   "referer", referer,
                   "method", "networkAfterModalClick",
                   "timeoutMs", timeout,
                   "outcome", "miss"
           ));
       }

       long fetchStart = System.nanoTime();
       var body = contextApiClient.getOptional(page, apiUrl, referer, timeout);
       if (body != null) {
           logOddsStep(matchId, "oddsDetailFetch", fetchStart, Map.of(
                   "oddsType", tab.oddsType(),
                   "tabLabel", tab.tabLabel(),
                   "apiUrl", apiUrl,
                   "referer", referer,
                   "method", "directAfterModalClick",
                   "timeoutMs", timeout,
                   "outcome", "success"
           ));
           return body;
       }

       logOddsStep(matchId, "oddsDetailFetch", fetchStart, Map.of(
               "oddsType", tab.oddsType(),
               "tabLabel", tab.tabLabel(),
               "apiUrl", apiUrl,
               "referer", referer,
               "method", "directAfterModalClick",
               "timeoutMs", timeout,
               "outcome", "miss"
       ));
       return null;
   }

   private byte[] captureOddsDetailBody(
           Page page,
           String matchId,
           String oddsType,
           String apiUrl,
           String referer,
           long timeout
   ) {
       long stepStart = System.nanoTime();
       var directTimeout = Math.min(timeout, 1_500L);
       var direct = contextApiClient.getOptional(page, apiUrl, referer, directTimeout);
       if (direct != null) {
           logOddsStep(matchId, "oddsDetailFetch", stepStart, Map.of(
                   "oddsType", oddsType,
                   "apiUrl", apiUrl,
                   "referer", referer,
                   "method", "direct",
                   "timeoutMs", directTimeout,
                   "outcome", "success"
           ));
           return direct;
       }
       logOddsStep(matchId, "oddsDetailFetch", stepStart, Map.of(
               "oddsType", oddsType,
               "apiUrl", apiUrl,
               "referer", referer,
               "method", "direct",
               "timeoutMs", directTimeout,
               "outcome", "miss"
       ));
       try {
           var body = oddsDomInteractor.captureOddsDetailViaEvaluate(page, matchId, oddsType, apiUrl, timeout);
           logOddsStep(matchId, "oddsDetailFetch", stepStart, Map.of(
                   "oddsType", oddsType,
                   "apiUrl", apiUrl,
                   "referer", referer,
                   "method", "evaluate",
                   "timeoutMs", timeout,
                   "outcome", "success"
           ));
           return body;
       } catch (AiscoreBadGatewayException ex) {
           logOddsStep(matchId, "oddsDetailFetch", stepStart, Map.of(
                   "oddsType", oddsType,
                   "apiUrl", apiUrl,
                   "referer", referer,
                   "method", "evaluate",
                   "timeoutMs", timeout,
                   "outcome", "failed",
                   "error", ex.getMessage()
           ));
           throw ex;
       }
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

   private static void logOddsStep(String matchId, String step, long startNano, Map<String, Object> fields) {
       var details = new StringBuilder();
       for (var entry : fields.entrySet()) {
           if (!details.isEmpty()) {
               details.append(' ');
           }
           details.append(entry.getKey()).append('=').append(entry.getValue());
       }
       log.info(
               "MatchOdds timing matchId={} step={} durationSec={} {}",
               matchId,
               step,
               formatDurationSec(startNano),
               details
       );
   }

   private static String formatDurationSec(long startNano) {
       return "%.3f".formatted((System.nanoTime() - startNano) / 1_000_000_000.0);
   }
}
