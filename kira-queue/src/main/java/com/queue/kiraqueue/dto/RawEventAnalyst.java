package com.queue.kiraqueue.dto;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@EqualsAndHashCode(callSuper = true)
public class RawEventAnalyst extends BaseEventAnalystDTO {
    String oddTypeHdc;
    String lineHdc;
    String homeLineHdc;
    String awayLineHdc;
    Double homeOddsHdc;
    Double awayOddsHdc;
    String homeLineMovement;
    String awayLineMovement;

    String oddTypeOu;
    String lineOu;
    Double overOu;
    Double underOu;
    String overLineMovement;
    String underLineMovement;

    String oddTypeCorner;
    String lineCorner;
    Double overCorner;
    Double underCorner;

    Double firstHomeOdds;
    Double lastHomeOdds;
    Double firstAwayOdds;
    Double lastAwayOdds;
    Double firstOverOdds;
    Double lastOverOdds;
    Double firstUnderOdds;
    Double lastUnderOdds;
    Double firstOverCornerOdds;
    Double firstUnderCornerOdds;
    Double lastOverCornerOdds;
    Double lastUnderCornerOdds;

    String firstHdc;
    String lastHdc;
    String firstOu;
    String lastOu;
    String firstCorner;
    String lastCorner;
    Long predictId;

    String homeLogo;
    String awayLogo;
}
