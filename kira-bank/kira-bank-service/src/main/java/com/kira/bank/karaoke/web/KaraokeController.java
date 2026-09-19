package com.kira.bank.karaoke.web;

import com.kira.bank.karaoke.application.KaraokeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import static com.kira.bank.karaoke.application.KaraokeDtos.*;

@RestController
@RequestMapping("/api/v1/karaoke/favorite-songs")
@RequiredArgsConstructor
public class KaraokeController {
    private final KaraokeService service;

    @GetMapping
    public com.kira.bank.shared.web.ApiTypes.PageResponse<FavoriteSong> list(
        @AuthenticationPrincipal Long user,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "") String search) {
        return service.list(user, page, size, search);
    }

    @GetMapping("/{id}")
    public FavoriteSong get(@AuthenticationPrincipal Long user, @PathVariable long id) {
        return service.get(user, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FavoriteSong create(@AuthenticationPrincipal Long user, @Valid @RequestBody FavoriteSongCreate value) {
        return service.create(user, value);
    }

    @PutMapping("/{id}")
    public FavoriteSong update(@AuthenticationPrincipal Long user, @PathVariable long id,
                               @Valid @RequestBody FavoriteSongUpdate value) {
        return service.update(user, id, value);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Long user, @PathVariable long id, @RequestParam long version) {
        service.delete(user, id, version);
    }
}
