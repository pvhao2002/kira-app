package com.kira.affiliate.order.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "sync_runs")
public class SyncRun {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long userId;
    private String kind;
    private String triggerType;
    private String status;
    private Instant startedAt;
    private Instant finishedAt;
    private int rowsUpserted;
    private String errorCode;
    private String errorMessage;
}
