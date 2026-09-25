package com.kira.bank.creditcard.web;

import com.kira.bank.creditcard.application.CardRecommendationService;
import com.kira.bank.creditcard.application.CardTransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;

import static com.kira.bank.creditcard.application.CardTransactionDtos.*;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CardTransactionController {
    private final CardTransactionService transactions;
    private final CardRecommendationService recommendations;

    @GetMapping("/credit-cards/{cardId}/transactions")
    PageResponse<TransactionResponse> list(@AuthenticationPrincipal Long u, @PathVariable Long cardId,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
                                           @PageableDefault(size = 50, sort = "transactionDate", direction = Sort.Direction.DESC) Pageable p) {
        return transactions.list(u, cardId, fromDate, toDate, p);
    }

    @PostMapping("/credit-cards/{cardId}/transactions")
    @ResponseStatus(HttpStatus.CREATED)
    TransactionResponse create(@AuthenticationPrincipal Long u, @PathVariable Long cardId,
                               @RequestHeader("Idempotency-Key") String key,
                               @Valid @RequestBody ManualTransactionRequest r) {
        return transactions.createManual(u, cardId, key, r);
    }

    @PatchMapping("/card-transactions/{id}")
    TransactionResponse updateCategory(@AuthenticationPrincipal Long u, @PathVariable Long id,
                                       @Valid @RequestBody CategoryUpdateRequest r) {
        return transactions.updateCategory(u, id, r);
    }

    @DeleteMapping("/card-transactions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Long u, @PathVariable Long id, @RequestParam Long version) {
        transactions.delete(u, id, version);
    }

    @GetMapping("/credit-cards/{cardId}/cashback-progress")
    CashbackProgressResponse progress(@AuthenticationPrincipal Long u, @PathVariable Long cardId) {
        return transactions.progress(u, cardId);
    }

    @GetMapping("/credit-card-recommendations")
    RecommendationResponse recommend(@AuthenticationPrincipal Long u, @RequestParam String mcc,
                                     @RequestParam(required = false) BigDecimal amount) {
        return recommendations.recommend(u, mcc, amount);
    }
}
