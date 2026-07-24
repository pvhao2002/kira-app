package com.kira.bank.publiccatalog.application;

import java.math.BigDecimal;

public final class CatalogDtos {
    private CatalogDtos() {
    }

    public record BankDto(Long id, Long vietqrId, String code, String name, String shortName, String logoUrl,
                          String bin, String swiftCode, boolean transferSupported, boolean lookupSupported,
                          String website, String hotline, String brandColor, String description) {
    }

    public record MccDto(Long id, String code, String name, String category, String description, String merchantType) {
    }

    public record CardDto(Long id, Long bankId, String bankName, String cardName, String cardCode, String cardNetwork,
                          String cardTier, BigDecimal annualFee, String currency, BigDecimal cashbackLimit,
                          String cashbackCondition, String description, String imageUrl) {
    }

    public record FinderResult(Long ruleId, CardDto card, MccDto mcc, BigDecimal rate, BigDecimal estimatedCashback,
                               BigDecimal cap, BigDecimal eligibleAmount, String conditions, String exclusions) {
    }
}
