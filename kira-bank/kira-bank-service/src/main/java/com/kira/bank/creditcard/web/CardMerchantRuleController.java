package com.kira.bank.creditcard.web;

import com.kira.bank.creditcard.application.CardMerchantRuleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.kira.bank.creditcard.application.CardTransactionDtos.*;

@RestController
@RequestMapping("/api/v1/card-merchant-rules")
@RequiredArgsConstructor
public class CardMerchantRuleController {
    private final CardMerchantRuleService rules;

    @GetMapping
    List<MerchantRuleResponse> list(@AuthenticationPrincipal Long u) {
        return rules.list(u);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    MerchantRuleSaveResponse create(@AuthenticationPrincipal Long u, @Valid @RequestBody MerchantRuleRequest r) {
        return rules.create(u, r);
    }

    @PutMapping("/{id}")
    MerchantRuleResponse update(@AuthenticationPrincipal Long u, @PathVariable Long id,
                                @Valid @RequestBody MerchantRuleRequest r) {
        return rules.update(u, id, r);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Long u, @PathVariable Long id, @RequestParam Long version) {
        rules.delete(u, id, version);
    }
}
