package com.queue.kiraqueue.prediction;

import com.queue.kiraqueue.dto.PredictJobMessage;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class WithPricePredictionEngine extends AbstractLinePatternPredictionEngine {

    public WithPricePredictionEngine(PredictionEngineSupport support, HistoricalScoreMatcher matcher) {
        super(support, matcher);
    }

    public static String versionCode() {
        return PredictJobMessage.VERSION_WITH_PRICE;
    }

    @Override
    protected List<ScoreMatchRow> findTopScores(long eventId, TargetEventOdds odds) {
        return matcher.findTopScoresWithPrice(eventId, odds);
    }

    @Override
    protected boolean hasRequiredData(TargetEventOdds odds) {
        return PredictionEngineSupport.hasRequiredOpenPrematchLines(odds)
                && PredictionEngineSupport.hasRequiredOpenPrematchPrices(odds);
    }

    @Override
    protected String missingRequirementsMessage(TargetEventOdds odds) {
        if (!PredictionEngineSupport.hasRequiredHdcOuLines(odds)) {
            return "Missing required open or pre-match hdc/ou lines";
        }
        if (PredictionEngineSupport.hasCornerLines(odds) && !PredictionEngineSupport.hasCornerPrices(odds)) {
            return "Missing required open or pre-match corner prices";
        }
        if (!PredictionEngineSupport.isBlank(odds.openCornerLine())
                || !PredictionEngineSupport.isBlank(odds.prematchCornerLine())) {
            return "Missing required open or pre-match corner lines";
        }
        return "Missing required open or pre-match hdc/ou prices";
    }
}
