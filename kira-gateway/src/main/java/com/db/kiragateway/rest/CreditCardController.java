package com.db.kiragateway.rest;

import com.db.kiragateway.credit.CreditCardService;
import com.db.kiragateway.credit.dto.CreateCreditCardRequest;
import com.db.kiragateway.credit.dto.CreatePaymentRequest;
import com.db.kiragateway.credit.dto.CreditCardPaymentResponse;
import com.db.kiragateway.credit.dto.CreditCardResponse;
import com.db.kiragateway.credit.dto.CreditCardSummaryResponse;
import com.db.kiragateway.credit.dto.PatchCycleRequest;
import com.db.kiragateway.credit.dto.PaymentPageResponse;
import com.db.kiragateway.credit.dto.UpdateCreditCardRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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

@RestController
@RequestMapping("/cards")
public class CreditCardController {

    private final CreditCardService creditCardService;

    public CreditCardController(CreditCardService creditCardService) {
        this.creditCardService = creditCardService;
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
