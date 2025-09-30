import { Module } from '@nestjs/common';
import { GamePlayerService } from './game-player.service';
import { GamePlayerController } from './game-player.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { MessageGateway } from 'src/modules/chat/message/message.gateway';

@Module({
  imports: [PrismaModule, MessageGateway],
  controllers: [GamePlayerController],
  providers: [GamePlayerService],
  exports: [GamePlayerService],
})
export class GamePlayerModule {}
