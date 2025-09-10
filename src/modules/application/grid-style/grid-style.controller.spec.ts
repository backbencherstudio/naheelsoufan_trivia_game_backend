import { Test, TestingModule } from '@nestjs/testing';
import { GridStyleController } from './grid-style.controller';

describe('GridStyleController', () => {
  let controller: GridStyleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GridStyleController],
    }).compile();

    controller = module.get<GridStyleController>(GridStyleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
