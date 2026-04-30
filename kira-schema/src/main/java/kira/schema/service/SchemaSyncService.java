package kira.schema.service;

import jakarta.persistence.Embedded;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import kira.schema.config.SchemaProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import jakarta.persistence.metamodel.EntityType;
import jakarta.persistence.metamodel.Metamodel;
import jakarta.persistence.EntityManagerFactory;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service
public class SchemaSyncService {

    private static final Logger log = LoggerFactory.getLogger(SchemaSyncService.class);

    private static final String COLUMN_SQL = """
            SELECT COLUMN_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ?
              AND LOWER(TABLE_NAME) = LOWER(?)
            """;

    private final DataSource dataSource;
    private final EntityManagerFactory entityManagerFactory;
    private final JdbcTemplate jdbcTemplate;
    private final SchemaProperties properties;

    public SchemaSyncService(DataSource dataSource,
                             EntityManagerFactory entityManagerFactory,
                             JdbcTemplate jdbcTemplate,
                             SchemaProperties properties) {
        this.dataSource = dataSource;
        this.entityManagerFactory = entityManagerFactory;
        this.jdbcTemplate = jdbcTemplate;
        this.properties = properties;
    }

    public SchemaSyncResult run() {
        Metamodel metamodel = entityManagerFactory.getMetamodel();
        Map<String, Set<String>> expectedByTable = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);

        for (EntityType<?> entityType : metamodel.getEntities()) {
            Class<?> javaType = entityType.getJavaType();
            if (javaType.getAnnotation(Entity.class) == null) {
                continue;
            }
            Table tableAnn = javaType.getAnnotation(Table.class);
            if (tableAnn == null) {
                continue;
            }
            String tableName = tableAnn.name();
            if (tableName.isEmpty()) {
                tableName = javaType.getSimpleName();
            }
            expectedByTable.put(tableName, collectExpectedColumns(javaType));
        }

        String schemaName = resolveCatalog();
        boolean hasOrphans = false;

        for (Map.Entry<String, Set<String>> entry : expectedByTable.entrySet()) {
            String table = entry.getKey();
            Set<String> expected = entry.getValue();
            Map<String, String> actualByLower = fetchActualColumns(schemaName, table);
            Set<String> actualLower = actualByLower.keySet();

            Set<String> orphanLower = new LinkedHashSet<>(actualLower);
            orphanLower.removeAll(expected);

            if (orphanLower.isEmpty()) {
                continue;
            }
            hasOrphans = true;
            log.warn("Orphan columns in {}.{} (present in DB, not in JPA mapping): {}", schemaName, table,
                    orphanLower.stream().map(actualByLower::get).collect(Collectors.toList()));

            if (properties.isDropOrphanColumns()) {
                for (String low : orphanLower) {
                    String physical = actualByLower.get(low);
                    String sql = "ALTER TABLE `" + escapeIdentifier(table) + "` DROP COLUMN `" + escapeIdentifier(physical) + "`";
                    log.warn("Executing: {}", sql);
                    jdbcTemplate.execute(sql);
                }
            }
        }

        int exit = 0;
        if (hasOrphans && properties.isFailOnOrphanColumns()) {
            exit = 1;
        }
        return new SchemaSyncResult(exit, hasOrphans);
    }

    private String resolveCatalog() {
        try (Connection c = dataSource.getConnection()) {
            String catalog = c.getCatalog();
            if (catalog == null || catalog.isBlank()) {
                throw new IllegalStateException("Could not resolve catalog from DataSource connection");
            }
            return catalog;
        } catch (SQLException e) {
            throw new IllegalStateException("Could not open JDBC connection for schema resolution", e);
        }
    }

    private Map<String, String> fetchActualColumns(String schemaName, String tableName) {
        return jdbcTemplate.query(COLUMN_SQL, ps -> {
            ps.setString(1, schemaName);
            ps.setString(2, tableName);
        }, rs -> {
            Map<String, String> map = new HashMap<>();
            while (rs.next()) {
                String name = rs.getString(1);
                map.put(name.toLowerCase(Locale.ROOT), name);
            }
            return map;
        });
    }

    private static Set<String> collectExpectedColumns(Class<?> entityClass) {
        Set<String> raw = new LinkedHashSet<>();
        walkFields(entityClass, raw);
        return raw.stream()
                .map(s -> s.toLowerCase(Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static void walkFields(Class<?> clazz, Set<String> columns) {
        for (Field field : clazz.getDeclaredFields()) {
            int mod = field.getModifiers();
            if (Modifier.isStatic(mod) || field.isSynthetic() || field.isAnnotationPresent(Transient.class)) {
                continue;
            }
            if (field.isAnnotationPresent(OneToMany.class)
                    || field.isAnnotationPresent(ManyToMany.class)) {
                continue;
            }
            if (field.isAnnotationPresent(EmbeddedId.class) || field.isAnnotationPresent(Embedded.class)) {
                walkFields(field.getType(), columns);
                continue;
            }
            if (field.isAnnotationPresent(ManyToOne.class)
                    || field.isAnnotationPresent(OneToOne.class)) {
                JoinColumn jc = field.getAnnotation(JoinColumn.class);
                String name = (jc != null && jc.name() != null && !jc.name().isEmpty())
                        ? jc.name()
                        : toSnakeCase(field.getName()) + "_id";
                columns.add(name);
                continue;
            }
            jakarta.persistence.Column col = field.getAnnotation(jakarta.persistence.Column.class);
            String name = (col != null && col.name() != null && !col.name().isEmpty())
                    ? col.name()
                    : toSnakeCase(field.getName());
            columns.add(name);
        }
    }

    private static String toSnakeCase(String name) {
        return name.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase(Locale.ROOT);
    }

    private static String escapeIdentifier(String id) {
        return id.replace("`", "``");
    }
}
