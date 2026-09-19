package com.db.kiragateway.karaoke;

import com.db.kiragateway.karaoke.dto.CreateFavoriteSongRequest;
import com.db.kiragateway.karaoke.dto.FavoriteSongResponse;
import com.db.kiragateway.karaoke.dto.UpdateFavoriteSongRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class KaraokeFavoriteSongService {

    private final KaraokeFavoriteSongRepository repo;

    public KaraokeFavoriteSongService(KaraokeFavoriteSongRepository repo) {
        this.repo = repo;
    }

    public List<FavoriteSongResponse> list(int userId, String query) {
        return repo.findAll(userId, query).stream().map(this::toResponse).toList();
    }

    public FavoriteSongResponse create(int userId, CreateFavoriteSongRequest request) {
        long id = repo.insert(userId, requiredText(request.title(), "Song title is required"), optionalText(request.artist()),
                optionalText(request.genre()), optionalText(request.karaokeCode()), optionalText(request.tone()),
                optionalText(request.link()), optionalText(request.note()));
        return get(userId, id);
    }

    public FavoriteSongResponse update(int userId, long songId, UpdateFavoriteSongRequest request) {
        var existing = repo.findById(songId, userId).orElseThrow(() -> notFound("Favorite song not found"));
        int updated = repo.update(songId, userId,
                request.title() != null ? requiredText(request.title(), "Song title is required") : existing.title(),
                request.artist() != null ? optionalText(request.artist()) : existing.artist(),
                request.genre() != null ? optionalText(request.genre()) : existing.genre(),
                request.karaokeCode() != null ? optionalText(request.karaokeCode()) : existing.karaokeCode(),
                request.tone() != null ? optionalText(request.tone()) : existing.tone(),
                request.link() != null ? optionalText(request.link()) : existing.link(),
                request.note() != null ? optionalText(request.note()) : existing.note());
        if (updated == 0) {
            throw notFound("Favorite song not found");
        }
        return get(userId, songId);
    }

    public FavoriteSongResponse get(int userId, long songId) {
        return repo.findById(songId, userId).map(this::toResponse)
                .orElseThrow(() -> notFound("Favorite song not found"));
    }

    public void delete(int userId, long songId) {
        if (repo.delete(songId, userId) == 0) {
            throw notFound("Favorite song not found");
        }
    }

    private FavoriteSongResponse toResponse(KaraokeFavoriteSongRow row) {
        return new FavoriteSongResponse(row.songId(), row.title(), row.artist(), row.genre(), row.karaokeCode(),
                row.tone(), row.link(), row.note(), row.createdAt(), row.updatedAt());
    }

    private static String requiredText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private static String optionalText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
