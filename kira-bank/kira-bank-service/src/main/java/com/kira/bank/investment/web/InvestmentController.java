package com.kira.bank.investment.web;

import com.kira.bank.investment.application.InvestmentService;
import com.kira.bank.investment.application.InvestmentTransactionImportDtos.ConfirmBatchRequest;
import com.kira.bank.investment.application.InvestmentTransactionImportService;
import com.kira.bank.investment.domain.InvestmentTransactionStatus;
import com.kira.bank.investment.domain.InvestmentTransactionType;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

import static com.kira.bank.investment.application.InvestmentDtos.*;

@RestController
@RequestMapping("/api/v1/investment")
@RequiredArgsConstructor
public class InvestmentController {
    private final InvestmentService service;
    private final InvestmentTransactionImportService transactionImports;

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

}
