package com.db.kiragateway.karaoke;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class KaraokeFavoriteSongRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public KaraokeFavoriteSongRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<KaraokeFavoriteSongRow> findAll(int userId, String query) {
        var params = new MapSqlParameterSource("userId", userId);
        var where = "where user_id = :userId";
        if (query != null && !query.isBlank()) {
            where += " and (lower(title) like :query or lower(coalesce(artist, '')) like :query)";
            params.addValue("query", "%" + query.trim().toLowerCase() + "%");
        }
        return jdbc.query("""
                select song_id, user_id, title, artist, genre, karaoke_code, tone, link, note, created_at, updated_at
                from karaoke_favorite_song
                """ + where + " order by updated_at desc, song_id desc", params, this::mapRow);
    }

    public Optional<KaraokeFavoriteSongRow> findById(long songId, int userId) {
        var rows = jdbc.query("""
                select song_id, user_id, title, artist, genre, karaoke_code, tone, link, note, created_at, updated_at
                from karaoke_favorite_song
                where song_id = :songId and user_id = :userId
                limit 1
                """, new MapSqlParameterSource("songId", songId).addValue("userId", userId), this::mapRow);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    public long insert(int userId, String title, String artist, String genre, String karaokeCode, String tone,
                       String link, String note) {
        var keyHolder = new GeneratedKeyHolder();
        jdbc.update("""
                insert into karaoke_favorite_song
                    (user_id, title, artist, genre, karaoke_code, tone, link, note, created_at, updated_at)
                values (:userId, :title, :artist, :genre, :karaokeCode, :tone, :link, :note, :createdAt, :updatedAt)
                """, new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("title", title)
                .addValue("artist", artist)
                .addValue("genre", genre)
                .addValue("karaokeCode", karaokeCode)
                .addValue("tone", tone)
                .addValue("link", link)
                .addValue("note", note)
                .addValue("createdAt", LocalDateTime.now())
                .addValue("updatedAt", LocalDateTime.now()), keyHolder, new String[]{"song_id"});
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("insert karaoke favorite song returned no key");
        }
        return key.longValue();
    }

    public int update(long songId, int userId, String title, String artist, String genre, String karaokeCode,
                      String tone, String link, String note) {
        return jdbc.update("""
                update karaoke_favorite_song
                set title = :title, artist = :artist, genre = :genre, karaoke_code = :karaokeCode,
                    tone = :tone, link = :link, note = :note, updated_at = :updatedAt
                where song_id = :songId and user_id = :userId
                """, new MapSqlParameterSource()
                .addValue("songId", songId)
                .addValue("userId", userId)
                .addValue("title", title)
                .addValue("artist", artist)
                .addValue("genre", genre)
                .addValue("karaokeCode", karaokeCode)
                .addValue("tone", tone)
                .addValue("link", link)
                .addValue("note", note)
                .addValue("updatedAt", LocalDateTime.now()));
    }

    public int delete(long songId, int userId) {
        return jdbc.update("delete from karaoke_favorite_song where song_id = :songId and user_id = :userId",
                new MapSqlParameterSource("songId", songId).addValue("userId", userId));
    }

    private KaraokeFavoriteSongRow mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new KaraokeFavoriteSongRow(
                rs.getLong("song_id"), rs.getInt("user_id"), rs.getString("title"), rs.getString("artist"),
                rs.getString("genre"), rs.getString("karaoke_code"), rs.getString("tone"), rs.getString("link"),
                rs.getString("note"), toLocalDateTime(rs.getTimestamp("created_at")),
                toLocalDateTime(rs.getTimestamp("updated_at"))
        );
    }

    private static LocalDateTime toLocalDateTime(java.sql.Timestamp value) {
        return value == null ? null : value.toLocalDateTime();
    }
}
