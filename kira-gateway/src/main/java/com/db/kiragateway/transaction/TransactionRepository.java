package com.db.kiragateway.transaction;

import com.db.kiragateway.transaction.dto.TransactionResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Objects;

@Repository
public class TransactionRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public TransactionRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long insertManual(int userId, String type, BigDecimal amount, LocalDateTime transactionAt, String description) {
        var sql = """
                insert into transactions (user_id, type, amount, transaction_at, description, source, status,
                    created_at, updated_at)
                values (:user_id, :type, :amount, :transaction_at, :description, 'manual', 'success', now(), now())
                """;
        var params = new MapSqlParameterSource()
                .addValue("user_id", userId)
                .addValue("type", type)
                .addValue("amount", amount)
                .addValue("transaction_at", Timestamp.valueOf(transactionAt))
                .addValue("description", description);
        var keyHolder = new GeneratedKeyHolder();
        jdbc.update(sql, params, keyHolder);
        return Objects.requireNonNull(keyHolder.getKey()).longValue();
    }

    public long insertReceiptPending(int userId, String base64, String mimeType, String fileName, LocalDateTime placeholderWhen) {
        var sql = """
                insert into transactions (user_id, type, amount, transaction_at, description, source, status,
                    receipt_image_base64, receipt_mime_type, receipt_file_name, created_at, updated_at)
                values (:user_id, 'deposit', 0, :transaction_at, null, 'ai', 'processing',
                    :b64, :mime, :fname, now(), now())
                """;
        var params = new MapSqlParameterSource()
                .addValue("user_id", userId)
                .addValue("transaction_at", Timestamp.valueOf(placeholderWhen))
                .addValue("b64", base64)
                .addValue("mime", mimeType)
                .addValue("fname", fileName);
        var keyHolder = new GeneratedKeyHolder();
        jdbc.update(sql, params, keyHolder);
        return Objects.requireNonNull(keyHolder.getKey()).longValue();
    }

    public TransactionResponse findByIdForUser(long transactionId, int userId) {
        var sql = """
                select transaction_id, type, amount, transaction_at, description, source, status,
                       receipt_image_base64 is not null as has_receipt, ai_error
                from transactions
                where transaction_id = :id and user_id = :uid
                limit 1
                """;
        var list = jdbc.query(sql,
                new MapSqlParameterSource("id", transactionId).addValue("uid", userId),
                (rs, rn) -> new TransactionResponse(
                        rs.getLong("transaction_id"),
                        rs.getString("type"),
                        rs.getBigDecimal("amount"),
                        rs.getTimestamp("transaction_at").toLocalDateTime().toString(),
                        rs.getString("description"),
                        rs.getString("source"),
                        rs.getString("status"),
                        "processing".equalsIgnoreCase(rs.getString("status"))
                                && rs.getBoolean("has_receipt"),
                        rs.getString("ai_error")
                ));
        return list.isEmpty() ? null : list.get(0);
    }
}
