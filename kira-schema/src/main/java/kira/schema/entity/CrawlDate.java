package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import kira.schema.entity.enums.CrawlDateStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "crawl_date")
@Getter
@Setter
@NoArgsConstructor
public class CrawlDate {

    @Id
    @Column(name = "date", length = 20, nullable = false)
    private String date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "enum('pending','picked','in_progress','done','failed') default 'pending'")
    private CrawlDateStatus status = CrawlDateStatus.pending;

    @Lob
    private String message;

    @Column(name = "total_events", nullable = false)
    private Integer totalEvents = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
