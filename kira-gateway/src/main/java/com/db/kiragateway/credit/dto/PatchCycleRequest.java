package com.db.kiragateway.credit.dto;

public record PatchCycleRequest(
        Boolean cycleStatementDone,
        Boolean cycleDuePaid
) {
}
