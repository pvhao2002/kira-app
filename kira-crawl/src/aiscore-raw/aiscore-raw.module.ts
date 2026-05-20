import { Module } from '@nestjs/common';
import { AiscoreProtobufService } from '../matches/aiscore-protobuf.service';
import { AiscoreRawController } from './aiscore-raw.controller';
import { AiscoreRawService } from './aiscore-raw.service';

@Module({
    controllers: [AiscoreRawController],
    providers: [AiscoreProtobufService, AiscoreRawService],
})
export class AiscoreRawModule {}
