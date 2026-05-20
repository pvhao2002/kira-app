import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import * as protobuf from 'protobufjs';

@Injectable()
export class AiscoreProtobufService {
  private readonly responseType: protobuf.Type;
  private readonly matchesType: protobuf.Type;
  private readonly matchOddsType: protobuf.Type;
  private readonly webMatchOddsDetailType: protobuf.Type;
  private readonly matchOddsDetailType: protobuf.Type;
  private readonly matchTeamStatsType: protobuf.Type;

  constructor() {
    const schemaPath = join(process.cwd(), 'protobuf.json');
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as protobuf.INamespace;
    const root = protobuf.Root.fromJSON(schema);

    const responseType = root.lookupTypeOrEnum('onescore.app.v1.Response');
    const matchesType = root.lookupTypeOrEnum('onescore.app.v1.Matches');
    const matchOddsType = root.lookupTypeOrEnum('onescore.app.v1.MatchOdds');
    const webMatchOddsDetailType = root.lookupTypeOrEnum('onescore.app.v1.WebMatchOddsDetail');
    const matchOddsDetailType = root.lookupTypeOrEnum('onescore.app.v1.MatchOddsDetail');
    const matchTeamStatsType = root.lookupTypeOrEnum('onescore.app.v1.MatchTeamStats');
    if (!(responseType instanceof protobuf.Type)) {
      throw new InternalServerErrorException('Protobuf message onescore.app.v1.Response was not found');
    }

    if (!(matchesType instanceof protobuf.Type)) {
      throw new InternalServerErrorException('Protobuf message onescore.app.v1.Matches was not found');
    }

    if (!(matchOddsType instanceof protobuf.Type)) {
      throw new InternalServerErrorException('Protobuf message onescore.app.v1.MatchOdds was not found');
    }

    if (!(webMatchOddsDetailType instanceof protobuf.Type)) {
      throw new InternalServerErrorException('Protobuf message onescore.app.v1.WebMatchOddsDetail was not found');
    }

    if (!(matchOddsDetailType instanceof protobuf.Type)) {
      throw new InternalServerErrorException('Protobuf message onescore.app.v1.MatchOddsDetail was not found');
    }
    if (!(matchTeamStatsType instanceof protobuf.Type)) {
      throw new InternalServerErrorException('Protobuf message onescore.app.v1.MatchTeamStats was not found');
    }

    this.responseType = responseType;
    this.matchesType = matchesType;
    this.matchOddsType = matchOddsType;
    this.webMatchOddsDetailType = webMatchOddsDetailType;
    this.matchOddsDetailType = matchOddsDetailType;
    this.matchTeamStatsType = matchTeamStatsType;
  }

  decodeMatches(body: Buffer): Record<string, unknown> {
    const payload = this.unwrapGzip(body);
    const matchesPayload = this.unwrapResponseData(payload);
    const decoded = this.matchesType.decode(matchesPayload);

    return this.matchesType.toObject(decoded, {
      longs: String,
      enums: String,
      bytes: String,
      defaults: false,
      arrays: true,
      objects: true,
    }) as Record<string, unknown>;
  }

  decodeWebMatchOddsDetail(body: Buffer): Record<string, unknown> {
    const payload = this.unwrapGzip(body);
    const oddsPayload = this.unwrapResponseData(payload);
    const decoded = this.webMatchOddsDetailType.decode(oddsPayload);

    return this.webMatchOddsDetailType.toObject(decoded, {
      longs: String,
      enums: String,
      bytes: String,
      defaults: false,
      arrays: true,
      objects: true,
    }) as Record<string, unknown>;
  }

  decodeMatchOdds(body: Buffer): Record<string, unknown> {
    const payload = this.unwrapGzip(body);
    const oddsPayload = this.unwrapResponseData(payload);
    const decoded = this.matchOddsType.decode(oddsPayload);

    return this.matchOddsType.toObject(decoded, {
      longs: String,
      enums: String,
      bytes: String,
      defaults: false,
      arrays: true,
      objects: true,
    }) as Record<string, unknown>;
  }

  decodeMatchOddsDetail(body: Buffer): Record<string, unknown> {
    const payload = this.unwrapGzip(body);
    const oddsPayload = this.unwrapResponseData(payload);
    const decoded = this.matchOddsDetailType.decode(oddsPayload);

    return this.matchOddsDetailType.toObject(decoded, {
      longs: String,
      enums: String,
      bytes: String,
      defaults: false,
      arrays: true,
      objects: true,
    }) as Record<string, unknown>;
  }

  decodeMatchTeamStats(body: Buffer): Record<string, unknown> {
    const payload = this.unwrapGzip(body);
    const statsPayload = this.unwrapResponseData(payload);
    const decoded = this.matchTeamStatsType.decode(statsPayload);

    return this.matchTeamStatsType.toObject(decoded, {
      longs: String,
      enums: String,
      bytes: String,
      defaults: false,
      arrays: true,
      objects: true,
    }) as Record<string, unknown>;
  }

  private unwrapGzip(body: Buffer): Buffer {
    if (this.isGzip(body)) {
      return gunzipSync(body);
    }

    return body;
  }

  private isGzip(body: Buffer): boolean {
    return body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b;
  }

  private unwrapResponseData(payload: Buffer): Uint8Array {
    const response = this.responseType.decode(payload) as protobuf.Message & {
      data?: Uint8Array;
    };

    if (response.data && response.data.length > 0) {
      return response.data;
    }

    return payload;
  }
}
