package com.app.kira.schedule;

import com.app.kira.service.OddService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

@Log
@Service
@RequiredArgsConstructor
public class OddSchedule {
    private final OddService oddService;

    @Scheduled(fixedDelay = 1, timeUnit = TimeUnit.SECONDS, initialDelay = 5)
    public void calculateOdds() {
        log.log(Level.INFO, "Processing odds...");
        try {
            oddService.processOdds();
        } catch (Exception e) {
            log.log(Level.SEVERE, "Error processing odds", e);
        }
    }
}
