import { IsString, IsNotEmpty, IsUUID, IsOptional, IsNumber } from 'class-validator';

export class CreateDifficultyDto {
    @IsString()
    @IsNotEmpty()
    name: string;  // The name of the difficulty level (e.g., Easy, Medium, Extreme)

    @IsNumber()
    @IsNotEmpty()
    points: number;

    @IsString()
    language_id: string;  // Foreign key to the Language model (UUID)

    @IsOptional()
    created_at?: Date;  // Automatically set by Prisma, optional
    @IsOptional()
    updated_at?: Date;  // Automatically set by Prisma, optional
}
