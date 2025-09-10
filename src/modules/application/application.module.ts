import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';
import { GridStyleModule } from './grid-style/grid-style.module';

@Module({
  imports: [NotificationModule, ContactModule, FaqModule, GridStyleModule],
})
export class ApplicationModule {}
