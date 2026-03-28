package com.app.kira.config.db;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.sql.DataSource;

@Configuration("DBConfiguration")
@EnableTransactionManagement
public class DBConfiguration {
    // temp solution for ex is main database
    @Bean
    @ExDB
    @ConfigurationProperties(prefix = "application.datasource.ex")
    public HikariConfig exHikariConfig() {
        return new HikariConfig();
    }

    @Bean
    @ExDB
    public DataSource exDataSource(@ExDB HikariConfig config) {
        return getDataSource(config);
    }

    @Bean
    @ExDB
    @Primary
    public JdbcTemplate exJdbcTemplate(@ExDB DataSource ds) {
        return new JdbcTemplate(ds);
    }

    @Bean
    @ExDB
    @Primary
    public NamedParameterJdbcTemplate exNamedParameterJdbcTemplate(@ExDB DataSource ds) {
        return new NamedParameterJdbcTemplate(this.exJdbcTemplate(ds));
    }

    @Bean
    @ExDB
    @Primary
    public JdbcClient exJdbcClient(@ExDB DataSource ds) {
        return JdbcClient.create(ds);
    }

    @Bean
    @Primary
    public DataSourceTransactionManager transactionManager(@ExDB DataSource ds) {
        var txManager = new DataSourceTransactionManager();
        txManager.setDataSource(ds);
        return txManager;
    }


    // ─── Write DB ───
    @Bean
    @WriteDB
    @ConfigurationProperties(prefix = "application.datasource.primary")
    public HikariConfig writeHikariConfig() {
        return new HikariConfig();
    }

    @Bean
    @WriteDB
    public DataSource writeDataSource(@WriteDB HikariConfig config) {
        return getDataSource(config);
    }

    private DataSource getDataSource(HikariConfig configuration) {
        return new HikariDataSource(configuration);
    }

    @Bean
    @WriteDB
    public JdbcTemplate writeJdbcTemplate(@WriteDB DataSource ds) {
        return new JdbcTemplate(ds);
    }

    @Bean
    @WriteDB
    public NamedParameterJdbcTemplate writeNamedParameterJdbcTemplate(@WriteDB DataSource ds) {
        return new NamedParameterJdbcTemplate(this.writeJdbcTemplate(ds));
    }

    @Bean
    @WriteDB
    public JdbcClient writeJdbcClient(@WriteDB DataSource ds) {
        return JdbcClient.create(ds);
    }

    // ─── Read DB ───

    @Bean
    @ReadDB
    @ConfigurationProperties(prefix = "application.datasource.replica")
    public HikariConfig readHikariConfig() {
        return new HikariConfig();
    }

    @Bean
    @ReadDB
    public DataSource readDataSource(@ReadDB HikariConfig config) {
        return getDataSource(config);
    }

    @Bean
    @ReadDB
    public JdbcTemplate readJdbcTemplate(@ReadDB DataSource ds) {
        return new JdbcTemplate(ds);
    }

    @Bean
    @ReadDB
    public NamedParameterJdbcTemplate readNamedParameterJdbcTemplate(@ReadDB DataSource ds) {
        return new NamedParameterJdbcTemplate(this.readJdbcTemplate(ds));
    }

    @Bean
    @ReadDB
    public JdbcClient readJdbcClient(@ReadDB DataSource ds) {
        return JdbcClient.create(ds);
    }

    @Bean
    public DataSourceTransactionManager readTransactionManager(@ReadDB DataSource ds) {
        var txManager = new DataSourceTransactionManager();
        txManager.setDataSource(ds);
        return txManager;
    }
}
