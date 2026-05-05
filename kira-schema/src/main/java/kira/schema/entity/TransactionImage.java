package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.ConstraintMode;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import kira.schema.entity.enums.TransactionImageParseStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "transaction_images",
        indexes = {
                @Index(name = "ux_transaction_images_transaction", columnList = "transaction_id", unique = true),
                @Index(name = "idx_transaction_images_user", columnList = "user_id"),
                @Index(name = "idx_transaction_images_parse_status", columnList = "parse_status"),
                @Index(name = "idx_transaction_images_created_at", columnList = "created_at")
        })
@Getter
@Setter
@NoArgsConstructor
public class TransactionImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "image_id")
    private Long imageId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "transaction_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private Transaction transaction;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private User user;

    @Lob
    @Column(name = "image_base64", nullable = false, columnDefinition = "LONGTEXT")
    private String imageBase64;

    @Column(name = "content_type", length = 50)
    private String contentType;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(name = "ai_model", length = 100)
    private String aiModel;

    @Lob
    @Column(name = "ai_raw_response", columnDefinition = "LONGTEXT")
    private String aiRawResponse;

    @Lob
    @Column(name = "ai_parsed_response", columnDefinition = "LONGTEXT")
    private String aiParsedResponse;

    @Enumerated(EnumType.STRING)
    @Column(name = "parse_status", nullable = false,
            columnDefinition = "enum('pending','processing','success','error') not null default 'processing'")
    private TransactionImageParseStatus parseStatus = TransactionImageParseStatus.processing;

    @Lob
    @Column(name = "parse_error", columnDefinition = "TEXT")
    private String parseError;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}
