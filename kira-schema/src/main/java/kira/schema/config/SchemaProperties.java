package kira.schema.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "kira.schema")
public class SchemaProperties {

    /**
     * When true, columns present in the database but absent from JPA mappings are dropped (destructive).
     */
    private boolean dropOrphanColumns = false;

    /**
     * When true, exit with non-zero status if orphan columns are detected (even when not dropped).
     */
    private boolean failOnOrphanColumns = false;
}
