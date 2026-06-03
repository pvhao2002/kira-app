package com.queue.kiraqueue.dto;

import java.util.List;

public record AiscoreMatchPageInfo(
        String status,
        Integer statusId,
        List<Integer> homeScores,
        List<Integer> awayScores
) {
    public boolean hasScores() {
        return (homeScores != null && !homeScores.isEmpty())
                || (awayScores != null && !awayScores.isEmpty());
    }
}
