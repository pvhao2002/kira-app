package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "teams", indexes = @Index(name = "idx_teams_name", columnList = "team_name"))
@Getter
@Setter
@NoArgsConstructor
public class Team {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "team_id")
    private Integer teamId;

    @Column(name = "team_name", nullable = false, length = 100, unique = true)
    private String teamName;

    @Column(name = "external_id", length = 100)
    private String externalId;

    @Column(name = "sport_id")
    private Integer sportId;

    @Lob
    @Column(name = "logo_url")
    private String logoUrl;

    @Lob
    @Column(name = "logo")
    private String logo;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}
