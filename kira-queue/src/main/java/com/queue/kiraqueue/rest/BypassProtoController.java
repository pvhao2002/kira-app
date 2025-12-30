package com.queue.kiraqueue.rest;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.RequestOptions;
import com.queue.kiraqueue.util.PlaywrightUtil;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class BypassProtoController {

    @PostConstruct
    public void init() {
        try (Playwright playwright = Playwright.create()) {

            var browser = playwright.chromium().launch(
                    new BrowserType.LaunchOptions().setHeadless(false)
            );

            var context = browser.newContext(
                    new Browser.NewContextOptions()
                            .setUserAgent(PlaywrightUtil.USER_AGENT)
            );

            var page = context.newPage();

            // Quan trọng: vào m.aiscore.com trước để có cookie
            page.navigate("https://m.aiscore.com");
            page.waitForLoadState();
            context.cookies().forEach(System.out::println);
            var api = context.request();

            String url =
                    "https://api.aiscore.com/v1/m/api/match/odds/list" +
                            "?match_id=o07dni56044cmkn&code=89&platform=1";

            var list = (java.util.List<Number>) page.evaluate(
                    "async (url) => {" +
                            "  const res = await fetch(url, {" +
                            "    method: 'GET'," +
                            "    headers: {" +
                            "      'Accept': 'application/json, text/plain, */*'" +
                            "    }" +
                            "  });" +
                            "  if (!res.ok) return null;" +
                            "  const buf = await res.arrayBuffer();" +
                            "  return Array.from(new Uint8Array(buf));" +
                            "}",
                    url
            );

            if (list == null) {
                System.out.println("❌ FETCH FAILED");
                return;
            }

            // Convert List<Integer> -> byte[]
            byte[] realBinary = new byte[list.size()];
            for (int i = 0; i < list.size(); i++) {
                realBinary[i] = (byte) (list.get(i).intValue() & 0xFF);
            }

            System.out.println("✅ SUCCESS, binary size = " + realBinary.length);

            // debug
            for (int i = 0; i < 20; i++) {
                System.out.print((realBinary[i] & 0xff) + " ");
            }


            browser.close();
        }
    }
}
