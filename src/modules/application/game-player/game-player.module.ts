import { Module } from '@nestjs/common';
import { GamePlayerService } from './game-player.service';
import { GamePlayerController } from './game-player.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GamePlayerController],
  providers: [GamePlayerService],
  exports: [GamePlayerService],
})
export class GamePlayerModule { }
