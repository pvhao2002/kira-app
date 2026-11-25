package com.kira.memory.media;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class MediaController {
    private final MediaService media;

    public MediaController(MediaService media) {
        this.media = media;
    }

    public record UpdateMedia(String caption, Long groupId) {
    }

    public record MoveMedia(List<Long> ids, Long groupId) {
    }

    @GetMapping("/media")
    MediaService.Page list(@RequestParam(required = false) Long groupId,
                           @RequestParam(defaultValue = "false") boolean ungrouped,
                           @RequestParam(required = false) String cursor, @RequestParam(defaultValue = "60") int limit) {
        return media.list(groupId, ungrouped, cursor, limit);
    }

    @PutMapping("/admin/media/{id}")
    MediaService.MediaView update(@PathVariable long id, @RequestBody UpdateMedia req) {
        return media.update(id, req.caption(), req.groupId());
    }

    @PostMapping("/admin/media/move")
    Map<String, Integer> move(@RequestBody MoveMedia req) {
        return Map.of("moved", media.move(req.ids(), req.groupId()));
    }

    @DeleteMapping("/admin/media/{id}")
    void delete(@PathVariable long id) {
        media.delete(id);
    }
}
