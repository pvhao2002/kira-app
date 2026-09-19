package com.db.kiragateway.karaoke.dto;

import java.time.LocalDateTime;

public record FavoriteSongResponse(
        long songId,
        String title,
        String artist,
        String genre,
        String karaokeCode,
        String tone,
        String link,
        String note,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
