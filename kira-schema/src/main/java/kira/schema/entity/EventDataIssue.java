package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "event_data_issue")
@IdClass(EventDataIssueId.class)
@Getter
@Setter
@NoArgsConstructor
public class EventDataIssue {
    @Id
    @Column(name = "event_id")
    private Long eventId;

    @Id
    @Column(name = "issue_type", length = 30)
    private String issueType;

    @Column(name = "description", columnDefinition = "LONGTEXT")
    private String description;

    @Lob
    private String screenshot;

    @Column(name = "recorded_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime recordedAt;
}
