package com.app.kira.server;

import com.app.kira.spring.ApplicationContextProvider;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
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

import java.lang.reflect.Method;
import java.text.MessageFormat;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

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
    private static final String HOST_NAME = "host_name";
    private static final String NODE = "node";

    private final LoadingCache<String, Boolean> activeConfigCache = CacheBuilder.newBuilder()
            .expireAfterAccess(10, TimeUnit.MINUTES)
            .build(CacheLoader.from(this::getActiveOfNode));

    private final LoadingCache<String, Boolean> scheduleConfigCache = CacheBuilder.newBuilder()
            .expireAfterAccess(10, TimeUnit.MINUTES)
            .build(CacheLoader.from(this::isScheduledMethodActive));

    private final LoadingCache<String, Boolean> runHeadlessConfigCache = CacheBuilder.newBuilder()
            .expireAfterAccess(10, TimeUnit.MINUTES)
            .build(CacheLoader.from(this::runHeadless));

    public ServerInfoService(JdbcTemplate db) {
        this.db = new NamedParameterJdbcTemplate(db);
    }

    @PostConstruct
    void init() {
        this.hostName = ServerUtils.getServerHostName();
        this.ipAddress = ServerUtils.getInstanceName();
        log.info("Application started on host: " + hostName + ", IP: " + ipAddress);
    }

    @PreDestroy
    void stopInstance() {
        log.info("Stopping instance: " + hostName);
        var sql = "update router_setting set is_active = false where node = :node";
        var params = Map.of(NODE, hostName);
        db.update(sql, params);
        log.info("Instance stopped: " + hostName);
    }

    @Override
    public void onApplicationEvent(@NonNull WebServerInitializedEvent event) {
        this.url = "http://" + ipAddress + ":" + event.getWebServer().getPort() + module;
        saveServerInfo();
        saveScheduledMethods();
    }

    public void clearCache() {
        activeConfigCache.invalidateAll();
        scheduleConfigCache.invalidateAll();
        runHeadlessConfigCache.invalidateAll();
    }

    void saveServerInfo() {
        var params = Map.of(NODE, hostName, "url", url);
        db.update("""
                INSERT INTO router_setting(node, url)
                VALUES (:node, :url)
                ON DUPLICATE KEY UPDATE last_update = NOW()
                , url = values(url)
                """, params);
    }

    public boolean getActiveOfNode(String node) {
        return db.query(
                "select is_active from router_setting where node = :node",
                Map.of(NODE, node),
                (rs, i) -> rs.getBoolean("is_active")
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
                (rs, rn) -> rs.getBoolean("run_headless")
        ).stream().findFirst().orElse(false);
    }

    public boolean isScheduledMethodActive(String methodName) {
        var sql = "select status from schedule_manager where schedule_name = :schedule_name and host_name = :host_name";
        var params = Map.of(
                "schedule_name", methodName,
                HOST_NAME, hostName
        );
        return db.query(sql, params, (rs, i) -> rs.getString("status"))
                .stream()
                .findFirst()
                .map("active"::equalsIgnoreCase)
                .orElse(false);
    }

    public boolean getScheduleActive(String methodName) {
        try {
            return scheduleConfigCache.get(methodName);
        } catch (Exception e) {
            log.log(Level.WARNING, MessageFormat.format("ServerInfoService >> getScheduleActive >> not found for method {0} because of {1}", methodName, e.getMessage()));
            return false;
        }
    }


    public void saveScheduledMethods() {
        var sqlDel = "delete from schedule_manager where host_name = :host_name";
        var paramsDel = Map.of(HOST_NAME, hostName);
        db.update(sqlDel, paramsDel);
        String[] beanNames = ApplicationContextProvider.getBeanDefinitionNames();
        for (String beanName : beanNames) {
            Object bean = ApplicationContextProvider.getBean(beanName);
            Class<?> targetClass = AopUtils.getTargetClass(bean);

            Method[] methods = targetClass.getDeclaredMethods();
            for (Method method : methods) {
                if (method.isAnnotationPresent(Scheduled.class)) {
                    var name = simplifyMethod(targetClass, method);
                    var sql = "insert ignore into schedule_manager(schedule_name, host_name, run_headless) VALUES (:schedule_name, :host_name, 0)";
                    var params = Map.of(
                            "schedule_name", name,
                            HOST_NAME, hostName
                    );
                    db.update(sql, params);
                }
            }
        }
    }


    private String simplifyMethod(Class<?> targetClass, Method method) {
        return String.format("%s.%s", targetClass.getCanonicalName(), method.getName());
    }

    public boolean getActiveConfig(String key) {
        try {
            return activeConfigCache.get(key);
        } catch (Exception e) {
            log.log(Level.WARNING, "SystemConfigService >> getSystemConfig >> not found because of ", e.getMessage());
            return false;
        }
    }

    public boolean isNotActive() {
        return !getActiveConfig(hostName);
    }
}
