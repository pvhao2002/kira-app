package com.app.kira.dto.prediction;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictionVersionDto {
    private String code;
    private String displayName;
    private String description;
    private Integer sortOrder;
}
