package com.kira.farm.order.application;

import com.kira.farm.branch.application.BranchAccess;
import com.kira.farm.order.domain.OrderNote;
import com.kira.farm.order.domain.OrderStatus;
import com.kira.farm.order.domain.PaymentMethod;
import com.kira.farm.order.domain.PaymentStatus;
import com.kira.farm.order.domain.ShopOrder;
import com.kira.farm.order.infrastructure.OrderNoteRepository;
import com.kira.farm.order.infrastructure.OrderRepository;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiException;
import com.kira.farm.shared.web.ApiTypes.PageMeta;
import com.kira.farm.shared.web.Paging;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

import static com.kira.farm.order.application.OrderDtos.*;

/** Back-office orders. Staff/manager only see orders of branches granted by BranchAccess; admin sees all. */
@Service
@RequiredArgsConstructor
public class AdminOrderService {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Instant FAR_FUTURE = Instant.parse("2100-01-01T00:00:00Z");

    private final OrderRepository orders;
    private final OrderNoteRepository notes;
    private final BranchAccess access;
    private final OrderWorkflow workflow;
    private final OrderAssembler assembler;

    @Transactional(readOnly = true)
    public AdminOrderList list(OrderStatus status, String q, LocalDate from, LocalDate to, Long branchId, int page,
                               int size) {
        var pageable = Paging.of(page, size);
        Set<Long> scope = access.scope(branchId);
        Map<OrderStatus, Long> counts = new EnumMap<>(OrderStatus.class);
        for (OrderStatus s : OrderStatus.values()) counts.put(s, 0L);
        if (scope.isEmpty()) return new AdminOrderList(List.of(), new PageMeta(page, size, 0, 0), counts);

        Instant fromAt = from == null ? Instant.EPOCH : from.atStartOfDay(VN).toInstant();
        Instant toAt = to == null ? FAR_FUTURE : to.plusDays(1).atStartOfDay(VN).toInstant();
        String like = "%" + (q == null ? "" : q.trim().toLowerCase(Locale.ROOT)) + "%";
        for (Object[] row : orders.countByStatus(scope, fromAt, toAt, like))
            counts.put((OrderStatus) row[0], ((Number) row[1]).longValue());
        Collection<OrderStatus> statuses = status == null ? List.of(OrderStatus.values()) : List.of(status);
        Page<ShopOrder> result = orders.search(scope, statuses, fromAt, toAt, like, pageable);
        return new AdminOrderList(assembler.adminSummaries(result.getContent()),
            new PageMeta(result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()), counts);
    }

    @Transactional(readOnly = true)
    public AdminOrderDetail get(String code) {
        return detail(scoped(orders.findByCode(code)));
    }

    /** Strict state machine; see OrderStatus.canMoveTo. DELIVERED commits stock and awards points. */
    @Transactional
    public AdminOrderDetail changeStatus(String code, StatusRequest r) {
        ShopOrder o = scoped(orders.findForUpdateByCode(code));
        workflow.apply(o, r.status(), r.trackingCode(), r.note());
        return detail(orders.findByCode(code).orElseThrow());
    }

    @Transactional
    public NoteResponse addNote(String code, NoteRequest r) {
        ShopOrder o = scoped(orders.findByCode(code));
        OrderNote n = new OrderNote();
        n.setOrderId(o.getId());
        n.setAuthorUserId(CurrentUser.id());
        n.setBody(r.body().trim());
        return toNote(notes.saveAndFlush(n), assembler.customerNames(List.of(CurrentUser.id())));
    }

    /**
     * Staff confirm (or revert) a manual payment of a non-COD order. Idempotent: repeating the current status
     * changes nothing and writes no note. COD turns PAID by itself on delivery; cancelled orders are frozen.
     */
    @Transactional
    public AdminOrderDetail setPayment(String code, PaymentRequest r) {
        ShopOrder o = scoped(orders.findForUpdateByCode(code));
        if (o.getPaymentMethod() == PaymentMethod.COD)
            throw ApiException.unprocessable("PAYMENT_COD_AUTOMATIC", "Đơn COD được ghi nhận thanh toán khi giao hàng");
        if (o.getStatus() == OrderStatus.CANCELLED)
            throw ApiException.conflict("ORDER_CANCELLED", "Đơn hàng đã hủy, không thể cập nhật thanh toán");
        if (o.getPaymentStatus() != r.status()) {
            o.setPaymentStatus(r.status());
            orders.saveAndFlush(o);
            String extra = r.note() == null || r.note().isBlank() ? "" : " — " + r.note().trim();
            OrderNote n = new OrderNote();
            n.setOrderId(o.getId());
            n.setAuthorUserId(CurrentUser.id());
            n.setBody((r.status() == PaymentStatus.PAID ? "Xác nhận đã nhận tiền" : "Đánh dấu chưa thanh toán") + extra);
            notes.saveAndFlush(n);
        }
        return detail(o);
    }

    private AdminOrderDetail detail(ShopOrder o) {
        List<OrderNote> list = notes.findByOrderIdOrderByIdDesc(o.getId());
        Set<Long> ids = list.stream().map(OrderNote::getAuthorUserId).collect(Collectors.toSet());
        ids.add(o.getUserId());
        Map<Long, String> names = assembler.customerNames(ids);
        return new AdminOrderDetail(assembler.detail(o), o.getUserId(), names.get(o.getUserId()),
            list.stream().map(n -> toNote(n, names)).toList());
    }

    private static NoteResponse toNote(OrderNote n, Map<Long, String> names) {
        return new NoteResponse(n.getId(), n.getAuthorUserId(), names.get(n.getAuthorUserId()), n.getBody(),
            n.getCreatedAt());
    }

    /** Loads the order and enforces branch access; unknown and forbidden both read as 404/403 per BranchAccess. */
    private ShopOrder scoped(Optional<ShopOrder> found) {
        ShopOrder o = found.orElseThrow(() -> ApiException.notFound("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng"));
        access.require(o.getBranchId());
        return o;
    }
}
