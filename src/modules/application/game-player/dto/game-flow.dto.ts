import { IsNotEmpty, IsString, IsOptional, IsInt, Min, Max, IsBoolean } from "class-validator";
import { Transform } from "class-transformer";

export class StartTurnDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
}

export class SelectCategoryDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
  
  @IsString()
  @IsNotEmpty()
  category_id: string;
  
  @IsString()
  @IsNotEmpty()
  difficulty_id: string;
}

export class AddGuestPlayerDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
  
  @IsString()
  @IsNotEmpty()
  player_name: string;
}

export class GetGameStateDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
}

export class NextTurnDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
}

export class AnswerQuestionDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
  
  @IsString()
  @IsNotEmpty()
  question_id: string;
  
  @IsString()
  @IsNotEmpty()
  answer_id: string;
}

export class StealQuestionDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
  
  @IsString()
  @IsNotEmpty()
  question_id: string;
  
  @IsString()
  @IsNotEmpty()
  answer_id: string;
}

export class EndGameDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
}

