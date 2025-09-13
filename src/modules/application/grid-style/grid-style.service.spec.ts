import { Test, TestingModule } from '@nestjs/testing';
import { GridStyleService } from './grid-style.service';

describe('GridStyleService', () => {
  let service: GridStyleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GridStyleService],
    }).compile();

    service = module.get<GridStyleService>(GridStyleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
