package com.app.kira.dto.prediction;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictionStatsSummaryDto {
    private String versionCode;
    private String versionDisplayName;
    private String from;
    private String to;
    private int totalCompleted;
    private int totalSettled;
    private int totalSkipped;
    private int totalFailed;
    private Double avgMatchSampleCount;
    private PredictionMarketStatsDto hdc;
    private PredictionMarketStatsDto ou;
    private List<PredictionLeagueStatsDto> byLeague;
}
