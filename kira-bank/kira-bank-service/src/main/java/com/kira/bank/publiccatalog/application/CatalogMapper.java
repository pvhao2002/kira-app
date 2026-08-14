package com.kira.bank.publiccatalog.application;

import com.kira.bank.publiccatalog.domain.*;
import org.mapstruct.Mapper;

import static com.kira.bank.publiccatalog.application.CatalogDtos.*;

@Mapper(componentModel = "spring")
public interface CatalogMapper {
    BankDto toDto(Bank bank);

    MccDto toDto(Mcc mcc);
}
