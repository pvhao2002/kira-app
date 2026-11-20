import { BusinessException } from '../util.js';
import { VERSION_NO_PRICE, VERSION_WITH_PRICE, VERSION_WITH_LEAGUE_NO_PRICE } from '../prediction/engines.js';

export const VERSION_CODES = [VERSION_NO_PRICE, VERSION_WITH_PRICE, VERSION_WITH_LEAGUE_NO_PRICE];

/** Port of OnDemandPredictService (POST /predict/events/{eventId}). */
export function createOnDemandPredictService({ crawlEventService, registry, support }) {
  return {
    async predict(eventId, recrawlOdd) {
      if (recrawlOdd) {
        await crawlEventService.recrawlOdds(eventId);
      } else if ((await support.loadTargetOdds(eventId)) === null) {
        throw BusinessException.notFound(`Event not found: ${eventId}`);
      }
      const predictions = {};
      for (const code of VERSION_CODES) {
        const engine = registry.findEngine(code);
        predictions[code] = engine
          ? await engine.compute(eventId)
          : support.buildSkippedResult(`No prediction engine registered for version: ${code}`);
      }
      return { eventId, recrawled: recrawlOdd, predictions };
    },
  };
}
