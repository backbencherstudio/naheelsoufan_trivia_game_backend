import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { GameMode } from '@prisma/client';

export class CreateLeaderboardDto {
    @IsString()
    @IsNotEmpty()
    user_id: string; // Foreign key to User model

    @IsString()
    @IsOptional()
    game_id?: string; // Foreign key to Game model (optional)

    @IsString()
    @IsOptional()
    category_id?: string; // Foreign key to Category model (optional)

    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value))
    score: number; // The user's score

    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value))
    correct: number; // Number of correct answers

    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value))
    wrong: number; // Number of wrong answers

    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value))
    skipped: number; // Number of skipped answers

    @IsInt()
    @Min(1)
    @Max(100)
    @Transform(({ value }) => parseInt(value))
    @IsOptional()
    tts_speed?: number; // Text-to-Speech speed (default: 50)

    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value))
    @IsOptional()
    games_played?: number; // Total games played (default: 1)

    @IsEnum(GameMode)
    mode: GameMode; // QUICK_GAME or GRID_STYLE
}
