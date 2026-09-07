package com.kira.bank.travel.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.List;
import static com.kira.bank.travel.application.TravelDtos.*;

@Repository
@RequiredArgsConstructor
public class TravelRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    private TripData read(String json) {
        try { return mapper.readValue(json, TripData.class); }
        catch (Exception e) { throw new IllegalStateException("Invalid stored travel document"); }
    }
    private String json(TripData data) {
        try { return mapper.writeValueAsString(data); }
        catch (Exception e) { throw new IllegalStateException("Invalid travel document"); }
    }
    public List<Trip> list(long user) {
        return jdbc.query("SELECT id,data,version FROM travel_trips WHERE user_id=? ORDER BY updated_at DESC,id",
            (r,n) -> new Trip(r.getString(1), read(r.getString(2)), r.getLong(3)), user);
    }
    public Trip find(long user, String id, boolean lock) {
        return jdbc.query("SELECT id,data,version FROM travel_trips WHERE user_id=? AND id=?" + (lock ? " FOR UPDATE" : ""),
            (r,n) -> new Trip(r.getString(1), read(r.getString(2)), r.getLong(3)), user,id).stream().findFirst().orElse(null);
    }
    public void insert(long user, String id, TripData data) {
        jdbc.update("INSERT INTO travel_trips(id,user_id,data) VALUES (?,?,?)", id,user,json(data));
    }
    public int update(long user, String id, TripWrite write) {
        return jdbc.update("UPDATE travel_trips SET data=?,version=version+1 WHERE user_id=? AND id=? AND version=?",
            json(write.data()),user,id,write.version());
    }
    public int delete(long user, String id, long version) {
        return jdbc.update("DELETE FROM travel_trips WHERE user_id=? AND id=? AND version=?",user,id,version);
    }
    public List<FileView> files(long user, String trip) {
        return jdbc.query("SELECT f.id,f.name,f.content_type,f.size_bytes FROM travel_files f JOIN travel_trips t ON t.id=f.trip_id WHERE t.user_id=? AND t.id=? ORDER BY f.created_at,f.id",
            (r,n) -> new FileView(r.getString(1),r.getString(2),r.getString(3),r.getInt(4)), user,trip);
    }
    public void insertFile(String trip, FileView file, byte[] content) {
        jdbc.update("INSERT INTO travel_files(id,trip_id,name,content_type,size_bytes,content) VALUES (?,?,?,?,?,?)",
            file.id(),trip,file.name(),file.contentType(),file.size(),content);
    }
    public FileContent file(long user, String trip, String id) {
        return jdbc.query("SELECT f.id,f.name,f.content_type,f.size_bytes,f.content FROM travel_files f JOIN travel_trips t ON t.id=f.trip_id WHERE t.user_id=? AND t.id=? AND f.id=?",
            (r,n) -> new FileContent(new FileView(r.getString(1),r.getString(2),r.getString(3),r.getInt(4)),r.getBytes(5)),user,trip,id).stream().findFirst().orElse(null);
    }
    public int deleteFile(long user, String trip, String id) {
        return jdbc.update("DELETE f FROM travel_files f JOIN travel_trips t ON t.id=f.trip_id WHERE t.user_id=? AND t.id=? AND f.id=?",user,trip,id);
    }
}
