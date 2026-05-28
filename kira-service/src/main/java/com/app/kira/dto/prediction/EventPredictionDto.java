package com.app.kira.dto.prediction;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class EventPredictionDto {
    private Long eventPredictionId;
    private Long eventId;
    private String versionCode;
    private String versionDisplayName;
    private String status;
    private String eventName;
    private String eventDate;
    private String leagueName;
    private Boolean isMainLeague;
    private String eventLink;
    private String homeLogo;
    private String awayLogo;
    private String prematchHdcLine;
    private String prematchOuLine;
    private Double prematchHdcPriceA;
    private Double prematchHdcPriceB;
    private Double prematchOuPriceA;
    private Double prematchOuPriceB;
    private String hdcPick;
    private String ouPick;
    private Integer hdcVoteCount;
    private Integer ouVoteCount;
    private Integer matchSampleCount;
    private String errorMessage;
    private List<PredictionScoreDto> topScores;
}
