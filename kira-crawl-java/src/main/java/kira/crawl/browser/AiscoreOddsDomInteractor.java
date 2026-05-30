package kira.crawl.browser;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.TimeoutError;
import com.microsoft.playwright.options.WaitForSelectorState;
import kira.crawl.browser.CdpNetworkCapture.ApiUrlMatcher;
import kira.crawl.service.AiscoreBadGatewayException;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class AiscoreOddsDomInteractor {

    static final String BET365_LOOK_BOX_SELECTOR = ".flex.w100.borderBottom .lookBox.brb";
    static final String ODDS_MODAL_SELECTOR = ".el-dialog__wrapper.oddsDialogBox";
    static final String MODAL_TAB_SELECTOR = ".oddsDialogBox .changTabBox .changeItem";

    public static final List<DetailTab> DETAIL_TABS = List.of(
            new DetailTab("Asian Handicap", "asia"),
            new DetailTab("Total Goals", "bs"),
            new DetailTab("Total Corners", "corner")
    );

    public void openBet365OddsModal(Page page, long timeout) {
        page.setDefaultTimeout(timeout);
        Locator lookBox;
        try {
            lookBox = page.locator(BET365_LOOK_BOX_SELECTOR).first();
            lookBox.waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE).setTimeout(timeout));
        } catch (TimeoutError ex) {
            throw new AiscoreBadGatewayException(
                    "AiScore odds provider look control was not found on page",
                    Map.of("step", "openOddsModal")
            );
        }
        lookBox.scrollIntoViewIfNeeded();
        lookBox.click();

        page.locator(ODDS_MODAL_SELECTOR).waitFor(
                new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE).setTimeout(timeout)
        );
        if (page.locator(MODAL_TAB_SELECTOR).count() < 2) {
            throw new AiscoreBadGatewayException(
                    "AiScore odds detail modal tabs were not found",
                    Map.of("step", "openOddsModal")
            );
        }
    }

    /**
     * Triggers odds detail via in-page Vue method (faster than sequential DOM tab clicks).
     */
    public byte[] captureOddsDetailViaEvaluate(
            Page page,
            String matchId,
            String oddsType,
            String apiUrl,
            long timeout
    ) {
        page.setDefaultTimeout(timeout);
        try {
            Response response = page.waitForResponse(
                    candidate -> ApiUrlMatcher.isSameApiRequest(candidate.url(), apiUrl),
                    () -> triggerOddsDetailEvaluate(page, matchId, oddsType, timeout)
            );
            return requireOkBody(response, apiUrl);
        } catch (TimeoutError ex) {
            throw new AiscoreBadGatewayException(
                    "AiScore API response was not found in page network traffic url (%s) of matchId %s and oddsType %s".formatted(apiUrl, matchId, oddsType),
                    Map.of("apiUrl", apiUrl, "oddsType", oddsType)
            );
        }
    }

    private void triggerOddsDetailEvaluate(Page page, String matchId, String oddsType, long timeout) {
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
                          const tabs = ['asia', 'bs', 'corner'];
                          if (target.activeTab === type) {
                            const alternate = tabs.find((tab) => tab !== type);
                            if (alternate) {
                              target.activeTab = alternate;
                            }
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

    private static byte[] requireOkBody(Response response, String apiUrl) {
        if (!response.ok()) {
            throw new AiscoreBadGatewayException(
                    "AiScore upstream request failed",
                    Map.of("url", apiUrl, "status", response.status(), "statusText", response.statusText())
            );
        }
        return response.body();
    }

    public record DetailTab(String tabLabel, String oddsType) {
    }
}
