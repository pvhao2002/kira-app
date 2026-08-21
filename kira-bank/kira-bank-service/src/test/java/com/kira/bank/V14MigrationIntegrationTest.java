package com.kira.bank;

import com.kira.bank.ai.AiDocumentService;
import com.kira.bank.attachment.R2StorageService;
import com.kira.bank.attachment.application.AttachmentService;
import com.kira.bank.attachment.domain.AttachmentAiStatus;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import com.kira.bank.identity.domain.User;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.investment.application.InvestmentTransactionImportDtos;
import com.kira.bank.investment.application.InvestmentTransactionImportService;
import com.kira.bank.investment.application.InvestmentImportRetentionScheduler;
import com.kira.bank.investment.domain.*;
import com.kira.bank.investment.infrastructure.InvestmentAccountRepository;
import com.kira.bank.investment.infrastructure.InvestmentAccountTransactionRepository;
import com.kira.bank.investment.infrastructure.InvestmentTransactionImportBatchRepository;
import com.kira.bank.shared.web.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.mock.web.MockMultipartFile;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.anyString;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
    "app.seed-development-users=false",
    "spring.jpa.hibernate.ddl-auto=validate",
    "ai.enabled=false"
})
class V14MigrationIntegrationTest {
    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0");

    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    UserRepository users;
    @Autowired
    InvestmentAccountRepository accounts;
    @Autowired
    InvestmentAccountTransactionRepository transactions;
    @Autowired
    InvestmentTransactionImportBatchRepository batches;
    @Autowired
    AttachmentRepository attachments;
    @Autowired
    AttachmentService attachmentService;
    @Autowired
    InvestmentTransactionImportService imports;
    @Autowired
    InvestmentImportRetentionScheduler retention;
    @MockitoBean
    AiDocumentService ai;
    @MockitoBean
    R2StorageService storage;

    private Long userId;
    private Long accountId;

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @BeforeEach
    void createOwnerAndAccount() {
        when(ai.isConfigured()).thenReturn(true);
        User user = new User();
        user.setEmail(UUID.randomUUID() + "@test.local");
        user.setPasswordHash("test-password-hash");
        user.setFullName("Import Test");
        user = users.saveAndFlush(user);
        InvestmentAccount account = new InvestmentAccount();
        account.setUserId(user.getId());
        account.setAccountName("AI import account");
        account.setAccountCode("AI-" + UUID.randomUUID());
        account.setCurrency("VND");
        account.setStatus("ACTIVE");
        account = accounts.saveAndFlush(account);
        userId = user.getId();
        accountId = account.getId();
    }

    @Test
    void flywayRunsV1ThroughV14AndHibernateValidates() {
        Integer newTables = jdbc.queryForObject("""
            select count(*) from information_schema.tables
            where table_schema=database() and table_name in (
              'investment_account_transactions', 'investment_transaction_import_batches',
              'investment_transaction_import_files', 'investment_transaction_import_items',
              'investment_transaction_import_item_sources', 'investment_account_transaction_sources')
            """, Integer.class);
        Integer legacyTables = jdbc.queryForObject("""
            select count(*) from information_schema.tables
            where table_schema=database() and table_name in (
              'investment_deposits', 'investment_withdrawals', 'investment_ledger_entries',
              'investment_tasks', 'investment_platforms', 'card_transactions', 'cashback_records',
              'discount_invoices', 'merchants', 'mccs', 'service_providers')
            """, Integer.class);
        Integer attachmentColumns = jdbc.queryForObject("""
            select count(*) from information_schema.columns
            where table_schema=database() and table_name='attachments'
              and column_name in ('ai_schema_version', 'storage_purged_at')
            """, Integer.class);
        assertThat(newTables).isEqualTo(6);
        assertThat(legacyTables).isZero();
        assertThat(attachmentColumns).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where success=1", Integer.class))
            .isEqualTo(14);
    }

    @Test
    void enforcesOwnershipMimeSpoofingAndRateLimit() throws Exception {
        User other = new User();
        other.setEmail(UUID.randomUUID() + "@test.local");
        other.setPasswordHash("test-password-hash");
        other.setFullName("Other owner");
        other = users.saveAndFlush(other);
        Long otherUserId = other.getId();
        MockMultipartFile valid = jpeg("valid.jpg", (byte) 1);
        assertThatThrownBy(() -> imports.createBatch(otherUserId, accountId, List.of(valid)))
            .isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getCode()).isEqualTo("INVESTMENT_ACCOUNT_NOT_FOUND"));

        MockMultipartFile spoofed = new MockMultipartFile("files", "spoof.png", "image/png",
            new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff, 1});
        assertThatThrownBy(() -> imports.createBatch(userId, accountId, List.of(spoofed)))
            .isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getCode()).isEqualTo("FILE_CONTENT_TYPE_MISMATCH"));

        for (int index = 0; index < 5; index++) {
            imports.createBatch(userId, accountId, List.of(jpeg("rate-" + index + ".jpg", (byte) index)));
        }
        assertThatThrownBy(() -> imports.createBatch(userId, accountId, List.of(jpeg("rate-6.jpg", (byte) 9))))
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.getCode()).isEqualTo("IMPORT_RATE_LIMITED");
                assertThat(error.getHeaders().getFirst("Retry-After")).isEqualTo("60");
            });
    }

    @Test
    void movesQueueToPreviewAndConfirmsIdempotently() throws Exception {
        var created = imports.createBatch(userId, accountId, List.of(jpeg("receipt.jpg", (byte) 7)));
        Long attachmentId = created.files().getFirst().attachmentId();
        var attachment = attachments.findById(attachmentId).orElseThrow();
        attachment.setAiStatus(AttachmentAiStatus.PROCESSING);
        attachments.saveAndFlush(attachment);
        attachmentService.markReady(attachmentId, new AiDocumentService.AiExtraction(attachmentId, List.of(
            new AiDocumentService.AiTransactionExtraction(
                "DEPOSIT", "COMPLETED", new BigDecimal("125000.50"), "VNĐ",
                "2026-08-18T09:30:00+07:00", "No. TX 100", "Nạp tiền", "receipt row",
                0.96, List.of(), List.of())
        )), "provider-response-not-logged", "test-model");
        imports.refreshAttachmentState(attachmentId);

        var preview = imports.batch(userId, accountId, created.batchId());
        assertThat(preview.status()).isEqualTo(InvestmentImportBatchStatus.READY);
        assertThat(preview.transactions()).hasSize(1);
        var item = preview.transactions().getFirst();
        assertThat(item.externalTransactionId()).isEqualTo("TX100");
        assertThat(item.amount()).isEqualByComparingTo("125000.5000");

        var requestItem = new InvestmentTransactionImportDtos.ConfirmItemRequest(
            item.itemId(), item.version(), true, InvestmentImportResolution.ACCEPT,
            InvestmentTransactionType.DEPOSIT, InvestmentTransactionStatus.COMPLETED,
            item.amount(), "VND", item.transactionAt(), item.externalTransactionId(), item.description());
        var request = new InvestmentTransactionImportDtos.ConfirmBatchRequest(List.of(requestItem));
        var first = imports.confirm(userId, accountId, created.batchId(), request);
        var repeated = imports.confirm(userId, accountId, created.batchId(), request);
        assertThat(first.inserted()).isEqualTo(1);
        assertThat(repeated.skipped()).isEqualTo(1);
        assertThat(transactionCount(accountId)).isEqualTo(1);
        assertThat(accounts.findById(accountId).orElseThrow().getCurrency()).isEqualTo("VND");
    }

    @Test
    void reusesExactReadyImageAndMergesOverlappingSources() throws Exception {
        MockMultipartFile firstImage = jpeg("first.jpg", (byte) 21);
        MockMultipartFile overlappingImage = jpeg("overlap.jpg", (byte) 22);
        var firstBatch = imports.createBatch(userId, accountId, List.of(firstImage, overlappingImage));
        var extraction = new AiDocumentService.AiExtraction(null, List.of(
            new AiDocumentService.AiTransactionExtraction(
                "BONUS", "COMPLETED", new BigDecimal("50000"), "VND",
                "2026-08-18T10:15:00+07:00", "# BONUS 42", "Thưởng", "same transaction",
                0.99, List.of(), List.of())
        ));
        for (var file : firstBatch.files()) {
            var attachment = attachments.findById(file.attachmentId()).orElseThrow();
            attachment.setAiStatus(AttachmentAiStatus.PROCESSING);
            attachments.saveAndFlush(attachment);
            attachmentService.markReady(file.attachmentId(), extraction, "provider-response-not-logged", "test-model");
            imports.refreshAttachmentState(file.attachmentId());
        }

        var overlappingPreview = imports.batch(userId, accountId, firstBatch.batchId());
        assertThat(overlappingPreview.transactions()).hasSize(1);
        String itemId = overlappingPreview.transactions().getFirst().itemId();
        assertThat(jdbc.queryForObject("""
            select count(*) from investment_transaction_import_item_sources source
            join investment_transaction_import_items item on item.id=source.import_item_id
            where item.item_id=?
            """, Integer.class, itemId)).isEqualTo(2);

        var reusedBatch = imports.createBatch(userId, accountId, List.of(jpeg("renamed.jpg", (byte) 21)));
        assertThat(reusedBatch.files().getFirst().attachmentId())
            .isEqualTo(firstBatch.files().getFirst().attachmentId());
        assertThat(reusedBatch.status()).isEqualTo(InvestmentImportBatchStatus.READY);
        assertThat(reusedBatch.transactions()).hasSize(1);
    }

    @Test
    void reconcilesTwoConcurrentConfirmsWithoutCreatingDuplicateTransactions() throws Exception {
        var created = imports.createBatch(userId, accountId, List.of(jpeg("concurrent.jpg", (byte) 31)));
        Long attachmentId = created.files().getFirst().attachmentId();
        var attachment = attachments.findById(attachmentId).orElseThrow();
        attachment.setAiStatus(AttachmentAiStatus.PROCESSING);
        attachments.saveAndFlush(attachment);
        attachmentService.markReady(attachmentId, new AiDocumentService.AiExtraction(attachmentId, List.of(
            new AiDocumentService.AiTransactionExtraction(
                "WITHDRAWAL", "COMPLETED", new BigDecimal("75000"), "VND",
                "2026-08-18T11:20:00+07:00", "Concurrent-77", "Rút tiền", "concurrent row",
                0.98, List.of(), List.of())
        )), "provider-response-not-logged", "test-model");
        imports.refreshAttachmentState(attachmentId);
        var item = imports.batch(userId, accountId, created.batchId()).transactions().getFirst();
        var request = new InvestmentTransactionImportDtos.ConfirmBatchRequest(List.of(
            new InvestmentTransactionImportDtos.ConfirmItemRequest(
                item.itemId(), item.version(), true, InvestmentImportResolution.ACCEPT,
                item.transactionType(), item.transactionStatus(), item.amount(), item.currency(),
                item.transactionAt(), item.externalTransactionId(), item.description())
        ));

        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                start.await();
                return imports.confirm(userId, accountId, created.batchId(), request);
            });
            var second = executor.submit(() -> {
                start.await();
                return imports.confirm(userId, accountId, created.batchId(), request);
            });
            start.countDown();
            var results = List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
            assertThat(results.stream().mapToInt(InvestmentTransactionImportDtos.ConfirmBatchResponse::inserted).sum())
                .isEqualTo(1);
            assertThat(results.stream().mapToInt(InvestmentTransactionImportDtos.ConfirmBatchResponse::skipped).sum())
                .isEqualTo(1);
            assertThat(results.stream().mapToInt(InvestmentTransactionImportDtos.ConfirmBatchResponse::failed).sum())
                .isZero();
        }
        assertThat(transactionCount(accountId)).isEqualTo(1);
    }

    @Test
    void purgesExpiredR2ContentButKeepsAttachmentAudit() throws Exception {
        var created = imports.createBatch(userId, accountId, List.of(jpeg("retention.jpg", (byte) 8)));
        var batch = batches.findByBatchIdAndUserIdAndInvestmentAccountIdAndDeletedAtIsNull(
            created.batchId(), userId, accountId).orElseThrow();
        batch.setStatus(InvestmentImportBatchStatus.FAILED);
        batch.setCompletedAt(Instant.now().minusSeconds(31L * 24 * 60 * 60));
        batch.setRetentionUntil(Instant.now().minusSeconds(60));
        batches.saveAndFlush(batch);

        retention.purgeExpiredStorage();

        Long attachmentId = created.files().getFirst().attachmentId();
        verify(storage).delete(anyString());
        assertThat(attachments.findById(attachmentId).orElseThrow().getStoragePurgedAt()).isNotNull();
        assertThatThrownBy(() -> attachmentService.content(userId, attachmentId))
            .isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getStatus().value()).isEqualTo(410));
    }

    private MockMultipartFile jpeg(String name, byte marker) {
        return new MockMultipartFile("files", name, "image/jpeg",
            new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff, marker});
    }

    private int transactionCount(Long investmentAccountId) {
        return jdbc.queryForObject(
            "select count(*) from investment_account_transactions where investment_account_id=?",
            Integer.class, investmentAccountId);
    }
}
