package com.kira.bank.attachment.application;

import com.kira.bank.ai.AiJobProperties;
import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.attachment.domain.AttachmentAiStatus;
import com.kira.bank.attachment.infrastructure.AttachmentRepository;
import com.kira.bank.attachment.infrastructure.InvestmentAiJobEventRepository;
import com.kira.bank.identity.domain.User;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.investment.application.InvestmentTransactionImportService;
import com.kira.bank.investment.domain.InvestmentImportBatchStatus;
import com.kira.bank.investment.domain.InvestmentImportResolution;
import com.kira.bank.investment.infrastructure.InvestmentTransactionImportFileRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.kira.bank.attachment.application.AttachmentDtos.*;
import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@Service
@RequiredArgsConstructor
public class InvestmentAiJobService {
    private static final EnumSet<AttachmentAiStatus> JOB_STATUSES = EnumSet.of(
        AttachmentAiStatus.PENDING,
        AttachmentAiStatus.PROCESSING,
        AttachmentAiStatus.READY,
        AttachmentAiStatus.FAILED,
        AttachmentAiStatus.CANCELLED,
        AttachmentAiStatus.CONFIRMED
    );
    private static final EnumSet<InvestmentImportBatchStatus> REVIEWABLE_BATCH_STATUSES = EnumSet.of(
        InvestmentImportBatchStatus.QUEUED,
        InvestmentImportBatchStatus.PROCESSING,
        InvestmentImportBatchStatus.READY,
        InvestmentImportBatchStatus.READY_WITH_ERRORS,
        InvestmentImportBatchStatus.PARTIALLY_CONFIRMED
    );

    private final AttachmentRepository attachments;
    private final InvestmentAiJobEventRepository events;
    private final AttachmentService attachmentService;
    private final InvestmentTransactionImportService transactionImports;
    private final InvestmentTransactionImportFileRepository importFiles;
    private final UserRepository users;
    private final AiJobProperties jobProperties;

    @Transactional(readOnly = true)
    public PageResponse<InvestmentAiJobResponse> mine(
        Long userId, Collection<AttachmentAiStatus> statuses, Pageable pageable
    ) {
        Page<Attachment> page = attachments.findByUserIdAndModuleAndDocumentTypeAndAiStatusInAndDeletedAtIsNull(
            userId, AttachmentService.INVESTMENT_MODULE, AttachmentService.RECEIPT_DOCUMENT_TYPE,
            statuses(statuses), pageable);
        return response(page, Map.of(), false);
    }

    @Transactional(readOnly = true)
    public PageResponse<InvestmentAiJobResponse> all(
        Collection<AttachmentAiStatus> statuses, Pageable pageable
    ) {
        Page<Attachment> page = attachments.findByModuleAndDocumentTypeAndAiStatusInAndDeletedAtIsNull(
            AttachmentService.INVESTMENT_MODULE, AttachmentService.RECEIPT_DOCUMENT_TYPE,
            statuses(statuses), pageable);
        Map<Long, User> owners = users.findAllById(
                page.getContent().stream().map(Attachment::getUserId).collect(Collectors.toSet()))
            .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return response(page, owners, true);
    }

    @Transactional(readOnly = true)
    public InvestmentAiQueueSummaryResponse summary() {
        Map<AttachmentAiStatus, Long> counts = new java.util.EnumMap<>(AttachmentAiStatus.class);
        attachments.countAiJobsByStatus(AttachmentService.INVESTMENT_MODULE, AttachmentService.RECEIPT_DOCUMENT_TYPE)
            .forEach(item -> counts.put(item.getStatus(), item.getCount()));
        return new InvestmentAiQueueSummaryResponse(
            count(counts, AttachmentAiStatus.PENDING) + count(counts, AttachmentAiStatus.PROCESSING)
                + count(counts, AttachmentAiStatus.READY) + count(counts, AttachmentAiStatus.FAILED)
                + count(counts, AttachmentAiStatus.CANCELLED) + count(counts, AttachmentAiStatus.CONFIRMED),
            count(counts, AttachmentAiStatus.PENDING),
            count(counts, AttachmentAiStatus.PROCESSING),
            count(counts, AttachmentAiStatus.READY),
            count(counts, AttachmentAiStatus.FAILED),
            count(counts, AttachmentAiStatus.CANCELLED),
            count(counts, AttachmentAiStatus.CONFIRMED),
            java.time.Instant.now()
        );
    }

    @Transactional(readOnly = true)
    public InvestmentAiJobResponse mineOne(Long userId, Long attachmentId) {
        Attachment attachment = investmentJob(owned(attachmentId, userId));
        return response(attachment, null, reviewTargets(List.of(attachment)), history(attachmentId));
    }

    @Transactional(readOnly = true)
    public InvestmentAiJobResponse allOne(Long attachmentId) {
        Attachment attachment = investmentJob(existing(attachmentId));
        return response(attachment, owner(attachment.getUserId()), reviewTargets(List.of(attachment)), history(attachmentId));
    }

    @Transactional
    public InvestmentAiJobResponse cancelMine(Long userId, Long attachmentId) {
        attachmentService.cancel(userId, attachmentId);
        transactionImports.refreshAttachmentState(attachmentId);
        return response(owned(attachmentId, userId), null, Map.of());
    }

    @Transactional
    public InvestmentAiJobResponse cancelAsAdmin(Long adminId, Long attachmentId) {
        attachmentService.cancelAsAdmin(adminId, attachmentId);
        transactionImports.refreshAttachmentState(attachmentId);
        Attachment attachment = existing(attachmentId);
        return response(attachment, owner(attachment.getUserId()), Map.of());
    }

    @Transactional
    public ImmediateRunClaim claimRunMine(Long userId, Long attachmentId) {
        Attachment attachment = attachmentService.claimImmediateRun(userId, attachmentId);
        transactionImports.resetForRerun(attachmentId);
        transactionImports.refreshAttachmentState(attachmentId);
        return new ImmediateRunClaim(attachment, response(attachment, null, Map.of()));
    }

    @Transactional
    public ImmediateRunClaim claimRunAsAdmin(Long adminId, Long attachmentId) {
        Attachment attachment = attachmentService.claimImmediateRunAsAdmin(adminId, attachmentId);
        transactionImports.resetForRerun(attachmentId);
        transactionImports.refreshAttachmentState(attachmentId);
        return new ImmediateRunClaim(attachment, response(attachment, owner(attachment.getUserId()), Map.of()));
    }

    private PageResponse<InvestmentAiJobResponse> response(Page<Attachment> page, Map<Long, User> owners, boolean includeOwner) {
        Map<Long, List<InvestmentAiJobReviewTarget>> reviewTargets = reviewTargets(page.getContent());
        List<InvestmentAiJobResponse> data = page.getContent().stream()
            .map(attachment -> response(attachment, includeOwner
                    ? owner(attachment.getUserId(), owners.get(attachment.getUserId())) : null,
                reviewTargets, List.of()))
            .toList();
        return new PageResponse<>(data, new PageMeta(
            page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    private InvestmentAiJobResponse response(Attachment attachment, AiJobOwnerResponse owner,
                                             Map<Long, List<InvestmentAiJobReviewTarget>> reviewTargets) {
        return response(attachment, owner, reviewTargets, List.of());
    }

    private InvestmentAiJobResponse response(Attachment attachment, AiJobOwnerResponse owner,
                                             Map<Long, List<InvestmentAiJobReviewTarget>> reviewTargets,
                                             List<InvestmentAiJobEventResponse> history) {
        AttachmentAiStatus status = attachment.getAiStatus();
        return new InvestmentAiJobResponse(
            attachment.getId(),
            owner,
            attachment.getOriginalName(),
            attachment.getMimeType(),
            attachment.getSizeBytes(),
            status,
            attachment.getAiAttemptCount(),
            jobProperties.safeMaxAttempts(),
            attachment.getAiModel(),
            attachment.getAiError(),
            attachment.getAiNextAttemptAt(),
            attachment.getAiProcessingStartedAt(),
            attachment.getAiCompletedAt(),
            attachment.getCreatedAt(),
            attachment.getUpdatedAt(),
            attachment.getStoragePurgedAt() == null,
            status == AttachmentAiStatus.PENDING,
            status == AttachmentAiStatus.PENDING || status == AttachmentAiStatus.FAILED
                || status == AttachmentAiStatus.CANCELLED || status == AttachmentAiStatus.READY,
            reviewTargets.getOrDefault(attachment.getId(), List.of()),
            attachmentService.parseDraft(attachment.getAiResult()),
            history
        );
    }

    private Map<Long, List<InvestmentAiJobReviewTarget>> reviewTargets(List<Attachment> page) {
        List<Long> readyAttachmentIds = page.stream()
            .filter(attachment -> attachment.getAiStatus() == AttachmentAiStatus.READY)
            .map(Attachment::getId)
            .toList();
        if (readyAttachmentIds.isEmpty()) return Map.of();

        Map<Long, List<InvestmentAiJobReviewTarget>> targets = new LinkedHashMap<>();
        for (var target : importFiles.findAiJobReviewTargets(
            readyAttachmentIds, REVIEWABLE_BATCH_STATUSES, InvestmentImportResolution.SKIP)) {
            targets.computeIfAbsent(target.getAttachmentId(), ignored -> new java.util.ArrayList<>())
                .add(new InvestmentAiJobReviewTarget(
                    target.getAccountId(),
                    target.getAccountName(),
                    target.getBatchId(),
                    target.getBatchStatus(),
                    target.getCreatedAt(),
                    target.getPendingItemCount()
                ));
        }
        return targets;
    }

    private List<InvestmentAiJobEventResponse> history(Long attachmentId) {
        return events.findByAttachmentIdOrderByCreatedAtAscIdAsc(attachmentId).stream()
            .map(event -> new InvestmentAiJobEventResponse(
                event.getFromStatus(), event.getToStatus(), event.getAttemptCount(),
                event.getReasonCode(), event.getActorType(), event.getCreatedAt()))
            .toList();
    }

    private long count(Map<AttachmentAiStatus, Long> counts, AttachmentAiStatus status) {
        return counts.getOrDefault(status, 0L);
    }

    private Collection<AttachmentAiStatus> statuses(Collection<AttachmentAiStatus> requested) {
        if (requested == null || requested.isEmpty()) {
            return JOB_STATUSES;
        }
        List<AttachmentAiStatus> filtered = requested.stream().filter(JOB_STATUSES::contains).distinct().toList();
        return filtered.isEmpty() ? JOB_STATUSES : filtered;
    }

    private Attachment owned(Long attachmentId, Long userId) {
        return attachments.findByIdAndUserIdAndDeletedAtIsNull(attachmentId, userId)
            .orElseThrow(this::missing);
    }

    private Attachment existing(Long attachmentId) {
        return attachments.findById(attachmentId).filter(value -> value.getDeletedAt() == null)
            .orElseThrow(this::missing);
    }

    private Attachment investmentJob(Attachment attachment) {
        if (!AttachmentService.INVESTMENT_MODULE.equalsIgnoreCase(attachment.getModule())
            || !AttachmentService.RECEIPT_DOCUMENT_TYPE.equalsIgnoreCase(attachment.getDocumentType())) {
            throw missing();
        }
        return attachment;
    }

    private AiJobOwnerResponse owner(Long userId) {
        return owner(userId, users.findById(userId).orElse(null));
    }

    private AiJobOwnerResponse owner(Long userId, User user) {
        return user == null
            ? new AiJobOwnerResponse(userId, null, null)
            : new AiJobOwnerResponse(user.getId(), user.getFullName(), user.getEmail());
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "AI_JOB_NOT_FOUND", "Không tìm thấy AI job");
    }

    public record ImmediateRunClaim(Attachment attachment, InvestmentAiJobResponse response) {
    }
}
