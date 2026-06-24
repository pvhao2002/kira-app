package com.queue.kiraqueue.playwright;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PlaywrightManager {
    private final Map<String, PlaywrightLane> laneMap = new ConcurrentHashMap<>();
    private static final String DATE_LANE = "date";
    private static final String EVENT_LANE = "event";

    public PlaywrightLane getLane(String lane) {
        return laneMap.computeIfAbsent(lane, PlaywrightLane::new);
    }

    public PlaywrightLane getLaneByDate() {
        return getLane(DATE_LANE);
    }

    public PlaywrightLane getEventLane() {
        return getLane(EVENT_LANE);
    }

    public void closeAllLanes() {
        laneMap.values().forEach(PlaywrightLane::close);
        laneMap.clear();
    }
}
