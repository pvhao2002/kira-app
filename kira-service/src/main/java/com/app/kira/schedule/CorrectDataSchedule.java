package com.app.kira.schedule;

import com.app.kira.service.CorrectService;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@Log
@RequiredArgsConstructor
public class CorrectDataSchedule {
    private final CorrectService correctService;

//    @Scheduled(cron = "0 0 5,7 * * *", zone = "Asia/Ho_Chi_Minh") // Every day at 7 AM
    public void correctLeague() {
        correctService.correctLeagueForEventAnalyst();
    }
}
