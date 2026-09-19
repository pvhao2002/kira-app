package com.db.kiragateway.jobtracker;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class JobApplicationRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public JobApplicationRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<JobApplicationRow> findAll(int userId, String query, String status) {
        var params = new MapSqlParameterSource("userId", userId);
        var where = new StringBuilder("where user_id = :userId");
        if (query != null && !query.isBlank()) {
            where.append(" and (lower(company_name) like :query or lower(position_title) like :query");
            where.append(" or lower(coalesce(location, '')) like :query)");
            params.addValue("query", "%" + query.trim().toLowerCase() + "%");
        }
        if (status != null && !status.isBlank()) {
            where.append(" and status = :status");
            params.addValue("status", status.trim().toUpperCase());
        }
        return jdbc.query("""
                select job_id, user_id, company_name, position_title, location, job_url, salary,
                       employment_type, status, priority, deadline, contact_name, contact_email, notes,
                       created_at, updated_at
                from job_application
                """ + where + " order by coalesce(deadline, '9999-12-31') asc, updated_at desc, job_id desc", params,
                this::mapRow);
    }

    public Optional<JobApplicationRow> findById(long jobId, int userId) {
        var rows = jdbc.query("""
                select job_id, user_id, company_name, position_title, location, job_url, salary,
                       employment_type, status, priority, deadline, contact_name, contact_email, notes,
                       created_at, updated_at
                from job_application
                where job_id = :jobId and user_id = :userId
                limit 1
                """, new MapSqlParameterSource("jobId", jobId).addValue("userId", userId), this::mapRow);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    public long insert(int userId, String companyName, String positionTitle, String location, String jobUrl,
                       String salary, String employmentType, String status, String priority, LocalDate deadline,
                       String contactName, String contactEmail, String notes) {
        var keyHolder = new GeneratedKeyHolder();
        jdbc.update("""
                insert into job_application
                    (user_id, company_name, position_title, location, job_url, salary, employment_type,
                     status, priority, deadline, contact_name, contact_email, notes, created_at, updated_at)
                values (:userId, :companyName, :positionTitle, :location, :jobUrl, :salary, :employmentType,
                        :status, :priority, :deadline, :contactName, :contactEmail, :notes, :createdAt, :updatedAt)
                """, params(userId, companyName, positionTitle, location, jobUrl, salary, employmentType,
                status, priority, deadline, contactName, contactEmail, notes), keyHolder, new String[]{"job_id"});
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("insert job application returned no key");
        }
        return key.longValue();
    }

    public int update(long jobId, int userId, String companyName, String positionTitle, String location, String jobUrl,
                      String salary, String employmentType, String status, String priority, LocalDate deadline,
                      String contactName, String contactEmail, String notes) {
        var params = params(userId, companyName, positionTitle, location, jobUrl, salary, employmentType,
                status, priority, deadline, contactName, contactEmail, notes).addValue("jobId", jobId);
        return jdbc.update("""
                update job_application
                set company_name = :companyName, position_title = :positionTitle, location = :location,
                    job_url = :jobUrl, salary = :salary, employment_type = :employmentType,
                    status = :status, priority = :priority, deadline = :deadline,
                    contact_name = :contactName, contact_email = :contactEmail, notes = :notes,
                    updated_at = :updatedAt
                where job_id = :jobId and user_id = :userId
                """, params);
    }

    public int delete(long jobId, int userId) {
        return jdbc.update("delete from job_application where job_id = :jobId and user_id = :userId",
                new MapSqlParameterSource("jobId", jobId).addValue("userId", userId));
    }

    private MapSqlParameterSource params(int userId, String companyName, String positionTitle, String location,
                                         String jobUrl, String salary, String employmentType, String status,
                                         String priority, LocalDate deadline, String contactName, String contactEmail,
                                         String notes) {
        return new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("companyName", companyName)
                .addValue("positionTitle", positionTitle)
                .addValue("location", location)
                .addValue("jobUrl", jobUrl)
                .addValue("salary", salary)
                .addValue("employmentType", employmentType)
                .addValue("status", status)
                .addValue("priority", priority)
                .addValue("deadline", deadline)
                .addValue("contactName", contactName)
                .addValue("contactEmail", contactEmail)
                .addValue("notes", notes)
                .addValue("createdAt", LocalDateTime.now())
                .addValue("updatedAt", LocalDateTime.now());
    }

    private JobApplicationRow mapRow(ResultSet rs, int rowNum) throws SQLException {
        var deadline = rs.getDate("deadline");
        return new JobApplicationRow(
                rs.getLong("job_id"), rs.getInt("user_id"), rs.getString("company_name"),
                rs.getString("position_title"), rs.getString("location"), rs.getString("job_url"),
                rs.getString("salary"), rs.getString("employment_type"), rs.getString("status"),
                rs.getString("priority"), deadline == null ? null : deadline.toLocalDate(),
                rs.getString("contact_name"), rs.getString("contact_email"), rs.getString("notes"),
                toLocalDateTime(rs.getTimestamp("created_at")), toLocalDateTime(rs.getTimestamp("updated_at"))
        );
    }

    private static LocalDateTime toLocalDateTime(java.sql.Timestamp value) {
        return value == null ? null : value.toLocalDateTime();
    }
}
