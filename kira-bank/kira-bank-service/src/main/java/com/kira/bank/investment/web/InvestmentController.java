package com.kira.bank.investment.web;

import com.kira.bank.investment.application.InvestmentReconciliationReportDtos.CreateReportRequest;
import com.kira.bank.investment.application.InvestmentReconciliationReportService;
import com.kira.bank.investment.application.InvestmentService;
import com.kira.bank.investment.application.InvestmentStatisticsService;
import com.kira.bank.investment.application.InvestmentStatisticsDtos.StatisticsResponse;
import com.kira.bank.investment.application.InvestmentTransactionImportDtos.ConfirmBatchRequest;
import com.kira.bank.investment.application.InvestmentTransactionImportDtos.ManualTransactionRequest;
import com.kira.bank.investment.application.InvestmentTransactionImportService;
import com.kira.bank.investment.domain.InvestmentTransactionStatus;
import com.kira.bank.investment.domain.InvestmentTransactionType;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

import static com.kira.bank.investment.application.InvestmentDtos.CreateAccountRequest;
import static com.kira.bank.investment.application.InvestmentDtos.UpdateAccountRequest;

@RestController
@RequestMapping("/api/v1/investment")
@RequiredArgsConstructor
public class InvestmentController {
    private final InvestmentService service;
    private final InvestmentTransactionImportService transactionImports;
    private final InvestmentReconciliationReportService reconciliationReports;
    private final InvestmentStatisticsService statistics;

    @PostMapping("/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    Object account(@AuthenticationPrincipal Long user, @Valid @RequestBody CreateAccountRequest r) {
        return service.createAccount(user, r);
    }

    @GetMapping("/accounts")
    Object accounts(@AuthenticationPrincipal Long user, @RequestParam(defaultValue = "") String search,
                    @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable p) {
        return service.accounts(user, search, p);
    }

    @GetMapping("/accounts/{id}")
    Object account(@AuthenticationPrincipal Long user, @PathVariable Long id) {
        return service.accountDetails(user, id);
    }

    @PutMapping("/accounts/{id}")
    Object updateAccount(@AuthenticationPrincipal Long user, @PathVariable Long id, @Valid @RequestBody UpdateAccountRequest r) {
        return service.updateAccount(user, id, r);
    }

    @PostMapping(value = "/accounts/{id}/transaction-imports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    Object importTransactions(@AuthenticationPrincipal Long user, @PathVariable Long id,
                              @RequestPart("files") List<MultipartFile> files) throws IOException {
        return transactionImports.createBatch(user, id, files);
    }

    @GetMapping("/accounts/{id}/transaction-imports/{batchId}")
    Object transactionImport(@AuthenticationPrincipal Long user, @PathVariable Long id,
                             @PathVariable String batchId) {
        return transactionImports.batch(user, id, batchId);
    }

    @PostMapping("/accounts/{id}/transaction-imports/{batchId}/files/{attachmentId}/retry")
    Object retryImportFile(@AuthenticationPrincipal Long user, @PathVariable Long id,
                           @PathVariable String batchId, @PathVariable Long attachmentId) {
        return transactionImports.retryFile(user, id, batchId, attachmentId);
    }

    @PostMapping("/accounts/{id}/transaction-imports/{batchId}/confirm")
    Object confirmTransactions(@AuthenticationPrincipal Long user, @PathVariable Long id,
                               @PathVariable String batchId, @Valid @RequestBody ConfirmBatchRequest request) {
        return transactionImports.confirm(user, id, batchId, request);
    }

    @GetMapping("/accounts/{id}/transactions")
    Object transactions(@AuthenticationPrincipal Long user, @PathVariable Long id,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
                        @RequestParam(required = false) InvestmentTransactionType type,
                        @RequestParam(required = false) InvestmentTransactionStatus status,
                        @PageableDefault(size = 20, sort = "transactionAt", direction = Sort.Direction.DESC) Pageable p) {
        return transactionImports.transactions(user, id, fromDate, toDate, type, status, p);
    }

    @PostMapping("/accounts/{id}/manual-transactions")
    @ResponseStatus(HttpStatus.CREATED)
    Object manualTransaction(@AuthenticationPrincipal Long user, @PathVariable Long id,
                             @Valid @RequestBody ManualTransactionRequest request) {
        return transactionImports.createManual(user, id, request);
    }

    @GetMapping("/accounts/{id}/transactions/{transactionId}")
    Object transaction(@AuthenticationPrincipal Long user, @PathVariable Long id,
                       @PathVariable Long transactionId) {
        return transactionImports.transaction(user, id, transactionId);
    }

    @DeleteMapping("/accounts/{id}/transactions/{transactionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteTransaction(@AuthenticationPrincipal Long user, @PathVariable Long id,
                           @PathVariable Long transactionId) {
        transactionImports.deleteTransaction(user, id, transactionId);
    }

    @GetMapping("/accounts/{id}/statistics")
    StatisticsResponse statistics(@AuthenticationPrincipal Long user, @PathVariable Long id,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
                                  @RequestParam(required = false) InvestmentTransactionStatus status) {
        return transactionImports.statistics(user, id, fromDate, toDate, status);
    }

    @GetMapping("/statistics")
    Object statisticsOverview(@AuthenticationPrincipal Long user,
                              @RequestParam(required = false) Long accountId,
                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return statistics.overview(user, accountId, fromDate, toDate);
    }

    @GetMapping("/statistics/operations")
    Object statisticsOperations(@AuthenticationPrincipal Long user, @RequestParam(required = false) Long accountId) {
        return statistics.operations(user, accountId);
    }

    @PostMapping("/accounts/{id}/transactions/{transactionId}/reconciliation-reports")
    @ResponseStatus(HttpStatus.CREATED)
    Object createReconciliationReport(@AuthenticationPrincipal Long user, @PathVariable Long id,
                                      @PathVariable Long transactionId, @Valid @RequestBody CreateReportRequest request) {
        return reconciliationReports.create(user, id, transactionId, request);
    }

    @GetMapping("/reconciliation-reports")
    Object reconciliationReports(@AuthenticationPrincipal Long user,
                                 @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return reconciliationReports.mine(user, pageable);
    }

    @GetMapping("/reconciliation-reports/{reportId}")
    Object reconciliationReport(@AuthenticationPrincipal Long user, @PathVariable Long reportId) {
        return reconciliationReports.mineOne(user, reportId);
    }

}
