package com.db.kiragateway.karaoke;

import java.time.LocalDateTime;

public record KaraokeFavoriteSongRow(
        long songId,
        int userId,
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
