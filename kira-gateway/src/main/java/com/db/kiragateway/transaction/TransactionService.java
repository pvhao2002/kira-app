package com.db.kiragateway.transaction;

import com.db.kiragateway.transaction.dto.CreateManualTransactionRequest;
import com.db.kiragateway.transaction.dto.CreateReceiptTransactionRequest;
import com.db.kiragateway.transaction.dto.TransactionResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Set;

@Service
public class TransactionService {

    private static final int MAX_RECEIPT_BASE64_CHARS = 15_000_000;
    private static final Set<String> ALLOWED_TYPES = Set.of("withdraw", "deposit", "bonus");
    private static final Set<String> ALLOWED_MIME = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"
    );

    private final TransactionRepository repo;

    public TransactionService(TransactionRepository repo) {
        this.repo = repo;
    }

    public TransactionResponse createManual(int userId, CreateManualTransactionRequest req) {
        String t = req.type().trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_TYPES.contains(t)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid transaction type");
        }
        LocalDateTime at = parseTransactionAt(req.transactionAt());
        long id = repo.insertManual(userId, t, req.amount(), at, blankToNull(req.description()));
        return loadOrThrow(id, userId);
    }

    public TransactionResponse createReceipt(int userId, CreateReceiptTransactionRequest req) {
        ParsedImage parsed = parseDataUrlOrBase64(req.imageBase64());
        if (parsed.base64().length() > MAX_RECEIPT_BASE64_CHARS) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Receipt image too large");
        }
        String mime = resolveMime(req.mimeType(), parsed.mimeFromDataUrl(), parsed.base64());
        if (!ALLOWED_MIME.contains(mime.toLowerCase(Locale.ROOT))) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Only image/jpeg, image/png, image/webp, image/gif are allowed");
        }
        String fileName = blankToNull(req.fileName());
        long id = repo.insertReceiptPending(userId, parsed.base64(), mime, fileName, LocalDateTime.now());
        return loadOrThrow(id, userId);
    }

    private record ParsedImage(String base64, String mimeFromDataUrl) {
    }

    private static ParsedImage parseDataUrlOrBase64(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "imageBase64 is required");
        }
        String s = raw.trim();
        if (s.regionMatches(true, 0, "data:", 0, 5)) {
            int comma = s.indexOf(',');
            if (comma < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid data URL");
            }
            int semi = s.indexOf(';');
            String mime = null;
            if (semi > 5 && semi < comma) {
                mime = s.substring(5, semi).trim().toLowerCase(Locale.ROOT);
            }
            String b64 = s.substring(comma + 1).replaceAll("\\s", "");
            return new ParsedImage(b64, mime);
        }
        return new ParsedImage(s.replaceAll("\\s", ""), null);
    }

    private static String blankToNull(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.trim();
    }

    private static String resolveMime(String declared, String fromDataUrl, String normalizedB64) {
        if (declared != null && !declared.isBlank()) {
            return declared.trim().toLowerCase(Locale.ROOT);
        }
        if (fromDataUrl != null && !fromDataUrl.isBlank()) {
            return fromDataUrl.toLowerCase(Locale.ROOT);
        }
        return sniffMimeFromBase64(normalizedB64);
    }

    /**
     * Magic-byte sniff for common image formats when client omits mimeType.
     */
    private static String sniffMimeFromBase64(String b64) {
        try {
            byte[] head = java.util.Base64.getDecoder().decode(
                    b64.length() > 48 ? b64.substring(0, 48) : b64);
            if (head.length >= 3 && head[0] == (byte) 0xFF && head[1] == (byte) 0xD8) {
                return "image/jpeg";
            }
            if (head.length >= 8 && head[0] == (byte) 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G') {
                return "image/png";
            }
            if (head.length >= 6 && head[0] == 'G' && head[1] == 'I' && head[2] == 'F') {
                return "image/gif";
            }
            if (head.length >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[8] == 'W' && head[9] == 'E'
                    && head[10] == 'B' && head[11] == 'P') {
                return "image/webp";
            }
        } catch (IllegalArgumentException ignored) {
            // fall through
        }
        return "application/octet-stream";
    }

    private static LocalDateTime parseTransactionAt(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "transactionAt is required");
        }
        String s = raw.trim();
        try {
            return LocalDateTime.parse(s, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException e1) {
            try {
                return OffsetDateTime.parse(s).toLocalDateTime();
            } catch (DateTimeParseException e2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "transactionAt must be ISO-8601 local or offset datetime");
            }
        }
    }

    private TransactionResponse loadOrThrow(long id, int userId) {
        TransactionResponse r = repo.findByIdForUser(id, userId);
        if (r == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction not found");
        }
        return r;
    }
}
