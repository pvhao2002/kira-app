package com.kira.memory.album;

import com.kira.memory.media.MediaUrls;
import com.kira.memory.shared.ApiException;
import com.kira.memory.shared.Utc;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Albums ("nhóm"). Pinned albums always come first; media does not have to belong to one. */
@RestController
@RequestMapping("/api")
public class GroupController {
    private final JdbcClient jdbc;
    private final MediaUrls urls;

    public GroupController(JdbcClient jdbc, MediaUrls urls) {
        this.jdbc = jdbc;
        this.urls = urls;
    }

    public record GroupView(long id, String name, boolean pinned, int count, String coverUrl) {
    }

    public record SaveGroup(@NotBlank @Size(max = 100) String name, boolean pinned) {
    }

    record Row(long id, String name, boolean pinned, int count, Long coverId) {
    }

    @GetMapping("/groups")
    List<GroupView> list() {
        return jdbc.sql("""
                SELECT g.id, g.name, g.pinned,
                  (SELECT COUNT(*) FROM media m WHERE m.group_id = g.id) AS count,
                  (SELECT m.id FROM media m WHERE m.group_id = g.id ORDER BY m.taken_at DESC, m.id DESC LIMIT 1) AS cover_id
                FROM memory_group g
                ORDER BY g.pinned DESC, g.pinned_at DESC, g.created_at DESC, g.id DESC""")
            .query(Row.class).list().stream().map(this::view).toList();
    }

    @PostMapping("/admin/groups")
    GroupView create(@Valid @RequestBody SaveGroup req) {
        var now = Utc.now();
        var keys = new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO memory_group (name, pinned, pinned_at, created_at) VALUES (?, ?, ?, ?)")
            .params(req.name().strip(), req.pinned(), req.pinned() ? now : null, now).update(keys);
        return get(keys.getKey().longValue());
    }

    @PutMapping("/admin/groups/{id}")
    GroupView update(@PathVariable long id, @Valid @RequestBody SaveGroup req) {
        // pinned_at only moves when the album becomes pinned, so the latest pin sits on top.
        int n = jdbc.sql("""
                UPDATE memory_group SET name = ?,
                  pinned_at = CASE WHEN ? AND NOT pinned THEN ? WHEN ? THEN pinned_at ELSE NULL END,
                  pinned = ?
                WHERE id = ?""")
            .params(req.name().strip(), req.pinned(), Utc.now(), req.pinned(),
                req.pinned(), id).update();
        if (n == 0) throw ApiException.notFound();
        return get(id);
    }

    /** Media in the album stays, it just becomes ungrouped (FK ON DELETE SET NULL). */
    @DeleteMapping("/admin/groups/{id}")
    void delete(@PathVariable long id) {
        if (jdbc.sql("DELETE FROM memory_group WHERE id = ?").param(id).update() == 0) throw ApiException.notFound();
    }

    private GroupView get(long id) {
        return list().stream().filter(g -> g.id() == id).findFirst().orElseThrow(ApiException::notFound);
    }

    private GroupView view(Row r) {
        return new GroupView(r.id(), r.name(), r.pinned(), r.count(), r.coverId() == null ? null : urls.thumb(r.coverId()));
    }
}
