import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateLanguageDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    code: string;

    @IsString()
    @IsOptional()
    file_url: string;
}