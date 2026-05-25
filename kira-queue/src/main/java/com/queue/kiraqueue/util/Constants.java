package com.queue.kiraqueue.util;

import lombok.experimental.UtilityClass;

import java.util.List;

@UtilityClass
public class Constants {
    public static final String AI_SCORE_URL = "https://www.aiscore.com/";
    public static final String M_AI_SCORE_URL = "https://m.aiscore.com/";
    public static final String CRAWL_UPCOMING_EVENT = "CRAWL_UPCOMING_EVENT";
    public static final String PREDICT = "PREDICT";

    public static final String CRAWL_BY_DATE = "crawlByDate";
    public static final String CRAWL_ODD_FOR_UP_COMING_EVENT = "crawlOddForUpcomingEvent";
    public static final String CRAWLTOMORROW_EVENT = "crawlTomorrowEvent";
    public static final String EVENT = "event";
    public static final String PREDICTION = "prediction";
    public static final String AI_SCORE = "ai-score";

    public static final List<String> FIELD_EVENT_RESULT = List.of(
            "Corner Kicks", "Yellow Cards", "Fouls", "Offsides",
            "Total Shots", "Shots on target", "ht_result", "ht_goal_str",
            "ft_result", "ft_goal_str"
    );
}
