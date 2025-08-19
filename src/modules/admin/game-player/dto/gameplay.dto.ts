import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class StartGameDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;  // Game ID only - just start the game
}

export class EndGameDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;  // Game to end
}

export class GetGameStatusDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;  // Game to check status
}

export class UpdateScoreDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;

    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value))
    score: number;  // New score to add

    @IsOptional()
    @IsString()
    reason?: string;  // Reason for score update (bonus, penalty, etc.)
}

export class GetGameQuestionsDto {
    @IsString()
    @IsNotEmpty()
    category_id: string;  // Selected category

    @IsString()
    @IsNotEmpty()
    difficulty_id: string;  // Selected difficulty level

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(50)
    @Transform(({ value }) => parseInt(value))
    question_count?: number;  // Optional: number of questions (if not provided, use all available)
}
