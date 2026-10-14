package com.kira.bank.telegram.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kira.bank.identity.domain.Role;
import com.kira.bank.identity.domain.User;
import com.kira.bank.identity.infrastructure.UserRepository;
import com.kira.bank.investment.application.InvestmentStatisticsService;
import com.kira.bank.storage.application.FileStorageService;
import com.kira.bank.telegram.infrastructure.TelegramClient;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.MySQLContainer;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Linking and the retry state machine against a throwaway MySQL (Testcontainers) with the project's Flyway schema. */
class TelegramBotServiceIT {
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0");
    static JdbcTemplate jdbc;
    static TelegramClient client = mock(TelegramClient.class);
    static InvestmentStatisticsService statistics = mock(InvestmentStatisticsService.class);
    static FileStorageService fileStorage = mock(FileStorageService.class);
    static TelegramBotService bot;

    @BeforeAll
    static void start() {
        mysql.start();
        Flyway.configure().dataSource(mysql.getJdbcUrl(), mysql.getUsername(), mysql.getPassword())
            .locations("classpath:db/migration").load().migrate();
        DriverManagerDataSource ds = new DriverManagerDataSource(mysql.getJdbcUrl(), mysql.getUsername(), mysql.getPassword());
        jdbc = new JdbcTemplate(ds);
        jdbc.update("insert into users(id,email,password_hash,full_name) values "
            + "(1,'a@x.io','x','A'),(2,'b@x.io','x','B'),(3,'c@x.io','x','C'),(4,'d@x.io','x','D')");
        UserRepository users = mock(UserRepository.class);
        when(users.findById(anyLong())).thenAnswer(call -> {
            User u = new User();
            u.setId(call.getArgument(0));
            u.setEmail("u@x.io");
            u.setFullName("U");
            Role admin = new Role();
            admin.setName("ROLE_ADMIN");
            u.getRoles().add(admin);
            return Optional.of(u);
        });
        when(client.configured()).thenReturn(true);
        bot = new TelegramBotService(new ObjectMapper(), jdbc, new TransactionTemplate(new DataSourceTransactionManager(ds)),
            users, null, null, statistics, fileStorage, client);
    }

    @AfterAll
    static void stop() {
        mysql.stop();
    }

    static void update(long id, long chat, String messageFields) {
        jdbc.update("insert into telegram_updates (update_id, payload, status, next_attempt_at) values (?, ?, 'PENDING', ?)",
            id, "{\"update_id\":%d,\"message\":{\"chat\":{\"id\":%d,\"type\":\"private\"},%s}}".formatted(id, chat, messageFields),
            Timestamp.from(Instant.now().minusSeconds(5)));
    }

    static String status(long id) {
        return jdbc.queryForObject("select status from telegram_updates where update_id = ?", String.class, id);
    }

    @Test
    void linkCodeIsSingleUseAndTakesTheChatFromAnotherUser() {
        jdbc.update("insert into telegram_links (user_id, chat_id) values (2, 100)");
        String code = bot.createLinkCode(1L).code();

        update(1, 100, "\"text\":\"/login " + code.toLowerCase() + "\"");
        bot.process(1);

        assertEquals("DONE", status(1));
        assertEquals(100L, jdbc.queryForObject("select chat_id from telegram_links where user_id = 1", Long.class));
        assertNull(jdbc.queryForObject("select link_code_hash from telegram_links where user_id = 1", String.class));
        assertNull(jdbc.queryForObject("select chat_id from telegram_links where user_id = 2", Long.class));
        verify(client).send(eq(100L), startsWith("Đã liên kết"));

        update(2, 100, "\"text\":\"/login " + code + "\"");
        bot.process(2);

        assertEquals("DONE", status(2));
        verify(client).send(100L, "Mã không hợp lệ hoặc đã hết hạn");
    }

    @Test
    void transientFailureIsRetriedThenMarkedFailed() {
        jdbc.update("insert into telegram_links (user_id, chat_id) values (3, 300)");
        when(statistics.overview(eq(3L), any(), any(), any())).thenThrow(new IllegalStateException("db down"));
        update(10, 300, "\"text\":\"/statistic\"");

        for (int attempt = 1; attempt <= 3; attempt++) {
            jdbc.update("update telegram_updates set next_attempt_at = ? where update_id = 10",
                Timestamp.from(Instant.now().minusSeconds(5)));
            bot.process(10);
            assertEquals(attempt < 3 ? "PENDING" : "FAILED", status(10));
        }

        assertEquals(3, jdbc.queryForObject("select attempts from telegram_updates where update_id = 10", Integer.class));
        verify(client, times(1)).send(300L, "Có lỗi, thử lại sau");
    }

    @Test
    void oversizedDocumentIsRejectedBeforeDownload() throws Exception {
        jdbc.update("insert into telegram_links (user_id, chat_id) values (4, 400)");
        update(20, 400, "\"caption\":\"/upload r2\",\"document\":{\"file_id\":\"f\",\"file_name\":\"big.zip\","
            + "\"mime_type\":\"application/zip\",\"file_size\":26214400}");

        bot.process(20);

        assertEquals("DONE", status(20));
        verify(client).send(400L, "File tối đa 10 MB");
        verify(client, never()).download(anyString(), anyLong());
        verifyNoInteractions(fileStorage);
    }
}
