package com.kira.bank.creditcard.web;

import com.kira.bank.creditcard.application.CreditCardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
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

    @PostMapping("/credit-cards")
    @ResponseStatus(HttpStatus.CREATED)
    Object card(@AuthenticationPrincipal Long u, @Valid @RequestBody CreateCardRequest r) {
        return service.createCard(u, r);
    }

    @GetMapping("/credit-cards")
    Object cards(@AuthenticationPrincipal Long u, @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable p) {
        return service.cards(u, p);
    }

    @PostMapping("/card-transactions")
    @ResponseStatus(HttpStatus.CREATED)
    Object tx(@AuthenticationPrincipal Long u, @Valid @RequestBody TransactionRequest r) {
        return service.transaction(u, r);
    }

    @GetMapping("/card-transactions")
    Object txs(@AuthenticationPrincipal Long u, @PageableDefault(size = 20, sort = "transactionDate", direction = Sort.Direction.DESC) Pageable p) {
        return service.transactions(u, p);
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

    @GetMapping("/cashbacks")
    Object cashbacks(@AuthenticationPrincipal Long u, @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable p) {
        return service.cashbacks(u, p);
    }

    @PostMapping("/discount-invoices")
    @ResponseStatus(HttpStatus.CREATED)
    Object invoice(@AuthenticationPrincipal Long u, @Valid @RequestBody InvoiceRequest r) {
        return service.invoice(u, r);
    }

    @GetMapping("/discount-invoices")
    Object invoices(@AuthenticationPrincipal Long u, @PageableDefault(size = 20, sort = "invoiceDate", direction = Sort.Direction.DESC) Pageable p) {
        return service.invoices(u, p);
    }
}
