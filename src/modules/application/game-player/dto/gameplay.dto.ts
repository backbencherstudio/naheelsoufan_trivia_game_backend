import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class StartGameDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
}

export class EndGameDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
}

export class GetGameStatusDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
}

export class UpdateScoreDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;

  @IsInt()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  score: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class GetGameQuestionsDto {
  @IsArray()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value;
  })
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  category_ids: string[];

  @IsString()
  @IsNotEmpty()
  difficulty_id: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Transform(({ value }) => parseInt(value))
  question_count?: number;
}
