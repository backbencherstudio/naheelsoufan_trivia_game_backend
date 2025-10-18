import { Module } from '@nestjs/common';
import { GridStyleController } from './grid-style.controller';
import { GridStyleService } from './grid-style.service';
import { GamePlayerModule } from '../game-player/game-player.module';

@Module({
  controllers: [GridStyleController],
  providers: [GridStyleService],
  imports: [GamePlayerModule],
})
export class GridStyleModule {}
