package kira.crawl.browser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.LoadState;
import com.microsoft.playwright.options.RequestOptions;
import com.microsoft.playwright.options.WaitUntilState;
import lombok.extern.slf4j.Slf4j;
import kira.crawl.config.PlaywrightProperties;
import kira.crawl.dto.AiscoreMatchPageInfo;
import kira.crawl.protobuf.AiscoreProtobufService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

import static kira.crawl.util.JsonRecords.numberArray;
import static kira.crawl.util.JsonRecords.numberValue;

@Component
@RequiredArgsConstructor
@Slf4j
public class AiscoreMatchPageReader {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final int MIN_MATCH_DETAIL_BYTES = 64;

    private static final String MATCH_DETAIL_URL =
            "https://api.aiscore.com/v1/web/api/match/detail?match_id=%s&lang=2";
    private static final String MATCH_PAGE_REFERER = "https://www.aiscore.com/match/%s";

    private final AiscorePageFetchClient pageFetchClient;
    private final AiscoreProtobufService protobufService;
    private final PlaywrightProperties playwrightProperties;

    public static String buildMatchPageReferer(String matchId) {
        return MATCH_PAGE_REFERER.formatted(matchId);
    }

    public static String buildMatchDetailApiUrl(String matchId) {
        return MATCH_DETAIL_URL.formatted(matchId);
    }

    /**
     * Reads match status and scores API-first (no navigation). Falls back to Nuxt store only when
     * the tab is already on a page that contains the match id.
     */
    public AiscoreMatchPageInfo readMatchPageInfo(Page page, String matchId) {
        return readMatchPageInfo(page, matchId, null);
    }

    /**
     * Loads the public match page when needed so Nuxt store and match APIs return real payloads.
     * Skips navigation when the tab is already on the same match URL.
     */
    public boolean ensureMatchPageLoaded(Page page, String matchId) {
        var matchPageUrl = buildMatchPageReferer(matchId);
        if (isSameMatchPage(page, matchPageUrl)) {
            return false;
        }
        var timeout = playwrightProperties.browserTimeoutMs();
        page.setDefaultTimeout(timeout);
        page.setDefaultNavigationTimeout(timeout);
        log.info("Loading match page for matchId={} url={}", matchId, matchPageUrl);
        page.navigate(
                matchPageUrl,
                new Page.NavigateOptions()
                        .setWaitUntil(WaitUntilState.DOMCONTENTLOADED)
                        .setTimeout(timeout)
        );
        page.waitForLoadState(LoadState.DOMCONTENTLOADED);
        CloudflareSupport.waitForClearance(page, timeout);
        return true;
    }

    /**
     * Same as {@link #readMatchPageInfo(Page, String)} but uses a pre-fetched match/detail body when present.
     */
    public AiscoreMatchPageInfo readMatchPageInfo(Page page, String matchId, byte[] prefetchedDetailBody) {
        if (prefetchedDetailBody != null && prefetchedDetailBody.length >= MIN_MATCH_DETAIL_BYTES) {
            var prefetched = fromMatchDetailBody(prefetchedDetailBody);
            if (prefetched.hasScores() || !"-".equals(prefetched.status())) {
                return prefetched;
            }
        }

        if (pageUrlContainsMatchId(page, matchId)) {
            var nuxtInfo = readMatchPageInfoFromNuxt(page, playwrightProperties.browserTimeoutMs());
            if (nuxtInfo.hasScores() || !"-".equals(nuxtInfo.status())) {
                return nuxtInfo;
            }
        }

        var detailUrl = buildMatchDetailApiUrl(matchId);
        var matchReferer = buildMatchPageReferer(matchId);

        for (var referer : refererCandidates(page, matchReferer)) {
            var info = fromMatchDetailBody(fetchMatchDetailBody(page, detailUrl, referer));
            if (info.hasScores() || !"-".equals(info.status())) {
                return info;
            }
        }

        return empty();
    }

    AiscoreMatchPageInfo readMatchPageInfoFromNuxt(Page page, long waitTimeoutMs) {
        try {
            page.waitForFunction(
                    """
                            () => {
                              const detail = window.$nuxt?.$store?.state?.football?.detail;
                              return !!detail?.WebMatchData?.match;
                            }
                            """,
                    null,
                    new Page.WaitForFunctionOptions().setTimeout(waitTimeoutMs)
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
            return fromMatchNode(matchNode);
        } catch (RuntimeException ex) {
            return empty();
        }
    }

    private byte[] fetchMatchDetailBody(Page page, String detailUrl, String referer) {
        var body = fetchIfSubstantial(page, detailUrl, referer, false);
        if (body != null) {
            return body;
        }
        return fetchIfSubstantial(page, detailUrl, referer, true);
    }

    private byte[] fetchIfSubstantial(Page page, String apiUrl, String referer, boolean useContextRequest) {
        byte[] body = useContextRequest
                ? fetchViaContextRequest(page, apiUrl, referer)
                : pageFetchClient.fetchOptional(page, apiUrl, referer);
        if (body != null && body.length >= MIN_MATCH_DETAIL_BYTES) {
            return body;
        }
        return null;
    }

    private byte[] fetchViaContextRequest(Page page, String apiUrl, String referer) {
        APIResponse response;
        try {
            response = page.context().request().get(
                    apiUrl,
                    RequestOptions.create()
                            .setHeader("referer", referer)
                            .setHeader("origin", AiscorePageFetchClient.ORIGIN)
                            .setHeader("accept-language", playwrightProperties.acceptLanguage())
                            .setTimeout((int) playwrightProperties.browserTimeoutMs())
            );
        } catch (RuntimeException ex) {
            return null;
        }
        if (!response.ok()) {
            return null;
        }
        var body = response.body();
        return body != null && body.length >= MIN_MATCH_DETAIL_BYTES ? body : null;
    }

    private AiscoreMatchPageInfo fromMatchDetailBody(byte[] body) {
        if (body == null) {
            return empty();
        }
        try {
            var decoded = protobufService.decodeWebMatchData(body);
            var matchNode = decoded.get("match");
            if (matchNode == null || matchNode.isNull()) {
                return empty();
            }
            return fromMatchNode(matchNode);
        } catch (RuntimeException ex) {
            return empty();
        }
    }

    private static List<String> refererCandidates(Page page, String matchReferer) {
        return List.of(matchReferer, AiscorePageFetchClient.ORIGIN, safePageUrl(page));
    }

    static boolean isSameMatchPage(Page page, String matchPageUrl) {
        if (page == null || page.isClosed() || matchPageUrl == null || matchPageUrl.isBlank()) {
            return false;
        }
        try {
            var current = java.net.URI.create(page.url());
            var target = java.net.URI.create(matchPageUrl);
            return normalizeHost(current.getHost()).equals(normalizeHost(target.getHost()))
                    && normalizePath(current.getPath()).equals(normalizePath(target.getPath()));
        } catch (RuntimeException ex) {
            return false;
        }
    }

    private static String normalizeHost(String host) {
        if (host == null) {
            return "";
        }
        return host.startsWith("www.") ? host.substring(4) : host;
    }

    private static String normalizePath(String path) {
        if (path == null || path.isBlank()) {
            return "/";
        }
        var normalized = path.endsWith("/") && path.length() > 1 ? path.substring(0, path.length() - 1) : path;
        return normalized.isEmpty() ? "/" : normalized;
    }

    private static boolean pageUrlContainsMatchId(Page page, String matchId) {
        if (page == null || page.isClosed() || matchId == null || matchId.isBlank()) {
            return false;
        }
        try {
            return page.url().contains(matchId);
        } catch (RuntimeException ex) {
            return false;
        }
    }

    private static String safePageUrl(Page page) {
        if (page == null || page.isClosed()) {
            return AiscorePageFetchClient.ORIGIN;
        }
        try {
            var url = page.url();
            return url != null && !url.isBlank() ? url : AiscorePageFetchClient.ORIGIN;
        } catch (RuntimeException ex) {
            return AiscorePageFetchClient.ORIGIN;
        }
    }

    private static AiscoreMatchPageInfo fromMatchNode(JsonNode match) {
        return new AiscoreMatchPageInfo(
                mapEventStatus(match),
                numberValue(match.get("statusId")),
                numberArray(match.get("homeScores")),
                numberArray(match.get("awayScores"))
        );
    }

    private static AiscoreMatchPageInfo empty() {
        return new AiscoreMatchPageInfo("-", null, List.of(), List.of());
    }

    private static String mapEventStatus(JsonNode match) {
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
}
