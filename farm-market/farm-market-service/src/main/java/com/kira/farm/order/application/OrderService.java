package com.kira.farm.order.application;

import com.kira.farm.account.domain.Address;
import com.kira.farm.account.infrastructure.AddressRepository;
import com.kira.farm.branch.domain.Branch;
import com.kira.farm.branch.infrastructure.BranchRepository;
import com.kira.farm.catalog.domain.Product;
import com.kira.farm.catalog.domain.ProductStatus;
import com.kira.farm.catalog.infrastructure.ProductRepository;
import com.kira.farm.inventory.application.InventoryService;
import com.kira.farm.loyalty.application.LoyaltyService;
import com.kira.farm.loyalty.domain.Tier;
import com.kira.farm.loyalty.domain.Voucher;
import com.kira.farm.loyalty.infrastructure.VoucherRepository;
import com.kira.farm.order.domain.*;
import com.kira.farm.order.infrastructure.OrderItemRepository;
import com.kira.farm.order.infrastructure.OrderRepository;
import com.kira.farm.promotion.application.PromotionDtos.ValidateResponse;
import com.kira.farm.promotion.application.PromotionService;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiException;
import com.kira.farm.shared.web.ApiTypes.PageResponse;
import com.kira.farm.shared.web.IdempotencyKey;
import com.kira.farm.shared.web.Paging;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.kira.farm.order.application.OrderDtos.*;

/** Customer side of orders: checkout, own list/detail, cancel, reorder. */
@Service
@RequiredArgsConstructor
public class OrderService {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DAY_KEY = DateTimeFormatter.ofPattern("yyMMdd");

    private final OrderRepository orders;
    private final OrderItemRepository items;
    private final ProductRepository products;
    private final BranchRepository branches;
    private final AddressRepository addresses;
    private final VoucherRepository vouchers;
    private final InventoryService inventory;
    private final PromotionService promotions;
    private final LoyaltyService loyalty;
    private final OrderWorkflow workflow;
    private final OrderAssembler assembler;

    /**
     * Idempotent per (user, Idempotency-Key): a retry returns the original order and changes nothing. Everything
     * below runs in one transaction, so any failing line (stock, promo, points...) rolls the whole order back.
     */
    @Transactional
    public OrderResponse checkout(String rawKey, CheckoutRequest r) {
        String key = IdempotencyKey.require(rawKey);
        Long userId = CurrentUser.id();
        loyalty.lockUser(userId); // serialises this customer's checkouts: idempotency replay + points balance
        Optional<ShopOrder> replay = orders.findByUserIdAndIdempotencyKey(userId, key);
        if (replay.isPresent()) return assembler.detail(replay.get());

        // 1. Basket from the database only.
        Map<Long, Integer> qty = new TreeMap<>(); // sorted by product id: stable lock order, no deadlocks
        for (CheckoutLine l : r.items()) qty.merge(l.productId(), l.quantity(), Integer::sum);
        if (qty.values().stream().anyMatch(q -> q > 999))
            throw ApiException.badRequest("INVALID_QUANTITY", "Số lượng mỗi sản phẩm tối đa là 999");
        Map<Long, Product> found = products.findAllById(qty.keySet()).stream()
            .collect(Collectors.toMap(Product::getId, Function.identity()));
        if (found.size() != qty.size())
            throw ApiException.unprocessable("PRODUCT_NOT_FOUND", "Có sản phẩm không còn tồn tại");
        Set<Long> branchIds = found.values().stream().map(Product::getBranchId).collect(Collectors.toSet());
        if (branchIds.size() != 1)
            throw ApiException.unprocessable("MIXED_BRANCH_CART", "Giỏ hàng chỉ được chứa sản phẩm của một chi nhánh");
        Long branchId = branchIds.iterator().next();
        if (r.branchId() != null && !r.branchId().equals(branchId))
            throw ApiException.unprocessable("BRANCH_MISMATCH", "Sản phẩm không thuộc chi nhánh đã chọn");
        Branch branch = branches.findById(branchId)
            .orElseThrow(() -> ApiException.unprocessable("BRANCH_NOT_FOUND", "Chi nhánh không tồn tại"));
        if (!branch.isOpenFlag())
            throw ApiException.unprocessable("BRANCH_CLOSED", "Chi nhánh hiện đang tạm đóng cửa");
        for (Product p : found.values())
            if (p.getStatus() != ProductStatus.ACTIVE)
                throw ApiException.unprocessable("PRODUCT_UNAVAILABLE", "Sản phẩm \"" + p.getName() + "\" hiện không bán");
        Address address = addresses.findByIdAndUserId(r.addressId(), userId)
            .orElseThrow(() -> ApiException.notFound("ADDRESS_NOT_FOUND", "Không tìm thấy địa chỉ giao hàng"));

        // 2. Money (long VND; percentages via BigDecimal inside Tier/PromotionService).
        long subtotal = 0;
        for (var e : qty.entrySet())
            subtotal = Math.addExact(subtotal, Math.multiplyExact(found.get(e.getKey()).getPrice(), (long) e.getValue()));
        Tier tier = loyalty.tierFor(userId);
        long fee = r.shippingMethod().fee(subtotal, tier.freeFastDelivery());
        long tierDiscount = tier.discount(subtotal);

        ValidateResponse promo = r.promoCode() == null || r.promoCode().isBlank() ? null
            : promotions.evaluate(r.promoCode(), userId, branchId, subtotal, fee);
        Voucher voucher = null;
        long voucherGoods = 0;
        long voucherShip = 0;
        if (r.voucherCode() != null && !r.voucherCode().isBlank()) {
            voucher = vouchers.findByCodeAndUserId(r.voucherCode().trim().toUpperCase(Locale.ROOT), userId)
                .orElseThrow(() -> ApiException.notFound("VOUCHER_NOT_FOUND", "Voucher không tồn tại"));
            if (!voucher.usableAt(Instant.now()))
                throw ApiException.unprocessable("VOUCHER_UNAVAILABLE", "Voucher đã được dùng hoặc đã hết hạn");
            if (subtotal < voucher.getMinOrder())
                throw ApiException.unprocessable("VOUCHER_MIN_ORDER", "Đơn hàng chưa đạt giá trị tối thiểu để dùng voucher");
            switch (voucher.getDiscountType()) {
                case PERCENT -> voucherGoods = percent(subtotal, voucher.getValue());
                case FIXED -> voucherGoods = voucher.getValue();
                case FREE_SHIP -> voucherShip = fee;
            }
        }
        long goodsDiscount = Math.min(subtotal - tierDiscount, (promo == null ? 0 : promo.discount()) + voucherGoods);
        long shipDiscount = Math.min(fee, (promo == null ? 0 : promo.shippingDiscount()) + voucherShip);
        long discount = goodsDiscount + shipDiscount;
        long payable = subtotal + fee - tierDiscount - discount;

        int points = r.usePoints() == null ? 0 : r.usePoints();
        long pointsDiscount = Math.multiplyExact((long) points, (long) LoyaltyService.POINT_VALUE_VND);
        if (points > 0) {
            if (points > loyalty.balance(userId))
                throw ApiException.unprocessable("INSUFFICIENT_POINTS", "Bạn không đủ điểm để sử dụng");
            if (pointsDiscount > payable)
                throw ApiException.unprocessable("POINTS_EXCEED_TOTAL", "Số điểm sử dụng vượt quá giá trị đơn hàng");
        }
        long total = payable - pointsDiscount;

        // 3. Reserve stock (each call is an atomic conditional UPDATE; a shortage throws 409 and rolls everything back).
        for (var e : qty.entrySet()) inventory.reserve(branchId, e.getKey(), e.getValue());

        // 4. Persist.
        String dayKey = LocalDate.now(VN).format(DAY_KEY);
        orders.nextSequence(dayKey);
        String code = "DN-" + dayKey + "-" + String.format("%04d", orders.lastInsertId());

        ShopOrder o = new ShopOrder();
        o.setCode(code);
        o.setUserId(userId);
        o.setBranchId(branchId);
        o.setPaymentMethod(r.paymentMethod());
        o.setShippingMethod(r.shippingMethod());
        o.setShippingFee(fee);
        o.setSubtotal(subtotal);
        o.setDiscount(discount);
        o.setTierDiscount(tierDiscount);
        o.setPointsUsed(points);
        o.setPointsDiscount(pointsDiscount);
        o.setTotal(total);
        o.setPromoCode(promo == null ? null : promo.code());
        o.setVoucherCode(voucher == null ? null : voucher.getCode());
        o.setShipRecipient(address.getRecipient());
        o.setShipPhone(address.getPhone());
        o.setShipLine1(address.getLine1());
        o.setShipWard(address.getWard());
        o.setShipDistrict(address.getDistrict());
        o.setShipCity(address.getCity());
        o.setCustomerNote(r.customerNote() == null || r.customerNote().isBlank() ? null : r.customerNote().trim());
        o.setIdempotencyKey(key);
        o = orders.saveAndFlush(o);

        List<OrderItem> lines = new ArrayList<>();
        for (var e : qty.entrySet()) {
            Product p = found.get(e.getKey());
            OrderItem i = new OrderItem();
            i.setOrderId(o.getId());
            i.setProductId(p.getId());
            i.setSku(p.getSku());
            i.setProductName(p.getName());
            i.setUnit(p.getUnit());
            i.setUnitPrice(p.getPrice());
            i.setQuantity(e.getValue());
            i.setLineTotal(p.getPrice() * e.getValue());
            lines.add(i);
        }
        items.saveAll(lines);
        workflow.record(o.getId(), null, OrderStatus.PENDING, "Đặt hàng");

        // 5. Consume promo / voucher / points in the same transaction.
        if (promo != null) promotions.redeem(promo.promotionId(), userId, o.getId(), promo.totalDiscount());
        if (voucher != null && vouchers.markUsed(voucher.getCode(), userId, o.getId()) == 0)
            throw ApiException.unprocessable("VOUCHER_UNAVAILABLE", "Voucher đã được dùng hoặc đã hết hạn");
        loyalty.spendForOrder(userId, points, code);
        return assembler.detail(o);
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderSummary> list(OrderStatus status, int page, int size) {
        Collection<OrderStatus> statuses = status == null ? List.of(OrderStatus.values()) : List.of(status);
        var result = orders.findByUserIdAndStatusInOrderByIdDesc(CurrentUser.id(), statuses, Paging.of(page, size));
        List<OrderSummary> data = assembler.summaries(result.getContent());
        return new PageResponse<>(data, new com.kira.farm.shared.web.ApiTypes.PageMeta(result.getNumber(),
            result.getSize(), result.getTotalElements(), result.getTotalPages()));
    }

    @Transactional(readOnly = true)
    public OrderResponse get(String code) {
        return assembler.detail(own(code));
    }

    /** Customer cancellation: only while PENDING or CONFIRMED. Releases stock and refunds points, voucher and promotion (see OrderWorkflow). */
    @Transactional
    public OrderResponse cancel(String code) {
        Long userId = CurrentUser.id();
        ShopOrder o = orders.findForUpdateByCode(code)
            .filter(x -> x.getUserId().equals(userId)).orElseThrow(OrderService::notFound);
        if (o.getStatus() != OrderStatus.PENDING && o.getStatus() != OrderStatus.CONFIRMED)
            throw ApiException.conflict("ORDER_NOT_CANCELLABLE", "Đơn hàng đã được xử lý nên không thể hủy");
        workflow.apply(o, OrderStatus.CANCELLED, null, "Khách hàng hủy đơn");
        return assembler.detail(orders.findByCode(code).orElseThrow());
    }

    /** Which lines of a past order can be bought again right now (current price, quantity capped at stock). */
    @Transactional(readOnly = true)
    public ReorderResponse reorder(String code) {
        ShopOrder o = own(code);
        List<OrderItem> lines = items.findByOrderIdOrderByIdAsc(o.getId());
        Map<Long, Product> current = products.findAllById(lines.stream().map(OrderItem::getProductId).toList()).stream()
            .collect(Collectors.toMap(Product::getId, Function.identity()));
        List<ReorderLine> ok = new ArrayList<>();
        List<ReorderSkipped> skipped = new ArrayList<>();
        for (OrderItem l : lines) {
            Product p = current.get(l.getProductId());
            if (p == null || p.getStatus() != ProductStatus.ACTIVE) {
                skipped.add(new ReorderSkipped(l.getProductId(), l.getProductName(), "UNAVAILABLE"));
                continue;
            }
            int available = inventory.available(p.getBranchId(), p.getId());
            if (available <= 0) {
                skipped.add(new ReorderSkipped(p.getId(), p.getName(), "OUT_OF_STOCK"));
                continue;
            }
            ok.add(new ReorderLine(p.getId(), p.getSlug(), p.getName(), p.getImageUrl(), p.getUnit(), p.getPrice(),
                Math.min(l.getQuantity(), available), l.getQuantity(), available));
        }
        return new ReorderResponse(o.getBranchId(), ok, skipped);
    }

    private ShopOrder own(String code) {
        return orders.findByCodeAndUserId(code, CurrentUser.id()).orElseThrow(OrderService::notFound);
    }

    private static ApiException notFound() {
        return ApiException.notFound("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng");
    }

    private static long percent(long amount, long percent) {
        return BigDecimal.valueOf(amount).multiply(BigDecimal.valueOf(percent))
            .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP).longValueExact();
    }
}
