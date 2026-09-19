package com.kira.bank.karaoke.application;

import com.kira.bank.karaoke.infrastructure.KaraokeRepository;
import com.kira.bank.shared.web.ApiException;
import com.kira.bank.shared.web.ApiTypes;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.List;

import static com.kira.bank.karaoke.application.KaraokeDtos.*;

@Service
@RequiredArgsConstructor
public class KaraokeService {
    private final KaraokeRepository repo;

    @Transactional(readOnly = true)
    public ApiTypes.PageResponse<FavoriteSong> list(long user, int page, int size, String search) {
        Page pageValue = page(page, size);
        return repo.list(user, pageValue.page(), pageValue.size(), search);
    }

    @Transactional
    public FavoriteSong create(long user, FavoriteSongCreate value) {
        FavoriteSongCreate clean = new FavoriteSongCreate(required(value.title(), "KARAOKE_TITLE_REQUIRED"),
            optional(value.artist()), optional(value.genre()), optional(value.karaokeCode()), optional(value.tone()),
            url(value.link()), optional(value.note()));
        return get(user, repo.insert(user, clean));
    }

    @Transactional
    public FavoriteSong update(long user, long id, FavoriteSongUpdate value) {
        FavoriteSongUpdate clean = new FavoriteSongUpdate(required(value.title(), "KARAOKE_TITLE_REQUIRED"),
            optional(value.artist()), optional(value.genre()), optional(value.karaokeCode()), optional(value.tone()),
            url(value.link()), optional(value.note()), value.version());
        if (repo.find(user, id, true) == null) throw notFound();
        if (repo.update(user, id, clean) != 1) throw conflict();
        return get(user, id);
    }

    @Transactional(readOnly = true)
    public FavoriteSong get(long user, long id) {
        FavoriteSong song = repo.find(user, id, false);
        if (song == null) throw notFound();
        return song;
    }

    @Transactional
    public void delete(long user, long id, long version) {
        if (repo.find(user, id, true) == null) throw notFound();
        if (repo.delete(user, id, version) != 1) throw conflict();
    }

    private static String required(String value, String code) {
        if (value == null || value.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, code, "Tiêu đề bài hát là bắt buộc");
        return value.trim();
    }

    private static String optional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String url(String value) {
        String normalized = optional(value);
        if (normalized == null) return null;
        try {
            URI uri = URI.create(normalized);
            if (!List.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
                throw new IllegalArgumentException();
            return normalized;
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "KARAOKE_LINK_INVALID", "Link bài hát phải dùng HTTP hoặc HTTPS");
        }
    }

    private static Page page(int value, int size) {
        if (value < 0 || size < 1 || size > 100)
            throw new ApiException(HttpStatus.BAD_REQUEST, "KARAOKE_PAGE_INVALID", "Phân trang không hợp lệ");
        return new Page(value, size);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "KARAOKE_SONG_NOT_FOUND", "Không tìm thấy bài hát yêu thích");
    }

    private static ApiException conflict() {
        return new ApiException(HttpStatus.CONFLICT, "KARAOKE_VERSION_CONFLICT", "Bài hát đã thay đổi. Vui lòng tải lại trước khi lưu");
    }

    private record Page(int page, int size) {
    }
}
