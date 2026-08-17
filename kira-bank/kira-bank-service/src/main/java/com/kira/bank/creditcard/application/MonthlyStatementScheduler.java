package com.kira.bank.creditcard.application;

import com.kira.bank.creditcard.infrastructure.UserCreditCardRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

@Component
@RequiredArgsConstructor
public class MonthlyStatementScheduler {
    private static final Logger log = LoggerFactory.getLogger(MonthlyStatementScheduler.class);
    private static final int BATCH_SIZE = 100;

    private final UserCreditCardRepository cards;
    private final MonthlyStatementService monthlyStatements;

    @Value("${CARD_STATEMENT_JOB_TIME_ZONE:Asia/Bangkok}")
    private String timeZone;

    @Scheduled(cron = "${CARD_STATEMENT_JOB_CRON:0 5 0 * * *}",
        zone = "${CARD_STATEMENT_JOB_TIME_ZONE:Asia/Bangkok}")
    @PostConstruct
    public void createCurrentMonthlyStatements() {
        LocalDate today = LocalDate.now(ZoneId.of(timeZone));
        int page = 0;
        Slice<com.kira.bank.creditcard.domain.UserCreditCard> batch;
        do {
            batch = cards.findByStatusAndDeletedAtIsNull(
                "ACTIVE", PageRequest.of(page++, BATCH_SIZE, Sort.by(Sort.Direction.ASC, "id")));
            for (var card : batch.getContent()) {
                try {
                    monthlyStatements.ensureCurrentCycle(card.getId(), today);
                } catch (DataIntegrityViolationException duplicate) {
                    log.debug("Monthly statement already exists for card {}", card.getId());
                } catch (RuntimeException ex) {
                    log.warn("Unable to prepare monthly statement for card {}: {}", card.getId(), ex.getMessage());
                }
            }
        } while (batch.hasNext());
    }
}
