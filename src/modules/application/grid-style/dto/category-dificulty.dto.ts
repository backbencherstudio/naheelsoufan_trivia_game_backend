import { IsArray, ArrayNotEmpty, IsString, IsNotEmpty } from 'class-validator';

export class CategoryDifficultyDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  category_ids: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  difficulty_ids: string[];
}
