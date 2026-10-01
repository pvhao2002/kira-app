package com.kira.farm.promotion.application;

import com.kira.farm.branch.application.BranchAccess;
import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.promotion.domain.Promotion;
import com.kira.farm.promotion.domain.PromotionType;
import com.kira.farm.promotion.infrastructure.PromotionRepository;
import com.kira.farm.shared.security.AuthPrincipal;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiException;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import com.kira.farm.shared.web.Paging;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

import static com.kira.farm.promotion.application.PromotionDtos.*;

@Service
@RequiredArgsConstructor
public class PromotionService {
    private final PromotionRepository promotions;
    private final BranchRepository branches;
    private final BranchAccess access;

    // ---- API for checkout / the order capability -------------------------------------------------------------

    /** Validates a code for a user/branch/basket and computes the discount. Throws ApiException (PROMO_*) if unusable. */
    @Transactional(readOnly = true)
    public ValidateResponse evaluate(String code, Long userId, Long branchId, long subtotal, long shippingFee) {
        Promotion p = promotions.findByCode(code.trim().toUpperCase(Locale.ROOT)).orElseThrow(
            () -> ApiException.notFound("PROMO_NOT_FOUND", "Mã khuyến mãi không tồn tại"));
        Instant now = Instant.now();
        if (!p.isActive()) throw ApiException.unprocessable("PROMO_INACTIVE", "Mã khuyến mãi đang tạm dừng");
        if (now.isBefore(p.getStartsAt()))
            throw ApiException.unprocessable("PROMO_NOT_STARTED", "Mã khuyến mãi chưa đến thời gian áp dụng");
        if (now.isAfter(p.getEndsAt())) throw ApiException.unprocessable("PROMO_EXPIRED", "Mã khuyến mãi đã hết hạn");
        if (!p.isAllBranches() && !p.getBranchIds().contains(branchId))
            throw ApiException.unprocessable("PROMO_BRANCH_NOT_ELIGIBLE", "Mã không áp dụng cho chi nhánh này");
        if (subtotal < p.getMinOrder())
            throw ApiException.unprocessable("PROMO_MIN_ORDER", "Đơn hàng chưa đạt giá trị tối thiểu để dùng mã");
        if (p.getUsageLimit() != null && p.getUsedCount() >= p.getUsageLimit())
            throw ApiException.unprocessable("PROMO_USAGE_LIMIT", "Mã khuyến mãi đã hết lượt sử dụng");
        if (p.getPerUserLimit() != null && promotions.countRedemptions(p.getId(), userId) >= p.getPerUserLimit())
            throw ApiException.unprocessable("PROMO_USER_LIMIT", "Bạn đã dùng hết lượt cho mã này");
        long discount = 0;
        long shippingDiscount = 0;
        switch (p.getType()) {
            case PERCENT -> {
                discount = percentOf(subtotal, p.getValue());
                if (p.getMaxDiscount() != null) discount = Math.min(discount, p.getMaxDiscount());
            }
            case FIXED -> discount = p.getValue();
            case FREE_SHIP -> shippingDiscount = Math.max(0, shippingFee);
        }
        discount = Math.min(discount, Math.max(0, subtotal));
        return new ValidateResponse(p.getId(), p.getCode(), p.getType(), discount, shippingDiscount,
            discount + shippingDiscount);
    }

    /**
     * Records that an order used the promotion. Call inside the order transaction. Idempotent per
     * (promotion, order); atomically enforces the global usage limit and the per-user limit.
     */
    @Transactional
    public void redeem(Long promotionId, Long userId, Long orderId, long totalDiscount) {
        if (promotions.insertRedemption(promotionId, userId, orderId, totalDiscount) == 0) return;
        if (promotions.incrementUsage(promotionId) == 0)
            throw ApiException.unprocessable("PROMO_USAGE_LIMIT", "Mã khuyến mãi đã hết lượt sử dụng");
        Promotion p = promotions.findById(promotionId).orElseThrow();
        if (p.getPerUserLimit() != null && promotions.countRedemptions(promotionId, userId) > p.getPerUserLimit())
            throw ApiException.unprocessable("PROMO_USER_LIMIT", "Bạn đã dùng hết lượt cho mã này");
    }

    /** Releases every promotion redeemed by a cancelled order. Idempotent: the counter drops only if a row was deleted. */
    @Transactional
    public void release(Long orderId) {
        for (Long promotionId : promotions.redeemedPromotionIds(orderId))
            if (promotions.deleteRedemption(promotionId, orderId) > 0) promotions.decrementUsage(promotionId);
    }

    /** Integer VND percentage, rounded half-up. */
    static long percentOf(long amount, long percent) {
        return BigDecimal.valueOf(amount).multiply(BigDecimal.valueOf(percent))
            .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP).longValueExact();
    }

    // ---- Admin CRUD ----------------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<PromotionResponse> list(String q, int page, int size) {
        AuthPrincipal me = CurrentUser.require();
        String like = "%" + (q == null ? "" : q.trim().toUpperCase(Locale.ROOT)) + "%";
        var pageable = Paging.of(page, size, Sort.by(Sort.Direction.DESC, "id"));
        var result = me.isAdmin() ? promotions.searchAll(like, pageable)
            : promotions.searchVisible(access.accessibleBranchIds(), like, pageable);
        Instant now = Instant.now();
        return PageResponse.of(result, p -> PromotionResponse.of(p, now));
    }

    @Transactional(readOnly = true)
    public PromotionResponse get(Long id) {
        Promotion p = require(id);
        if (!CurrentUser.require().isAdmin() && !p.isAllBranches()
            && p.getBranchIds().stream().noneMatch(access::canAccess))
            throw ApiException.forbidden("BRANCH_FORBIDDEN", "Bạn không có quyền với chi nhánh này");
        return PromotionResponse.of(p, Instant.now());
    }

    @Transactional
    public PromotionResponse create(PromotionRequest r) {
        String code = r.code().trim().toUpperCase(Locale.ROOT);
        if (promotions.existsByCode(code)) throw ApiException.conflict("PROMO_CODE_EXISTS", "Mã khuyến mãi đã tồn tại");
        Promotion p = new Promotion();
        p.setCode(code);
        apply(p, r);
        return PromotionResponse.of(promotions.saveAndFlush(p), Instant.now());
    }

    @Transactional
    public PromotionResponse update(Long id, PromotionRequest r) {
        Promotion p = require(id);
        requireManageable(p);
        if (!p.getCode().equals(r.code().trim().toUpperCase(Locale.ROOT)))
            throw ApiException.badRequest("PROMO_CODE_IMMUTABLE", "Không thể đổi mã khuyến mãi");
        apply(p, r);
        return PromotionResponse.of(promotions.saveAndFlush(p), Instant.now());
    }

    @Transactional
    public void delete(Long id) {
        Promotion p = require(id);
        requireManageable(p);
        if (promotions.countAllRedemptions(id) > 0)
            throw ApiException.conflict("PROMO_IN_USE", "Mã đã được sử dụng, hãy tạm dừng thay vì xóa");
        promotions.delete(p);
    }

    private void apply(Promotion p, PromotionRequest r) {
        if (!r.endsAt().isAfter(r.startsAt()))
            throw ApiException.badRequest("INVALID_DATE_RANGE", "Ngày kết thúc phải sau ngày bắt đầu");
        if (r.type() == PromotionType.PERCENT && r.value() > 100)
            throw ApiException.badRequest("INVALID_PERCENT", "Phần trăm giảm tối đa là 100");
        if (r.type() != PromotionType.FREE_SHIP && r.value() <= 0)
            throw ApiException.badRequest("INVALID_VALUE", "Giá trị ưu đãi phải lớn hơn 0");
        p.setBranchIds(resolveBranches(r));
        p.setAllBranches(r.allBranches());
        p.setType(r.type());
        p.setValue(r.type() == PromotionType.FREE_SHIP ? 0 : r.value());
        p.setMinOrder(r.minOrder());
        p.setMaxDiscount(r.type() == PromotionType.PERCENT ? r.maxDiscount() : null);
        p.setStartsAt(r.startsAt());
        p.setEndsAt(r.endsAt());
        p.setUsageLimit(r.usageLimit());
        p.setPerUserLimit(r.perUserLimit());
        if (r.active() != null) p.setActive(r.active());
    }

    /** Admin may target every branch; managers/staff only a non-empty subset of their own branches. */
    private Set<Long> resolveBranches(PromotionRequest r) {
        boolean admin = CurrentUser.require().isAdmin();
        Set<Long> ids = r.branchIds() == null ? Set.of() : new HashSet<>(r.branchIds());
        if (r.allBranches()) {
            if (!admin) throw ApiException.forbidden("PROMO_SCOPE_FORBIDDEN", "Chỉ quản trị viên được áp dụng cho mọi chi nhánh");
            return new HashSet<>();
        }
        if (ids.isEmpty()) throw ApiException.badRequest("PROMO_BRANCHES_REQUIRED", "Vui lòng chọn chi nhánh áp dụng");
        if (admin) {
            if (branches.findAllById(ids).size() != ids.size())
                throw ApiException.badRequest("BRANCH_NOT_FOUND", "Chi nhánh không tồn tại");
        } else {
            ids.forEach(access::require);
        }
        return ids;
    }

    private void requireManageable(Promotion p) {
        if (CurrentUser.require().isAdmin()) return;
        if (p.isAllBranches() || p.getBranchIds().isEmpty()) throw ApiException.forbidden("FORBIDDEN",
            "Bạn không có quyền thực hiện thao tác này");
        p.getBranchIds().forEach(access::require);
    }

    private Promotion require(Long id) {
        return promotions.findById(id).orElseThrow(
            () -> ApiException.notFound("PROMO_NOT_FOUND", "Mã khuyến mãi không tồn tại"));
    }
}
