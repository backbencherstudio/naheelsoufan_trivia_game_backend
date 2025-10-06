import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class GetGameCategoriesDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
}

export class GetCategoryDifficultiesDto {
  @IsString()
  @IsNotEmpty()
  category_id: string;
}
