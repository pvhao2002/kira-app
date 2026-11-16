package com.kira.affiliate.link.application;

import com.kira.affiliate.shared.web.ApiException;
import com.kira.affiliate.shared.web.ApiTypes.PageResponse;
import com.kira.affiliate.shared.web.Csv;
import com.kira.affiliate.shared.web.DateRange;
import com.kira.affiliate.shared.web.Paging;
import com.kira.affiliate.shopee.application.ShopeeCredentialService;
import com.kira.affiliate.shopee.infrastructure.ShopeeAffiliateClient;
import com.kira.affiliate.shopee.infrastructure.ShopeeAffiliateClient.Credentials;
import com.kira.affiliate.shopee.infrastructure.ShopeeApiException;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LinkService {
    public static final int MAX_URLS = 50;
    static final int EXPORT_LIMIT = 50_000;
    private static final DateTimeFormatter VN_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(DateRange.VN);

    private final JdbcClient jdbc;
    private final ShopeeCredentialService credentials;
    private final ShopeeAffiliateClient client;
    private final CampaignService campaigns;

    public record ConvertRequest(@NotEmpty @Size(max = MAX_URLS) List<String> urls, @Size(max = 5) List<String> subIds,
                                 Long campaignId) {
    }

    public record ConvertResult(String originUrl, String status, String shortLink, String error, Long id) {
    }

    public record Link(long id, String originUrl, String shortLink, List<String> subIds, Long campaignId,
                       String campaignName, String status, String error, Instant createdAt) {
    }

    public record Filter(String search, String status, Long campaignId, LocalDate from, LocalDate to) {
    }

    /** Sequential on purpose: Shopee VN has no confirmed batch mutation and the API is rate limited. */
    public List<ConvertResult> convert(Long userId, ConvertRequest request) {
        if (request.campaignId() != null && request.subIds() != null && !request.subIds().isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "CAMPAIGN_OR_SUB_IDS", "Chọn chiến dịch hoặc nhập Sub ID, không dùng cả hai");
        List<String> subIds;
        String utmKey;
        if (request.campaignId() != null) {
            subIds = campaigns.find(userId, request.campaignId()).orElseThrow(CampaignService::notFound).subIds();
            utmKey = String.join("-", subIds);
        } else {
            subIds = request.subIds() == null ? List.of() : request.subIds();
            try {
                utmKey = ShopeeUrls.utmKey(subIds);
            } catch (IllegalArgumentException ex) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SUB_ID", ex.getMessage());
            }
        }
        Credentials resolved = credentials.require(userId);
        List<ConvertResult> results = new ArrayList<>();
        String aborted = null; // set once Shopee rejects the account/credentials or rate limits us
        for (String raw : request.urls()) {
            if (aborted != null) {
                results.add(new ConvertResult(raw, "FAILED", null, aborted, null));
                continue;
            }
            String url;
            try {
                url = ShopeeUrls.validate(raw);
            } catch (IllegalArgumentException ex) {
                results.add(new ConvertResult(raw, "FAILED", null, ex.getMessage(), null));
                continue;
            }
            try {
                String shortLink = client.generateShortLink(resolved, url, subIds);
                results.add(new ConvertResult(url, "OK", shortLink, null,
                    insert(userId, url, shortLink, utmKey, request.campaignId(), "OK", null)));
            } catch (ShopeeApiException ex) {
                String message = ex.userMessage();
                if (ex.getKind() != ShopeeApiException.Kind.ERROR) {
                    credentials.recordResult(userId, ex);
                    aborted = message;
                }
                results.add(new ConvertResult(url, "FAILED", null, message,
                    insert(userId, url, null, utmKey, request.campaignId(), "FAILED", message)));
            }
        }
        return results;
    }

    public PageResponse<Link> list(Long userId, Filter filter, int page, int size, boolean ascending) {
        int p = Paging.page(page), s = Paging.size(size);
        Map<String, Object> params = new HashMap<>();
        String where = where(userId, filter, params);
        long total = jdbc.sql("SELECT COUNT(*) FROM affiliate_links l" + where).params(params).query(Long.class).single();
        params.put("limit", s);
        params.put("offset", (long) p * s);
        String direction = ascending ? "ASC" : "DESC";
        List<Link> data = jdbc.sql(SELECT + where + " ORDER BY l.created_at " + direction + ", l.id " + direction
            + " LIMIT :limit OFFSET :offset").params(params).query(LinkService::map).list();
        return Paging.response(data, p, s, total);
    }

    // shortcut: export is built in memory and capped at 50k rows; stream it if users outgrow the cap.
    public Csv export(Long userId, Filter filter) {
        Map<String, Object> params = new HashMap<>();
        String where = where(userId, filter, params);
        Csv csv = new Csv().row("Thời gian tạo", "Liên kết gốc", "Liên kết affiliate", "Sub ID", "Chiến dịch", "Trạng thái", "Lỗi");
        jdbc.sql(SELECT + where + " ORDER BY l.created_at DESC, l.id DESC LIMIT " + EXPORT_LIMIT).params(params)
            .query(LinkService::map).list().forEach(l -> csv.row(VN_TIME.format(l.createdAt()), l.originUrl(),
                l.shortLink(), String.join("-", l.subIds()), l.campaignName(), l.status(), l.error()));
        return csv;
    }

    public void delete(Long userId, long id) {
        if (jdbc.sql("DELETE FROM affiliate_links WHERE user_id = :userId AND id = :id")
            .param("userId", userId).param("id", id).update() == 0)
            throw new ApiException(HttpStatus.NOT_FOUND, "LINK_NOT_FOUND", "Không tìm thấy liên kết");
    }

    private static final String SELECT = """
        SELECT l.id, l.origin_url, l.short_link, l.utm_key, l.campaign_id, cp.name AS campaign_name, l.status, l.error,
               l.created_at
        FROM affiliate_links l LEFT JOIN campaigns cp ON cp.id = l.campaign_id AND cp.user_id = l.user_id""";

    private static String where(Long userId, Filter f, Map<String, Object> params) {
        StringBuilder where = new StringBuilder(" WHERE l.user_id = :userId");
        params.put("userId", userId);
        if (f.search() != null && !f.search().isBlank()) {
            where.append(" AND (l.origin_url LIKE :search OR l.short_link LIKE :search OR l.utm_key LIKE :search)");
            params.put("search", Paging.contains(f.search()));
        }
        if (f.status() != null && !f.status().isBlank()) {
            where.append(" AND l.status = :status");
            params.put("status", f.status());
        }
        if (f.campaignId() != null) {
            where.append(" AND l.campaign_id = :campaignId");
            params.put("campaignId", f.campaignId());
        }
        if (f.from() != null) {
            where.append(" AND l.created_at >= :from");
            params.put("from", DateRange.utc(DateRange.startOf(f.from())));
        }
        if (f.to() != null) {
            where.append(" AND l.created_at < :to");
            params.put("to", DateRange.utc(DateRange.endExclusive(f.to())));
        }
        return where.toString();
    }

    private Long insert(Long userId, String originUrl, String shortLink, String utmKey, Long campaignId, String status,
                        String error) {
        GeneratedKeyHolder key = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO affiliate_links (user_id, origin_url, short_link, utm_key, campaign_id, status, error, created_at)
                VALUES (:userId, :originUrl, :shortLink, :utmKey, :campaignId, :status, :error, :now)""")
            .param("userId", userId).param("originUrl", originUrl).param("shortLink", shortLink).param("utmKey", utmKey)
            .param("campaignId", campaignId).param("status", status).param("error", error)
            .param("now", DateRange.utc(Instant.now())).update(key);
        return key.getKey().longValue();
    }

    private static Link map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Link(rs.getLong("id"), rs.getString("origin_url"), rs.getString("short_link"),
            ShopeeUrls.subIds(rs.getString("utm_key")), rs.getObject("campaign_id", Long.class),
            rs.getString("campaign_name"), rs.getString("status"), rs.getString("error"),
            DateRange.instant(rs.getObject("created_at", LocalDateTime.class)));
    }
}
