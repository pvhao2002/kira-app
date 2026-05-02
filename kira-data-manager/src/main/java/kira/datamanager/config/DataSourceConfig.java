package kira.datamanager.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;

import javax.sql.DataSource;

@Configuration
@EnableConfigurationProperties({WritePoolProperties.class, ReadPoolProperties.class})
public class DataSourceConfig {

    @Bean(name = "writeDataSource")
    @Primary
    public DataSource writeDataSource(WritePoolProperties p) {
        return buildPool(p.getUrl(), p.getUsername(), p.getPassword(), p.getDriverClassName());
    }

    @Bean(name = "readDataSource")
    public DataSource readDataSource(ReadPoolProperties p) {
        return buildPool(p.getUrl(), p.getUsername(), p.getPassword(), p.getDriverClassName());
    }

    private static DataSource buildPool(String url, String username, String password, String driverClassName) {
        var ds = new HikariDataSource();
        ds.setJdbcUrl(url);
        ds.setUsername(username);
        ds.setPassword(password);
        ds.setDriverClassName(driverClassName);
        return ds;
    }

    @Bean(name = "writeJdbcClient")
    @Primary
    public JdbcClient writeJdbcClient(@Qualifier("writeDataSource") DataSource dataSource) {
        return JdbcClient.create(dataSource);
    }

    @Bean(name = "readJdbcClient")
    public JdbcClient readJdbcClient(@Qualifier("readDataSource") DataSource dataSource) {
        return JdbcClient.create(dataSource);
    }
}
