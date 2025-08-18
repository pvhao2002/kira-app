package com.app.kira.dto.predict;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictDetail {
    private Long predictDetailId;
    private PredictType predictType;
    private Long predictId;
    private String predictScore;
    private PredictPick hdcPick;
    private PredictPick ouPick;
    private PredictResult resultHdc;
    private PredictResult resultOu;
    private PredictResult resultScore;

    private Integer hdcCount;
    private Integer ouCount;
    private Integer matchCount;

    public MapSqlParameterSource toParam() {
        MapSqlParameterSource param = new MapSqlParameterSource();
        param.addValue("predict_type", getPredictType().name());
        param.addValue("predict_id", getPredictId());
        param.addValue("predict_score", getPredictScore());
        param.addValue("hdc_pick", getHdcPick().name());
        param.addValue("ou_pick", getOuPick().name());
        return param;
    }

    public enum PredictType {
        SIMPLE, COMPLEX, COMBINE
    }

    public enum PredictPick {
        HOME, AWAY, OVER, UNDER, DRAW, NONE
    }

    public enum PredictResult {
        WIN, LOSE, DRAW, NONE, CANCEL, VOID
    }
}
