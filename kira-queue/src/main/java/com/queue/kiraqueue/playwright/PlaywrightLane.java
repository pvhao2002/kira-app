package kira.crawl.playwright;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import kira.crawl.browser.AiscorePageFetchClient;
import lombok.Getter;
import lombok.Setter;

import static kira.crawl.util.PlaywrightUtils.*;

@Getter
@Setter
public class PlaywrightLane {
    private Playwright playwright;
    private BrowserContext browserContext;
    private Page page;

    public PlaywrightLane() {
        this.playwright = Playwright.create();
        var b = playwright.chromium().launch(launchOptions(true));
        this.browserContext = b.newContext(contextOptions());
        this.browserContext.addInitScript(INIT_SCRIPT_STEALTH);
        this.page = browserContext.newPage();
        this.page.navigate(AiscorePageFetchClient.ORIGIN);
    }

    public void close() {
        if (page != null) {
            page.close();
        }
        if (browserContext != null) {
            browserContext.close();
        }
        if (playwright != null) {
            playwright.close();
        }
    }
}
