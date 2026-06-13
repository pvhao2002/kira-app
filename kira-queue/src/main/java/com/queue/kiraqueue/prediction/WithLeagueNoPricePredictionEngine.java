package com.queue.kiraqueue.prediction;

import com.queue.kiraqueue.dto.PredictJobMessage;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class WithLeagueNoPricePredictionEngine extends AbstractLinePatternPredictionEngine {

    public WithLeagueNoPricePredictionEngine(PredictionEngineSupport support, HistoricalScoreMatcher matcher) {
        super(support, matcher);
    }

    public static String versionCode() {
        return PredictJobMessage.VERSION_WITH_LEAGUE_NO_PRICE;
    }

    @Override
    protected List<ScoreMatchRow> findTopScores(long eventId, TargetEventOdds odds) {
        return matcher.findTopScoresWithLeagueNoPrice(eventId, odds);
    }

    @Override
    protected boolean hasRequiredData(TargetEventOdds odds) {
        return odds.leagueId() != null
                && PredictionEngineSupport.hasRequiredOpenPrematchLines(odds);
    }

    @Override
    protected String missingRequirementsMessage(TargetEventOdds odds) {
        if (odds.leagueId() == null) {
            return "Missing league_id on event";
        }
        if (!PredictionEngineSupport.hasRequiredHdcOuLines(odds)) {
            return "Missing required open or pre-match hdc/ou lines";
        }
        return "Missing required open or pre-match corner lines";
    }
}
