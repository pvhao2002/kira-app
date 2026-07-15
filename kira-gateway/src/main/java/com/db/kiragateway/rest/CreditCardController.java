package com.db.kiragateway.rest;

import com.db.kiragateway.credit.CreditCardService;
import com.db.kiragateway.credit.CreditCardWorkspaceService;
import com.db.kiragateway.credit.dto.CreateCreditCardRequest;
import com.db.kiragateway.credit.dto.CreatePaymentRequest;
import com.db.kiragateway.credit.dto.CreditCardPaymentResponse;
import com.db.kiragateway.credit.dto.CreditCardResponse;
import com.db.kiragateway.credit.dto.CreditCardSummaryResponse;
import com.db.kiragateway.credit.dto.PatchCycleRequest;
import com.db.kiragateway.credit.dto.PaymentPageResponse;
import com.db.kiragateway.credit.dto.UpdateCreditCardRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CashbackRuleInput;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CashbackRuleResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CashbackTransactionPageResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CashbackTransactionResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CreateCashbackTransactionRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CreateMccCategoryRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.CreateStatementCycleRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.MccCategoryResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.OverviewResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.ReceiveCashbackRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.StatementCyclePageResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.StatementCycleResponse;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.UpdateCashbackRuleRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.UpdateCashbackTransactionRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.UpdateMccCategoryRequest;
import com.db.kiragateway.credit.dto.CreditCardWorkspaceDtos.UpdateStatementCycleRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.time.LocalDate;
import java.time.YearMonth;

@RestController
@RequestMapping("/cards")
public class CreditCardController {

    private final CreditCardService creditCardService;
    private final CreditCardWorkspaceService workspaceService;

    public CreditCardController(CreditCardService creditCardService, CreditCardWorkspaceService workspaceService) {
        this.creditCardService = creditCardService;
        this.workspaceService = workspaceService;
    }

    @GetMapping("/overview")
    public OverviewResponse overview(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM") YearMonth month
    ) {
        return workspaceService.overview(currentUserId(jwt), month);
    }

    @GetMapping("/cashback-transactions")
    public CashbackTransactionPageResponse cashbackTransactions(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long cardId,
            @RequestParam(required = false) Long mccCategoryId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return workspaceService.cashbackTransactions(currentUserId(jwt), cardId, mccCategoryId, status,
                from, to, page, size);
    }

    @GetMapping("/cashback-transactions/{transactionId:\\d+}")
    public CashbackTransactionResponse cashbackTransaction(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long transactionId
    ) {
        return workspaceService.cashbackTransaction(currentUserId(jwt), transactionId);
    }

    @PostMapping("/cashback-transactions")
    public ResponseEntity<CashbackTransactionResponse> createCashbackTransaction(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateCashbackTransactionRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(workspaceService.createCashbackTransaction(currentUserId(jwt), request));
    }

    @PatchMapping("/cashback-transactions/{transactionId:\\d+}")
    public CashbackTransactionResponse updateCashbackTransaction(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long transactionId,
            @Valid @RequestBody UpdateCashbackTransactionRequest request
    ) {
        return workspaceService.updateCashbackTransaction(currentUserId(jwt), transactionId, request);
    }

    @PostMapping("/cashback-transactions/{transactionId:\\d+}/receive")
    public CashbackTransactionResponse receiveCashback(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long transactionId,
            @Valid @RequestBody ReceiveCashbackRequest request
    ) {
        return workspaceService.receiveCashback(currentUserId(jwt), transactionId, request);
    }

    @PostMapping("/cashback-transactions/{transactionId:\\d+}/cancel")
    public CashbackTransactionResponse cancelCashback(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long transactionId
    ) {
        return workspaceService.cancelCashback(currentUserId(jwt), transactionId);
    }

    @GetMapping("/statement-cycles")
    public StatementCyclePageResponse statementCycles(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long cardId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM") YearMonth month,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return workspaceService.statementCycles(currentUserId(jwt), cardId, status, month, page, size);
    }

    @PostMapping("/{creditCardId:\\d+}/statement-cycles")
    public ResponseEntity<StatementCycleResponse> createStatementCycle(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId,
            @Valid @RequestBody CreateStatementCycleRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(workspaceService.createStatementCycle(currentUserId(jwt), creditCardId, request));
    }

    @PatchMapping("/{creditCardId:\\d+}/statement-cycles/{cycleId:\\d+}")
    public StatementCycleResponse updateStatementCycle(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId,
            @PathVariable long cycleId,
            @Valid @RequestBody UpdateStatementCycleRequest request
    ) {
        return workspaceService.updateStatementCycle(currentUserId(jwt), creditCardId, cycleId, request);
    }

    @GetMapping("/mcc-categories")
    public List<MccCategoryResponse> mccCategories(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "true") boolean activeOnly
    ) {
        return workspaceService.mccCategories(currentUserId(jwt), activeOnly);
    }

    @PostMapping("/mcc-categories")
    public ResponseEntity<MccCategoryResponse> createMccCategory(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateMccCategoryRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(workspaceService.createMccCategory(currentUserId(jwt), request));
    }

    @PatchMapping("/mcc-categories/{categoryId:\\d+}")
    public MccCategoryResponse updateMccCategory(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long categoryId,
            @Valid @RequestBody UpdateMccCategoryRequest request
    ) {
        return workspaceService.updateMccCategory(currentUserId(jwt), categoryId, request);
    }

    @DeleteMapping("/mcc-categories/{categoryId:\\d+}")
    public ResponseEntity<Void> deactivateMccCategory(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long categoryId
    ) {
        workspaceService.deactivateMccCategory(currentUserId(jwt), categoryId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{creditCardId:\\d+}/cashback-rules")
    public List<CashbackRuleResponse> cashbackRules(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId
    ) {
        return workspaceService.rulesForCard(currentUserId(jwt), creditCardId);
    }

    @PostMapping("/{creditCardId:\\d+}/mcc-categories/{categoryId:\\d+}/cashback-rules")
    public ResponseEntity<CashbackRuleResponse> createCashbackRule(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId,
            @PathVariable long categoryId,
            @Valid @RequestBody CashbackRuleInput request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(workspaceService.createRule(currentUserId(jwt), creditCardId, categoryId, request));
    }

    @PatchMapping("/{creditCardId:\\d+}/cashback-rules/{ruleId:\\d+}")
    public CashbackRuleResponse updateCashbackRule(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId,
            @PathVariable long ruleId,
            @Valid @RequestBody UpdateCashbackRuleRequest request
    ) {
        return workspaceService.updateRule(currentUserId(jwt), creditCardId, ruleId, request);
    }

    @DeleteMapping("/{creditCardId:\\d+}/cashback-rules/{ruleId:\\d+}")
    public ResponseEntity<Void> deactivateCashbackRule(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId,
            @PathVariable long ruleId
    ) {
        workspaceService.deactivateRule(currentUserId(jwt), creditCardId, ruleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/summary")
    public CreditCardSummaryResponse summary(@AuthenticationPrincipal Jwt jwt) {
        return creditCardService.summary(currentUserId(jwt));
    }

    @GetMapping
    public List<CreditCardResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return creditCardService.list(currentUserId(jwt));
    }

    @PostMapping
    public ResponseEntity<CreditCardResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateCreditCardRequest request
    ) {
        var body = creditCardService.create(currentUserId(jwt), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/{creditCardId:\\d+}")
    public CreditCardResponse get(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId
    ) {
        return creditCardService.get(currentUserId(jwt), creditCardId);
    }

    @PatchMapping("/{creditCardId:\\d+}")
    public CreditCardResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId,
            @Valid @RequestBody UpdateCreditCardRequest request
    ) {
        return creditCardService.update(currentUserId(jwt), creditCardId, request);
    }

    @PatchMapping("/{creditCardId:\\d+}/cycle")
    public ResponseEntity<Void> patchCycle(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId,
            @RequestBody PatchCycleRequest request
    ) {
        creditCardService.patchCycle(currentUserId(jwt), creditCardId, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{creditCardId:\\d+}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId
    ) {
        creditCardService.delete(currentUserId(jwt), creditCardId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{creditCardId:\\d+}/payments")
    public PaymentPageResponse payments(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return creditCardService.payments(currentUserId(jwt), creditCardId, page, size);
    }

    @PostMapping("/{creditCardId:\\d+}/payments")
    public ResponseEntity<CreditCardPaymentResponse> addPayment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId,
            @Valid @RequestBody CreatePaymentRequest request
    ) {
        var body = creditCardService.addPayment(currentUserId(jwt), creditCardId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @DeleteMapping("/{creditCardId:\\d+}/payments/{paymentId:\\d+}")
    public ResponseEntity<Void> deletePayment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long creditCardId,
            @PathVariable long paymentId
    ) {
        creditCardService.deletePayment(currentUserId(jwt), creditCardId, paymentId);
        return ResponseEntity.noContent().build();
    }

    private static int currentUserId(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        var uid = jwt.getClaim("uid");
        if (uid instanceof Number n && n.intValue() > 0) {
            return n.intValue();
        }
        throw new IllegalArgumentException("Missing user id in token");
    }
}
