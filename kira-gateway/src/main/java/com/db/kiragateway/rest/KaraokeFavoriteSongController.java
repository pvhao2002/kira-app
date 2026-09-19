package com.db.kiragateway.rest;

import com.db.kiragateway.karaoke.KaraokeFavoriteSongService;
import com.db.kiragateway.karaoke.dto.CreateFavoriteSongRequest;
import com.db.kiragateway.karaoke.dto.FavoriteSongResponse;
import com.db.kiragateway.karaoke.dto.UpdateFavoriteSongRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/karaoke/favorite-songs")
public class KaraokeFavoriteSongController {

    private final KaraokeFavoriteSongService service;

    public KaraokeFavoriteSongController(KaraokeFavoriteSongService service) {
        this.service = service;
    }

    @GetMapping
    public List<FavoriteSongResponse> list(@AuthenticationPrincipal Jwt jwt,
                                           @RequestParam(required = false) String q) {
        return service.list(currentUserId(jwt), q);
    }

    @PostMapping
    public ResponseEntity<FavoriteSongResponse> create(@AuthenticationPrincipal Jwt jwt,
                                                        @Valid @RequestBody CreateFavoriteSongRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(currentUserId(jwt), request));
    }

    @PatchMapping("/{songId:\\d+}")
    public FavoriteSongResponse update(@AuthenticationPrincipal Jwt jwt,
                                       @PathVariable long songId,
                                       @Valid @RequestBody UpdateFavoriteSongRequest request) {
        return service.update(currentUserId(jwt), songId, request);
    }

    @DeleteMapping("/{songId:\\d+}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long songId) {
        service.delete(currentUserId(jwt), songId);
        return ResponseEntity.noContent().build();
    }

    private static int currentUserId(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        var uid = jwt.getClaim("uid");
        if (uid instanceof Number number && number.intValue() > 0) {
            return number.intValue();
        }
        throw new IllegalArgumentException("Missing user id in token");
    }
}
