package com.app.kira.util;

import com.app.kira.server.ServerInfoService;
import com.app.kira.spring.ApplicationContextProvider;
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.Proxy;
import lombok.experimental.UtilityClass;
import lombok.extern.java.Log;

import java.util.List;
import java.util.Optional;
import java.util.function.BiConsumer;
import java.util.logging.Level;

@Log
@UtilityClass
public class PlaywrightUtil {
    private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
    private static final ServerInfoService SERVER_BEAN = ApplicationContextProvider.getBean(ServerInfoService.class);

    public <P> void withPlaywright(List<P> list, BiConsumer<Page, List<P>> logic) {
        withPlaywright(list, false, false, logic);
    }

    public <P> void withPlaywright(List<P> list, boolean useProxy, BiConsumer<Page, List<P>> logic) {
        withPlaywright(list, useProxy, false, logic);
    }

    public <P> void withPlaywright(List<P> list, String jobName, BiConsumer<Page, List<P>> logic) {
        var useProxy = SERVER_BEAN.useProxy(jobName);
        var runHeadless = SERVER_BEAN.runHeadless(jobName);
        log.log(Level.INFO, "Running Playwright with job: {0}, useProxy: {1}, runHeadless: {2}", new Object[]{jobName, useProxy, runHeadless});
        withPlaywright(list, useProxy, runHeadless, logic);
    }

    public <P> void withPlaywright(List<P> list, boolean useProxy, boolean runHeadless, BiConsumer<Page, List<P>> logic) {
        var proxyDto = SERVER_BEAN.getProxy();
        try (var playwright = Playwright.create()) {
            var contextOption = new Browser.NewContextOptions().setUserAgent(USER_AGENT);
            if (useProxy) {
                Optional.ofNullable(proxyDto).ifPresent(proxy -> contextOption.setProxy(proxyDto.toProxyPlayWright()));
            }
            var browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(runHeadless));
            var context = browser.newContext(contextOption);

            var page = context.newPage();
            logic.accept(page, list);

            page.close();
            context.close();
            browser.close();
        } catch (TimeoutError timeoutError) {
            log.log(Level.WARNING, "Playwright task timed out", timeoutError);
            SERVER_BEAN.inactiveProxy(proxyDto, timeoutError.getMessage());
        } catch (PlaywrightException playwrightException) {
            log.log(Level.SEVERE, "Playwright error occurred", playwrightException);
            SERVER_BEAN.inactiveProxy(proxyDto, playwrightException.getMessage());
        } catch (Exception e) {
            log.log(Level.WARNING, "Error during Playwright task", e);
        }
    }
}
