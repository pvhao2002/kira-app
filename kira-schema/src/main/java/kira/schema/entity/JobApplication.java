package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "job_application", indexes = {
        @Index(name = "idx_job_application_user_status_updated", columnList = "user_id, status, updated_at"),
        @Index(name = "idx_job_application_user_deadline", columnList = "user_id, deadline")
})
@Getter
@Setter
@NoArgsConstructor
public class JobApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "job_id")
    private Long jobId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_job_application_user"))
    private User user;

    @Column(name = "company_name", nullable = false, length = 255)
    private String companyName;

    @Column(name = "position_title", nullable = false, length = 255)
    private String positionTitle;

    @Column(length = 255)
    private String location;

    @Column(name = "job_url", length = 1000)
    private String jobUrl;

    @Column(length = 255)
    private String salary;

    @Column(name = "employment_type", length = 100)
    private String employmentType;

    @Column(nullable = false, length = 30)
    private String status = "SAVED";

    @Column(nullable = false, length = 20)
    private String priority = "MEDIUM";

    private LocalDate deadline;

    @Column(name = "contact_name", length = 255)
    private String contactName;

    @Column(name = "contact_email", length = 255)
    private String contactEmail;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}
