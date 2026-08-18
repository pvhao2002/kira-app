package com.kira.bank.creditcard.web;

import com.kira.bank.creditcard.application.CreditCardService;
import com.kira.bank.creditcard.application.MonthlyStatementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import static com.kira.bank.creditcard.application.CreditCardDtos.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CreditCardController {
    private final CreditCardService service;
    private final MonthlyStatementService monthlyStatements;

    @PostMapping("/credit-cards")
    @ResponseStatus(HttpStatus.CREATED)
    Object card(@AuthenticationPrincipal Long u, @Valid @RequestBody CreateCardRequest r) {
        return service.createCard(u, r);
    }

    @GetMapping("/credit-cards")
    Object cards(@AuthenticationPrincipal Long u, @RequestParam(defaultValue = "") String search,
                 @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable p) {
        return service.cards(u, search, p);
    }

    @GetMapping("/credit-cards/{id}")
    Object card(@AuthenticationPrincipal Long u, @PathVariable Long id) {
        return service.card(u, id);
    }

    @PutMapping("/credit-cards/{id}")
    Object updateCard(@AuthenticationPrincipal Long u, @PathVariable Long id, @Valid @RequestBody UpdateCardRequest r) {
        return service.updateCard(u, id, r);
    }

    @GetMapping("/credit-card-bank-limits")
    Object bankCreditLimits(@AuthenticationPrincipal Long u) {
        return service.bankCreditLimits(u);
    }

    @PutMapping("/credit-card-bank-limits/{bankId}")
    Object updateBankCreditLimit(@AuthenticationPrincipal Long u, @PathVariable Long bankId,
                                 @Valid @RequestBody BankCreditLimitUpdateRequest r) {
        return service.updateBankCreditLimit(u, bankId, r);
    }

    @PutMapping("/credit-card-bank-balances/{bankId}")
    Object updateBankBalance(@AuthenticationPrincipal Long u, @PathVariable Long bankId,
                             @Valid @RequestBody BankBalanceUpdateRequest r) {
        return service.updateBankBalance(u, bankId, r);
    }

    @PutMapping("/credit-cards/{id}/billing-cycle")
    Object updateBillingCycle(@AuthenticationPrincipal Long u, @PathVariable Long id,
                              @Valid @RequestBody BillingCycleUpdateRequest r) {
        return monthlyStatements.updateCurrentCycle(u, id, r);
    }

    @PostMapping("/statements")
    @ResponseStatus(HttpStatus.CREATED)
    Object statement(@AuthenticationPrincipal Long u, @Valid @RequestBody StatementRequest r) {
        return service.statement(u, r);
    }

    @GetMapping("/statements")
    Object statements(@AuthenticationPrincipal Long u, @PageableDefault(size = 20, sort = "dueDate", direction = Sort.Direction.DESC) Pageable p) {
        return service.statements(u, p);
    }

    @PostMapping("/statements/{id}/payments")
    Object pay(@AuthenticationPrincipal Long u, @PathVariable Long id, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody PaymentRequest r) {
        return service.pay(u, id, key, r);
    }

    @GetMapping("/payments")
    Object payments(@AuthenticationPrincipal Long u, @PageableDefault(size = 20, sort = "paymentDate", direction = Sort.Direction.DESC) Pageable p) {
        return service.payments(u, p);
    }

}
