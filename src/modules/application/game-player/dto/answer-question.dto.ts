import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class AnswerQuestionDto {
    @IsString()
    @IsNotEmpty()
    question_id: string;  // Question being answered

    @IsString()
    @IsNotEmpty()
    answer_id: string;  // Selected answer

    @IsString()
    @IsNotEmpty()
    user_id: string;  // User ID

    @IsOptional()
    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value))
    time_taken?: number;  // Time taken to answer in seconds
}

export class SkipQuestionDto {
    @IsString()
    @IsNotEmpty()
    question_id: string;  // Question being skipped
}
