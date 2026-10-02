package com.kira.farm.loyalty.domain;

import com.kira.farm.shared.domain.Money;

import java.util.List;

/**
 * Membership tier from points earned in the calendar year. discountPercent applies to the goods subtotal of every
 * order (Kim cương = Vàng 3% + extra 5%); freeFastDelivery makes the 2-hour method free.
 */
public enum Tier {
    DONG("Đồng", 0, 0, false, List.of("Tích điểm mỗi đơn hàng")),
    BAC("Bạc", 500, 0, false, List.of("Tích điểm mỗi đơn hàng", "Ưu đãi sinh nhật")),
    VANG("Vàng", 1500, 3, false, List.of("Giảm 3% mọi đơn hàng", "Miễn phí vận chuyển từ 200.000₫")),
    KIM_CUONG("Kim cương", 4000, 8, true, List.of("Giảm 8% mọi đơn hàng (3% + thêm 5%)",
        "Miễn phí vận chuyển từ 200.000₫", "Miễn phí giao nhanh 2 giờ"));

    private final String label;
    private final int minPoints;
    private final int discountPercent;
    private final boolean freeFastDelivery;
    private final List<String> perks;

    Tier(String label, int minPoints, int discountPercent, boolean freeFastDelivery, List<String> perks) {
        this.label = label;
        this.minPoints = minPoints;
        this.discountPercent = discountPercent;
        this.freeFastDelivery = freeFastDelivery;
        this.perks = perks;
    }

    public String label() {
        return label;
    }

    public int minPoints() {
        return minPoints;
    }

    public int discountPercent() {
        return discountPercent;
    }

    public boolean freeFastDelivery() {
        return freeFastDelivery;
    }

    public List<String> perks() {
        return perks;
    }

    /** Tier discount on a goods subtotal in VND, rounded half-up. */
    public long discount(long subtotal) {
        if (discountPercent == 0 || subtotal <= 0) return 0L;
        return Money.percentOf(subtotal, discountPercent);
    }

    public static Tier of(long pointsEarnedThisYear) {
        Tier result = DONG;
        for (Tier t : values()) if (pointsEarnedThisYear >= t.minPoints) result = t;
        return result;
    }

    /** The next tier up, or null for the top tier. */
    public Tier next() {
        int i = ordinal() + 1;
        return i < values().length ? values()[i] : null;
    }
}
