import { PartialType } from '@nestjs/swagger';
import { CreateDifficultyDto } from './create-difficulty.dto';

export class UpdateDifficultyDto extends PartialType(CreateDifficultyDto) {}
