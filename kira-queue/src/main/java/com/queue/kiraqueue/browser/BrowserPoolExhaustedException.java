package kira.crawl.browser;

import lombok.Getter;

@Getter
public class BrowserPoolExhaustedException extends RuntimeException {

    private final BrowserApiType apiType;

    public BrowserPoolExhaustedException(BrowserApiType apiType, long timeoutMs) {
        super("Browser pool exhausted for " + apiType.name() + " after waiting " + timeoutMs + "ms");
        this.apiType = apiType;
    }

}
