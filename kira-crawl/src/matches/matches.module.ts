import { Module } from '@nestjs/common';
import { AiscoreProtobufService } from './aiscore-protobuf.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  controllers: [MatchesController],
  providers: [AiscoreProtobufService, MatchesService],
})
export class MatchesModule {}
