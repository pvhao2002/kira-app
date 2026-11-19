package com.matchmind.match;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "match_result_history")
@Getter
@Setter
public class MatchResultHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "match_id", nullable = false)
    private UUID matchId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "previous_result", nullable = false)
    private JsonNode previousResult;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_result", nullable = false)
    private JsonNode newResult;
    @Column(name = "change_source", nullable = false)
    private String changeSource;
    @Column(name = "source_request_id")
    private UUID sourceRequestId;
    @Column(name = "changed_by")
    private UUID changedBy;
    @Column(name = "changed_at", nullable = false)
    private Instant changedAt = Instant.now();
}
