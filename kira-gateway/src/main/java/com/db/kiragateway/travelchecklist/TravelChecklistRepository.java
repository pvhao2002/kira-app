package com.db.kiragateway.travelchecklist;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@Repository
public class TravelChecklistRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public TravelChecklistRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<TravelChecklistPlanRow> findPlans(int userId) {
        var sql = """
                select plan_id, user_id, plan_name, is_public, created_at, updated_at
                from travel_checklist_plan
                where user_id = :userId
                order by updated_at desc, plan_id desc
                """;
        return jdbc.query(sql, new MapSqlParameterSource("userId", userId), this::mapPlan);
    }

    public List<TravelChecklistPlanRow> findPublishedPlans() {
        var sql = """
                select plan_id, user_id, plan_name, is_public, created_at, updated_at
                from travel_checklist_plan
                where is_public = 1
                order by updated_at desc, plan_id desc
                """;
        return jdbc.query(sql, new MapSqlParameterSource(), this::mapPlan);
    }

    public Optional<TravelChecklistPlanRow> findPlan(long planId, int userId) {
        var sql = """
                select plan_id, user_id, plan_name, is_public, created_at, updated_at
                from travel_checklist_plan
                where plan_id = :planId and user_id = :userId
                limit 1
                """;
        var rows = jdbc.query(sql, new MapSqlParameterSource("planId", planId).addValue("userId", userId), this::mapPlan);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public long insertPlan(int userId, String planName) {
        var sql = """
                insert into travel_checklist_plan (user_id, plan_name, is_public, created_at, updated_at)
                values (:userId, :planName, :published, :createdAt, :updatedAt)
                """;
        var now = LocalDateTime.now();
        var keyHolder = new GeneratedKeyHolder();
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("planName", planName)
                .addValue("published", false)
                .addValue("createdAt", now)
                .addValue("updatedAt", now), keyHolder, new String[]{"plan_id"});
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("insert travel_checklist_plan returned no key");
        }
        return key.longValue();
    }

    public int updatePlan(long planId, int userId, String planName, boolean published) {
        var sql = """
                update travel_checklist_plan
                set plan_name = :planName, is_public = :published, updated_at = :updatedAt
                where plan_id = :planId and user_id = :userId
                """;
        return jdbc.update(sql, new MapSqlParameterSource()
                .addValue("planId", planId)
                .addValue("userId", userId)
                .addValue("planName", planName)
                .addValue("published", published)
                .addValue("updatedAt", LocalDateTime.now()));
    }

    public int deletePlan(long planId, int userId) {
        return jdbc.update("delete from travel_checklist_plan where plan_id = :planId and user_id = :userId",
                new MapSqlParameterSource("planId", planId).addValue("userId", userId));
    }

    public List<TravelChecklistGroupRow> findGroups(long planId, int userId) {
        var sql = """
                select g.group_id, g.plan_id, g.schedule_type, g.schedule_date, g.start_time, g.end_time,
                       g.title, g.sort_order, g.created_at, g.updated_at
                from travel_checklist_group g
                join travel_checklist_plan p on p.plan_id = g.plan_id
                where g.plan_id = :planId and p.user_id = :userId
                order by g.sort_order asc, g.group_id asc
                """;
        return jdbc.query(sql, new MapSqlParameterSource("planId", planId).addValue("userId", userId), this::mapGroup);
    }

    public List<TravelChecklistGroupRow> findPublishedGroups(long planId) {
        var sql = """
                select g.group_id, g.plan_id, g.schedule_type, g.schedule_date, g.start_time, g.end_time,
                       g.title, g.sort_order, g.created_at, g.updated_at
                from travel_checklist_group g
                join travel_checklist_plan p on p.plan_id = g.plan_id
                where g.plan_id = :planId and p.is_public = 1
                order by g.sort_order asc, g.group_id asc
                """;
        return jdbc.query(sql, new MapSqlParameterSource("planId", planId), this::mapGroup);
    }

    public Optional<TravelChecklistGroupRow> findGroup(long planId, long groupId, int userId) {
        var sql = """
                select g.group_id, g.plan_id, g.schedule_type, g.schedule_date, g.start_time, g.end_time,
                       g.title, g.sort_order, g.created_at, g.updated_at
                from travel_checklist_group g
                join travel_checklist_plan p on p.plan_id = g.plan_id
                where g.plan_id = :planId and g.group_id = :groupId and p.user_id = :userId
                limit 1
                """;
        var rows = jdbc.query(sql, new MapSqlParameterSource("planId", planId)
                .addValue("groupId", groupId)
                .addValue("userId", userId), this::mapGroup);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public long insertGroup(TravelChecklistGroupRow row) {
        var sql = """
                insert into travel_checklist_group
                    (plan_id, schedule_type, schedule_date, start_time, end_time, title, sort_order, created_at, updated_at)
                values
                    (:planId, :scheduleType, :scheduleDate, :startTime, :endTime, :title, :sortOrder, :createdAt, :updatedAt)
                """;
        var now = LocalDateTime.now();
        var keyHolder = new GeneratedKeyHolder();
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("planId", row.planId())
                .addValue("scheduleType", row.scheduleType().name())
                .addValue("scheduleDate", row.scheduleDate())
                .addValue("startTime", row.startTime())
                .addValue("endTime", row.endTime())
                .addValue("title", row.title())
                .addValue("sortOrder", row.sortOrder())
                .addValue("createdAt", now)
                .addValue("updatedAt", now), keyHolder, new String[]{"group_id"});
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("insert travel_checklist_group returned no key");
        }
        touchPlan(row.planId());
        return key.longValue();
    }

    public int updateGroup(TravelChecklistGroupRow row) {
        var sql = """
                update travel_checklist_group
                set schedule_type = :scheduleType,
                    schedule_date = :scheduleDate,
                    start_time = :startTime,
                    end_time = :endTime,
                    title = :title,
                    sort_order = :sortOrder,
                    updated_at = :updatedAt
                where group_id = :groupId and plan_id = :planId
                """;
        int n = jdbc.update(sql, new MapSqlParameterSource()
                .addValue("groupId", row.groupId())
                .addValue("planId", row.planId())
                .addValue("scheduleType", row.scheduleType().name())
                .addValue("scheduleDate", row.scheduleDate())
                .addValue("startTime", row.startTime())
                .addValue("endTime", row.endTime())
                .addValue("title", row.title())
                .addValue("sortOrder", row.sortOrder())
                .addValue("updatedAt", LocalDateTime.now()));
        if (n > 0) {
            touchPlan(row.planId());
        }
        return n;
    }

    public int deleteGroup(long planId, long groupId) {
        int n = jdbc.update("delete from travel_checklist_group where group_id = :groupId and plan_id = :planId",
                new MapSqlParameterSource("groupId", groupId).addValue("planId", planId));
        if (n > 0) {
            touchPlan(planId);
        }
        return n;
    }

    public List<TravelChecklistItemRow> findItems(long planId, int userId) {
        var sql = """
                select i.item_id, i.group_id, i.activity_time, i.activity, i.address, i.cost, i.note,
                       i.checked, i.sort_order, i.created_at, i.updated_at
                from travel_checklist_item i
                join travel_checklist_group g on g.group_id = i.group_id
                join travel_checklist_plan p on p.plan_id = g.plan_id
                where p.plan_id = :planId and p.user_id = :userId
                order by i.sort_order asc, i.item_id asc
                """;
        return jdbc.query(sql, new MapSqlParameterSource("planId", planId).addValue("userId", userId), this::mapItem);
    }

    public List<TravelChecklistItemRow> findPublishedItems(long planId) {
        var sql = """
                select i.item_id, i.group_id, i.activity_time, i.activity, i.address, i.cost, i.note,
                       i.checked, i.sort_order, i.created_at, i.updated_at
                from travel_checklist_item i
                join travel_checklist_group g on g.group_id = i.group_id
                join travel_checklist_plan p on p.plan_id = g.plan_id
                where p.plan_id = :planId and p.is_public = 1
                order by i.sort_order asc, i.item_id asc
                """;
        return jdbc.query(sql, new MapSqlParameterSource("planId", planId), this::mapItem);
    }

    public Optional<TravelChecklistItemRow> findItem(long planId, long groupId, long itemId, int userId) {
        var sql = """
                select i.item_id, i.group_id, i.activity_time, i.activity, i.address, i.cost, i.note,
                       i.checked, i.sort_order, i.created_at, i.updated_at
                from travel_checklist_item i
                join travel_checklist_group g on g.group_id = i.group_id
                join travel_checklist_plan p on p.plan_id = g.plan_id
                where p.plan_id = :planId and p.user_id = :userId and g.group_id = :groupId and i.item_id = :itemId
                limit 1
                """;
        var rows = jdbc.query(sql, new MapSqlParameterSource("planId", planId)
                .addValue("groupId", groupId)
                .addValue("itemId", itemId)
                .addValue("userId", userId), this::mapItem);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public long insertItem(long planId, TravelChecklistItemRow row) {
        var sql = """
                insert into travel_checklist_item
                    (group_id, content, activity_time, activity, address, cost, note, checked, sort_order, created_at, updated_at)
                values
                    (:groupId, :content, :activityTime, :activity, :address, :cost, :note, :checked, :sortOrder, :createdAt, :updatedAt)
                """;
        var now = LocalDateTime.now();
        var keyHolder = new GeneratedKeyHolder();
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("groupId", row.groupId())
                .addValue("content", row.activity())
                .addValue("activityTime", row.activityTime())
                .addValue("activity", row.activity())
                .addValue("address", row.address())
                .addValue("cost", row.cost())
                .addValue("note", row.note())
                .addValue("checked", row.checked())
                .addValue("sortOrder", row.sortOrder())
                .addValue("createdAt", now)
                .addValue("updatedAt", now), keyHolder, new String[]{"item_id"});
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("insert travel_checklist_item returned no key");
        }
        touchPlan(planId);
        return key.longValue();
    }

    public int updateItem(long planId, TravelChecklistItemRow row) {
        var sql = """
                update travel_checklist_item
                set content = :content,
                    activity_time = :activityTime,
                    activity = :activity,
                    address = :address,
                    cost = :cost,
                    note = :note,
                    checked = :checked,
                    sort_order = :sortOrder,
                    updated_at = :updatedAt
                where item_id = :itemId and group_id = :groupId
                """;
        int n = jdbc.update(sql, new MapSqlParameterSource()
                .addValue("itemId", row.itemId())
                .addValue("groupId", row.groupId())
                .addValue("content", row.activity())
                .addValue("activityTime", row.activityTime())
                .addValue("activity", row.activity())
                .addValue("address", row.address())
                .addValue("cost", row.cost())
                .addValue("note", row.note())
                .addValue("checked", row.checked())
                .addValue("sortOrder", row.sortOrder())
                .addValue("updatedAt", LocalDateTime.now()));
        if (n > 0) {
            touchPlan(planId);
        }
        return n;
    }

    public int deleteItem(long planId, long groupId, long itemId) {
        int n = jdbc.update("delete from travel_checklist_item where item_id = :itemId and group_id = :groupId",
                new MapSqlParameterSource("itemId", itemId).addValue("groupId", groupId));
        if (n > 0) {
            touchPlan(planId);
        }
        return n;
    }

    private void touchPlan(long planId) {
        jdbc.update("update travel_checklist_plan set updated_at = :updatedAt where plan_id = :planId",
                new MapSqlParameterSource("planId", planId).addValue("updatedAt", LocalDateTime.now()));
    }

    private TravelChecklistPlanRow mapPlan(ResultSet rs, int rowNum) throws SQLException {
        var ct = rs.getTimestamp("created_at");
        var ut = rs.getTimestamp("updated_at");
        return new TravelChecklistPlanRow(
                rs.getLong("plan_id"),
                rs.getInt("user_id"),
                rs.getString("plan_name"),
                rs.getBoolean("is_public"),
                ct != null ? ct.toLocalDateTime() : null,
                ut != null ? ut.toLocalDateTime() : null
        );
    }

    private TravelChecklistGroupRow mapGroup(ResultSet rs, int rowNum) throws SQLException {
        var sd = rs.getDate("schedule_date");
        var st = rs.getTime("start_time");
        var et = rs.getTime("end_time");
        var ct = rs.getTimestamp("created_at");
        var ut = rs.getTimestamp("updated_at");
        return new TravelChecklistGroupRow(
                rs.getLong("group_id"),
                rs.getLong("plan_id"),
                TravelChecklistScheduleType.valueOf(rs.getString("schedule_type")),
                sd != null ? sd.toLocalDate() : null,
                st != null ? st.toLocalTime() : null,
                et != null ? et.toLocalTime() : null,
                rs.getString("title"),
                rs.getInt("sort_order"),
                ct != null ? ct.toLocalDateTime() : null,
                ut != null ? ut.toLocalDateTime() : null
        );
    }

    private TravelChecklistItemRow mapItem(ResultSet rs, int rowNum) throws SQLException {
        var ct = rs.getTimestamp("created_at");
        var ut = rs.getTimestamp("updated_at");
        var at = rs.getTime("activity_time");
        return new TravelChecklistItemRow(
                rs.getLong("item_id"),
                rs.getLong("group_id"),
                at != null ? at.toLocalTime() : null,
                rs.getString("activity"),
                rs.getString("address"),
                rs.getBigDecimal("cost"),
                rs.getString("note"),
                rs.getBoolean("checked"),
                rs.getInt("sort_order"),
                ct != null ? ct.toLocalDateTime() : null,
                ut != null ? ut.toLocalDateTime() : null
        );
    }
}
