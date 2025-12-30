package com.app.kira.rest;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@RequestMapping("setting")
public class SettingController {
    private final NamedParameterJdbcTemplate jdbcTemplate;

    @PatchMapping("{id}/active")
    public void setActive(@PathVariable Long id) {
        updateRouter(id, true);
    }

    @PatchMapping("{id}/inactive")
    public void setInactive(@PathVariable Long id) {
        updateRouter(id, false);
    }

    @PatchMapping("schedule/{hostName}/{scheduleName}/active")
    public void setScheduleActive(@PathVariable String hostName, @PathVariable String scheduleName) {
        updateSchedule(hostName, scheduleName, true);
    }

    @PatchMapping("schedule/{hostName}/{scheduleName}/inactive")
    public void setScheduleInactive(@PathVariable String hostName, @PathVariable String scheduleName) {
        updateSchedule(hostName, scheduleName, false);
    }

    @PatchMapping("headless/{hostName}/{scheduleName}/active")
    public void setHeadlessActive(@PathVariable String hostName, @PathVariable String scheduleName) {
        updateHeadless(hostName, scheduleName, true);
    }

    @PatchMapping("headless/{hostName}/{scheduleName}/inactive")
    public void setHeadlessInactive(@PathVariable String hostName, @PathVariable String scheduleName) {
        updateHeadless(hostName, scheduleName, false);
    }

    private void updateHeadless(String hostName, String schedulename, boolean active) {
        var sql = "update schedule_manager set run_headless = :active where host_name = :host_name and schedule_name = :schedule_name";
        var params = Map.of("active", active, "host_name", hostName, "schedule_name", schedulename);
        jdbcTemplate.update(sql, params);
    }

    private void updateSchedule(String hostName, String schedulename, boolean active) {
        var status = active ? "ACTIVE" : "INACTIVE";
        var params = Map.of("status", status, "host_name", hostName, "schedule_name", schedulename);
        var sql = "update schedule_manager set status = :status where host_name = :host_name and schedule_name = :schedule_name";
        jdbcTemplate.update(sql, params);
    }

    private void updateRouter(Long id, boolean active) {
        var sql = "update router_setting set is_active = :active where crawl_setting_id = :id";
        var params = Map.of("active", active, "id", id);
        jdbcTemplate.update(sql, params);
    }

    @GetMapping
    public Object getSetting() {
        var sql = """
                select r.crawl_setting_id
                     , r.node
                     , r.is_active
                
                     , s.schedule_name
                     , if(s.status = 'ACTIVE', 1, 0) as status
                     , s.run_headless
                from router_setting r
                         inner join schedule_manager s on s.host_name = r.node
                order by r.node, s.schedule_name
                """;
        return jdbcTemplate.query(sql, BeanPropertyRowMapper.newInstance(SettingRaw.class))
                .stream()
                .collect(Collectors.groupingBy(SettingRaw::getCrawlSettingId, LinkedHashMap::new, Collectors.toList()))
                .entrySet()
                .stream()
                .map(Router::new)
                .collect(Collectors.toList());
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class SettingRaw {
        private Long crawlSettingId;
        private String node;
        private Boolean isActive;
        private String scheduleName;
        private boolean status;
        private Boolean runHeadless;
    }


    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Router {
        private Long crawlSettingId;
        private String node;
        private Boolean isActive;
        private List<Schedule> schedules;

        public Router(Map.Entry<Long, List<SettingRaw>> entry) {
            this.crawlSettingId = entry.getKey();
            this.node = entry.getValue().getFirst().getNode();
            this.isActive = entry.getValue().getFirst().getIsActive();
            this.schedules = entry.getValue().stream()
                    .map(Schedule::new)
                    .toList();
        }
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Schedule {
        private String scheduleName;
        private boolean status;
        private boolean runHeadless;

        public Schedule(SettingRaw dto) {
            this(dto.getScheduleName(), dto.isStatus(), dto.getRunHeadless());
        }
    }
}
