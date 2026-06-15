package com.db.kiragateway.dashboard;

import com.db.kiragateway.credit.CreditCardRepository;
import com.db.kiragateway.credit.CreditCardRow;
import com.db.kiragateway.credit.CreditCardScheduleUtil;
import com.db.kiragateway.dashboard.dto.DashboardActivityItemDto;
import com.db.kiragateway.dashboard.dto.DashboardCardHighlightDto;
import com.db.kiragateway.dashboard.dto.DashboardFinanceDto;
import com.db.kiragateway.dashboard.dto.DashboardProfitPointDto;
import com.db.kiragateway.dashboard.dto.DashboardResponse;
import com.db.kiragateway.dashboard.dto.DashboardSoccerDto;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class DashboardService {

    private static final int ACTIVITY_LIMIT = 8;
    private static final int CHART_DAYS = 7;

    private final DashboardRepository dashboardRepository;
    private final CreditCardRepository creditCardRepository;

    public DashboardService(DashboardRepository dashboardRepository, CreditCardRepository creditCardRepository) {
        this.dashboardRepository = dashboardRepository;
        this.creditCardRepository = creditCardRepository;
    }

    public DashboardResponse build(int userId, String username, String role) {
        boolean isAdmin = "admin".equalsIgnoreCase(role != null ? role.trim() : "");
        var finance = buildFinance(userId);
        DashboardSoccerDto soccer = null;
        List<DashboardProfitPointDto> profitChart = null;

        if (isAdmin) {
            soccer = buildSoccer(userId);
            profitChart = buildProfitChart(userId);
        }

        var recentActivity = buildRecentActivity(userId, isAdmin);

        return new DashboardResponse(
                username != null ? username : "",
                role != null ? role : "user",
                finance,
                soccer,
                profitChart,
                recentActivity
        );
    }

    private DashboardFinanceDto buildFinance(int userId) {
        List<CreditCardRow> cards = creditCardRepository.findAllByUserId(userId);
        BigDecimal totalOutstanding = BigDecimal.ZERO;
        BigDecimal totalLimit = BigDecimal.ZERO;
        LocalDate today = LocalDate.now();

        long minDaysUntilDue = Long.MAX_VALUE;
        String nextDueLabel = "";
        String nextStatementLabel = "";

        for (CreditCardRow card : cards) {
            if (card.outstandingBalance() != null) {
                totalOutstanding = totalOutstanding.add(card.outstandingBalance());
            }
            if (card.creditLimit() != null) {
                totalLimit = totalLimit.add(card.creditLimit());
            }
            LocalDate nextDue = CreditCardScheduleUtil.nextOccurrenceOfDay(today, card.paymentDueDay());
            long days = CreditCardScheduleUtil.daysUntil(today, nextDue);
            if (days < minDaysUntilDue) {
                minDaysUntilDue = days;
                nextDueLabel = CreditCardScheduleUtil.formatDdMm(nextDue);
                LocalDate nextStmt = CreditCardScheduleUtil.nextOccurrenceOfDay(today, card.statementDay());
                nextStatementLabel = CreditCardScheduleUtil.formatDdMm(nextStmt);
            }
        }

        int utilization = 0;
        if (totalLimit.compareTo(BigDecimal.ZERO) > 0) {
            utilization = totalOutstanding
                    .multiply(BigDecimal.valueOf(100))
                    .divide(totalLimit, 0, RoundingMode.HALF_UP)
                    .intValue();
        }

        if (cards.isEmpty()) {
            minDaysUntilDue = 0;
        }

        var highlights = cards.stream()
                .limit(2)
                .map(c -> new DashboardCardHighlightDto(
                        c.cardLabel(),
                        c.lastFour() != null ? c.lastFour() : ""
                ))
                .toList();

        return new DashboardFinanceDto(
                totalOutstanding,
                cards.size(),
                totalLimit,
                utilization,
                nextStatementLabel.isBlank() ? nextDueLabel : nextStatementLabel,
                minDaysUntilDue == Long.MAX_VALUE ? 0 : minDaysUntilDue,
                highlights
        );
    }

    private DashboardSoccerDto buildSoccer(int userId) {
        Optional<Long> versionId = dashboardRepository.findActivePredictionVersionId();
        if (versionId.isEmpty()) {
            return new DashboardSoccerDto(0, 0, 0, dashboardRepository.netProfit(userId), 0, 0);
        }

        long version = versionId.get();
        LocalDateTime weekStart = DashboardRepository.startOfWeek(LocalDate.now());
        var stats = dashboardRepository.findSoccerStats(version, weekStart);
        long trackedTotal = dashboardRepository.countSettledPredictions(version);

        int winRate = 0;
        long decided = stats.wins() + stats.losses();
        if (decided > 0) {
            winRate = (int) Math.round((double) stats.wins() * 100.0 / decided);
        }

        return new DashboardSoccerDto(
                trackedTotal,
                stats.trackedThisWeek(),
                winRate,
                dashboardRepository.netProfit(userId),
                stats.wins(),
                stats.losses()
        );
    }

    private List<DashboardProfitPointDto> buildProfitChart(int userId) {
        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(CHART_DAYS - 1L);
        var rows = dashboardRepository.profitByDay(userId, start.atStartOfDay());

        var amountByDay = new java.util.HashMap<LocalDate, BigDecimal>();
        for (var row : rows) {
            if (row.day() != null) {
                amountByDay.put(row.day(), row.netAmount() != null ? row.netAmount() : BigDecimal.ZERO);
            }
        }

        var points = new ArrayList<DashboardProfitPointDto>();
        for (int i = 0; i < CHART_DAYS; i++) {
            LocalDate day = start.plusDays(i);
            BigDecimal amount = amountByDay.getOrDefault(day, BigDecimal.ZERO);
            points.add(new DashboardProfitPointDto(
                    DashboardRepository.dayLabel(day),
                    day.toString(),
                    amount
            ));
        }
        return points;
    }

    private List<DashboardActivityItemDto> buildRecentActivity(int userId, boolean includePredictions) {
        var items = new ArrayList<ActivitySortable>();

        for (var tx : dashboardRepository.recentTransactions(userId, 5)) {
            items.add(new ActivitySortable(
                    tx.transactionAt(),
                    toTransactionActivity(tx)
            ));
        }

        for (var pay : dashboardRepository.recentCardPayments(userId, 5)) {
            items.add(new ActivitySortable(
                    pay.paidAt() != null ? pay.paidAt() : pay.createdAt(),
                    toCardPaymentActivity(pay)
            ));
        }

        if (includePredictions) {
            dashboardRepository.findActivePredictionVersionId().ifPresent(versionId -> {
                for (var pred : dashboardRepository.recentPredictions(versionId, 5)) {
                    items.add(new ActivitySortable(pred.settledAt(), toPredictionActivity(pred)));
                }
            });
        }

        return items.stream()
                .filter(i -> i.occurredAt() != null)
                .sorted(Comparator.comparing(ActivitySortable::occurredAt).reversed())
                .limit(ACTIVITY_LIMIT)
                .map(ActivitySortable::item)
                .toList();
    }

    private DashboardActivityItemDto toTransactionActivity(DashboardRepository.TransactionActivityRow tx) {
        String type = tx.type() != null ? tx.type().toLowerCase(Locale.ROOT) : "";
        boolean positive = "deposit".equals(type) || "bonus".equals(type);
        String title = switch (type) {
            case "deposit" -> "Nạp tiền";
            case "withdraw" -> "Rút tiền";
            case "bonus" -> "Thưởng";
            default -> "Giao dịch";
        };
        String subtitle = tx.description() != null && !tx.description().isBlank()
                ? tx.description().trim()
                : title;
        BigDecimal amount = tx.amount() != null ? tx.amount() : BigDecimal.ZERO;
        return new DashboardActivityItemDto(
                "transaction",
                title,
                subtitle,
                amount,
                tx.transactionAt() != null ? tx.transactionAt().toString() : null,
                positive
        );
    }

    private DashboardActivityItemDto toCardPaymentActivity(DashboardRepository.CardPaymentActivityRow pay) {
        String cardRef = pay.cardLabel() != null ? pay.cardLabel() : "Thẻ";
        if (pay.lastFour() != null && !pay.lastFour().isBlank()) {
            cardRef += " ****" + pay.lastFour();
        }
        String subtitle = pay.note() != null && !pay.note().isBlank()
                ? pay.note().trim()
                : "Thanh toán " + cardRef;
        LocalDateTime at = pay.paidAt() != null ? pay.paidAt() : pay.createdAt();
        BigDecimal amount = pay.amount() != null ? pay.amount() : BigDecimal.ZERO;
        return new DashboardActivityItemDto(
                "card_payment",
                "Thanh toán thẻ",
                subtitle,
                amount,
                at != null ? at.toString() : null,
                false
        );
    }

    private DashboardActivityItemDto toPredictionActivity(DashboardRepository.PredictionActivityRow pred) {
        String matchTitle = buildMatchTitle(pred);
        String pickLine = buildPickLine(pred);
        String primaryResult = resolvePrimaryResult(pred);
        boolean positive = "WIN".equalsIgnoreCase(primaryResult);
        return new DashboardActivityItemDto(
                "prediction",
                matchTitle,
                pickLine,
                BigDecimal.ZERO,
                pred.settledAt() != null ? pred.settledAt().toString() : null,
                positive
        );
    }

    private static String buildMatchTitle(DashboardRepository.PredictionActivityRow pred) {
        if (pred.eventName() != null && !pred.eventName().isBlank()) {
            return pred.eventName().trim();
        }
        String home = pred.homeTeam() != null ? pred.homeTeam() : "?";
        String away = pred.awayTeam() != null ? pred.awayTeam() : "?";
        return home + " vs " + away;
    }

    private static String buildPickLine(DashboardRepository.PredictionActivityRow pred) {
        boolean useHdc = pred.hdcPick() != null && !"NONE".equalsIgnoreCase(pred.hdcPick());
        if (useHdc) {
            String price = pred.prematchHdcPriceA() != null ? pred.prematchHdcPriceA().toPlainString() : "";
            return "Dự đoán: " + formatPick(pred.hdcPick()) + (price.isBlank() ? "" : " (" + price + ")");
        }
        String price = pred.prematchOuPriceA() != null ? pred.prematchOuPriceA().toPlainString() : "";
        return "Dự đoán: " + formatPick(pred.ouPick()) + (price.isBlank() ? "" : " (" + price + ")");
    }

    private static String formatPick(String pick) {
        if (pick == null || pick.isBlank() || "NONE".equalsIgnoreCase(pick)) {
            return "—";
        }
        return switch (pick.toUpperCase(Locale.ROOT)) {
            case "HOME" -> "Chủ nhà";
            case "AWAY" -> "Khách";
            case "OVER" -> "Tài";
            case "UNDER" -> "Xỉu";
            case "DRAW" -> "Hòa";
            default -> pick;
        };
    }

    private static String resolvePrimaryResult(DashboardRepository.PredictionActivityRow pred) {
        if (pred.hdcPick() != null && !"NONE".equalsIgnoreCase(pred.hdcPick())) {
            return pred.resultHdc();
        }
        return pred.resultOu();
    }

    private record ActivitySortable(LocalDateTime occurredAt, DashboardActivityItemDto item) {
    }
}
