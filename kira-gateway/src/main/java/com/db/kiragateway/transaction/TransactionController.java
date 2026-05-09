package com.db.kiragateway.transaction;

import com.db.kiragateway.transaction.dto.CreateManualTransactionRequest;
import com.db.kiragateway.transaction.dto.CreateReceiptTransactionRequest;
import com.db.kiragateway.transaction.dto.TransactionResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/transactions")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @PostMapping("/manual")
    public ResponseEntity<TransactionResponse> manual(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateManualTransactionRequest body
    ) {
        var res = transactionService.createManual(currentUserId(jwt), body);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @PostMapping("/receipt")
    public ResponseEntity<TransactionResponse> receipt(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateReceiptTransactionRequest body
    ) {
        var res = transactionService.createReceipt(currentUserId(jwt), body);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
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
