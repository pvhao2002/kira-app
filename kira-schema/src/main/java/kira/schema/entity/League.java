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
@Table(
        name = "leagues",
        indexes = {
                @Index(name = "idx_country", columnList = "country"),
                @Index(name = "idx_country_code_short", columnList = "country_code_short"),
                @Index(name = "idx_leagues_main_country_name", columnList = "is_main, country, league_name")
        })
@Getter
@Setter
@NoArgsConstructor
public class League {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "league_id")
    private Integer leagueId;

    @Column(name = "league_name", nullable = false, unique = true)
    private String leagueName;

    @Lob
    @Column(name = "logo_url")
    private String logoUrl;

    @Column(length = 100)
    private String country;

    @Column(name = "country_code_short", length = 3)
    private String countryCodeShort;

    @Column(name = "is_main")
    private Boolean isMain = Boolean.FALSE;

    @Column(name = "total_events")
    private Integer totalEvents = 0;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}
