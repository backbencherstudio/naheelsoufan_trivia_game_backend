import { Test, TestingModule } from '@nestjs/testing';
import { QuestionTypeController } from './question-type.controller';
import { QuestionTypeService } from './question-type.service';

describe('QuestionTypeController', () => {
  let controller: QuestionTypeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionTypeController],
      providers: [QuestionTypeService],
    }).compile();

    controller = module.get<QuestionTypeController>(QuestionTypeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
