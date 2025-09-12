import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { GameMode } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateGameDto {
    @IsEnum(GameMode)
    @IsOptional()
    mode?: GameMode;  // Game mode: QUICK_GAME or GRID_STYLE

    @IsOptional()
    @IsString()
    status?: string;  // Game status (default: "active")

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(8)
    @Transform(({ value }) => parseInt(value))
    max_players?: number;  // Maximum number of players (default: 8)

    @IsString()
    @IsNotEmpty()
    language_id: string;  // Foreign key to Language model (required)

    @IsString()
    @IsOptional()
    user_id: string;  // Foreign key to User model (required)

    @IsOptional()
    created_at?: Date;  // Optional, automatically set by Prisma if not provided

    @IsOptional()
    updated_at?: Date;  // Optional, automatically set by Prisma if not provided
}