package com.kira.bank.publiccatalog.application;

import com.kira.bank.publiccatalog.infrastructure.BankRepository;
import com.kira.bank.shared.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.kira.bank.publiccatalog.application.CatalogDtos.BankDto;
import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatalogService {
    private final BankRepository banks;
    private final CatalogMapper mapper;

    public PageResponse<BankDto> banks(String q, Pageable p) {
        return page(banks.search(q == null ? "" : q.trim(), p).map(mapper::toDto));
    }

    public BankDto bank(long id) {
        return mapper.toDto(banks.findById(id)
            .filter(b -> b.isActive() && b.getDeletedAt() == null)
            .orElseThrow(() -> notFound("BANK_NOT_FOUND")));
    }

    private <T> PageResponse<T> page(Page<T> p) {
        return new PageResponse<>(p.getContent(),
            new PageMeta(p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages()));
    }

    private ApiException notFound(String code) {
        return new ApiException(HttpStatus.NOT_FOUND, code, "Không tìm thấy dữ liệu");
    }
}
