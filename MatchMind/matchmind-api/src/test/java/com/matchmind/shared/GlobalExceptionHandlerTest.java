package com.matchmind.shared;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.jdbc.UncategorizedSQLException;
import org.springframework.mock.web.MockHttpServletRequest;

import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class GlobalExceptionHandlerTest {

    @Test
    void immutableTableWriteIs500AndLogsOnlyTheTableName(CapturedOutput out) {
        var sql = new SQLException("ERROR: MM_IMMUTABLE: predictions\n  Where: PL/pgSQL function mm_forbid_change()", "P0001");
        var ex = new UncategorizedSQLException("update", "UPDATE predictions SET predicted_at = ? WHERE id = ?", sql);

        var res = new GlobalExceptionHandler().unexpected(ex, new MockHttpServletRequest("POST", "/api/v1/x"));

        assertThat(res.getStatusCode().value()).isEqualTo(500);
        assertThat(res.getBody().code()).isEqualTo("INTERNAL_ERROR");
        assertThat(out.getOut()).contains("immutable table write blocked: predictions")
            .doesNotContain("UPDATE predictions").doesNotContain("PL/pgSQL");
    }

    @Test
    void racingModelMergeChainIs409AndLogsNoRowData(CapturedOutput out) {
        var sql = new SQLException("ERROR: MM_MODEL_MERGE_CHAIN: 3f2b8f5e-0000-0000-0000-000000000001\n  Where: PL/pgSQL function", "P0001");
        var ex = new UncategorizedSQLException("update", "UPDATE ai_models SET merged_into_id = ? WHERE id = ?", sql);

        var res = new GlobalExceptionHandler().unexpected(ex, new MockHttpServletRequest("POST", "/api/v1/models/x/merge"));

        assertThat(res.getStatusCode().value()).isEqualTo(409);
        assertThat(res.getBody().code()).isEqualTo("MODEL_ALREADY_MERGED");
        assertThat(out.getOut()).doesNotContain("3f2b8f5e").doesNotContain("UPDATE ai_models");
    }
}
