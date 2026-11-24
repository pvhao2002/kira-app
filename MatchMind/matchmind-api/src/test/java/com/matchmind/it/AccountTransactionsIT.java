package com.matchmind.it;

import java.util.UUID;
import java.util.Map;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

class AccountTransactionsIT extends IntegrationTestBase {
    @Test void sheetRetriesAreAtomicAndTheReportStaysWithTheImageOwner() throws Exception {
        UUID image = UUID.randomUUID();
        db.update("INSERT INTO account_images(id,user_id,object_key) SELECT ?,id,? FROM users WHERE username=?",
            image, image.toString(), ADMIN);
        String payload = """
            {"importId":"%s","transactions":[
            {"reference":"d","type":"CREDIT","status":"SUCCESS","amount":80,"occurredAt":"2026-11-01T18:00:00Z"},
            {"reference":"w","type":"DEBIT","status":"SUCCESS","amount":90,"occurredAt":"2026-11-20T10:00:00+07:00"},
            {"reference":"b","type":"REWARD","status":"SUCCESS","amount":5,"occurredAt":"2026-11-20T11:00:00+07:00"},
            {"reference":"wc","type":"DEBIT","status":"CANCELLED","amount":70,"occurredAt":"2026-11-21T10:00:00+07:00"}]}
            """.formatted(image);
        String endpoint = "account/transactions";
        assertThat(external("other", endpoint, payload).getResponse().getStatus()).isEqualTo(403);
        assertThat(external("sheet", endpoint, payload.replace("\"amount\":90", "\"amount\":0")).getResponse().getStatus()).isEqualTo(400);
        assertThat(db.queryForObject("SELECT count(*) FROM account_transactions WHERE import_id=?", Integer.class, image)).isZero();
        String providerId = adminPost("/api/v1/providers", Map.of("name", "Account sheet", "code", "account-sheet")).path("id").asText();
        String keys = "/api/v1/providers/" + providerId + "/keys";
        String ordinary = adminPost(keys, Map.of("label", "ordinary")).path("apiKey").asText();
        assertThat(externalWith(Map.of("X-Api-Key", ordinary), endpoint, payload).getResponse().getStatus()).isEqualTo(403);
        String scoped = adminPost(keys, Map.of("label", "sheet", "scopes", List.of("ACCOUNT_IMPORT"))).path("apiKey").asText();
        assertThat(externalWith(Map.of("X-Api-Key", scoped), endpoint, payload).getResponse().getStatus()).isEqualTo(200);
        assertThat(read(external("sheet", endpoint, payload)).path("duplicate").asBoolean()).isTrue();
        assertThat(external("sheet", endpoint, payload.replace("\"amount\":90", "\"amount\":95")).getResponse().getStatus()).isEqualTo(409);
        var account = adminGet("/api/v1/account/transactions?size=1");
        assertThat(account.path("transactions").size()).isOne();
        assertThat(account.at("/meta/totalElements").asInt()).isEqualTo(4);
        // Rewards and cancelled withdrawals stay out of deposits, withdrawals and profit.
        assertThat(account.at("/reports/allTime/profit").asInt()).isEqualTo(10);
        assertThat(account.at("/reports/allTime/withdrawals").asInt()).isEqualTo(90);
        assertThat(account.at("/reports/allTime/rewards").asInt()).isEqualTo(5);
        assertThat(account.at("/reports/allTime/depositCount").asInt()).isEqualTo(1);
        assertThat(account.at("/reports/allTime/withdrawalCount").asInt()).isEqualTo(1);
        assertThat(account.at("/reports/allTime/cancelledWithdrawalCount").asInt()).isEqualTo(1);
        assertThat(account.at("/reports/allTime/cancelledWithdrawals").asInt()).isEqualTo(70);
        assertThat(account.at("/reports/weekly/0/periodStart").asText()).isEqualTo("2026-11-16");
        assertThat(account.at("/reports/weekly/0/depositCount").asInt()).isZero();
        assertThat(account.at("/reports/weekly/0/withdrawalCount").asInt()).isEqualTo(1);
        assertThat(account.at("/reports/weekly/0/cancelledWithdrawalCount").asInt()).isEqualTo(1);
        assertThat(account.at("/reports/weekly/1/depositCount").asInt()).isEqualTo(1);
        assertThat(account.at("/reports/weekly/1/periodStart").asText()).isEqualTo("2026-11-02");
        assertThat(account.at("/reports/weekly/1/profit").asInt()).isEqualTo(-80);
        assertThat(account.at("/reports/monthly/0/deposits").asInt()).isEqualTo(80);
        adminPost("/api/v1/users", Map.of("username","accountviewer","password","viewer-password-987","role","VIEWER"));
        String viewer = login("accountviewer","viewer-password-987");
        var other = read(mvc.perform(get("/api/v1/account/transactions").header("Authorization","Bearer " + viewer)).andReturn());
        assertThat(other.path("transactions").isArray()).isTrue();
        assertThat(other.path("transactions").size()).isZero();
        assertThat(other.at("/reports/allTime/profit").asInt()).isZero();
        assertThat(other.at("/reports/allTime/cancelledWithdrawalCount").asInt()).isZero();
    }
}
