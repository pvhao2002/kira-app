package com.kira.bank.publiccatalog.application;

import com.kira.bank.publiccatalog.domain.Bank;
import com.kira.bank.publiccatalog.domain.Mcc;
import org.mapstruct.Mapper;

import static com.kira.bank.publiccatalog.application.CatalogDtos.BankDto;
import static com.kira.bank.publiccatalog.application.CatalogDtos.MccDto;

@Mapper(componentModel = "spring")
public interface CatalogMapper {
    BankDto toDto(Bank bank);

    MccDto toDto(Mcc mcc);
}
