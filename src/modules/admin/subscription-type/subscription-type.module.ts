import { Module } from '@nestjs/common';
import { SubscriptionTypeService } from './subscription-type.service';
import { SubscriptionTypeController } from './subscription-type.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionTypeController],
  providers: [SubscriptionTypeService],
  exports: [SubscriptionTypeService],
})
export class SubscriptionTypeModule { }