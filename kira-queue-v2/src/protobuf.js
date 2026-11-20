import fs from 'node:fs';
import zlib from 'node:zlib';
import protobuf from 'protobufjs';
import { AiscoreBadGatewayException } from './util.js';

const PACKAGE = 'onescore.app.v1';

// Shape must match the old Java JSON tree: unset fields absent, 64-bit ints as text, enums by name,
// bytes as base64 text, no default values filled in (protobufjs toObject default).
const TO_OBJECT = { longs: String, enums: String, bytes: String };

const root = protobuf.Root.fromJSON(JSON.parse(fs.readFileSync(new URL('./protobuf.json', import.meta.url), 'utf8')));
const type = (name) => root.lookupType(`${PACKAGE}.${name}`);
const ResponseType = type('Response');

function unwrapGzip(body) {
  return body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b ? zlib.gunzipSync(body) : body;
}

function unwrapResponseData(payload) {
  try {
    const wrapper = ResponseType.toObject(ResponseType.decode(payload), TO_OBJECT);
    const data = wrapper.data;
    if (typeof data === 'string' && data.trim().length > 0) return Buffer.from(data, 'base64');
    return payload;
  } catch {
    return payload;
  }
}

function decodeMessage(name, body) {
  try {
    const inner = unwrapResponseData(unwrapGzip(Buffer.from(body)));
    const t = type(name);
    return t.toObject(t.decode(inner), TO_OBJECT);
  } catch (e) {
    throw new AiscoreBadGatewayException(`Failed to decode AiScore protobuf message ${name}: ${e.message}`);
  }
}

const orNull = (name) => (body) => (!body || body.length === 0 ? null : decodeMessage(name, body));

export const decodeMatches = (body) => decodeMessage('Matches', body);
export const decodeMatchOdds = orNull('MatchOdds');
export const decodeMatchOddsDetail = orNull('MatchOddsDetail');
