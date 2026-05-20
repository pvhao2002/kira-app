package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import kira.schema.entity.enums.AiscoreMatchStatusType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "aiscore_match_status_ref",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_aiscore_match_status_ref",
                columnNames = {"status_type", "sport_id", "code"}
        ),
        indexes = @Index(
                name = "idx_aiscore_match_status_ref_type",
                columnList = "status_type, sport_id, sort_order"
        ))
@Getter
@Setter
@NoArgsConstructor
public class AiscoreMatchStatusRef {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ref_id")
    private Integer refId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_type", nullable = false, columnDefinition = "enum('status_id','match_status')")
    private AiscoreMatchStatusType statusType;

    @Column(nullable = false)
    private Integer code;

    @Column(name = "sport_id", nullable = false)
    private Integer sportId = 1;

    @Column(nullable = false, length = 50)
    private String label;

    @Column(length = 255)
    private String description;

    @Column(name = "is_in_play", nullable = false)
    private Boolean inPlay = Boolean.FALSE;

    @Column(name = "is_terminal", nullable = false)
    private Boolean terminal = Boolean.FALSE;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}
