package com.kira.bank.investment.web;

import com.kira.bank.investment.application.InvestmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import static com.kira.bank.investment.application.InvestmentDtos.*;

@RestController
@RequestMapping("/api/v1/investment")
@RequiredArgsConstructor
public class InvestmentController {
    private final InvestmentService service;

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

    @GetMapping("/platforms")
    Object platforms(@PageableDefault(size = 20, sort = "name") Pageable p) {
        return service.platforms(p);
    }

    @GetMapping("/deposits")
    Object deposits(@AuthenticationPrincipal Long user, @PageableDefault(size = 20, sort = "depositDate", direction = Sort.Direction.DESC) Pageable p) {
        return service.deposits(user, p);
    }

    @GetMapping("/tasks")
    Object tasks(@AuthenticationPrincipal Long user, @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable p) {
        return service.tasks(user, p);
    }

    @GetMapping("/rewards")
    Object rewards(@AuthenticationPrincipal Long user, @PageableDefault(size = 20, sort = "rewardDate", direction = Sort.Direction.DESC) Pageable p) {
        return service.rewards(user, p);
    }

    @PostMapping("/rewards")
    Object reward(@AuthenticationPrincipal Long user, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody RewardRequest r) {
        return service.reward(user, key, r);
    }

    @GetMapping("/withdrawals")
    Object withdrawals(@AuthenticationPrincipal Long user, @PageableDefault(size = 20, sort = "requestedDate", direction = Sort.Direction.DESC) Pageable p) {
        return service.withdrawals(user, p);
    }

    @PostMapping("/deposits/completed")
    Object deposit(@AuthenticationPrincipal Long user, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody DepositRequest r) {
        return service.completeDeposit(user, key, r);
    }

    @PostMapping("/tasks/allocate")
    Object task(@AuthenticationPrincipal Long user, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody TaskRequest r) {
        return service.allocate(user, key, r);
    }

    @PostMapping("/tasks/{id}/settlements")
    Object settle(@AuthenticationPrincipal Long user, @PathVariable Long id, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody SettlementRequest r) {
        return service.settle(user, id, key, r);
    }

    @PostMapping("/withdrawals")
    Object withdrawal(@AuthenticationPrincipal Long user, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody WithdrawalRequest r) {
        return service.requestWithdrawal(user, key, r);
    }

    @PostMapping("/withdrawals/{id}/complete")
    Object completeWithdrawal(@AuthenticationPrincipal Long user, @PathVariable Long id) {
        return service.completeWithdrawal(user, id);
    }

    @PostMapping("/transactions")
    @ResponseStatus(HttpStatus.CREATED)
    Object transaction(
        @AuthenticationPrincipal Long user,
        @RequestHeader(value = "Idempotency-Key", required = false) String key,
        @Valid @RequestBody CreateTransactionRequest r
    ) {
        return service.createTransaction(user, key, r);
    }

    @GetMapping("/accounts/{id}/ledger")
    Object ledger(@AuthenticationPrincipal Long user, @PathVariable Long id, @PageableDefault(size = 50, sort = "entryDate", direction = Sort.Direction.DESC) Pageable p) {
        return service.ledger(user, id, p);
    }
}
