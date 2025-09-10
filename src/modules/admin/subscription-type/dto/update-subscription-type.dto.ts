import { PartialType } from '@nestjs/swagger';
import { CreateSubscriptionTypeDto } from './create-subscription-type.dto';

export class UpdateSubscriptionTypeDto extends PartialType(CreateSubscriptionTypeDto) { }