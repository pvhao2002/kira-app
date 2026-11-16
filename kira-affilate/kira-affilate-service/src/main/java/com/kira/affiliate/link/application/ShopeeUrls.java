package com.kira.affiliate.link.application;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/** Validation of user-supplied Shopee URLs and Sub IDs. We never fetch these URLs; they are only passed to Shopee. */
public final class ShopeeUrls {
    public static final int MAX_SUB_IDS = 5;
    private static final Pattern SUB_ID = Pattern.compile("[A-Za-z0-9]{1,50}");
    private static final List<String> HOSTS = List.of("shopee.vn", "shope.ee", "vn.shp.ee");

    private ShopeeUrls() {
    }

    /** @return the trimmed URL, or throws IllegalArgumentException with a Vietnamese reason. */
    public static String validate(String raw) {
        String url = raw == null ? "" : raw.trim();
        if (url.isEmpty()) throw new IllegalArgumentException("Liên kết trống");
        if (url.length() > 2048) throw new IllegalArgumentException("Liên kết quá dài");
        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException ex) {
            throw new IllegalArgumentException("Liên kết không hợp lệ");
        }
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getRawUserInfo() != null
            || (uri.getPort() != -1 && uri.getPort() != 443))
            throw new IllegalArgumentException("Chỉ hỗ trợ liên kết https của Shopee");
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if (HOSTS.stream().noneMatch(allowed -> host.equals(allowed) || host.endsWith("." + allowed) && allowed.equals("shopee.vn")))
            throw new IllegalArgumentException("Không phải liên kết Shopee Việt Nam");
        return url;
    }

    /** @return the utm key (sub IDs joined with '-'), "" when there are none. */
    public static String utmKey(List<String> subIds) {
        if (subIds == null || subIds.isEmpty()) return "";
        if (subIds.size() > MAX_SUB_IDS) throw new IllegalArgumentException("Tối đa 5 Sub ID");
        for (String subId : subIds)
            if (subId == null || !SUB_ID.matcher(subId).matches())
                throw new IllegalArgumentException("Sub ID chỉ gồm chữ và số, tối đa 50 ký tự");
        return String.join("-", subIds);
    }

    public static List<String> subIds(String utmKey) {
        return utmKey == null || utmKey.isEmpty() ? List.of() : List.of(utmKey.split("-"));
    }
}
