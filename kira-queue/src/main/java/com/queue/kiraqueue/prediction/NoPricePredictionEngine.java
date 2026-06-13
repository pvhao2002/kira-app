package com.queue.kiraqueue.prediction;

import com.queue.kiraqueue.dto.PredictJobMessage;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NoPricePredictionEngine extends AbstractLinePatternPredictionEngine {

    public NoPricePredictionEngine(PredictionEngineSupport support, HistoricalScoreMatcher matcher) {
        super(support, matcher);
    }

    public static String versionCode() {
        return PredictJobMessage.VERSION_NO_PRICE;
    }

    @Override
    protected List<ScoreMatchRow> findTopScores(long eventId, TargetEventOdds odds) {
        return matcher.findTopScoresNoPrice(eventId, odds);
    }

    @Override
    protected boolean hasRequiredData(TargetEventOdds odds) {
        return PredictionEngineSupport.hasRequiredOpenPrematchLines(odds);
    }

    @Override
    protected String missingRequirementsMessage(TargetEventOdds odds) {
        if (!PredictionEngineSupport.hasRequiredHdcOuLines(odds)) {
            return "Missing required open or pre-match hdc/ou lines";
        }
        return "Missing required open or pre-match corner lines";
    }
}
