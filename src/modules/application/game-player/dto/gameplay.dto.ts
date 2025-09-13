import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';
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
    @IsArray()
    @Transform(({ value }) => {
        // Handle different input types
        if (typeof value === 'string') {
            return JSON.parse(value);
        }
        return value;
    })
    @ArrayMinSize(1)
    @ArrayMaxSize(10)  // Allow up to 10 categories
    @IsString({ each: true })
    category_ids: string[];  // Selected categories (multiple allowed)

    @IsString()
    @IsNotEmpty()
    difficulty_id: string;  // Selected difficulty level

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10)
    @Transform(({ value }) => parseInt(value))
    question_count?: number;  // Optional: total number of questions (max 10, default 10)
}
