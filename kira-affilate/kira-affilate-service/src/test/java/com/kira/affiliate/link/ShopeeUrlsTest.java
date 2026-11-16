package com.kira.affiliate.link;

import com.kira.affiliate.link.application.ShopeeUrls;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ShopeeUrlsTest {
    @ParameterizedTest
    @ValueSource(strings = {
        "https://shopee.vn/Apple-Iphone-11-i.52377417.6309028319",
        "https://shopee.vn/shop/52377417",
        "  https://s.shopee.vn/abc123  ",
        "https://shope.ee/5XyZ7WqR",
        "https://vn.shp.ee/abc"})
    void acceptsShopeeVietnamLinks(String url) {
        assertEquals(url.trim(), ShopeeUrls.validate(url));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "", "not a url", "http://shopee.vn/x", "https://shopee.vn.evil.com/x", "https://evilshopee.vn/x",
        "https://user@shopee.vn/x", "https://shopee.vn:8443/x", "https://shopee.sg/x", "javascript:alert(1)",
        "https://127.0.0.1/x", "ftp://shopee.vn/x", "https://x.shope.ee/a"})
    void rejectsEverythingElse(String url) {
        assertThrows(IllegalArgumentException.class, () -> ShopeeUrls.validate(url));
    }

    @Test
    void subIdsBecomeTheUtmKey() {
        assertEquals("", ShopeeUrls.utmKey(null));
        assertEquals("tiktok-video1", ShopeeUrls.utmKey(List.of("tiktok", "video1")));
        assertEquals(List.of("tiktok", "video1"), ShopeeUrls.subIds("tiktok-video1"));
        assertEquals(List.of(), ShopeeUrls.subIds(""));
        assertThrows(IllegalArgumentException.class, () -> ShopeeUrls.utmKey(List.of("a", "b", "c", "d", "e", "f")));
        assertThrows(IllegalArgumentException.class, () -> ShopeeUrls.utmKey(List.of("a-b")));
        assertThrows(IllegalArgumentException.class, () -> ShopeeUrls.utmKey(List.of("a\"}){x}")));
    }
}
