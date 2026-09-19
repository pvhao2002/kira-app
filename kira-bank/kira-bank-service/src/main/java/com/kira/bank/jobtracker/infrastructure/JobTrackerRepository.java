package com.kira.bank.jobtracker.infrastructure;

import com.kira.bank.jobtracker.application.JobTrackerDtos.Job;
import com.kira.bank.jobtracker.application.JobTrackerDtos.JobCreate;
import com.kira.bank.jobtracker.application.JobTrackerDtos.JobUpdate;
import com.kira.bank.shared.web.ApiTypes;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class JobTrackerRepository {
    private final JdbcTemplate jdbc;

    public ApiTypes.PageResponse<Job> list(long user, int page, int size, String search) {
        String query = search == null ? "" : search.trim();
        String like = "%" + query.toLowerCase() + "%";
        long total = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM job_applications
            WHERE user_id=? AND deleted_at IS NULL
              AND (?='' OR LOWER(company_name) LIKE ? OR LOWER(position_title) LIKE ? OR LOWER(COALESCE(location,'')) LIKE ?)
            """, Long.class, user, query, like, like, like);
        List<Job> rows = jdbc.query("""
            SELECT id,company_name,position_title,location,job_url,salary,employment_type,status,priority,
                   deadline,contact_name,contact_email,notes,created_at,updated_at,version
            FROM job_applications
            WHERE user_id=? AND deleted_at IS NULL
              AND (?='' OR LOWER(company_name) LIKE ? OR LOWER(position_title) LIKE ? OR LOWER(COALESCE(location,'')) LIKE ?)
            ORDER BY (deadline IS NULL),deadline ASC,updated_at DESC,id DESC
            LIMIT ? OFFSET ?
            """, (rs, n) -> map(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5),
                rs.getString(6), rs.getString(7), rs.getString(8), rs.getString(9), rs.getDate(10), rs.getString(11),
                rs.getString(12), rs.getString(13), rs.getTimestamp(14), rs.getTimestamp(15), rs.getLong(16)),
            user, query, like, like, like, size, page * size);
        return new ApiTypes.PageResponse<>(rows,
            new ApiTypes.PageMeta(page, size, total, totalPages(total, size)));
    }

    public Job find(long user, long id, boolean lock) {
        return jdbc.query("""
            SELECT id,company_name,position_title,location,job_url,salary,employment_type,status,priority,
                   deadline,contact_name,contact_email,notes,created_at,updated_at,version
            FROM job_applications
            WHERE user_id=? AND id=? AND deleted_at IS NULL
            """ + (lock ? " FOR UPDATE" : ""), (rs, n) -> map(rs.getLong(1), rs.getString(2), rs.getString(3),
            rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8), rs.getString(9),
            rs.getDate(10), rs.getString(11), rs.getString(12), rs.getString(13), rs.getTimestamp(14),
            rs.getTimestamp(15), rs.getLong(16)), user, id).stream().findFirst().orElse(null);
    }

    public long insert(long user, JobCreate value) {
        var keys = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement("""
            INSERT INTO job_applications(user_id,company_name,position_title,location,job_url,salary,employment_type,
                status,priority,deadline,contact_name,contact_email,notes,created_by,updated_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, java.sql.Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, user);
            statement.setString(2, value.companyName());
            statement.setString(3, value.positionTitle());
            statement.setString(4, value.location());
            statement.setString(5, value.jobUrl());
            statement.setString(6, value.salary());
            statement.setString(7, value.employmentType());
            statement.setString(8, value.status());
            statement.setString(9, value.priority());
            if (value.deadline() == null) statement.setDate(10, null); else statement.setDate(10, java.sql.Date.valueOf(value.deadline()));
            statement.setString(11, value.contactName());
            statement.setString(12, value.contactEmail());
            statement.setString(13, value.notes());
            statement.setLong(14, user);
            statement.setLong(15, user);
            return statement;
        }, keys);
        if (keys.getKey() == null) throw new IllegalStateException("Could not create job application");
        return keys.getKey().longValue();
    }

    public int update(long user, long id, JobUpdate value) {
        return jdbc.update("""
            UPDATE job_applications
            SET company_name=?,position_title=?,location=?,job_url=?,salary=?,employment_type=?,status=?,priority=?,
                deadline=?,contact_name=?,contact_email=?,notes=?,updated_by=?,version=version+1
            WHERE user_id=? AND id=? AND version=? AND deleted_at IS NULL
            """, value.companyName(), value.positionTitle(), value.location(), value.jobUrl(), value.salary(),
            value.employmentType(), value.status(), value.priority(), value.deadline(), value.contactName(),
            value.contactEmail(), value.notes(), user, user, id, value.version());
    }

    public int delete(long user, long id, long version) {
        return jdbc.update("""
            UPDATE job_applications
            SET deleted_at=CURRENT_TIMESTAMP(6),updated_by=?,version=version+1
            WHERE user_id=? AND id=? AND version=? AND deleted_at IS NULL
            """, user, user, id, version);
    }

    private Job map(long id, String companyName, String positionTitle, String location, String jobUrl, String salary,
                    String employmentType, String status, String priority, Date deadline, String contactName,
                    String contactEmail, String notes, Timestamp createdAt, Timestamp updatedAt, long version) {
        return new Job(id, companyName, positionTitle, location, jobUrl, salary, employmentType, status, priority,
            deadline == null ? null : deadline.toLocalDate(), contactName, contactEmail, notes,
            instant(createdAt), instant(updatedAt), version);
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private static int totalPages(long total, int size) {
        return (int) Math.max(1, (total + size - 1) / size);
    }
}
