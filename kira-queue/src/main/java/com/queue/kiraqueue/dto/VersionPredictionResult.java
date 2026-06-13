package com.queue.kiraqueue.dto;

import java.util.List;

public record VersionPredictionResult(
        String status,
        String hdcPick,
        String ouPick,
        List<String> goalStrPick,
        Integer hdcVoteCount,
        Integer ouVoteCount,
        Integer matchSampleCount,
        String prematchHdcLine,
        String prematchOuLine,
        String errorMessage
) {
}
