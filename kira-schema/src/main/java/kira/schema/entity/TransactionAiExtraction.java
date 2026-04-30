package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import kira.schema.entity.enums.ParseStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "transaction_ai_extractions")
@Getter
@Setter
@NoArgsConstructor
public class TransactionAiExtraction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "extraction_id")
    private Long extractionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id")
    private Transaction transaction;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "file_name")
    private String fileName;

    @Lob
    @Column(nullable = false)
    private String prompt;

    @Lob
    @Column(name = "ai_raw_response", columnDefinition = "mediumtext")
    private String aiRawResponse;

    @Column(name = "parsed_datetime", nullable = false, length = 100)
    private String parsedDatetime = "";

    @Column(name = "parsed_money", nullable = false, length = 100)
    private String parsedMoney = "";

    @Lob
    @Column(name = "parsed_text")
    private String parsedText;

    @Column(name = "parsed_type", nullable = false, length = 20)
    private String parsedType = "";

    @Enumerated(EnumType.STRING)
    @Column(name = "parse_status", nullable = false,
            columnDefinition = "enum('success','invalid_json','invalid_type','error') not null default 'success'")
    private ParseStatus parseStatus = ParseStatus.success;

    @Lob
    @Column(name = "parse_error")
    private String parseError;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
