package com.app.kira.dto.prediction;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictionScoreDto {
    private Integer rankNo;
    private String ftGoalStr;
    private Integer matchCount;
    private String hdcPick;
    private String ouPick;
}
