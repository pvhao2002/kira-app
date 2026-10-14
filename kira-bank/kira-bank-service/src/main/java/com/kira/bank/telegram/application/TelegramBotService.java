package com.kira.bank.telegram.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.identity.domain.User;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.investment.application.InvestmentStatisticsDtos.CurrencySummary;
import com.kira.bank.investment.application.InvestmentStatisticsService;
import com.kira.bank.investment.application.InvestmentTransactionImportDtos.ImportStateResponse;
import com.kira.bank.investment.application.InvestmentTransactionImportService;
import com.kira.bank.investment.domain.InvestmentAccount;
import com.kira.bank.investment.infrastructure.InvestmentAccountRepository;
import com.kira.bank.shared.web.ApiException;
import com.kira.bank.storage.application.FileStorageService;
import com.kira.bank.storage.application.FileStorageService.StoredFileResponse;
import com.kira.bank.storage.domain.StorageProvider;
import com.kira.bank.telegram.infrastructure.TelegramClient;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Telegram bot commands for linked users. Updates are handled on a virtual thread so the webhook answers Telegram
 * immediately; updates are stored in telegram_updates (durable dedupe, retried on transient failure). Message text, file names,
 * link codes and file bytes are never logged.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TelegramBotService {
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final long MAX_FILE_BYTES = 10L * 1024 * 1024;
    private static final Set<String> RECEIPT_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final String USAGE = """
        Lệnh:
        /login <mã> - liên kết tài khoản (tạo mã ở web: Cài đặt > Telegram)
        /logout - hủy liên kết
        /transaction [accountId] - import biên lai (gửi kèm ảnh, lệnh ở caption)
        /upload [r2|hf] - upload file (admin, gửi kèm file, lệnh ở caption)
        /statistic [yyyy-MM-dd yyyy-MM-dd] - thống kê đầu tư""";
    private static final String NOT_LINKED = "Chưa liên kết, dùng /login <mã>";
    private final SecureRandom random = new SecureRandom();
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    private static final Duration LEASE = Duration.ofMinutes(2);
    private static final int MAX_ATTEMPTS = 3;

    private final ObjectMapper mapper;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactionTemplate;
    private final UserRepository users;
    private final InvestmentAccountRepository accounts;
    private final InvestmentTransactionImportService imports;
    private final InvestmentStatisticsService statistics;
    private final FileStorageService fileStorage;
    private final TelegramClient client;

    public record LinkCode(String code, Instant expiresAt) {
    }

    private record BytesFile(String originalFilename, String contentType, byte[] bytes) implements MultipartFile {
        public String getName() {
            return "file";
        }

        public String getOriginalFilename() {
            return originalFilename;
        }

        public String getContentType() {
            return contentType;
        }

        public boolean isEmpty() {
            return bytes.length == 0;
        }

        public long getSize() {
            return bytes.length;
        }

        public byte[] getBytes() {
            return bytes;
        }

        public InputStream getInputStream() {
            return new ByteArrayInputStream(bytes);
        }

        public void transferTo(File dest) throws IOException {
            Files.write(dest.toPath(), bytes);
        }
    }

    public LinkCode createLinkCode(Long userId) {
        if (!client.configured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "TELEGRAM_NOT_CONFIGURED",
                "Telegram bot chưa được cấu hình");
        }
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 8; i++) code.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(10));
        jdbc.update("""
            INSERT INTO telegram_links (user_id, link_code_hash, link_code_expires_at) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE link_code_hash = VALUES(link_code_hash),
              link_code_expires_at = VALUES(link_code_expires_at)
            """, userId, sha256(code.toString()), Timestamp.from(expiresAt));
        return new LinkCode(code.toString(), expiresAt);
    }

    /** Durable dedupe: the update row is the claim. A DB failure here propagates so Telegram retries the webhook. */
    public void accept(JsonNode update) {
        long id = update.path("update_id").asLong(0);
        if (id <= 0) return;
        int inserted = jdbc.update("""
            INSERT IGNORE INTO telegram_updates (update_id, payload, status, next_attempt_at)
            VALUES (?, ?, 'PENDING', ?)
            """, id, update.toString(), Timestamp.from(Instant.now()));
        if (inserted == 0) return; // duplicate
        try {
            executor.execute(() -> process(id));
        } catch (RuntimeException rejected) { // shutting down; retryDue picks it up
            log.debug("Telegram update deferred: {}", rejected.getClass().getSimpleName());
        }
    }

    @Scheduled(fixedDelay = 30000)
    void retryDue() {
        if (!client.configured()) return;
        Timestamp now = Timestamp.from(Instant.now());
        jdbc.queryForList("""
            SELECT update_id FROM telegram_updates WHERE status IN ('PENDING', 'PROCESSING') AND next_attempt_at <= ?
            ORDER BY update_id LIMIT 20
            """, Long.class, now).forEach(id -> executor.execute(() -> process(id))); // keep the shared scheduler thread free
        jdbc.update("DELETE FROM telegram_updates WHERE status IN ('DONE', 'FAILED') AND created_at < ?",
            Timestamp.from(Instant.now().minus(Duration.ofDays(7))));
    }

    void process(long id) {
        Instant now = Instant.now();
        if (jdbc.update("""
            UPDATE telegram_updates SET status = 'PROCESSING', attempts = attempts + 1, next_attempt_at = ?
            WHERE update_id = ? AND status IN ('PENDING', 'PROCESSING') AND next_attempt_at <= ?
            """, Timestamp.from(now.plus(LEASE)), id, Timestamp.from(now)) == 0) return; // taken elsewhere
        long chatId = 0;
        int attempts = 0;
        try {
            var row = jdbc.queryForMap("SELECT payload, attempts FROM telegram_updates WHERE update_id = ?", id);
            attempts = ((Number) row.get("attempts")).intValue();
            JsonNode update = mapper.readTree((String) row.get("payload"));
            chatId = update.path("message").path("chat").path("id").asLong(0);
            handle(update);
            finish(id, "DONE");
        } catch (ApiException e) { // business error: reply, no retry
            if (chatId != 0) client.send(chatId, e.getMessage());
            finish(id, "DONE");
        } catch (Exception e) {
            if (attempts < MAX_ATTEMPTS) {
                // ponytail: a /transaction retried after lease expiry re-uploads the image; the ledger dedup keys block
                // double inserts and a fallback-key collision becomes a REVIEW item. Add an idempotency key if it matters.
                jdbc.update("UPDATE telegram_updates SET status = 'PENDING', next_attempt_at = ? WHERE update_id = ?",
                    Timestamp.from(Instant.now().plus(Duration.ofMinutes(attempts))), id);
                return;
            }
            log.warn("Telegram update {} failed: {}", id, e.getClass().getSimpleName());
            if (chatId != 0) client.send(chatId, "Có lỗi, thử lại sau");
            finish(id, "FAILED");
        }
    }

    private void finish(long id, String status) {
        jdbc.update("UPDATE telegram_updates SET status = ?, payload = NULL WHERE update_id = ?", status, id);
    }

    private void handle(JsonNode update) throws Exception {
        JsonNode message = update.path("message");
        if (message.isMissingNode() || !"private".equals(message.path("chat").path("type").asText())) return;
        long chatId = message.path("chat").path("id").asLong();
        String text = message.path("text").asText(message.path("caption").asText("")).trim();
        String[] parts = text.split("\\s+");
        String command = parts[0].toLowerCase(Locale.ROOT);
        int at = command.indexOf('@');
        if (at > 0) command = command.substring(0, at);
        String[] args = Arrays.copyOfRange(parts, 1, parts.length);
        client.send(chatId, switch (command) {
            case "/login" -> login(chatId, args);
            case "/logout" -> logout(chatId);
            case "/transaction" -> transaction(chatId, message, args);
            case "/upload" -> upload(chatId, message, args);
            case "/statistic" -> statistic(chatId, args);
            default -> USAGE;
        });
    }

    private String login(long chatId, String[] args) {
        if (args.length == 0) {
            List<Long> linked = jdbc.queryForList("SELECT user_id FROM telegram_links WHERE chat_id = ?", Long.class, chatId);
            if (linked.isEmpty()) return "Chưa liên kết. Tạo mã ở web: Cài đặt > Telegram rồi gửi /login <mã>";
            return users.findById(linked.get(0)).filter(TelegramBotService::active).map(u -> "Đã liên kết: " + u.getFullName() + " <" + u.getEmail() + ">")
                .orElse(NOT_LINKED);
        }
        String hash = sha256(args[0].toUpperCase(Locale.ROOT));
        User user = transactionTemplate.execute(status -> {
            List<Long> ids = jdbc.queryForList("""
                SELECT user_id FROM telegram_links WHERE link_code_hash = ? AND link_code_expires_at > ? FOR UPDATE
                """, Long.class, hash, Timestamp.from(Instant.now()));
            if (ids.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_LINK_CODE",
                "Mã không hợp lệ hoặc đã hết hạn");
            Long userId = ids.get(0);
            User found = users.findById(userId).filter(TelegramBotService::active).orElseThrow(this::locked);
            jdbc.update("UPDATE telegram_links SET chat_id = NULL WHERE chat_id = ? AND user_id <> ?", chatId, userId);
            jdbc.update("""
                UPDATE telegram_links SET chat_id = ?, link_code_hash = NULL, link_code_expires_at = NULL,
                  linked_at = ? WHERE user_id = ?
                """, chatId, Timestamp.from(Instant.now()), userId);
            return found;
        });
        return "Đã liên kết: " + user.getFullName() + " <" + user.getEmail() + ">";
    }

    private String logout(long chatId) {
        jdbc.update("UPDATE telegram_links SET chat_id = NULL WHERE chat_id = ?", chatId);
        return "Đã hủy liên kết";
    }

    private String transaction(long chatId, JsonNode message, String[] args) throws IOException {
        User user = linkedUser(chatId);
        List<InvestmentAccount> list = accounts.findByUserIdAndDeletedAtIsNull(user.getId(), PageRequest.of(0, 20))
            .getContent();
        Long accountId;
        try {
            accountId = args.length > 0 ? Long.valueOf(args[0]) : list.size() == 1 ? list.get(0).getId() : null;
        } catch (NumberFormatException e) {
            return USAGE;
        }
        if (accountId == null) {
            if (list.isEmpty()) return "Chưa có tài khoản đầu tư";
            StringBuilder reply = new StringBuilder("Chọn tài khoản bằng /transaction <id>:");
            list.forEach(a -> reply.append('\n').append(a.getId()).append(" - ").append(a.getAccountName())
                .append(" (").append(a.getCurrency()).append(')'));
            return reply.toString();
        }
        ImportStateResponse state = imports.upload(user.getId(), accountId, List.of(fileOf(message, true)));
        return "Đã nhận ảnh, AI đang xử lý. Giao dịch hợp lệ sẽ tự ghi; mục cần xem lại ở web: Đầu tư > Nhập giao dịch";
    }

    private String upload(long chatId, JsonNode message, String[] args) throws IOException {
        User user = linkedUser(chatId);
        if (user.getRoles().stream().noneMatch(r -> "ROLE_ADMIN".equals(r.getName()))) return "Chỉ admin được upload";
        StorageProvider provider = null;
        if (args.length > 0) {
            switch (args[0].toLowerCase(Locale.ROOT)) {
                case "hf" -> provider = StorageProvider.HUGGING_FACE;
                case "r2" -> provider = StorageProvider.R2;
                default -> {
                    return USAGE;
                }
            }
        }
        StoredFileResponse stored = fileStorage.upload(user.getId(), provider, fileOf(message, false));
        return "Đã upload #" + stored.id() + " (" + stored.provider() + ") " + stored.originalName();
    }

    private String statistic(long chatId, String[] args) {
        User user = linkedUser(chatId);
        LocalDate from = null, to = null;
        try {
            if (args.length == 2) {
                from = LocalDate.parse(args[0]);
                to = LocalDate.parse(args[1]);
            } else if (args.length != 0) {
                return USAGE;
            }
        } catch (DateTimeParseException e) {
            return USAGE;
        }
        var overview = statistics.overview(user.getId(), null, from, to);
        if (overview.currencies().isEmpty()) return "Không có giao dịch";
        DecimalFormat money = new DecimalFormat("#,##0.##", DecimalFormatSymbols.getInstance(Locale.US));
        StringBuilder reply = new StringBuilder("Thống kê " + overview.fromDate() + " đến " + overview.toDate());
        for (CurrencySummary c : overview.currencies()) {
            BigDecimal profit = c.withdrawals().subtract(c.deposits());
            reply.append("\n\n").append(c.currency())
                .append("\nNạp: ").append(money.format(c.deposits()))
                .append("\nRút: ").append(money.format(c.withdrawals()))
                .append("\nThưởng: ").append(money.format(c.bonuses()))
                .append("\nĐang đầu tư: ").append(money.format(c.netAmount()))
                .append("\nLãi/lỗ: ").append(money.format(profit))
                .append("\nSố giao dịch: ").append(c.totalCount());
        }
        return reply.toString();
    }

    private User linkedUser(long chatId) {
        List<Long> ids = jdbc.queryForList("SELECT user_id FROM telegram_links WHERE chat_id = ?", Long.class, chatId);
        if (ids.isEmpty()) throw new ApiException(HttpStatus.UNAUTHORIZED, "TELEGRAM_NOT_LINKED", NOT_LINKED);
        return users.findById(ids.get(0)).filter(TelegramBotService::active).orElseThrow(this::locked);
    }

    private ApiException locked() {
        return new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_LOCKED", "Tài khoản đã bị khóa");
    }

    private static boolean active(User u) {
        return "ACTIVE".equals(u.getStatus()) && u.getDeletedAt() == null;
    }

    private MultipartFile fileOf(JsonNode message, boolean receipt) {
        JsonNode photos = message.path("photo");
        JsonNode document = message.path("document");
        String fileId, name, type;
        if (photos.isArray() && !photos.isEmpty()) {
            fileId = photos.get(photos.size() - 1).path("file_id").asText();
            name = "telegram.jpg";
            type = "image/jpeg";
        } else if (document.hasNonNull("file_id")) {
            fileId = document.path("file_id").asText();
            name = document.path("file_name").asText("telegram-file");
            type = document.path("mime_type").asText("application/octet-stream");
            if (receipt && !RECEIPT_TYPES.contains(type)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE_TYPE", "Chỉ nhận ảnh jpeg/png/webp");
            }
            // checked before getFile, which fails with a plain 400 above 20 MB and would be retried
            if (document.path("file_size").asLong(0) > MAX_FILE_BYTES) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", "File tối đa 10 MB");
            }
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_REQUIRED", "Gửi kèm ảnh/file với caption là lệnh");
        }
        return new BytesFile(name, type, client.download(fileId, MAX_FILE_BYTES));
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @PreDestroy
    void shutdown() {
        executor.close();
    }
}
