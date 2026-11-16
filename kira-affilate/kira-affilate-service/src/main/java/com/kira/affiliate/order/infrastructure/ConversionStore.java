package com.kira.affiliate.order.infrastructure;

import com.kira.affiliate.order.application.ConversionMapper.Conversion;
import com.kira.affiliate.order.application.ConversionMapper.Item;
import com.kira.affiliate.shared.web.DateRange;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/** Idempotent writes of synced Shopee data: the unique keys decide insert vs update, so re-syncing never duplicates. */
@Repository
@RequiredArgsConstructor
public class ConversionStore {
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;

    /** @return number of item rows written (inserted or refreshed). */
    @Transactional
    public int upsert(long userId, List<Conversion> conversions) {
        LocalDateTime now = DateRange.utc(Instant.now());
        List<Object[]> headers = new ArrayList<>();
        List<Object[]> items = new ArrayList<>();
        for (Conversion c : conversions) {
            LocalDateTime purchase = DateRange.utc(c.purchaseTime());
            headers.add(new Object[]{userId, c.conversionId(), purchase, DateRange.utc(c.clickTime()), c.utmContent(),
                c.buyerType(), c.device(), c.referrer(), c.totalCommission(), c.sellerCommission(),
                c.shopeeCommission(), c.netCommission(), now});
            for (Item i : c.items())
                items.add(new Object[]{userId, c.conversionId(), i.orderId(), i.itemId(), i.modelId(), purchase,
                    i.orderStatus(), i.fraudStatus(), i.itemName(), i.shopId(), i.shopName(), i.imageUrl(),
                    i.categoryLv1(), i.qty(), i.itemPrice(), i.actualAmount(), i.refundAmount(),
                    i.itemTotalCommission(), i.itemSellerCommission(), i.itemShopeeCommission(),
                    DateRange.utc(i.completeTime()), i.itemNotes(), now});
        }
        // validation_id / validated_at are owned by the validated-report import and are not touched here.
        jdbc.batchUpdate("""
            INSERT INTO conversions (user_id, conversion_id, purchase_time, click_time, utm_content, buyer_type, device,
              referrer, total_commission, seller_commission, shopee_commission, net_commission, synced_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE purchase_time=VALUES(purchase_time), click_time=VALUES(click_time),
              utm_content=VALUES(utm_content), buyer_type=VALUES(buyer_type), device=VALUES(device),
              referrer=VALUES(referrer), total_commission=VALUES(total_commission),
              seller_commission=VALUES(seller_commission), shopee_commission=VALUES(shopee_commission),
              net_commission=VALUES(net_commission), synced_at=VALUES(synced_at)""", headers);
        jdbc.batchUpdate("""
            INSERT INTO conversion_items (user_id, conversion_id, order_id, item_id, model_id, purchase_time,
              order_status, fraud_status, item_name, shop_id, shop_name, image_url, category_lv1, qty, item_price,
              actual_amount, refund_amount, item_total_commission, item_seller_commission, item_shopee_commission,
              complete_time, item_notes, synced_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE purchase_time=VALUES(purchase_time), order_status=VALUES(order_status),
              fraud_status=VALUES(fraud_status), item_name=VALUES(item_name), shop_id=VALUES(shop_id),
              shop_name=VALUES(shop_name), image_url=VALUES(image_url), category_lv1=VALUES(category_lv1),
              qty=VALUES(qty), item_price=VALUES(item_price), actual_amount=VALUES(actual_amount),
              refund_amount=VALUES(refund_amount), item_total_commission=VALUES(item_total_commission),
              item_seller_commission=VALUES(item_seller_commission),
              item_shopee_commission=VALUES(item_shopee_commission), complete_time=VALUES(complete_time),
              item_notes=VALUES(item_notes), synced_at=VALUES(synced_at)""", items);
        return items.size();
    }

    /** Marks the user's conversions that appear in a Shopee validated report. @return matched conversions. */
    @Transactional
    public int markValidated(long userId, long validationId, Collection<String> conversionIds) {
        LocalDateTime now = DateRange.utc(Instant.now());
        jdbc.update("""
            INSERT INTO validations (user_id, validation_id, imported_at) VALUES (?,?,?)
            ON DUPLICATE KEY UPDATE imported_at=VALUES(imported_at)""", userId, validationId, now);
        if (conversionIds.isEmpty()) return 0;
        return named.update("""
            UPDATE conversions SET validation_id = :validationId, validated_at = :now
            WHERE user_id = :userId AND conversion_id IN (:ids)""", new MapSqlParameterSource()
            .addValue("validationId", validationId).addValue("now", now).addValue("userId", userId)
            .addValue("ids", conversionIds));
    }
}
