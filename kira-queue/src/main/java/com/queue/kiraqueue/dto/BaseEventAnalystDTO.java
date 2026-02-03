package com.queue.kiraqueue.dto;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PROTECTED)
public class BaseEventAnalystDTO {
    Long eventId;
    String eventName;
    String homeTeam;
    String awayTeam;
    String leagueName;
    String eventDate;
    String htScoreStr;
    String ftScoreStr;
    String cornerStr;
    String link;
}
