import { log } from '../log.js';

const NO_JOB = Object.freeze({ eventId: null, versionCode: null });

/** Integer from a JSON number or numeric string (Jackson-style coercion for Long), else undefined. */
function toLong(v) {
  if (typeof v === 'number') return Number.isSafeInteger(v) ? v : undefined;
  if (typeof v === 'string' && /^[+-]?\d+$/.test(v.trim())) {
    const n = Number.parseInt(v.trim(), 10);
    return Number.isSafeInteger(n) ? n : undefined;
  }
  return undefined;
}

/** PredictService.parseJob: `{eventId, versionCode}` JSON or a bare event id. Never throws. */
export function parseJob(payload) {
  if (payload === null || payload === undefined || String(payload).trim() === '') return NO_JOB;
  const trimmed = String(payload).trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      const eventId = obj.eventId === null || obj.eventId === undefined ? null : toLong(obj.eventId);
      if (eventId === undefined || (obj.versionCode !== undefined && obj.versionCode !== null && typeof obj.versionCode !== 'string')) {
        throw new Error('bad field type');
      }
      return { eventId, versionCode: obj.versionCode ?? null };
    } catch {
      log.warn('Failed to parse prediction job JSON');
      return NO_JOB;
    }
  }
  const id = toLong(trimmed);
  if (id === undefined) {
    log.warn('Invalid prediction job payload');
    return NO_JOB;
  }
  return { eventId: id, versionCode: null };
}

/** Port of PredictService. */
export function createPredictService({ versionCache, registry, support }) {
  async function runVersion(eventId, versionCode) {
    const engine = registry.findEngine(versionCode);
    if (!engine) {
      log.warn(`No prediction engine registered for version: ${versionCode}`);
      return;
    }
    const version = (await versionCache.getActiveVersions()).find((v) => v.code === versionCode);
    if (!version) {
      log.warn(`Active prediction version not found: ${versionCode}`);
      return;
    }
    await engine.predict(eventId, version.predictionVersionId);
  }

  async function predict(payload) {
    const job = parseJob(payload);
    if (job.eventId === null) {
      log.warn('Prediction job missing eventId');
      return;
    }
    if (job.versionCode !== null && job.versionCode.trim() !== '') {
      await runVersion(job.eventId, job.versionCode);
      return;
    }
    const active = [...(await versionCache.getActiveVersions())].sort((a, b) => a.predictionVersionId - b.predictionVersionId);
    if (active.length === 0) {
      log.warn(`Skip prediction cleanup for event_id=${job.eventId}: no active prediction versions`);
      return;
    }
    for (const version of active) await runVersion(job.eventId, version.code);
    await support.deleteEventIfNoCurrentPredictionRows(job.eventId);
  }

  return { predict };
}

/** SettleConsumer.parseEventId: `{eventId}` JSON or a bare id; null when unusable. */
export const parseSettleEventId = (payload) => parseJob(payload).eventId;
