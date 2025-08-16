import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateQuestionTypeDto {
    @IsString()
    @IsNotEmpty()
    name: string;  // The name of the question type (e.g., Multiple Choice, True/False)

    @IsString()
    language_id: string;  // Foreign key to the Language model (UUID)

    @IsOptional()
    created_at?: Date;  // Optional field for created_at (automatically set by Prisma)
    @IsOptional()
    updated_at?: Date;  // Optional field for updated_at (automatically set by Prisma)
}
