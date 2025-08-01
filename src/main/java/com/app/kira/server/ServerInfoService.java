package com.app.kira.server;

import com.app.kira.dto.predict.ProxyDTO;
import com.app.kira.spring.ApplicationContextProvider;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.Getter;
import lombok.NonNull;
import lombok.extern.java.Log;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.Optional;

@Service
@Log
public class ServerInfoService implements ApplicationListener<WebServerInitializedEvent> {
    @Value("${server.servlet.context-path}")
    private String module;
    @Getter
    private String hostName;
    @Getter
    private String ipAddress;
    @Getter
    private String url;
    private final NamedParameterJdbcTemplate db;


    public ServerInfoService(JdbcTemplate db) {
        this.db = new NamedParameterJdbcTemplate(db);
    }

    @PostConstruct
    void init() {
        this.hostName = ServerUtils.getServerHostName();
        this.ipAddress = ServerUtils.getInstanceName();
    }

    @PreDestroy
    void stopInstance() {
        log.info("Stopping instance: " + hostName);
        var sql = "update router_setting set is_active = false where node = :node";
        var params = Map.of("node", hostName);
        db.update(sql, params);
        log.info("Instance stopped: " + hostName);
    }

    public ProxyDTO getProxy() {
        var sql = """
                select *
                from proxy
                where status = 'active'
                """;
        return db.query(sql, (rs, i) -> new ProxyDTO(rs)).stream().findFirst().orElse(null);
    }

    @Transactional
    public void inactiveProxy(ProxyDTO dto, String message) {
        if (dto == null) return;
        var sql = "update proxy set status = 'inactive', message = :mess where proxy_id = :proxy_id";
        var params = Map.of("proxy_id", dto.getProxyId(), "mess", message);
        db.update(sql, params);
        log.info("Proxy " + dto.getServer() + " is inactive");
    }

    @Override
    public void onApplicationEvent(@NonNull WebServerInitializedEvent event) {
        this.url = "http://" + ipAddress + ":" + event.getWebServer().getPort() + module;
        saveServerInfo();
        saveScheduledMethods();
    }

    void saveServerInfo() {
        var params = Map.of("node", hostName, "url", url);
        db.update("""
                INSERT INTO router_setting(node, url)
                VALUES (:node, :url)
                ON DUPLICATE KEY UPDATE last_update = NOW()
                , url = values(url)
                """, params);
    }

    public boolean isActive() {
        return db.queryForObject(
                "select is_active from router_setting where node = :node",
                Map.of("node", hostName),
                Boolean.class
        );
    }

    public boolean useProxy(String jobName) {
        return db.query(
                """
                               select use_proxy
                               from schedule_manager
                               where host_name = :node
                                 and schedule_name like :name
                        """,
                Map.of("node", hostName, "name", jobName),
                (rs, rn) -> rs.getBoolean("use_proxy")
        ).stream().findFirst().orElse(false);
    }

    public boolean runHeadless(String jobName) {
        return db.query(
                """
                               select run_headless
                               from schedule_manager
                               where host_name = :node
                                 and schedule_name like :name
                        """,
                Map.of("node", hostName, "name", jobName),
                (rs, rn) -> rs.getBoolean("use_proxy")
        ).stream().findFirst().orElse(false);
    }

    public boolean isScheduledMethodActive(String methodName) {
        var sql = "select status from schedule_manager where schedule_name = :schedule_name and host_name = :host_name";
        var params = Map.of(
                "schedule_name", methodName,
                "host_name", hostName
        );
        return Optional.of(db.queryForObject(sql, params, String.class))
                .map("active"::equalsIgnoreCase)
                .orElse(false);
    }

    public void saveScheduledMethods() {
        String[] beanNames = ApplicationContextProvider.getBeanDefinitionNames();
        for (String beanName : beanNames) {
            Object bean = ApplicationContextProvider.getBean(beanName);
            Class<?> targetClass = AopUtils.getTargetClass(bean);

            Method[] methods = targetClass.getDeclaredMethods();
            for (Method method : methods) {
                if (method.isAnnotationPresent(Scheduled.class)) {
                    var name = simplifyMethod(targetClass, method);
                    var sql = "insert ignore into schedule_manager(schedule_name, host_name) VALUES (:schedule_name, :host_name)";
                    var params = Map.of(
                            "schedule_name", name,
                            "host_name", hostName
                    );
                    db.update(sql, params);
                }
            }
        }
    }


    private String simplifyMethod(Class<?> targetClass, Method method) {
        return String.format("%s.%s", targetClass.getPackageName(), method.getName());
    }

    public boolean isNotActive() {
        return !isActive();
    }
}
