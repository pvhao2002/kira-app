package com.kira.farm.loyalty.application;

import com.kira.farm.identity.infrastructure.UserRepository;
import com.kira.farm.loyalty.domain.Tier;
import com.kira.farm.loyalty.domain.Voucher;
import com.kira.farm.loyalty.infrastructure.LoyaltyRepository;
import com.kira.farm.loyalty.infrastructure.VoucherRepository;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.security.Hashing;
import com.kira.farm.shared.web.ApiException;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import com.kira.farm.shared.web.IdempotencyKey;
import com.kira.farm.shared.web.Paging;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import static com.kira.farm.loyalty.application.LoyaltyDtos.*;

/**
 * Points rules. The ledger is append-only; balance = unexpired SUM(delta). Every award/spend is an INSERT IGNORE on
 * UNIQUE(ref_type, ref_id, reason), so retries never double-count. Spending paths lock the user row first so two
 * concurrent requests cannot overdraw the balance.
 */
@Service
@RequiredArgsConstructor
public class LoyaltyService {
    public static final int POINT_VALUE_VND = 100;
    public static final long VND_PER_EARNED_POINT = 10_000L;
    public static final int REVIEW_POINTS_TEXT = 20;
    public static final int REVIEW_POINTS_PHOTO = 50;
    static final int POINT_TTL_DAYS = 365;
    public static final String REASON_CANCEL_REFUND = "ORDER_CANCEL_REFUND";
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private final LoyaltyRepository ledger;
    private final VoucherRepository vouchers;
    private final UserRepository users;
    private final LoyaltyProperties properties;

    // ---- API for order / account ------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public long balance(Long userId) {
        return Math.max(0L, ledger.balance(userId, Instant.now()));
    }

    @Transactional(readOnly = true)
    public long yearPoints(Long userId) {
        return ledger.earnedSince(userId, ZonedDateTime.now(VN).withDayOfYear(1).truncatedTo(ChronoUnit.DAYS).toInstant());
    }

    @Transactional(readOnly = true)
    public Tier tierFor(Long userId) {
        return Tier.of(yearPoints(userId));
    }

    /** Serialises this user's point-spending transactions until commit. */
    @Transactional
    public void lockUser(Long userId) {
        users.findForUpdate(userId).orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "Người dùng không tồn tại"));
    }

    /** Idempotent earn (expires in a year). Returns false when this (refType, refId, reason) was already awarded. */
    @Transactional
    public boolean award(Long userId, int points, String reason, String refType, String refId) {
        if (points <= 0) return false;
        return ledger.insertExpiring(userId, points, reason, refType, refId,
            Instant.now().plus(POINT_TTL_DAYS, ChronoUnit.DAYS)) > 0;
    }

    /** 1 point per 10.000₫ of the order total, awarded when the order is delivered. */
    @Transactional
    public void awardPurchase(Long userId, String orderCode, long orderTotal) {
        award(userId, (int) Math.min(Integer.MAX_VALUE, orderTotal / VND_PER_EARNED_POINT), "PURCHASE", "ORDER",
            orderCode);
    }

    @Transactional
    public void awardReview(Long userId, Long reviewId, boolean withPhoto) {
        award(userId, withPhoto ? REVIEW_POINTS_PHOTO : REVIEW_POINTS_TEXT, "REVIEW", "REVIEW", String.valueOf(reviewId));
    }

    /** Idempotent spend for an order. The caller has locked the user and validated the balance. */
    @Transactional
    public void spendForOrder(Long userId, int points, String orderCode) {
        if (points <= 0) return;
        ledger.insertPermanent(userId, -points, "CHECKOUT", "ORDER", orderCode);
    }

    /**
     * Returns points spent on a cancelled order. Idempotent via UNIQUE(ref_type, ref_id, reason); never expires and
     * is excluded from tier "earned" points (see LoyaltyRepository.earnedSince).
     */
    @Transactional
    public boolean refundForOrder(Long userId, int points, String orderCode) {
        if (points <= 0) return false;
        return ledger.insertPermanent(userId, points, REASON_CANCEL_REFUND, "ORDER", orderCode) > 0;
    }

    // ---- Customer endpoints -------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public SummaryResponse summary() {
        Long userId = CurrentUser.id();
        Instant now = Instant.now();
        long year = yearPoints(userId);
        Tier tier = Tier.of(year);
        Tier next = tier.next();
        Instant until = now.plus(30, ChronoUnit.DAYS);
        return new SummaryResponse(balance(userId), POINT_VALUE_VND, TierInfo.of(tier),
            next == null ? null : TierInfo.of(next), next == null ? 0 : Math.max(0, next.minPoints() - year), year,
            ledger.expiringBetween(userId, now, until), ledger.firstExpiry(userId, now, until));
    }

    @Transactional(readOnly = true)
    public PageResponse<HistoryEntry> history(String type, int page, int size) {
        Long userId = CurrentUser.id();
        var pageable = Paging.of(page, size);
        var result = switch (type == null ? "all" : type.toLowerCase(Locale.ROOT)) {
            case "all" -> ledger.findByUserIdOrderByIdDesc(userId, pageable);
            case "earn" -> ledger.findByUserIdAndDeltaGreaterThanOrderByIdDesc(userId, 0, pageable);
            case "spend" -> ledger.findByUserIdAndDeltaLessThanOrderByIdDesc(userId, 0, pageable);
            default -> throw ApiException.badRequest("INVALID_PARAMETER", "Loại lịch sử không hợp lệ");
        };
        return PageResponse.of(result, HistoryEntry::of);
    }

    @Transactional(readOnly = true)
    public List<RewardResponse> rewards() {
        long balance = balance(CurrentUser.id());
        return properties.rewards().stream().map(r -> new RewardResponse(r.id(), r.name(), r.pointsCost(), r.type(), r.value(),
            r.minOrder(), r.validDays(), balance >= r.pointsCost())).toList();
    }

    /**
     * Buys a voucher with points. The voucher code and ledger ref derive from (user, reward, Idempotency-Key), so a
     * retry with the same key returns the same voucher and spends nothing more.
     */
    @Transactional
    public VoucherResponse redeem(String rewardId, String rawKey) {
        String key = IdempotencyKey.require(rawKey);
        LoyaltyProperties.Reward reward = properties.rewards().stream().filter(r -> r.id().equals(rewardId)).findFirst()
            .orElseThrow(() -> ApiException.notFound("REWARD_NOT_FOUND", "Phần thưởng không tồn tại"));
        Long userId = CurrentUser.id();
        lockUser(userId);
        String refId = Hashing.sha256Hex(userId + ":" + reward.id() + ":" + key);
        String code = "VC" + refId.substring(0, 10).toUpperCase(Locale.ROOT);
        Instant now = Instant.now();
        Optional<Voucher> existing = vouchers.findByCodeAndUserId(code, userId);
        if (existing.isPresent()) return VoucherResponse.of(existing.get(), now);
        if (balance(userId) < reward.pointsCost())
            throw ApiException.unprocessable("INSUFFICIENT_POINTS", "Bạn không đủ điểm để đổi phần thưởng này");
        if (ledger.insertPermanent(userId, -reward.pointsCost(), "REWARD", "VOUCHER", refId) == 0)
            throw ApiException.conflict("REDEEM_CONFLICT", "Yêu cầu đổi thưởng đã được xử lý");
        Voucher v = new Voucher();
        v.setUserId(userId);
        v.setCode(code);
        v.setTitle(reward.name());
        v.setDiscountType(reward.type());
        v.setValue(reward.value());
        v.setMinOrder(reward.minOrder());
        v.setPointsCost(reward.pointsCost());
        v.setExpiresAt(now.plus(reward.validDays(), ChronoUnit.DAYS));
        return VoucherResponse.of(vouchers.saveAndFlush(v), now);
    }

    @Transactional(readOnly = true)
    public List<VoucherResponse> vouchers() {
        Instant now = Instant.now();
        return vouchers.findByUserIdOrderByIdDesc(CurrentUser.id()).stream().map(v -> VoucherResponse.of(v, now)).toList();
    }
}
