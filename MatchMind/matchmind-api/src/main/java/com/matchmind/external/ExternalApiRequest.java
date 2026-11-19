package com.matchmind.external;

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

/** Audit row for every external callback attempt, including rejected ones. Never stores credentials or headers. */
@Entity
@Table(name = "external_api_requests")
@Getter
@Setter
public class ExternalApiRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "provider_id")
    private UUID providerId;
    @Column(name = "api_key_id")
    private UUID apiKeyId;
    @Column(name = "request_id", nullable = false)
    private String requestId;
    @Column(name = "event_id")
    private String eventId;
    @Column(nullable = false)
    private String endpoint;
    @Column(name = "http_method", nullable = false)
    private String httpMethod;
    @Column(name = "http_status", nullable = false)
    private int httpStatus;
    @Column(name = "request_status", nullable = false)
    private String requestStatus;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "processing_result")
    private JsonNode processingResult;
    @Column(name = "error_message")
    private String errorMessage;
    @Column(name = "client_ip")
    private String clientIp;
    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;
    @Column(name = "duration_ms", nullable = false)
    private int durationMs;
}
