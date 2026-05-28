package com.app.kira.dto.prediction;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictionMarketStatsDto {
    private int winCount;
    private int loseCount;
    private int voidCount;
    private int noneCount;
    private Double accuracyPct;
}
