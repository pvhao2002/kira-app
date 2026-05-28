package com.app.kira.dto.prediction;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictionStatsCompareDto {
    private String from;
    private String to;
    private PredictionStatsSummaryDto baseData;
    private PredictionStatsSummaryDto oddsMovement;
}
