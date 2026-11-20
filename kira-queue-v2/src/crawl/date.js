import { asArray } from '../util.js';
import * as defaultProto from '../protobuf.js';
import { mapDatabaseEvent } from '../mapper/match.js';

// Template literal, not String.replace('%s', v): replace() expands `$&`/`$'`/`$$` in v.
const dateUrl = (date) => `https://api.aiscore.com/v1/web/api/matches?lang=2&sport_id=1&date=${date}&tz=07:00`;

/** Port of DateCrawlService. */
export function createDateCrawler({ browser, fetchClient, proto = defaultProto, mapEvent = mapDatabaseEvent }) {
  function mapMatches(date, body) {
    const decoded = proto.decodeMatches(body);
    const matches = asArray(decoded.matches);
    return {
      date,
      sportId: 1,
      lang: 2,
      tz: '07:00',
      total: matches.length,
      events: matches.map((m) => mapEvent(m, decoded)),
      aiscoreRaw: null,
    };
  }

  async function crawlDate(date) {
    const url = dateUrl(date);
    const body = await browser.getLane('date').withPage((page) => fetchClient.fetchOptional(page, url));
    return mapMatches(date, body);
  }

  return { crawlDate, mapMatches };
}
