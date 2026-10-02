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
import com.kira.farm.order.application.CheckoutPricing.VoucherTerms;
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

        Basket basket = loadBasket(r);
        Address address = addresses.findByIdAndUserId(r.addressId(), userId)
            .orElseThrow(() -> ApiException.notFound("ADDRESS_NOT_FOUND", "Không tìm thấy địa chỉ giao hàng"));
        Applied applied = applyDiscounts(userId, r, basket);
        CheckoutPricing pricing = applied.pricing();

        // Reserve stock: each call is an atomic conditional UPDATE; a shortage throws 409 and rolls everything back.
        for (var e : basket.qty().entrySet()) inventory.reserve(basket.branchId(), e.getKey(), e.getValue());

        String dayKey = LocalDate.now(VN).format(DAY_KEY);
        orders.nextSequence(dayKey);
        String code = "KF-" + dayKey + "-" + String.format("%04d", orders.lastInsertId());
        ShopOrder o = orders.saveAndFlush(newOrder(code, key, userId, r, basket, address, applied));

        List<OrderItem> lines = items.saveAll(orderLines(o.getId(), basket));
        OrderStatusHistory first = workflow.record(o.getId(), null, OrderStatus.PENDING, "Đặt hàng");

        // Consume promo / voucher / points in the same transaction.
        if (applied.promo() != null)
            promotions.redeem(applied.promo().promotionId(), userId, o.getId(), applied.promo().totalDiscount());
        if (applied.voucher() != null && vouchers.markUsed(applied.voucher().getCode(), userId, o.getId()) == 0)
            throw ApiException.unprocessable("VOUCHER_UNAVAILABLE", "Voucher đã được dùng hoặc đã hết hạn");
        loyalty.spendForOrder(userId, pricing.pointsUsed(), code);
        return assembler.detail(o, lines, List.of(first), basket.branch().getName());
    }

    /** The basket as the database sees it: one open branch, ACTIVE products only, subtotal from current prices. */
    private Basket loadBasket(CheckoutRequest r) {
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
        long subtotal = 0;
        for (var e : qty.entrySet())
            subtotal = Math.addExact(subtotal, Math.multiplyExact(found.get(e.getKey()).getPrice(), (long) e.getValue()));
        return new Basket(qty, found, branch, subtotal);
    }

    /** Validates promo code, voucher and points against the basket and prices the order (see CheckoutPricing). */
    private Applied applyDiscounts(Long userId, CheckoutRequest r, Basket basket) {
        Tier tier = loyalty.tierFor(userId);
        long subtotal = basket.subtotal();
        long fee = CheckoutPricing.shippingFee(subtotal, r.shippingMethod(), tier);
        ValidateResponse promo = isBlank(r.promoCode()) ? null
            : promotions.evaluate(r.promoCode(), userId, basket.branchId(), subtotal, fee);
        Voucher voucher = isBlank(r.voucherCode()) ? null : usableVoucher(r.voucherCode(), userId, subtotal);
        CheckoutPricing pricing = CheckoutPricing.price(subtotal, r.shippingMethod(), tier,
            promo == null ? 0 : promo.discount(), promo == null ? 0 : promo.shippingDiscount(),
            voucher == null ? null : new VoucherTerms(voucher.getDiscountType(), voucher.getValue()));
        int points = r.usePoints() == null ? 0 : r.usePoints();
        if (points > 0 && points > loyalty.balance(userId))
            throw ApiException.unprocessable("INSUFFICIENT_POINTS", "Bạn không đủ điểm để sử dụng");
        return new Applied(promo, voucher, pricing.withPoints(points));
    }

    private Voucher usableVoucher(String rawCode, Long userId, long subtotal) {
        Voucher voucher = vouchers.findByCodeAndUserId(rawCode.trim().toUpperCase(Locale.ROOT), userId)
            .orElseThrow(() -> ApiException.notFound("VOUCHER_NOT_FOUND", "Voucher không tồn tại"));
        if (!voucher.usableAt(Instant.now()))
            throw ApiException.unprocessable("VOUCHER_UNAVAILABLE", "Voucher đã được dùng hoặc đã hết hạn");
        if (subtotal < voucher.getMinOrder())
            throw ApiException.unprocessable("VOUCHER_MIN_ORDER", "Đơn hàng chưa đạt giá trị tối thiểu để dùng voucher");
        return voucher;
    }

    private static ShopOrder newOrder(String code, String idempotencyKey, Long userId, CheckoutRequest r, Basket basket,
                                      Address address, Applied applied) {
        CheckoutPricing p = applied.pricing();
        ShopOrder o = new ShopOrder();
        o.setCode(code);
        o.setUserId(userId);
        o.setBranchId(basket.branchId());
        o.setPaymentMethod(r.paymentMethod());
        o.setShippingMethod(r.shippingMethod());
        o.setShippingFee(p.shippingFee());
        o.setSubtotal(p.subtotal());
        o.setDiscount(p.discount());
        o.setTierDiscount(p.tierDiscount());
        o.setPointsUsed(p.pointsUsed());
        o.setPointsDiscount(p.pointsDiscount());
        o.setTotal(p.total());
        o.setPromoCode(applied.promo() == null ? null : applied.promo().code());
        o.setVoucherCode(applied.voucher() == null ? null : applied.voucher().getCode());
        o.setShipRecipient(address.getRecipient());
        o.setShipPhone(address.getPhone());
        o.setShipLine1(address.getLine1());
        o.setShipWard(address.getWard());
        o.setShipDistrict(address.getDistrict());
        o.setShipCity(address.getCity());
        o.setCustomerNote(isBlank(r.customerNote()) ? null : r.customerNote().trim());
        o.setIdempotencyKey(idempotencyKey);
        return o;
    }

    private static List<OrderItem> orderLines(Long orderId, Basket basket) {
        List<OrderItem> lines = new ArrayList<>();
        for (var e : basket.qty().entrySet()) {
            Product p = basket.products().get(e.getKey());
            OrderItem i = new OrderItem();
            i.setOrderId(orderId);
            i.setProductId(p.getId());
            i.setSku(p.getSku());
            i.setProductName(p.getName());
            i.setUnit(p.getUnit());
            i.setUnitPrice(p.getPrice());
            i.setQuantity(e.getValue());
            i.setLineTotal(p.getPrice() * e.getValue());
            lines.add(i);
        }
        return lines;
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderSummary> list(OrderStatus status, int page, int size) {
        Collection<OrderStatus> statuses = status == null ? List.of(OrderStatus.values()) : List.of(status);
        var result = orders.findByUserIdAndStatusInOrderByIdDesc(CurrentUser.id(), statuses, Paging.of(page, size));
        return PageResponse.of(result, assembler.summaries(result.getContent()));
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
        Map<Long, Integer> stock = inventory.availableByProduct(current.keySet());
        List<ReorderLine> ok = new ArrayList<>();
        List<ReorderSkipped> skipped = new ArrayList<>();
        for (OrderItem l : lines) {
            Product p = current.get(l.getProductId());
            if (p == null || p.getStatus() != ProductStatus.ACTIVE) {
                skipped.add(new ReorderSkipped(l.getProductId(), l.getProductName(), "UNAVAILABLE"));
                continue;
            }
            int available = stock.getOrDefault(p.getId(), 0);
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

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private record Basket(Map<Long, Integer> qty, Map<Long, Product> products, Branch branch, long subtotal) {
        Long branchId() {
            return branch.getId();
        }
    }

    /** Validated promotion/voucher (either may be null) and the resulting price. */
    private record Applied(ValidateResponse promo, Voucher voucher, CheckoutPricing pricing) {
    }
}
