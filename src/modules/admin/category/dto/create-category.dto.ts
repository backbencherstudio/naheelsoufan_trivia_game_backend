import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, Min } from 'class-validator';

export class CreateCategoryDto {
    @IsString()
    @IsNotEmpty()
    name: string;  // The name of the category (e.g., Science, History)

    @IsString()
    language_id: string;  // The ID of the language the category belongs to

    @IsOptional()
    @IsString()
    image?: string;  // Optional image URL for the category

    @IsInt()
    @IsOptional()
    @Min(1)
    @Transform(({ value }) => parseInt(value))
    same_category_selection: number; // Maximum number of category selection allowed

    @IsOptional()
    created_at?: Date;  // Optional, automatically set by Prisma if not provided
    @IsOptional()
    updated_at?: Date;  // Optional, automatically set by Prisma if not provided
}
