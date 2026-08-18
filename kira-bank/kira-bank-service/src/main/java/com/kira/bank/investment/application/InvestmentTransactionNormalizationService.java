package com.kira.bank.investment.application;

import com.kira.bank.investment.domain.InvestmentTransactionType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.Locale;

@Service
public class InvestmentTransactionNormalizationService {
    private final ZoneId defaultZone;

    public InvestmentTransactionNormalizationService(
        @Value("${investment.transaction-import.time-zone:Asia/Ho_Chi_Minh}") String zoneId
    ) {
        this.defaultZone = ZoneId.of(zoneId);
    }

    public String externalId(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim()
            .replaceFirst("(?iu)^(?:no\\.?|nº|#)\\s*", "")
            .replaceAll("\\s+", "");
        return normalized.isBlank() ? null : normalized;
    }

    public BigDecimal amount(BigDecimal value) {
        return value == null ? null : value.abs().setScale(4, RoundingMode.HALF_UP);
    }

    public BigDecimal amount(String value) {
        if (value == null || value.isBlank()) return null;
        String compact = value.trim().replace("₫", "").replaceAll("(?iu)VND|VNĐ|đ", "")
            .replace(" ", "").replace("+", "");
        boolean negative = compact.startsWith("-");
        compact = compact.replace("-", "");
        int dots = compact.length() - compact.replace(".", "").length();
        int commas = compact.length() - compact.replace(",", "").length();
        if (dots > 1 || commas > 1 || (dots == 1 && compact.matches(".*\\.\\d{3}(?:\\D|$).*"))) {
            compact = compact.replace(".", "").replace(",", "");
        } else if (commas > 0 && dots == 0) {
            compact = compact.replace(",", ".");
        } else {
            compact = compact.replace(",", "");
        }
        BigDecimal parsed = new BigDecimal((negative ? "-" : "") + compact);
        return amount(parsed);
    }

    public String currency(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (normalized.equals("Đ") || normalized.equals("₫") || normalized.equals("VNĐ")) return "VND";
        return normalized.matches("[A-Z]{3}") ? normalized : null;
    }

    public Instant instant(String value) {
        if (value == null || value.isBlank()) return null;
        for (Parser parser : new Parser[]{
            raw -> Instant.parse(raw),
            raw -> OffsetDateTime.parse(raw).toInstant(),
            raw -> LocalDateTime.parse(raw).atZone(defaultZone).toInstant(),
            raw -> LocalDateTime.parse(raw, DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")).atZone(defaultZone).toInstant()
        }) {
            try {
                return parser.parse(value.trim());
            } catch (DateTimeParseException ignored) {
                // Try the next supported format.
            }
        }
        return null;
    }

    public String description(String value) {
        if (value == null || value.isBlank()) return null;
        return value.toLowerCase(Locale.ROOT)
            .replaceAll("(?iu)(?:no\\.?|nº|#)\\s*\\p{Alnum}+", " ")
            .replaceAll("[+\\-]?\\d[\\d .,'₫đĐ]*", " ")
            .replaceAll("[^\\p{L}\\p{N}]+", " ")
            .trim().replaceAll("\\s+", " ");
    }

    public byte[] dedupKey(Long accountId, InvestmentTransactionType type, String externalId,
                           BigDecimal amount, String currency, Instant transactionAt, String disambiguator) {
        String canonical = externalId != null
            ? accountId + "|" + type + "|" + externalId
            : accountId + "|" + type + "|" + amount.setScale(4, RoundingMode.HALF_UP).toPlainString()
                + "|" + currency + "|" + transactionAt.truncatedTo(java.time.temporal.ChronoUnit.MINUTES);
        if (disambiguator != null) canonical += "|" + disambiguator;
        try {
            return MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to create transaction fingerprint", ex);
        }
    }

    public String hex(byte[] value) {
        return value == null ? null : HexFormat.of().formatHex(value);
    }

    @FunctionalInterface
    private interface Parser {
        Instant parse(String value);
    }
}
