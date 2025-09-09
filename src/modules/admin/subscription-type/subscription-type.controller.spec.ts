import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionTypeController } from './subscription-type.controller';
import { SubscriptionTypeService } from './subscription-type.service';

describe('SubscriptionTypeController', () => {
  let controller: SubscriptionTypeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionTypeController],
      providers: [SubscriptionTypeService],
    }).compile();

    controller = module.get<SubscriptionTypeController>(SubscriptionTypeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});