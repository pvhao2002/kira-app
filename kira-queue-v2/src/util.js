// Helpers ported from kira-queue JsonRecords / JsonNodes / StringUtil (live-path subset).

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function asRecord(v) {
  return isObject(v) ? v : {};
}

export function asArray(v) {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.slice();
  if (isObject(v)) return Object.values(v);
  return [];
}

export const numberArray = (v) => asArray(v).filter((x) => typeof x === 'number').map((x) => Math.trunc(x));
export const stringArray = (v) => asArray(v).filter((x) => typeof x === 'string');

export function stringValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

/** Java Integer.parseInt semantics for text, truncation for numbers. */
export function numberValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Math.trunc(v);
  if (typeof v !== 'string' || !/^[+-]?\d+$/.test(v)) return null;
  const n = Number.parseInt(v, 10);
  return n >= -2147483648 && n <= 2147483647 ? n : null; // int32 range, like Integer.parseInt
}

export const entityId = (v) => stringValue(asRecord(v).id);

export function findById(values, id) {
  if (id === null || id === undefined) return {};
  return asArray(values).find((item) => id === stringValue(asRecord(item).id)) ?? {};
}

export function isEmptyObject(v) {
  return v === null || v === undefined || (isObject(v) && Object.keys(v).length === 0);
}

/** Java Double.parseDouble for the inputs seen in odds payloads; null when unparsable. */
export function parseDouble(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  return Number(s);
}

export const hasText = (s) => typeof s === 'string' && s.trim().length > 0;

export class BusinessException extends Error {
  constructor(message, status = 422, cause = undefined) {
    super(message);
    this.name = 'BusinessException';
    this.status = status;
    if (cause) this.cause = cause;
  }

  static notFound(message) {
    return new BusinessException(message, 404);
  }
}

export class AiscoreBadGatewayException extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiscoreBadGatewayException';
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
