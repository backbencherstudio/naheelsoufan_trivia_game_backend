import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateGamePlayerDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;  // Foreign key to Game model

    @IsString()
    @IsNotEmpty()
    user_id: string;  // Foreign key to User model

    @IsOptional()
    @IsString()
    room_id?: string;  // Optional: if user joined through a room

    @IsOptional()
    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value))
    score?: number;  // Total points earned in this game (default: 0)

    @IsOptional()
    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value))
    correct_answers?: number;  // Number of correct answers (default: 0)

    @IsOptional()
    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value))
    wrong_answers?: number;  // Number of wrong answers (default: 0)

    @IsOptional()
    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value))
    skipped_answers?: number;  // Number of skipped answers (default: 0)

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(8)
    @Transform(({ value }) => parseInt(value))
    player_order?: number;  // Order in which player joined (1-8)

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(8)
    @Transform(({ value }) => parseInt(value))
    final_rank?: number;  // Final ranking when game ends (1st, 2nd, etc.)
}
