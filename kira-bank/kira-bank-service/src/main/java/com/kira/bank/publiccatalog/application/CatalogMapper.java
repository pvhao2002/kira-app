package com.kira.bank.publiccatalog.application;

import com.kira.bank.publiccatalog.domain.Bank;
import org.mapstruct.Mapper;

import static com.kira.bank.publiccatalog.application.CatalogDtos.BankDto;

@Mapper(componentModel = "spring")
public interface CatalogMapper {
    BankDto toDto(Bank bank);
}
