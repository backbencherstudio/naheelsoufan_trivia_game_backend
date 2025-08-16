import { PartialType } from '@nestjs/swagger';
import { CreateQuestionTypeDto } from './create-question-type.dto';

export class UpdateQuestionTypeDto extends PartialType(CreateQuestionTypeDto) {}
