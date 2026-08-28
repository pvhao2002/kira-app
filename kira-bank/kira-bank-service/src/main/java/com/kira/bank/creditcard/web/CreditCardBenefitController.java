package com.kira.bank.creditcard.web;

import com.kira.bank.creditcard.application.CreditCardBenefitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import static com.kira.bank.creditcard.application.CreditCardBenefitDtos.*;

@RestController
@RequestMapping("/api/v1/credit-card-benefits")
@RequiredArgsConstructor
public class CreditCardBenefitController {
    private final CreditCardBenefitService service;

    @GetMapping
    Object benefits(@AuthenticationPrincipal Long userId) {
        return service.benefits(userId);
    }

    @PutMapping("/{cardId}/monthly-cap")
    Object monthlyCap(@AuthenticationPrincipal Long userId, @PathVariable Long cardId,
                      @Valid @RequestBody MonthlyCapRequest request) {
        return service.updateMonthlyCap(userId, cardId, request);
    }

    @PostMapping("/{cardId}/programs")
    @ResponseStatus(HttpStatus.CREATED)
    Object createProgram(@AuthenticationPrincipal Long userId, @PathVariable Long cardId,
                         @Valid @RequestBody CashbackProgramRequest request) {
        return service.createProgram(userId, cardId, request);
    }

    @PutMapping("/{cardId}/programs/{programId}")
    Object updateProgram(@AuthenticationPrincipal Long userId, @PathVariable Long cardId,
                         @PathVariable Long programId, @Valid @RequestBody CashbackProgramRequest request) {
        return service.updateProgram(userId, cardId, programId, request);
    }

    @DeleteMapping("/{cardId}/programs/{programId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteProgram(@AuthenticationPrincipal Long userId, @PathVariable Long cardId,
                       @PathVariable Long programId, @Valid @RequestBody VersionRequest request) {
        service.deleteProgram(userId, cardId, programId, request);
    }
}
