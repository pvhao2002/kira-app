package com.queue.kiraqueue.playwright;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PlaywrightManager {
    private final Map<String, PlaywrightLane> laneMap = new ConcurrentHashMap<>();
    private static final String DATE_LANE = "date";
    private static final String EVENT_LANE = "event";

    public PlaywrightManager() {
//        laneMap.put(DATE_LANE, new PlaywrightLane(DATE_LANE));
        laneMap.put(EVENT_LANE, new PlaywrightLane(EVENT_LANE));
    }

    public PlaywrightLane getLane(String lane) {
        return laneMap.get(lane);
    }

    public PlaywrightLane getLaneByDate() {
        return laneMap.get(DATE_LANE);
    }

    public PlaywrightLane getEventLane() {
        return laneMap.get(EVENT_LANE);
    }

    public void closeAllLanes() {
        laneMap.values().forEach(PlaywrightLane::close);
        laneMap.clear();
    }
}
