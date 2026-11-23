package com.matchmind.account;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.matchmind.security.Principals.UserPrincipal;
import com.matchmind.shared.ApiException;
import com.matchmind.shared.ApiTypes.PageMeta;
import com.matchmind.shared.Paging;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AccountTransactions {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    public enum Type { CREDIT, DEBIT, REWARD }
    public enum Status { PENDING, SUCCESS, CANCELLED }
    public record Row(@NotBlank @Size(max = 160) String reference, @NotNull Type type, @NotNull Status status,
                      @NotNull @Positive @Digits(integer = 16, fraction = 4) BigDecimal amount, @NotNull Instant occurredAt) {}
    public record Batch(@NotNull UUID importId, @NotEmpty @Size(max = 500) List<@NotNull @Valid Row> transactions) {}
    public record Entry(String reference, Type type, Status status, BigDecimal amount, Instant occurredAt) {}
    public record Summary(BigDecimal deposits, BigDecimal withdrawals, BigDecimal rewards) {
        @JsonProperty
        public BigDecimal profit() { return withdrawals.subtract(deposits); }
    }
    public record Period(LocalDate periodStart, @JsonUnwrapped Summary totals) {}
    public record Reports(Summary allTime, List<Period> weekly, List<Period> monthly) {}
    public record Ledger(List<Entry> transactions, Reports reports, PageMeta meta) {}
    private record Image(UUID userId, byte[] importHash) {}
    private record Key(Type type, String reference) {}

    @Transactional
    public Map<String, Boolean> ingest(Batch batch) {
        var image = db.query("SELECT user_id, import_hash FROM account_images WHERE id=? FOR UPDATE",
            (rs, i) -> new Image(rs.getObject(1, UUID.class), rs.getBytes(2)), batch.importId())
            .stream().findFirst().orElseThrow(() -> ApiException.notFound("IMPORT_UNKNOWN", "Unknown image import"));
        byte[] hash;
        try {
            hash = MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(batch.transactions()));
        } catch (NoSuchAlgorithmException | JsonProcessingException e) {
            throw new IllegalStateException("Cannot fingerprint account transactions", e);
        }
        if (image.importHash() != null) {
            if (Arrays.equals(hash, image.importHash())) return Map.of("duplicate", true);
            throw ApiException.conflict("IMPORT_CHANGED", "This image has already been imported with different transactions");
        }
        for (Row row : canonical(batch.transactions())) {
            int matched = db.update("""
                INSERT INTO account_transactions(user_id,import_id,reference,type,status,amount,occurred_at)
                VALUES (?,?,?,?,?,?,?)
                ON CONFLICT (user_id,type,reference) DO UPDATE SET reference=excluded.reference
                WHERE account_transactions.amount=excluded.amount AND account_transactions.status=excluded.status
                    AND account_transactions.occurred_at=excluded.occurred_at
                """, image.userId(), batch.importId(), row.reference(), row.type().name(), row.status().name(),
                row.amount(), Timestamp.from(row.occurredAt()));
            if (matched == 0) throw ApiException.conflict("REFERENCE_CONFLICT", "Existing transaction differs: " + row.reference());
        }
        db.update("UPDATE account_images SET import_hash=? WHERE id=?", hash, batch.importId());
        return Map.of("duplicate", false);
    }

    static List<Row> canonical(List<Row> rows) {
        Map<Key, Row> unique = new LinkedHashMap<>();
        for (Row row : rows) {
            if (row.status() == Status.PENDING) continue;
            Key key = new Key(row.type(), row.reference());
            Row previous = unique.put(key, row);
            if (previous != null && row.type() != Type.REWARD && !previous.equals(row)) {
                throw ApiException.conflict("AMBIGUOUS_TRANSACTION", "Conflicting final rows for " + row.reference());
            }
        }
        return List.copyOf(unique.values());
    }

    @GetMapping("/api/v1/account/transactions")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Ledger list(@AuthenticationPrincipal UserPrincipal user, @RequestParam(required = false) Integer page,
                       @RequestParam(required = false) Integer size) {
        int pageNumber = Paging.page(page);
        int pageSize = Paging.size(size);
        var entries = db.query("""
            SELECT reference, type, status, amount, occurred_at FROM account_transactions
            WHERE user_id=? ORDER BY occurred_at DESC,type,reference LIMIT ? OFFSET ?
            """, (rs, i) -> new Entry(rs.getString(1), Type.valueOf(rs.getString(2)),
            Status.valueOf(rs.getString(3)), rs.getBigDecimal(4), rs.getTimestamp(5).toInstant()), user.id(), pageSize,
            (long) pageNumber * pageSize);
        var groups = db.query("""
            WITH periods AS (
                SELECT date_trunc('week', occurred_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS week,
                       date_trunc('month', occurred_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS month,
                       type, status, amount FROM account_transactions WHERE user_id=?
            )
            SELECT week, month, count(*) AS count,
                   coalesce(sum(amount) FILTER (WHERE type='CREDIT' AND status='SUCCESS'),0) AS deposits,
                   coalesce(sum(amount) FILTER (WHERE type='DEBIT' AND status='SUCCESS'),0) AS withdrawals,
                   coalesce(sum(amount) FILTER (WHERE type='REWARD' AND status='SUCCESS'),0) AS rewards
            FROM periods GROUP BY GROUPING SETS ((), (week), (month))
            ORDER BY week DESC NULLS FIRST, month DESC NULLS FIRST
            """, (rs, i) -> new Group(rs.getObject("week", LocalDate.class), rs.getObject("month", LocalDate.class),
            rs.getLong("count"), new Summary(rs.getBigDecimal("deposits"), rs.getBigDecimal("withdrawals"),
            rs.getBigDecimal("rewards"))), user.id());
        // The empty grouping set always yields one grand total, including for an empty account.
        Group total = groups.getFirst();
        List<Period> weekly = new ArrayList<>();
        List<Period> monthly = new ArrayList<>();
        for (Group group : groups) {
            if (group.week() != null) weekly.add(new Period(group.week(), group.summary()));
            if (group.month() != null) monthly.add(new Period(group.month(), group.summary()));
        }
        return new Ledger(entries, new Reports(total.summary(), weekly, monthly),
            Paging.response(entries, pageNumber, pageSize, total.count()).meta());
    }

    private record Group(LocalDate week, LocalDate month, long count, Summary summary) {}
}
