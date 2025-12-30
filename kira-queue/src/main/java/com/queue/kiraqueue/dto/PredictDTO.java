package com.queue.kiraqueue.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictDTO {
    private String ftScoreStr;
    private int scoreCount;
}
