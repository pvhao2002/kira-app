package com.kira.bank.english.infrastructure;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.english.application.EnglishDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class EnglishRewriteRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public void insert(long user, String id, RewriteRequest r, RewriteResult result) {
        String json;
        try {
            json = mapper.writeValueAsString(Map.of("sentences", result.sentences(), "keyPhrases", result.keyPhrases()));
        } catch (Exception _) {
            throw new IllegalStateException("Invalid english rewrite document");
        }
        jdbc.update("INSERT INTO english_rewrites(id,user_id,kind,category,question,notes,title,result_json) VALUES (?,?,?,?,?,?,?,?)",
            id, user, r.kind().name(), r.category() == null ? null : r.category().name(), r.question(), r.notes(), result.title(), json);
    }

    public Optional<Rewrite> find(long user, String id) {
        return jdbc.query("SELECT id,kind,category,question,notes,title,result_json,created_at FROM english_rewrites WHERE user_id=? AND id=?", (rs, n) -> {
            try {
                var doc = mapper.readValue(rs.getString(7), new TypeReference<Map<String, Object>>() {
                });
                var sentences = mapper.convertValue(doc.get("sentences"), new TypeReference<List<Sentence>>() {
                });
                var phrases = mapper.convertValue(doc.get("keyPhrases"), new TypeReference<List<KeyPhrase>>() {
                });
                String cat = rs.getString(3);
                return new Rewrite(rs.getString(1), Kind.valueOf(rs.getString(2)), cat == null ? null : Category.valueOf(cat),
                    rs.getString(4), rs.getString(5), rs.getString(6), sentences, phrases, rs.getTimestamp(8).toInstant());
            } catch (Exception _) {
                throw new IllegalStateException("Invalid stored english rewrite document");
            }
        }, user, id).stream().findFirst();
    }

    public List<RewriteSummary> list(long user, Kind kind) {
        String sql = "SELECT id,kind,title,created_at FROM english_rewrites WHERE user_id=?" + (kind == null ? "" : " AND kind=?")
            + " ORDER BY created_at DESC LIMIT 50";
        Object[] args = kind == null ? new Object[]{user} : new Object[]{user, kind.name()};
        return jdbc.query(sql, (rs, n) -> new RewriteSummary(rs.getString(1), Kind.valueOf(rs.getString(2)), rs.getString(3),
            rs.getTimestamp(4).toInstant()), args);
    }

    public boolean delete(long user, String id) {
        return jdbc.update("DELETE FROM english_rewrites WHERE user_id=? AND id=?", user, id) > 0;
    }
}
