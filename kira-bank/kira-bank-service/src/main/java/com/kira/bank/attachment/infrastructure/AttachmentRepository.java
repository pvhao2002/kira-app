package com.kira.bank.attachment.infrastructure;

import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.attachment.domain.AttachmentAiStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    long countByR2AccountId(Long r2AccountId);
    long countByR2AccountIdIsNullAndStoragePurgedAtIsNull();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Attachment a set a.r2AccountId = :accountId where a.r2AccountId is null and a.storagePurgedAt is null")
    int adoptLegacyR2Attachments(@Param("accountId") Long accountId);
    Page<Attachment> findByUserIdAndModuleAndDocumentTypeAndAiStatusInAndDeletedAtIsNull(
        Long userId, String module, String documentType, Collection<AttachmentAiStatus> statuses, Pageable pageable);

    Page<Attachment> findByModuleAndDocumentTypeAndAiStatusInAndDeletedAtIsNull(
        String module, String documentType, Collection<AttachmentAiStatus> statuses, Pageable pageable);

    Optional<Attachment> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    Optional<Attachment> findFirstByUserIdAndModuleAndDocumentTypeAndSha256AndAiSchemaVersionAndStoragePurgedAtIsNullAndDeletedAtIsNullOrderByCreatedAtDesc(
        Long userId, String module, String documentType, String sha256, Integer aiSchemaVersion);

    List<Attachment> findByIdInAndStoragePurgedAtIsNull(Collection<Long> ids);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Attachment a where a.id = :id and a.userId = :userId and a.deletedAt is null")
    Optional<Attachment> findOwnedForUpdate(@Param("id") Long id, @Param("userId") Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Attachment a where a.id = :id and a.deletedAt is null")
    Optional<Attachment> findForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select a from Attachment a
        where a.deletedAt is null
          and a.module = :module
          and a.documentType = :documentType
          and a.aiStatus = :status
          and (a.aiNextAttemptAt is null or a.aiNextAttemptAt <= :now)
        order by a.createdAt asc
        """)
    List<Attachment> findClaimableForUpdate(
        @Param("module") String module,
        @Param("documentType") String documentType,
        @Param("status") AttachmentAiStatus status,
        @Param("now") Instant now,
        Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select a from Attachment a
        where a.deletedAt is null
          and a.module = :module
          and a.documentType = :documentType
          and a.aiStatus = :status
          and a.aiProcessingStartedAt < :cutoff
        """)
    List<Attachment> findStaleProcessingForUpdate(
        @Param("module") String module,
        @Param("documentType") String documentType,
        @Param("status") AttachmentAiStatus status,
        @Param("cutoff") Instant cutoff);
}
