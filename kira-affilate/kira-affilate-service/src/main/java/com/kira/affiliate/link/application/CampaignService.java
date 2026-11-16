package com.kira.affiliate.link.application;

import com.kira.affiliate.shared.web.ApiException;
import com.kira.affiliate.shared.web.DateRange;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CampaignService {
    private final JdbcClient jdbc;

    public record CampaignRequest(@NotBlank @Size(max = 120) String name, @NotEmpty @Size(max = 5) List<String> subIds) {
    }

    public record Campaign(long id, String name, List<String> subIds, Instant createdAt) {
    }

    public List<Campaign> list(Long userId) {
        return jdbc.sql("SELECT id, name, utm_key, created_at FROM campaigns WHERE user_id = :userId ORDER BY name")
            .param("userId", userId).query(CampaignService::map).list();
    }

    public Optional<Campaign> find(Long userId, long id) {
        return jdbc.sql("SELECT id, name, utm_key, created_at FROM campaigns WHERE user_id = :userId AND id = :id")
            .param("userId", userId).param("id", id).query(CampaignService::map).optional();
    }

    public Campaign create(Long userId, CampaignRequest request) {
        String utmKey = utmKey(request);
        GeneratedKeyHolder key = new GeneratedKeyHolder();
        try {
            jdbc.sql("INSERT INTO campaigns (user_id, name, utm_key, created_at) VALUES (:userId, :name, :utmKey, :now)")
                .param("userId", userId).param("name", request.name().trim()).param("utmKey", utmKey)
                .param("now", DateRange.utc(Instant.now())).update(key);
        } catch (DuplicateKeyException ex) {
            throw duplicate();
        }
        return find(userId, key.getKey().longValue()).orElseThrow();
    }

    public Campaign update(Long userId, long id, CampaignRequest request) {
        String utmKey = utmKey(request);
        int updated;
        try {
            updated = jdbc.sql("UPDATE campaigns SET name = :name, utm_key = :utmKey WHERE user_id = :userId AND id = :id")
                .param("name", request.name().trim()).param("utmKey", utmKey).param("userId", userId).param("id", id).update();
        } catch (DuplicateKeyException ex) {
            throw duplicate();
        }
        if (updated == 0) throw notFound();
        return find(userId, id).orElseThrow(CampaignService::notFound);
    }

    public void delete(Long userId, long id) {
        if (jdbc.sql("DELETE FROM campaigns WHERE user_id = :userId AND id = :id")
            .param("userId", userId).param("id", id).update() == 0) throw notFound();
    }

    private static String utmKey(CampaignRequest request) {
        try {
            return ShopeeUrls.utmKey(request.subIds());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SUB_ID", ex.getMessage());
        }
    }

    static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "CAMPAIGN_NOT_FOUND", "Không tìm thấy chiến dịch");
    }

    private static ApiException duplicate() {
        return new ApiException(HttpStatus.CONFLICT, "CAMPAIGN_EXISTS", "Tên chiến dịch hoặc bộ Sub ID đã tồn tại");
    }

    private static Campaign map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Campaign(rs.getLong("id"), rs.getString("name"), ShopeeUrls.subIds(rs.getString("utm_key")),
            DateRange.instant(rs.getObject("created_at", LocalDateTime.class)));
    }
}
