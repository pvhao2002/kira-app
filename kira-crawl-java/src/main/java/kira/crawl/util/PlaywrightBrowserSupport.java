package kira.crawl.util;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.ColorScheme;
import com.microsoft.playwright.options.Cookie;
import kira.crawl.config.PlaywrightProperties;
import lombok.experimental.UtilityClass;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;

@UtilityClass
public class PlaywrightBrowserSupport {

    static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    private static final int VIEWPORT_WIDTH = 1920;
    private static final int VIEWPORT_HEIGHT = 1080;
    private static final String LOCALE = "en-US";
    private static final Set<String> LEAN_NETWORK_BLOCKED_TYPES = Set.of("image", "font", "media");

    private static final String INIT_SCRIPT_STEALTH = """
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = window.chrome || { runtime: {} };
            """;

    private static final String DEFAULT_OPTIONS_CLOSED_COOKIE = "optionsClosed";

    public static Browser launchBrowser(Playwright playwright, boolean headless) {
        return playwright.chromium().launch(launchOptions(headless));
    }

    public static BrowserContext createPreparedContext(Browser browser, PlaywrightProperties properties) {
        var context = browser.newContext(contextOptions(properties));
        installLeanNetwork(context);
        addDefaultContextCookies(context);
        seedCookies(context, properties.cookie());
        context.addInitScript(INIT_SCRIPT_STEALTH);
        return context;
    }

    public static BrowserType.LaunchOptions launchOptions(boolean headless) {
        var args = new ArrayList<>(List.of(
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-infobars",
                "--disable-dev-shm-usage",
                "--disable-background-networking",
                "--disable-renderer-backgrounding",
                "--window-size=%d,%d".formatted(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
        ));
        if (headless) {
            args.add("--headless=new");
        }
        return new BrowserType.LaunchOptions()
                .setHeadless(headless)
                .setArgs(args);
    }

    public static void installLeanNetwork(BrowserContext context) {
        if (!isLeanNetworkEnabled()) {
            return;
        }
        context.route("**/*", route -> {
            if (shouldBlockResourceType(route.request().resourceType())) {
                route.abort();
                return;
            }
            route.resume();
        });
    }

    public static boolean isLeanNetworkEnabled() {
        var raw = System.getenv("PLAYWRIGHT_UTIL_LEAN_NETWORK");
        if (raw == null || raw.isBlank()) {
            return true;
        }
        return !"false".equalsIgnoreCase(raw.trim()) && !"0".equals(raw.trim());
    }

    public static boolean shouldBlockResourceType(String resourceType) {
        return isLeanNetworkEnabled() && LEAN_NETWORK_BLOCKED_TYPES.contains(resourceType);
    }

    public static boolean isContextBroken(BrowserContext context) {
        try {
            return context == null || context.browser() == null || !context.browser().isConnected();
        } catch (Exception ex) {
            return true;
        }
    }

    public static void closeAllPages(BrowserContext context) {
        for (var page : new ArrayList<>(context.pages())) {
            closePageQuietly(page);
        }
    }

    public static void closePageQuietly(Page page) {
        if (page == null || page.isClosed()) {
            return;
        }
        try {
            page.close();
        } catch (Exception ignored) {
            // best effort
        }
    }

    public static void closeContextQuietly(BrowserContext context) {
        if (context == null) {
            return;
        }
        try {
            closeAllPages(context);
            context.close();
        } catch (Exception ignored) {
            // best effort
        }
    }

    public static void closeBrowserQuietly(Browser browser) {
        if (browser == null) {
            return;
        }
        try {
            browser.close();
        } catch (Exception ignored) {
            // best effort
        }
    }

    private static Browser.NewContextOptions contextOptions(PlaywrightProperties properties) {
        var userAgent = properties.userAgent() != null && !properties.userAgent().isBlank()
                ? properties.userAgent()
                : USER_AGENT;
        var acceptLanguage = properties.acceptLanguage() != null && !properties.acceptLanguage().isBlank()
                ? properties.acceptLanguage()
                : "en-US,en;q=0.9,vi;q=0.8";
        return new Browser.NewContextOptions()
                .setUserAgent(userAgent)
                .setViewportSize(VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
                .setLocale(LOCALE)
                .setTimezoneId("Asia/Ho_Chi_Minh")
                .setExtraHTTPHeaders(Map.of("accept-language", acceptLanguage))
                .setIgnoreHTTPSErrors(false)
                .setColorScheme(ColorScheme.LIGHT)
                .setDeviceScaleFactor(1);
    }

    private static void addDefaultContextCookies(BrowserContext context) {
        long ts = System.currentTimeMillis();
        context.addCookies(List.of(
                new Cookie(DEFAULT_OPTIONS_CLOSED_COOKIE, Long.toString(ts))
                        .setDomain("aiscore.com")
                        .setPath("/")
        ));
    }

    private static void seedCookies(BrowserContext context, String cookieConfig) {
        if (cookieConfig == null || cookieConfig.isBlank()) {
            return;
        }

        var cookies = Arrays.stream(cookieConfig.split(";"))
                .map(String::trim)
                .filter(part -> !part.isBlank())
                .map(part -> {
                    var idx = part.indexOf('=');
                    if (idx <= 0) {
                        return null;
                    }
                    return new Cookie(part.substring(0, idx), part.substring(idx + 1))
                            .setDomain(".aiscore.com")
                            .setPath("/");
                })
                .filter(cookie -> cookie != null && cookie.name != null && !cookie.name.isBlank())
                .toList();

        if (!cookies.isEmpty()) {
            context.addCookies(cookies);
        }
    }
}
