package com.app.kira.dto.prediction;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictionLeagueStatsDto {
    private String leagueName;
    private Boolean isMainLeague;
    private int settledCount;
    private PredictionMarketStatsDto hdc;
    private PredictionMarketStatsDto ou;
}
