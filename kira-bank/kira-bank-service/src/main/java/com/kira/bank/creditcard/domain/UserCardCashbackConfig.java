package com.kira.bank.creditcard.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "user_card_cashback_configs")
public class UserCardCashbackConfig extends AuditedEntity {
    private Long userCardId;
    private BigDecimal monthlyCashbackCap;
}
