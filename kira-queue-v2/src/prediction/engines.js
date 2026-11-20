import {
  createPredictionSupport, hasRequiredOpenPrematchLines, hasRequiredOpenPrematchPrices, hasRequiredHdcOuLines,
  hasCornerLines, hasCornerPrices, isBlank,
} from './support.js';
import { createHistoricalScoreMatcher } from './matcher.js';
import { log } from '../log.js';

export const VERSION_NO_PRICE = 'NO_PRICE';
export const VERSION_WITH_PRICE = 'WITH_PRICE';
export const VERSION_WITH_LEAGUE_NO_PRICE = 'WITH_LEAGUE_NO_PRICE';

/** The three registered engines: how each finds scores and what it needs. */
export const ENGINE_SPECS = {
  [VERSION_NO_PRICE]: {
    findTopScores: (m, id, odds) => m.findTopScoresNoPrice(id, odds),
    hasRequiredData: (odds) => hasRequiredOpenPrematchLines(odds),
    missingMessage: (odds) => (!hasRequiredHdcOuLines(odds)
      ? 'Missing required open or pre-match hdc/ou lines'
      : 'Missing required open or pre-match corner lines'),
  },
  [VERSION_WITH_PRICE]: {
    findTopScores: (m, id, odds) => m.findTopScoresWithPrice(id, odds),
    hasRequiredData: (odds) => hasRequiredOpenPrematchLines(odds) && hasRequiredOpenPrematchPrices(odds),
    missingMessage: (odds) => {
      if (!hasRequiredHdcOuLines(odds)) return 'Missing required open or pre-match hdc/ou lines';
      if (hasCornerLines(odds) && !hasCornerPrices(odds)) return 'Missing required open or pre-match corner prices';
      if (!isBlank(odds.openCornerLine) || !isBlank(odds.prematchCornerLine)) return 'Missing required open or pre-match corner lines';
      return 'Missing required open or pre-match hdc/ou prices';
    },
  },
  [VERSION_WITH_LEAGUE_NO_PRICE]: {
    findTopScores: (m, id, odds) => m.findTopScoresWithLeagueNoPrice(id, odds),
    hasRequiredData: (odds) => odds.leagueId !== null && odds.leagueId !== undefined && hasRequiredOpenPrematchLines(odds),
    missingMessage: (odds) => {
      if (odds.leagueId === null || odds.leagueId === undefined) return 'Missing league_id on event';
      if (!hasRequiredHdcOuLines(odds)) return 'Missing required open or pre-match hdc/ou lines';
      return 'Missing required open or pre-match corner lines';
    },
  },
};

/** Port of AbstractLinePatternPredictionEngine. makeSupport/makeMatcher are injectable (tests, transactions). */
export function createLinePatternEngine({
  db, code, spec, makeSupport = createPredictionSupport, makeMatcher = createHistoricalScoreMatcher,
}) {
  async function computeOdds(odds, support, matcher) {
    if (!spec.hasRequiredData(odds)) return support.buildSkippedResult(spec.missingMessage(odds));
    const eventId = odds.eventId === null || odds.eventId === undefined ? -1 : odds.eventId;
    const topScores = await spec.findTopScores(matcher, eventId, odds);
    if (topScores.length === 0) return support.buildSkippedResult('No historical matches for odds pattern');
    return support.buildCompletedResult(odds, topScores);
  }

  return {
    code,
    /** compute(eventId) loads odds from the DB; compute(odds) uses the given TargetEventOdds (no DB load). */
    async compute(arg) {
      const support = makeSupport(db);
      const matcher = makeMatcher(db);
      if (arg === null || typeof arg !== 'object') {
        const odds = await support.loadTargetOdds(arg);
        if (!odds) return support.buildSkippedResult('Event not found');
        return computeOdds(odds, support, matcher);
      }
      return computeOdds(arg, support, matcher);
    },

    /** One transaction per prediction (v1: @Transactional predict). */
    predict(eventId, versionId) {
      return db.withTx(async (tx) => {
        const support = makeSupport(tx);
        const matcher = makeMatcher(tx);
        const odds = await support.loadTargetOdds(eventId);
        if (!odds) return support.updateSkipped(eventId, versionId, 'Event not found');
        if (!spec.hasRequiredData(odds)) return support.updateSkipped(eventId, versionId, spec.missingMessage(odds));
        const topScores = await spec.findTopScores(matcher, eventId, odds);
        if (topScores.length === 0) return support.updateSkipped(eventId, versionId, 'No historical matches for odds pattern');
        await support.updateCompleted(eventId, versionId, odds, topScores);
        log.info(`${code} engine completed for event_id=${eventId}, scores=${topScores.length}`);
        return undefined;
      });
    },
  };
}

/** Port of PredictionEngineRegistry: only NO_PRICE / WITH_PRICE / WITH_LEAGUE_NO_PRICE resolve. */
export function createEngineRegistry({ db, makeSupport, makeMatcher }) {
  const engines = new Map(
    Object.entries(ENGINE_SPECS).map(([code, spec]) => [code, createLinePatternEngine({ db, code, spec, makeSupport, makeMatcher })]),
  );
  return { findEngine: (versionCode) => engines.get(versionCode) ?? null };
}
