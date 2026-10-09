package com.kira.bank.investment.web;

import com.kira.bank.investment.application.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Web-layer wiring only (parameter binding, validation); filters are off so the principal is null. */
@WebMvcTest(InvestmentController.class)
@AutoConfigureMockMvc(addFilters = false)
class InvestmentReportControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean com.kira.bank.identity.application.JwtService jwtService; // required by the security filter bean the slice still creates
    @MockitoBean com.kira.bank.identity.infrastructure.UserRepository userRepository;
    @MockitoBean InvestmentReportService reports;
    @MockitoBean InvestmentService service;
    @MockitoBean InvestmentTransactionImportService imports;
    @MockitoBean InvestmentReconciliationReportService reconciliation;
    @MockitoBean InvestmentStatisticsService statistics;

    @Test
    void bindsDatesGranularityAccountAndComparisonWindow() throws Exception {
        mvc.perform(get("/api/v1/investment/reports/periodic").param("accountId", "7").param("fromDate", "2026-01-01").param("toDate", "2026-03-31")
            .param("granularity", "WEEK").param("compareFromDate", "2025-01-01").param("compareToDate", "2025-03-31")).andExpect(status().isOk());
        verify(reports).report("periodic", null, 7L, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31), "WEEK",
            LocalDate.of(2025, 1, 1), LocalDate.of(2025, 3, 31));
    }

    @Test
    void optionalParametersDefaultToNull() throws Exception {
        mvc.perform(get("/api/v1/investment/reports/overview")).andExpect(status().isOk());
        verify(reports).report(eq("overview"), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull());
    }

    @Test
    void rejectsMalformedDates() throws Exception {
        mvc.perform(get("/api/v1/investment/reports/overview").param("fromDate", "01/02/2026")).andExpect(status().isBadRequest());
        verifyNoInteractions(reports);
    }

    @Test
    void goalRequestsAreValidatedBeforeReachingTheService() throws Exception {
        String bad = "{\"currency\":\"VN\",\"period\":\"WEEK\",\"targetAmount\":-1}";
        mvc.perform(put("/api/v1/investment/goals").contentType(MediaType.APPLICATION_JSON).content(bad)).andExpect(status().isBadRequest());
        verify(reports, never()).saveGoal(any(), any());
        mvc.perform(put("/api/v1/investment/goals").contentType(MediaType.APPLICATION_JSON)
            .content("{\"currency\":\"VND\",\"period\":\"MONTH\",\"targetAmount\":1000}")).andExpect(status().isOk());
        verify(reports).saveGoal(isNull(), eq(new InvestmentReportDtos.GoalRequest("VND", "MONTH", new BigDecimal("1000"))));
    }

    @Test
    void deletingAGoalReturnsNoContent() throws Exception {
        mvc.perform(delete("/api/v1/investment/goals/5")).andExpect(status().isNoContent());
        verify(reports).deleteGoal(null, 5L);
    }
}
