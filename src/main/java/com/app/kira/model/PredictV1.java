package com.app.kira.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PredictV1 {
    String firstHdc;
    String lastHdc;

    String firstOu;
    String lastOu;
}
