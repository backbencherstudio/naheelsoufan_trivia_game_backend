import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { GamePlayerModule } from '../game-player/game-player.module';

@Module({
  imports: [PrismaModule, GamePlayerModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
