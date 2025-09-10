import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionTypeService } from './subscription-type.service';

describe('SubscriptionTypeService', () => {
  let service: SubscriptionTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubscriptionTypeService],
    }).compile();

    service = module.get<SubscriptionTypeService>(SubscriptionTypeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});