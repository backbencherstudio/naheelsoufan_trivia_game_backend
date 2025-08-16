import { Module } from '@nestjs/common';
import { DifficultyService } from './difficulty.service';
import { DifficultyController } from './difficulty.controller';

@Module({
  controllers: [DifficultyController],
  providers: [DifficultyService],
})
export class DifficultyModule {}
