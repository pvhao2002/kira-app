package com.kira.bank.publiccatalog.application;

import com.kira.bank.publiccatalog.domain.*;
import org.mapstruct.*;

import static com.kira.bank.publiccatalog.application.CatalogDtos.*;

@Mapper(componentModel = "spring")
public interface CatalogMapper {
    BankDto toDto(Bank bank);

    MccDto toDto(Mcc mcc);

    @Mapping(target = "bankId", source = "bank.id")
    @Mapping(target = "bankName", source = "bank.name")
    CardDto toDto(CardCatalog card);
}

