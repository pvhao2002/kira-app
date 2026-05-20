import { Module } from '@nestjs/common';
import { AiscoreRawModule } from './aiscore-raw/aiscore-raw.module';
import { MatchesModule } from './matches/matches.module';

@Module({
  imports: [MatchesModule, AiscoreRawModule],
})
export class AppModule {}
