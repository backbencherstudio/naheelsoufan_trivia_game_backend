import { Module } from '@nestjs/common';
import { FaqModule } from './faq/faq.module';
import { ContactModule } from './contact/contact.module';
import { WebsiteInfoModule } from './website-info/website-info.module';
import { PaymentTransactionModule } from './payment-transaction/payment-transaction.module';
import { UserModule } from './user/user.module';
import { NotificationModule } from './notification/notification.module';
import { LanguageModule } from './language/language.module';
import { CategoryModule } from './category/category.module';
import { DifficultyModule } from './difficulty/difficulty.module';
import { QuestionTypeModule } from './question-type/question-type.module';
import { QuestionModule } from './question/question.module';
import { GameModule } from './game/game.module';
import { GamePlayerModule } from './game-player/game-player.module';

@Module({
  imports: [
    FaqModule,
    ContactModule,
    WebsiteInfoModule,
    PaymentTransactionModule,
    UserModule,
    NotificationModule,
    LanguageModule,
    CategoryModule,
    DifficultyModule,
    QuestionTypeModule,
    QuestionModule,
    GameModule,
    GamePlayerModule,
  ],
})
export class AdminModule {}
