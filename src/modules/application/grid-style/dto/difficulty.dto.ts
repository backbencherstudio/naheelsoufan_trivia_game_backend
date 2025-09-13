import { Transform } from 'class-transformer';
import {
    IsString,
    IsArray,
    ArrayNotEmpty,
    ArrayMinSize,
    ArrayMaxSize,
    IsNotEmpty,
} from 'class-validator';

export class DifficultyDto {
    @IsString()
    @IsNotEmpty()
    game_id: string

    @Transform(({ value }) =>
        typeof value === 'string' ? value.split(',').map(v => v.trim()) : value
    )
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMinSize(2)
    @ArrayMaxSize(6)
    @IsString({ each: true })
    categories: string[];
}
