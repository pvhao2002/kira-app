package com.app.kira.schedule;

import com.app.kira.service.CorrectService;
import com.app.kira.service.OddService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Log
@RequiredArgsConstructor
public class CorrectDataSchedule {
    private final OddService oddService;
    private final CorrectService correctService;

    @Scheduled(cron = "0 0 5 * * *", zone = "Asia/Ho_Chi_Minh") // Every day at 5 AM
    @Retryable(
            retryFor = {Exception.class},
            backoff = @Backoff(delay = 20_000)
    )
    public void correctOddLine() {
        oddService.correctOddMovement();
        log.info("correctOddMovement successfully.");
    }


    @Scheduled(cron = "0 0 7 * * *", zone = "Asia/Ho_Chi_Minh") // Every day at 7 AM
    @Transactional
    public void correctLeague() {
        correctService.correctLeagueForEventAnalyst();
    }
}
