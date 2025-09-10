import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';
import { GameModule } from './game/game.module';
import { GamePlayerModule } from './game-player/game-player.module';
import { GridStyleModule } from './grid-style/grid-style.module';

@Module({
  imports: [
    NotificationModule,
    ContactModule,
    FaqModule,
    GameModule,
    GamePlayerModule,
    GridStyleModule
  ],
})
export class ApplicationModule { }
