package com.kira.bank.karaoke.application;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class KaraokeDtos {
    private KaraokeDtos() {
    }

    public record FavoriteSongCreate(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 255) String artist,
        @Size(max = 100) String genre,
        @Size(max = 100) String karaokeCode,
        @Size(max = 50) String tone,
        @Size(max = 1000) String link,
        @Size(max = 10000) String note
    ) {
    }

    public record FavoriteSongUpdate(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 255) String artist,
        @Size(max = 100) String genre,
        @Size(max = 100) String karaokeCode,
        @Size(max = 50) String tone,
        @Size(max = 1000) String link,
        @Size(max = 10000) String note,
        @Min(0) long version
    ) {
    }

    public record FavoriteSong(
        long id,
        String title,
        String artist,
        String genre,
        String karaokeCode,
        String tone,
        String link,
        String note,
        Instant createdAt,
        Instant updatedAt,
        long version
    ) {
    }
}
