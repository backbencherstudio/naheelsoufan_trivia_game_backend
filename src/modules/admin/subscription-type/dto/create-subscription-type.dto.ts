import { IsString, IsNotEmpty, IsInt, IsNumber, Min, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSubscriptionTypeDto {
    @IsString()
    @IsNotEmpty()
    type: string; // e.g., Premium, Standard, Platinum

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