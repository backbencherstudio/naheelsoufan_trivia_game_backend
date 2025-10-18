import { Module } from '@nestjs/common';
import { MultiplayerGameService } from './multiplayer-game.service';
import { MultiplayerGameController } from './multiplayer-game.controller';
import { MessageGateway } from 'src/modules/chat/message/message.gateway';

@Module({
  controllers: [MultiplayerGameController],
  providers: [MultiplayerGameService],
  imports: [MessageGateway],
})
export class MultiplayerGameModule {}
