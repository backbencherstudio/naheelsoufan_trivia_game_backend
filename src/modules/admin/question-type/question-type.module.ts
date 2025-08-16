import { Module } from '@nestjs/common';
import { QuestionTypeService } from './question-type.service';
import { QuestionTypeController } from './question-type.controller';

@Module({
  controllers: [QuestionTypeController],
  providers: [QuestionTypeService],
})
export class QuestionTypeModule {}
