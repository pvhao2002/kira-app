import { Module } from '@nestjs/common';
import { MatchesModule } from './matches/matches.module';

@Module({
  imports: [MatchesModule],
})
export class AppModule {}
