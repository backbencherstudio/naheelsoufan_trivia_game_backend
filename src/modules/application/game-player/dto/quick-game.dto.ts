import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddQuickGamePlayerDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;

    @IsString()
    @IsNotEmpty()
    player_name: string;
}

export class StartQuickGameDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;
}

export class SelectQuickGameCategoryDto {
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

export class AnswerQuickGameQuestionDto {
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

export class StealQuickGameQuestionDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;

    @IsString()
    @IsNotEmpty()
    question_id: string;

    @IsString()
    @IsNotEmpty()
    answer_id: string;

    @IsString()
    @IsNotEmpty()
    user_id: string;
}

export class EndQuickGameDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;
}

export class GetQuickGameStatusDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;
}

export class AddMultipleQuickGamePlayersDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;

    @IsArray()
    @ArrayMinSize(2, { message: 'At least 2 players are required' })
    @ArrayMaxSize(4, { message: 'Maximum 4 players allowed' })
    @IsString({ each: true })
    player_names: string[];
}

export class AddPlayersAndStartGameDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;

    @IsArray()
    @ArrayMinSize(2, { message: 'At least 2 players are required' })
    @ArrayMaxSize(4, { message: 'Maximum 4 players allowed' })
    @IsString({ each: true })
    player_names: string[];
}

export class SelectCompetitiveCategoryDto {
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

export class AnswerCompetitiveQuestionDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;

    @IsString()
    @IsNotEmpty()
    question_id: string;

    @IsString()
    @IsNotEmpty()
    answer_id: string;

    @IsString()
    @IsNotEmpty()
    player_id: string;
}

export class GetCompetitiveQuestionDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;
}

export class GetCompetitiveGameStatusDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;
}
