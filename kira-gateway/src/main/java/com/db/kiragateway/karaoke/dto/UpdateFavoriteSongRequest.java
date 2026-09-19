package com.db.kiragateway.karaoke.dto;

import jakarta.validation.constraints.Size;

public record UpdateFavoriteSongRequest(
        @Size(max = 255) String title,
        @Size(max = 255) String artist,
        @Size(max = 100) String genre,
        @Size(max = 100) String karaokeCode,
        @Size(max = 50) String tone,
        @Size(max = 1000) String link,
        @Size(max = 10000) String note
) {
}
