import { IsString, IsNotEmpty, IsInt, IsNumber, Min, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { GameMode } from '@prisma/client';

export class CreateSubscriptionTypeDto {
    @IsString()
    @IsNotEmpty()
    title: string; // e.g., Premium, Standard, Platinum

    @IsEnum(GameMode)
    @IsNotEmpty()
    type: GameMode; // Game mode: QUICK_GAME or GRID_STYLE

    @IsInt()
    @Min(1)
    @Transform(({ value }) => parseInt(value))
    games: number; // Number of games allowed

    @IsInt()
    @Min(1)
    @Transform(({ value }) => parseInt(value))
    questions: number; // Number of questions allowed

    @IsInt()
    @Min(1)
    @Transform(({ value }) => parseInt(value))
    players: number; // Number of players allowed

    @IsNumber()
    @Min(0)
    @Transform(({ value }) => parseFloat(value))
    price: number; // Price of the subscription

    @IsString()
    @IsOptional()
    status?: string; // e.g., active, expired (default: active)

    @IsString()
    @IsNotEmpty()
    language_id: string; // Foreign key to Language model
}