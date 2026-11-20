import Decimal from 'decimal.js';
import { convertLine } from './odd-converter.js';
import { PICK, isBlank } from './support.js';

const PUSH_EPSILON = new Decimal('0.000001');
export const OUTCOME = Object.freeze({ WIN: 'WIN', LOSE: 'LOSE', VOID: 'VOID', NONE: 'NONE' });

export function settleHandicap(homeGoals, awayGoals, prematchHdcLine, pick) {
  if (!pick || pick === PICK.NONE || isBlank(prematchHdcLine)) return OUTCOME.NONE;
  if (pick !== PICK.HOME && pick !== PICK.AWAY) return OUTCOME.NONE;
  const hdcHome = convertLine(prematchHdcLine.split('#')[0]);
  const delta = new Decimal(homeGoals).plus(hdcHome).minus(awayGoals);
  if (delta.abs().lt(PUSH_EPSILON)) return OUTCOME.VOID;
  if (pick === PICK.HOME) return delta.gt(0) ? OUTCOME.WIN : OUTCOME.LOSE;
  return delta.lt(0) ? OUTCOME.WIN : OUTCOME.LOSE;
}

export function settleOverUnder(homeGoals, awayGoals, prematchOuLine, pick) {
  if (!pick || pick === PICK.NONE || isBlank(prematchOuLine)) return OUTCOME.NONE;
  if (pick !== PICK.OVER && pick !== PICK.UNDER) return OUTCOME.NONE;
  const delta = new Decimal(homeGoals + awayGoals).minus(convertLine(prematchOuLine));
  if (delta.abs().lt(PUSH_EPSILON)) return OUTCOME.VOID;
  if (pick === PICK.OVER) return delta.gt(0) ? OUTCOME.WIN : OUTCOME.LOSE;
  return delta.lt(0) ? OUTCOME.WIN : OUTCOME.LOSE;
}

export function parsePick(pick) {
  if (pick === null || pick === undefined || String(pick).trim() === '') return PICK.NONE;
  return Object.hasOwn(PICK, pick) ? pick : PICK.NONE;
}

const SQL_SELECT_UNSETTLED = `
  select ep.event_prediction_id,
         ep.hdc_pick,
         ep.ou_pick,
         ep.prematch_hdc_line,
         ep.prematch_ou_line,
         er.ft_home_goal,
         er.ft_away_goal,
         er.ft_goal_str
  from event_prediction ep
           inner join event_result er on er.event_id = ep.event_id
           inner join events e on e.event_id = ep.event_id
  where ep.status = 'completed'
    and ep.settled_at is null
    and er.ft_home_goal is not null
    and er.ft_away_goal is not null
    and (
          exists (select 1
                  from aiscore_match_status_ref r
                  where r.status_type = 'status_id'
                    and r.code = e.status_id
                    and r.sport_id = 1
                    and r.is_terminal = 1
                    and r.code not in (9, 12))
          or e.status_id = 8
          or e.status = 'FT'
      )
`;
const SQL_SELECT_UNSETTLED_BY_EVENT = `${SQL_SELECT_UNSETTLED}    and ep.event_id = :event_id\n`;
const SQL_UPDATE_OUTCOME = `
  update event_prediction
  set actual_ft_goal_str = :actual_ft_goal_str,
      result_hdc         = :result_hdc,
      result_ou          = :result_ou,
      settled_at         = current_timestamp
  where event_prediction_id = :event_prediction_id
`;

/** Port of PredictionSettleService. */
export function createSettleService({ db }) {
  async function settleRows(tx, rows) {
    for (const r of rows) {
      const home = Number(r.ft_home_goal);
      const away = Number(r.ft_away_goal);
      await tx.update(SQL_UPDATE_OUTCOME, {
        event_prediction_id: Number(r.event_prediction_id),
        actual_ft_goal_str: r.ft_goal_str ?? null,
        result_hdc: settleHandicap(home, away, r.prematch_hdc_line, parsePick(r.hdc_pick)),
        result_ou: settleOverUnder(home, away, r.prematch_ou_line, parsePick(r.ou_pick)),
      });
    }
  }

  return {
    /** One transaction per event (v1: @Transactional settleEvent). */
    settleEvent(eventId) {
      return db.withTx(async (tx) => {
        await settleRows(tx, await tx.query(SQL_SELECT_UNSETTLED_BY_EVENT, { event_id: eventId }));
      });
    },
  };
}
