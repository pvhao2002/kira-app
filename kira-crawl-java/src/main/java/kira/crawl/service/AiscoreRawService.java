package kira.crawl.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;
import kira.crawl.browser.BrowserApiType;
import kira.crawl.browser.BrowserSessionManager;
import kira.crawl.browser.CdpNetworkCapture.ApiUrlMatcher;
import kira.crawl.browser.CloudflareSupport;
import kira.crawl.protobuf.AiscoreProtobufService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AiscoreRawService {

    private static final List<String> ALLOWED_PUBLIC_HOSTS = List.of("aiscore.com", "www.aiscore.com");
    private static final String ALLOWED_API_HOST = "api.aiscore.com";

    private final BrowserSessionManager browserSessionManager;
    private final AiscoreProtobufService protobufService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public Map<String, Object> fetchRaw(String rawPublicPageUrl, String rawApiUrl) {
        var publicPageUrl = parseAndValidateUrl(rawPublicPageUrl, "publicPageUrl", ALLOWED_PUBLIC_HOSTS).toString();
        var apiUrl = parseAndValidateUrl(rawApiUrl, "apiUrl", List.of(ALLOWED_API_HOST)).toString();

        return browserSessionManager.withPage(BrowserApiType.RAW, publicPageUrl, (page, timeout) -> {
            page.setDefaultTimeout(timeout);
            var response = page.waitForResponse(
                    candidate -> ApiUrlMatcher.isSameApiRequest(candidate.url(), apiUrl),
                    () -> {
                        page.navigate(publicPageUrl, new Page.NavigateOptions()
                                .setWaitUntil(com.microsoft.playwright.options.WaitUntilState.DOMCONTENTLOADED)
                                .setTimeout(timeout));
                        CloudflareSupport.waitForClearance(page, timeout);
                    }
            );
            return parseProtobufResponse(response, apiUrl);
        });
    }

    private Map<String, Object> parseProtobufResponse(Response response, String apiUrl) {
        if (!response.ok()) {
            throw new AiscoreBadGatewayException(
                    "AiScore upstream request failed",
                    Map.of("url", apiUrl, "status", response.status(), "statusText", response.statusText())
            );
        }

        try {
            var body = response.body();
            JsonNode decoded = decodeProtobufBody(body, apiUrl);
            return objectMapper.convertValue(decoded, Map.class);
        } catch (AiscoreBadGatewayException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AiscoreBadGatewayException(
                    "AiScore upstream response could not be decoded as protobuf",
                    Map.of("url", apiUrl, "status", response.status(), "cause", ex.getMessage())
            );
        }
    }

    private JsonNode decodeProtobufBody(byte[] body, String apiUrl) {
        var path = URI.create(apiUrl).getPath();
        if (path.endsWith("/v1/web/api/matches")) {
            return protobufService.decodeMatches(body);
        }
        if (path.endsWith("/v1/web/api/match/odds/detail")) {
            var oddsType = queryParam(apiUrl, "odds_type");
            return "corner".equals(oddsType)
                    ? protobufService.decodeMatchOddsDetail(body)
                    : protobufService.decodeWebMatchOddsDetail(body);
        }
        throw new IllegalArgumentException("Unsupported AiScore protobuf API URL: " + apiUrl);
    }

    private String queryParam(String url, String key) {
        var query = URI.create(url).getQuery();
        if (query == null) {
            return null;
        }
        for (var part : query.split("&")) {
            var pieces = part.split("=", 2);
            if (pieces.length == 2 && key.equals(pieces[0])) {
                return pieces[1];
            }
        }
        return null;
    }

    private URI parseAndValidateUrl(String rawUrl, String parameterName, List<String> allowedHosts) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new IllegalArgumentException(parameterName + " query parameter is required");
        }
        URI url;
        try {
            url = URI.create(rawUrl);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid " + parameterName + ": \"" + rawUrl + "\"");
        }
        if (!"https".equalsIgnoreCase(url.getScheme())) {
            throw new IllegalArgumentException(
                    parameterName + " protocol must be \"https:\", got \"" + url.getScheme() + ":\""
            );
        }
        if (!allowedHosts.contains(url.getHost())) {
            throw new IllegalArgumentException(
                    parameterName + " host must be one of \"" + String.join(", ", allowedHosts)
                            + "\", got \"" + url.getHost() + "\""
            );
        }
        return url;
    }
}
