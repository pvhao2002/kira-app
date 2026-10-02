package com.kira.farm.it;

import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import javax.sql.DataSource;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Test-only SQL statement counter: wraps the DataSource in JDK proxies (no production dependency) and counts every
 * execute* call. Requests are served on other threads, so the counter is global; ITs that measure must not run
 * requests concurrently (JUnit runs them sequentially).
 */
public final class SqlCounter {
    private static final AtomicInteger COUNT = new AtomicInteger();
    private static final List<String> LOG = new CopyOnWriteArrayList<>();
    private static final Set<String> EXEC = Set.of("execute", "executeQuery", "executeUpdate", "executeLargeUpdate",
        "executeBatch", "executeLargeBatch");

    private SqlCounter() {
    }

    public static void reset() {
        COUNT.set(0);
        LOG.clear();
    }

    public static int count() {
        return COUNT.get();
    }

    public static List<String> statements() {
        return List.copyOf(LOG);
    }

    @TestConfiguration(proxyBeanMethods = false)
    public static class Config {
        @Bean
        static BeanPostProcessor sqlCountingDataSource() {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessAfterInitialization(Object bean, String name) {
                    return bean instanceof DataSource ds ? wrap(ds) : bean;
                }
            };
        }
    }

    private static DataSource wrap(DataSource ds) {
        return (DataSource) Proxy.newProxyInstance(SqlCounter.class.getClassLoader(), new Class<?>[]{DataSource.class},
            (proxy, m, args) -> {
                Object r = call(ds, m, args);
                return r instanceof Connection c ? wrapConnection(c) : r;
            });
    }

    private static Connection wrapConnection(Connection c) {
        return (Connection) Proxy.newProxyInstance(SqlCounter.class.getClassLoader(), new Class<?>[]{Connection.class},
            (proxy, m, args) -> {
                Object r = call(c, m, args);
                if (r instanceof PreparedStatement ps)
                    return wrapStatement(ps, PreparedStatement.class,
                        args != null && args.length > 0 && args[0] instanceof String s ? s : null);
                if (r instanceof Statement s) return wrapStatement(s, Statement.class, null);
                return r;
            });
    }

    private static Object wrapStatement(Statement s, Class<?> type, String sql) {
        return Proxy.newProxyInstance(SqlCounter.class.getClassLoader(), new Class<?>[]{type}, (proxy, m, args) -> {
            if (EXEC.contains(m.getName())) {
                COUNT.incrementAndGet();
                LOG.add(sql != null ? sql : args != null && args.length > 0 && args[0] instanceof String q ? q : "?");
            }
            return call(s, m, args);
        });
    }

    private static Object call(Object target, Method m, Object[] args) throws Throwable {
        try {
            return m.invoke(target, args);
        } catch (InvocationTargetException e) {
            throw e.getCause();
        }
    }
}
