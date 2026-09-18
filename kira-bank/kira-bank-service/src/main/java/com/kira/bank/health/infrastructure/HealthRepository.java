package com.kira.bank.health.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.health.application.HealthDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class HealthRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid health document");
        }
    }

    public <T> T read(String value, Class<T> type) {
        try {
            return mapper.readValue(value, type);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid stored health document");
        }
    }

    public void lockUser(long user) {
        jdbc.queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE", Long.class, user);
    }

    public ProfileView profile(long user) {
        return jdbc.query("SELECT data,version FROM health_profiles WHERE user_id=?",
            (r, n) -> new ProfileView(read(r.getString(1), Profile.class), r.getLong(2)), user).stream().findFirst().orElse(null);
    }

    public void insertProfile(long user, Profile data) {
        jdbc.update("INSERT INTO health_profiles(user_id,data) VALUES (?,?)", user, json(data));
    }

    public int updateProfile(long user, ProfileWrite value) {
        return jdbc.update("UPDATE health_profiles SET data=?,version=version+1 WHERE user_id=? AND version=?", json(value.data()), user, value.version());
    }

    public List<Weight> weights(long user) {
        return jdbc.query("SELECT measured_on,kg FROM health_weights WHERE user_id=? ORDER BY measured_on DESC", (r, n) -> new Weight(r.getDate(1).toLocalDate(), r.getDouble(2)), user);
    }

    public void weight(long user, Weight w) {
        jdbc.update("INSERT INTO health_weights(user_id,measured_on,kg) VALUES (?,?,?) ON DUPLICATE KEY UPDATE kg=VALUES(kg)", user, w.date(), w.kg());
    }

    public void deleteWeight(long user, LocalDate date) {
        jdbc.update("DELETE FROM health_weights WHERE user_id=? AND measured_on=?", user, date);
    }

    public List<PlanView> plans(long user, LocalDate week) {
        return jdbc.query("SELECT id,week_start,status,data,version FROM health_plans WHERE user_id=? AND week_start=? ORDER BY created_at DESC",
            (r, n) -> new PlanView(r.getString(1), r.getDate(2).toLocalDate(), r.getString(3), read(r.getString(4), PlanData.class), r.getLong(5)), user, week);
    }

    public PlanView plan(long user, String id) {
        return jdbc.query("SELECT id,week_start,status,data,version FROM health_plans WHERE user_id=? AND id=?",
            (r, n) -> new PlanView(r.getString(1), r.getDate(2).toLocalDate(), r.getString(3), read(r.getString(4), PlanData.class), r.getLong(5)), user, id).stream().findFirst().orElse(null);
    }

    public void insertPlan(long user, String id, PlanWrite p) {
        jdbc.update("INSERT INTO health_plans(id,user_id,week_start,status,data) VALUES (?,?,?,'DRAFT',?)", id, user, p.weekStart(), json(p.data()));
    }

    public int updatePlan(long user, String id, PlanWrite p) {
        return jdbc.update("UPDATE health_plans SET data=?,version=version+1 WHERE user_id=? AND id=? AND version=? AND status='DRAFT'", json(p.data()), user, id, p.version());
    }

    public void approve(long user, PlanView p) {
        jdbc.update("UPDATE health_plans SET status='ARCHIVED',version=version+1 WHERE user_id=? AND week_start=? AND status='ACTIVE'", user, p.weekStart());
        jdbc.update("UPDATE health_plans SET status='ACTIVE',version=version+1 WHERE user_id=? AND id=?", user, p.id());
    }

    public int complete(long user, String id, PlanData data, long version) {
        return jdbc.update("UPDATE health_plans SET data=?,version=version+1 WHERE user_id=? AND id=? AND version=? AND status='ACTIVE'", json(data), user, id, version);
    }

    public List<JournalView> journals(long user, LocalDate from, LocalDate to) {
        return jdbc.query("SELECT id,entry_date,data,version FROM health_journals WHERE user_id=? AND entry_date BETWEEN ? AND ? ORDER BY entry_date,id",
            (r, n) -> new JournalView(r.getString(1), r.getDate(2).toLocalDate(), read(r.getString(3), JournalData.class), r.getLong(4)), user, from, to);
    }

    public void insertJournal(long user, String id, JournalWrite p) {
        jdbc.update("INSERT INTO health_journals(id,user_id,entry_date,data) VALUES (?,?,?,?)", id, user, p.date(), json(p.data()));
    }

    public int updateJournal(long user, String id, JournalWrite p) {
        return jdbc.update("UPDATE health_journals SET entry_date=?,data=?,version=version+1 WHERE user_id=? AND id=? AND version=?", p.date(), json(p.data()), user, id, p.version());
    }

    public int deleteJournal(long user, String id, long version) {
        return jdbc.update("DELETE FROM health_journals WHERE user_id=? AND id=? AND version=?", user, id, version);
    }

    public Device device(long user) {
        return jdbc.query("SELECT device_id,generation,timezone,last_revision,last_synced_at FROM health_devices WHERE user_id=?", (r, n) -> new Device(r.getString(1), r.getString(2), r.getString(3), r.getLong(4), r.getTimestamp(5) == null ? null : r.getTimestamp(5).toInstant()), user).stream().findFirst().orElse(null);
    }

    public void connect(long user, Connect c, String generation) {
        jdbc.update("INSERT INTO health_devices(user_id,device_id,generation,timezone) VALUES (?,?,?,?)", user, c.deviceId().toString(), generation, c.timezone());
    }

    public void disconnect(long user) {
        jdbc.update("DELETE FROM health_devices WHERE user_id=?", user);
    }

    public void deleteDays(long user) {
        jdbc.update("DELETE FROM health_days WHERE user_id=?", user);
    }

    public void sync(long user, Sync s) {
        for (Day d : s.days())
            jdbc.update("INSERT INTO health_days(user_id,day,data) VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)", user, d.date(), json(d));
        jdbc.update("UPDATE health_devices SET last_revision=?,last_synced_at=CURRENT_TIMESTAMP(6) WHERE user_id=?", s.revision(), user);
    }

    public Day day(long user, LocalDate date) {
        return jdbc.query("SELECT data FROM health_days WHERE user_id=? AND day=?", (r, n) -> read(r.getString(1), Day.class), user, date).stream().findFirst().orElse(null);
    }

    public void expireJobs(long user) {
        jdbc.update("UPDATE health_ai_jobs SET status='FAILED',error_code='HEALTH_AI_INTERRUPTED' WHERE user_id=? AND status='RUNNING' AND created_at < CURRENT_TIMESTAMP - INTERVAL 10 MINUTE", user);
    }

    public void startJob(long user, String id) {
        jdbc.update("INSERT INTO health_ai_jobs(id,user_id,status) VALUES (?,?,'RUNNING')", id, user);
    }

    public void finishJob(long user, String id, String status, String plan, String error) {
        jdbc.update("UPDATE health_ai_jobs SET status=?,plan_id=?,error_code=? WHERE user_id=? AND id=?", status, plan, error, user, id);
    }

    public List<AiJob> jobs(long user) {
        return jdbc.query("SELECT id,status,plan_id,error_code FROM health_ai_jobs WHERE user_id=? ORDER BY created_at DESC LIMIT 20", (r, n) -> new AiJob(r.getString(1), r.getString(2), r.getString(3), r.getString(4)), user);
    }
}
