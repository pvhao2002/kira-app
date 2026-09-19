package com.kira.bank.karaoke.infrastructure;

import com.kira.bank.karaoke.application.KaraokeDtos.FavoriteSong;
import com.kira.bank.karaoke.application.KaraokeDtos.FavoriteSongCreate;
import com.kira.bank.karaoke.application.KaraokeDtos.FavoriteSongUpdate;
import com.kira.bank.shared.web.ApiTypes;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class KaraokeRepository {
    private final JdbcTemplate jdbc;

    public ApiTypes.PageResponse<FavoriteSong> list(long user, int page, int size, String search) {
        String query = search == null ? "" : search.trim();
        String like = "%" + query.toLowerCase() + "%";
        long total = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM karaoke_favorite_songs
            WHERE user_id=? AND deleted_at IS NULL
              AND (?='' OR LOWER(title) LIKE ? OR LOWER(COALESCE(artist,'')) LIKE ? OR LOWER(COALESCE(karaoke_code,'')) LIKE ?)
            """, Long.class, user, query, like, like, like);
        List<FavoriteSong> rows = jdbc.query("""
            SELECT id,title,artist,genre,karaoke_code,tone,link,note,created_at,updated_at,version
            FROM karaoke_favorite_songs
            WHERE user_id=? AND deleted_at IS NULL
              AND (?='' OR LOWER(title) LIKE ? OR LOWER(COALESCE(artist,'')) LIKE ? OR LOWER(COALESCE(karaoke_code,'')) LIKE ?)
            ORDER BY updated_at DESC,id DESC
            LIMIT ? OFFSET ?
            """, (rs, n) -> map(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8), rs.getTimestamp(9),
                rs.getTimestamp(10), rs.getLong(11)), user, query, like, like, like, size, page * size);
        return new ApiTypes.PageResponse<>(rows,
            new ApiTypes.PageMeta(page, size, total, totalPages(total, size)));
    }

    public FavoriteSong find(long user, long id, boolean lock) {
        return jdbc.query("""
            SELECT id,title,artist,genre,karaoke_code,tone,link,note,created_at,updated_at,version
            FROM karaoke_favorite_songs
            WHERE user_id=? AND id=? AND deleted_at IS NULL
            """ + (lock ? " FOR UPDATE" : ""), (rs, n) -> map(rs.getLong(1), rs.getString(2), rs.getString(3),
            rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8),
            rs.getTimestamp(9), rs.getTimestamp(10), rs.getLong(11)), user, id).stream().findFirst().orElse(null);
    }

    public long insert(long user, FavoriteSongCreate value) {
        var keys = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement("""
            INSERT INTO karaoke_favorite_songs(user_id,title,artist,genre,karaoke_code,tone,link,note,created_by,updated_by)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            """, java.sql.Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, user);
            statement.setString(2, value.title());
            statement.setString(3, value.artist());
            statement.setString(4, value.genre());
            statement.setString(5, value.karaokeCode());
            statement.setString(6, value.tone());
            statement.setString(7, value.link());
            statement.setString(8, value.note());
            statement.setLong(9, user);
            statement.setLong(10, user);
            return statement;
        }, keys);
        if (keys.getKey() == null) throw new IllegalStateException("Could not create favorite song");
        return keys.getKey().longValue();
    }

    public int update(long user, long id, FavoriteSongUpdate value) {
        return jdbc.update("""
            UPDATE karaoke_favorite_songs
            SET title=?,artist=?,genre=?,karaoke_code=?,tone=?,link=?,note=?,updated_by=?,version=version+1
            WHERE user_id=? AND id=? AND version=? AND deleted_at IS NULL
            """, value.title(), value.artist(), value.genre(), value.karaokeCode(), value.tone(), value.link(),
            value.note(), user, user, id, value.version());
    }

    public int delete(long user, long id, long version) {
        return jdbc.update("""
            UPDATE karaoke_favorite_songs
            SET deleted_at=CURRENT_TIMESTAMP(6),updated_by=?,version=version+1
            WHERE user_id=? AND id=? AND version=? AND deleted_at IS NULL
            """, user, user, id, version);
    }

    private FavoriteSong map(long id, String title, String artist, String genre, String karaokeCode, String tone,
                             String link, String note, Timestamp createdAt, Timestamp updatedAt, long version) {
        return new FavoriteSong(id, title, artist, genre, karaokeCode, tone, link, note,
            instant(createdAt), instant(updatedAt), version);
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private static int totalPages(long total, int size) {
        return (int) Math.max(1, (total + size - 1) / size);
    }
}
