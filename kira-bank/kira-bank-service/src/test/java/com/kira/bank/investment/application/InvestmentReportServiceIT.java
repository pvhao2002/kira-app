package com.kira.bank.investment.application;

import com.kira.bank.investment.application.InvestmentReportDtos.*;
import com.kira.bank.shared.web.ApiException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.containers.MySQLContainer;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/** Runs the real report SQL against a throwaway MySQL (Testcontainers) with the project's Flyway schema. */
class InvestmentReportServiceIT {
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0");
    static JdbcTemplate jdbc;
    static InvestmentReportService service;
    static final long USER = 1, OTHER = 2;
    static long accountA, accountB, accountOther;

    @BeforeAll
    static void start() {
        mysql.start();
        // the real, complete migration set (also guards against duplicate or broken versions)
        Flyway.configure().dataSource(mysql.getJdbcUrl(), mysql.getUsername(), mysql.getPassword())
            .locations("classpath:db/migration").load().migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(mysql.getJdbcUrl(), mysql.getUsername(), mysql.getPassword()));
        service = new InvestmentReportService(jdbc);
        ReflectionTestUtils.setField(service, "timeZone", "Asia/Ho_Chi_Minh");
        jdbc.update("insert into users(id,email,password_hash,full_name) values (1,'a@x.io','x','A'),(2,'b@x.io','x','B')");
        accountA = account(USER, "Alpha", "A1", "VND");
        accountB = account(USER, "Beta", "B1", "USD");
        accountOther = account(OTHER, "Other", "O1", "VND");
        tx(accountA, USER, "DEPOSIT", "1000", "VND", "2026-01-05 10:00:00", "COMPLETED");
        tx(accountA, USER, "WITHDRAWAL", "1600", "VND", "2026-01-20 22:00:00", "COMPLETED");
        tx(accountA, USER, "BONUS", "100", "VND", "2026-02-02 09:00:00", "COMPLETED");
        tx(accountA, USER, "DEPOSIT", "500", "VND", "2026-02-03 09:00:00", "PENDING");   // must be ignored
        tx(accountB, USER, "DEPOSIT", "50", "USD", "2026-02-10 09:00:00", "COMPLETED");
        tx(accountOther, OTHER, "DEPOSIT", "9999", "VND", "2026-01-06 10:00:00", "COMPLETED"); // other user
    }

    @AfterAll
    static void stop() { mysql.stop(); }

    static long account(long user, String name, String code, String currency) {
        jdbc.update("insert into investment_accounts(user_id,account_name,account_code,currency,status) values (?,?,?,?, 'ACTIVE')",
            user, name, code, currency);
        return jdbc.queryForObject("select max(id) from investment_accounts", Long.class);
    }

    static int seq;
    static void tx(long account, long user, String type, String amount, String currency, String at, String status) {
        jdbc.update("""
            insert into investment_account_transactions(user_id,investment_account_id,transaction_type,transaction_status,amount,currency,transaction_at,deduplication_key)
            values (?,?,?,?,?,?,?,unhex(sha2(?,256)))""", user, account, type, status, amount, currency, at, "k" + seq++);
    }

    static final LocalDate FROM = LocalDate.of(2026, 1, 1), TO = LocalDate.of(2026, 2, 28);

    @Test
    void periodicIsPerCurrencyScopedToUserAndIgnoresNonCompleted() {
        Report<PeriodicReport> r = service.periodic(USER, null, FROM, TO, "month");
        assertEquals(2, r.currencies().size());
        assertEquals("VND", r.currencies().get(0).currency()); // 3 VND transactions vs 1 USD
        PeriodicReport vnd = r.currencies().stream().filter(c -> c.currency().equals("VND")).findFirst().get().data();
        assertEquals(2, vnd.rows().size());
        assertEquals(0, new BigDecimal("600").compareTo(vnd.rows().get(0).totals().net()));
        assertEquals(0, new BigDecimal("100").compareTo(vnd.totals().bonuses()));
        assertEquals(3, vnd.totals().count()); // pending + other user's rows excluded
    }

    @Test
    void accountFilterAndOwnershipAreEnforced() {
        Report<AccountsReport> r = service.accounts(USER, accountA, FROM, TO);
        assertEquals(1, r.currencies().size());
        assertEquals(1, r.currencies().get(0).data().rows().size());
        ApiException e = assertThrows(ApiException.class, () -> service.accounts(USER, accountOther, FROM, TO));
        assertEquals("INVESTMENT_ACCOUNT_NOT_FOUND", e.getCode());
    }

    @Test
    void timezoneBucketsLateEveningToTheLocalDay() {
        // 2026-01-20 22:00 local must land on Jan 20 (not shifted by a UTC conversion)
        Report<DailyReport> r = service.daily(USER, accountA, FROM, TO);
        DailyReport d = r.currencies().get(0).data();
        assertTrue(d.days().stream().anyMatch(x -> x.date().equals(LocalDate.of(2026, 1, 20))));
        Report<ActivityReport> a = service.activity(USER, accountA, FROM, TO);
        assertEquals(1, a.currencies().get(0).data().matrix()[1][22]); // Tuesday 22h
    }

    @Test
    void comparisonLoadsPreviousPeriodAndKeepsCurrenciesThatOnlyExistBefore() {
        Report<ComparisonReport> r = service.comparison(USER, null, LocalDate.of(2026, 2, 1), LocalDate.of(2026, 2, 28));
        assertEquals(LocalDate.of(2026, 1, 4), r.currencies().get(0).data().previousFrom().plusDays(0));
        var vnd = r.currencies().stream().filter(c -> c.currency().equals("VND")).findFirst().get().data();
        assertEquals(0, new BigDecimal("600").compareTo(vnd.previous().net()));
        var onlyBefore = service.comparison(USER, null, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31));
        assertTrue(onlyBefore.currencies().stream().anyMatch(c -> c.currency().equals("VND"))); // Feb-only data survives
    }

    @Test
    void rangeValidation() {
        assertThrows(ApiException.class, () -> service.periodic(USER, null, TO, FROM, "MONTH"));
        assertThrows(ApiException.class, () -> service.periodic(USER, null, FROM, TO, "HOUR"));
        assertThrows(ApiException.class, () -> service.periodic(USER, null, LocalDate.of(2019, 1, 1), TO, "MONTH"));
        assertNotNull(service.rolling(USER, null, FROM, TO));
        assertNotNull(service.equity(USER, null, FROM, TO));
        assertNotNull(service.distribution(USER, null, FROM, TO));
        assertNotNull(service.bonus(USER, null, FROM, TO));
    }

    @Test
    void dispatcherRoutesByTypeAndRejectsUnknown() {
        assertEquals("BONUS", service.report("Bonus", USER, null, FROM, TO, null).type());
        assertEquals("PERIODIC", service.report("periodic", USER, null, FROM, TO, null).type());
        ApiException e = assertThrows(ApiException.class, () -> service.report("nope", USER, null, FROM, TO, null));
        assertEquals("INVESTMENT_REPORT_TYPE_NOT_FOUND", e.getCode());
    }

    @Test
    void paybackSeasonalityAndProjectionRunAgainstRealSchema() {
        Report<PaybackReport> pb = service.payback(USER, accountA, FROM, TO);
        PaybackReport p = pb.currencies().get(0).data();
        assertTrue(p.rows().get(0).brokeEven()); // 1600 withdrawn >= 1000 deposited
        assertEquals(LocalDate.of(2026, 1, 20), p.rows().get(0).breakEvenDate());
        Report<SeasonalityReport> se = service.seasonality(USER, null, FROM, TO);
        assertEquals(12, se.currencies().get(0).data().months().size());
        Report<ProjectionReport> pr = service.projection(USER, accountA, FROM, TO);
        assertEquals(TO, pr.currencies().get(0).data().asOf());
        assertEquals(30, pr.currencies().get(0).data().observedDays());
    }

    @Test
    void goalsAreUpsertedScopedToUserAndReportedPerCurrency() {
        var saved = service.saveGoal(USER, new InvestmentReportDtos.GoalRequest("vnd", "MONTH", new BigDecimal("1000")));
        var again = service.saveGoal(USER, new InvestmentReportDtos.GoalRequest("VND", "MONTH", new BigDecimal("2000")));
        assertEquals(saved.id(), again.id()); // same (currency, period) -> updated, not duplicated
        assertEquals(0, new BigDecimal("2000").compareTo(again.targetAmount()));
        service.saveGoal(USER, new InvestmentReportDtos.GoalRequest("USD", "YEAR", new BigDecimal("50")));
        service.saveGoal(OTHER, new InvestmentReportDtos.GoalRequest("VND", "YEAR", new BigDecimal("1")));
        assertEquals("INVALID_GOAL_CURRENCY", assertThrows(ApiException.class, () -> service.saveGoal(USER, new InvestmentReportDtos.GoalRequest("EUR", "MONTH", BigDecimal.ONE))).getCode());
        assertEquals(2, service.listGoals(USER).size());
        Report<GoalsReport> r = service.goals(USER, null, FROM, LocalDate.of(2026, 2, 28));
        assertTrue(r.currencies().stream().anyMatch(c -> c.currency().equals("USD") && c.data().goals().size() == 1));
        GoalsReport vnd = r.currencies().stream().filter(c -> c.currency().equals("VND")).findFirst().get().data();
        assertEquals(1, vnd.goals().size());
        assertEquals(0, BigDecimal.ZERO.compareTo(vnd.goals().get(0).achieved())); // Feb: only a bonus (net 0); the pending deposit is ignored
        ApiException e = assertThrows(ApiException.class, () -> service.deleteGoal(OTHER, saved.id()));
        assertEquals("INVESTMENT_GOAL_NOT_FOUND", e.getCode());
        service.deleteGoal(USER, saved.id());
        assertEquals(1, service.listGoals(USER).size());
        assertThrows(Exception.class, () -> jdbc.update("insert into investment_goals(user_id,currency,period,target_amount) values (1,'VND','DAY',5)"));
    }

    @Test
    void rangeAndOwnershipAreCheckedBeforeAnyHeavyLoad() {
        ApiException wide = assertThrows(ApiException.class, () -> service.comparison(USER, null, LocalDate.of(1900, 1, 1), TO));
        assertEquals("REPORT_RANGE_TOO_LARGE", wide.getCode());
        assertThrows(ApiException.class, () -> service.comparison(USER, null, LocalDate.MIN, LocalDate.MAX)); // no DateTimeException / 500
        ApiException foreign = assertThrows(ApiException.class, () -> service.comparison(USER, accountOther, FROM, TO));
        assertEquals("INVESTMENT_ACCOUNT_NOT_FOUND", foreign.getCode());
        assertThrows(ApiException.class, () -> service.report("projection", USER, null, TO, FROM, null));
    }

    @Test
    void goalsIgnoreTheAccountFilterAndProjectionIgnoresFromDate() {
        service.saveGoal(USER, new InvestmentReportDtos.GoalRequest("USD", "YEAR", new BigDecimal("100")));
        try {
            Report<GoalsReport> all = service.goals(USER, null, FROM, TO);
            Report<GoalsReport> scoped = service.goals(USER, accountA, FROM, TO);
            var usdAll = all.currencies().stream().filter(c -> c.currency().equals("USD")).findFirst().get().data().goals().get(0).achieved();
            var usdScoped = scoped.currencies().stream().filter(c -> c.currency().equals("USD")).findFirst().get().data().goals().get(0).achieved();
            assertEquals(0, usdAll.compareTo(usdScoped)); // account A is VND-only, yet the USD goal still sees account B's deposit
            assertEquals(0, new BigDecimal("-50").compareTo(usdAll));
        } finally {
            service.listGoals(USER).stream().filter(g -> g.currency().equals("USD")).forEach(g -> service.deleteGoal(USER, g.id()));
        }
        // same asOf, very different fromDate -> identical month-to-date
        var narrow = service.projection(USER, null, TO.minusDays(2), TO).currencies().stream().filter(c -> c.currency().equals("VND")).findFirst().get().data();
        var wide = service.projection(USER, null, FROM, TO).currencies().stream().filter(c -> c.currency().equals("VND")).findFirst().get().data();
        assertEquals(0, narrow.monthToDateNet().compareTo(wide.monthToDateNet()));
        assertEquals(0, narrow.trailing90().compareTo(wide.trailing90()));
    }

    @Test
    void insightsSeeAccountsThatWentQuietBeforeTheWindow() {
        // window = last 30 days before 2026-02-28; account A's last activity was Feb 3 (25 days), B's was Feb 10
        Report<InsightsReport> r = service.insights(USER, null, LocalDate.of(2026, 2, 20), LocalDate.of(2026, 2, 28));
        assertFalse(r.currencies().isEmpty());
        assertTrue(r.currencies().stream().flatMap(c -> c.data().insights().stream()).noneMatch(i -> i.code().equals("DORMANT_ACCOUNT"))); // all < 30d
        Report<InsightsReport> later = service.insights(USER, null, LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 10));
        assertTrue(later.currencies().stream().flatMap(c -> c.data().insights().stream()).anyMatch(i -> i.code().equals("DORMANT_ACCOUNT"))); // data predates the window
    }

    @Test
    void everyReportTypeRunsAgainstTheRealSchemaAndSerialisesToJson() throws Exception {
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules()
            .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        for (String type : java.util.List.of("overview", "insights", "goals", "periodic", "accounts", "matrix", "equity", "performance", "drawdowns",
            "rolling", "daily", "activity", "distribution", "bonus", "ledger", "cadence", "lots", "allocation", "payback", "seasonality", "projection", "comparison")) {
            for (Long account : new Long[]{null, accountA}) {
                Report<?> report = service.report(type, USER, account, FROM, TO, "WEEK");
                assertEquals(type.toUpperCase(), report.type());
                assertFalse(mapper.writeValueAsString(report).isBlank(), type);
            }
        }
    }

    @Test
    void comparisonAcceptsAnExplicitComparisonWindow() {
        // February vs January (explicit) must equal the automatic preceding-window result for the same 28/31-day shape only when windows match,
        // so compare February with January 5..20 where only the 600-net VND activity (deposit Jan 5, withdrawal Jan 20) falls
        var r = service.comparison(USER, accountA, LocalDate.of(2026, 2, 1), LocalDate.of(2026, 2, 28), LocalDate.of(2026, 1, 5), LocalDate.of(2026, 1, 20));
        var vnd = r.currencies().get(0).data();
        assertEquals(LocalDate.of(2026, 1, 5), vnd.previousFrom());
        assertEquals(0, new BigDecimal("600").compareTo(vnd.previous().net()));
        assertEquals(0, BigDecimal.ZERO.compareTo(vnd.current().net())); // February: only a bonus
        assertThrows(ApiException.class, () -> service.comparison(USER, null, FROM, TO, LocalDate.of(2026, 1, 1), null));
        assertThrows(ApiException.class, () -> service.comparison(USER, null, FROM, TO, TO, FROM));
        assertEquals("COMPARISON", service.report("comparison", USER, null, FROM, TO, null, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 31)).type());
    }

    @Test
    void adminSummaryAggregatesAcrossUsersWithoutLeakingNonCompletedRows() {
        var admin = new AdminInvestmentSummaryService(jdbc);
        ReflectionTestUtils.setField(admin, "timeZone", "Asia/Ho_Chi_Minh");
        var summary = admin.summary(FROM, TO);
        var vnd = summary.currencies().stream().filter(c -> c.currency().equals("VND")).findFirst().get();
        assertEquals("VND", summary.currencies().get(0).currency()); // busiest first
        assertEquals(2, vnd.totals().users()); // USER and OTHER
        assertEquals(4, vnd.totals().transactions()); // 3 of USER's completed + 1 of OTHER's; the pending one is excluded
        assertEquals(0, new BigDecimal("10999").compareTo(vnd.totals().deposits())); // 1000 + 9999
        assertEquals(0, new BigDecimal("-9399").compareTo(vnd.totals().net())); // 1600 - 10999 (bonus excluded from net)
        assertEquals(0, new BigDecimal("10999").compareTo(vnd.months().stream().map(m -> m.deposits()).reduce(BigDecimal.ZERO, BigDecimal::add)));
        assertEquals("2026-01", vnd.months().get(0).month());
        assertEquals(OTHER, vnd.topUsers().get(0).userId()); // 9999 deposit outweighs USER's volume
        assertThrows(ApiException.class, () -> admin.summary(TO, FROM));
        assertThrows(ApiException.class, () -> admin.summary(LocalDate.of(2000, 1, 1), TO));
    }

    @Test
    void adminMonthlyBucketsAlsoWorkForZonesWithDaylightSaving() {
        var admin = new AdminInvestmentSummaryService(jdbc);
        ReflectionTestUtils.setField(admin, "timeZone", "America/New_York"); // not a fixed-offset zone -> per-month fallback
        var vnd = admin.summary(FROM, TO).currencies().stream().filter(c -> c.currency().equals("VND")).findFirst().get();
        assertEquals(0, vnd.totals().deposits().compareTo(vnd.months().stream().map(m -> m.deposits()).reduce(BigDecimal.ZERO, BigDecimal::add)));
        assertEquals(vnd.totals().transactions(), vnd.months().stream().mapToLong(m -> m.transactions()).sum());
        assertTrue(vnd.months().stream().allMatch(m -> m.month().matches("\\d{4}-\\d{2}")));
    }

    @Test
    void theCompleteMigrationSetAppliesWithUniqueVersions() {
        assertEquals(2L, jdbc.queryForObject("select count(*) from information_schema.tables where table_schema = database() and table_name in ('login_history','card_merchant_rules')", Long.class));
        assertEquals(0L, jdbc.queryForObject("select count(*) from flyway_schema_history where success = 0", Long.class));
        assertEquals(jdbc.queryForObject("select count(distinct version) from flyway_schema_history where version is not null", Long.class),
            jdbc.queryForObject("select count(*) from flyway_schema_history where version is not null", Long.class));
    }
}
