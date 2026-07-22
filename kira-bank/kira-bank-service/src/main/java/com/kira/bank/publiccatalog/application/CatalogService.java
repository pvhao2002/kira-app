package com.kira.bank.publiccatalog.application;

import com.kira.bank.publiccatalog.infrastructure.*;
import com.kira.bank.shared.web.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.*;
import java.time.LocalDate;
import java.util.List;

import static com.kira.bank.publiccatalog.application.CatalogDtos.*;
import static com.kira.bank.shared.web.ApiTypes.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatalogService {
    private final BankRepository banks;
    private final CardCatalogRepository cards;
    private final MccRepository mccs;
    private final CashbackRuleRepository rules;
    private final CatalogMapper mapper;

    public PageResponse<BankDto> banks(String q, Pageable p) {
        return page(banks.findByActiveTrueAndNameContainingIgnoreCase(q, p).map(mapper::toDto));
    }

    public BankDto bank(long id) {
        return mapper.toDto(banks.findById(id).filter(b -> b.isActive() && b.getDeletedAt() == null).orElseThrow(() -> notFound("BANK_NOT_FOUND")));
    }

    public PageResponse<CardDto> cards(String q, Pageable p) {
        return page(cards.findByActiveTrueAndCardNameContainingIgnoreCase(q, p).map(mapper::toDto));
    }

    public CardDto card(long id) {
        return mapper.toDto(cards.findById(id).filter(c -> c.isActive() && c.getDeletedAt() == null).orElseThrow(() -> notFound("CARD_NOT_FOUND")));
    }

    public PageResponse<MccDto> mccs(String q, String category, Pageable p) {
        return page(mccs.search(q, category, p).map(mapper::toDto));
    }

    public MccDto mcc(long id) {
        return mapper.toDto(mccs.findById(id).filter(m -> m.isActive() && m.getDeletedAt() == null).orElseThrow(() -> notFound("MCC_NOT_FOUND")));
    }

    public List<FinderResult> finder(long mccId, BigDecimal amount) {
        if (amount.signum() <= 0)
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_AMOUNT", "Số tiền phải lớn hơn 0");
        return rules.findCurrent(mccId, LocalDate.now()).stream().map(r -> {
            BigDecimal eligible = r.getEligibleAmountLimit() == null ? amount : amount.min(r.getEligibleAmountLimit());
            BigDecimal raw = eligible.multiply(r.getCashbackRate()).setScale(4, RoundingMode.HALF_UP);
            BigDecimal estimate = r.getCashbackCap() == null ? raw : raw.min(r.getCashbackCap());
            return new FinderResult(r.getId(), mapper.toDto(r.getCardCatalog()), mapper.toDto(r.getMcc()), r.getCashbackRate(), estimate, r.getCashbackCap(), eligible, r.getConditions(), r.getExclusions());
        }).toList();
    }

    private <T> PageResponse<T> page(Page<T> p) {
        return new PageResponse<>(p.getContent(), new PageMeta(p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages()));
    }

    private ApiException notFound(String code) {
        return new ApiException(HttpStatus.NOT_FOUND, code, "Không tìm thấy dữ liệu");
    }
}

