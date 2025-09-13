import {
    IsString,
    IsNotEmpty,
} from 'class-validator';

export class GetCategoryDto {
    @IsString()
    @IsNotEmpty()
    game_id: string

    @IsString()
    @IsNotEmpty()
    category_id: string

    @IsString()
    @IsNotEmpty()
    difficulty_id: string
}
