import {
    IsString,
    IsNotEmpty,
} from 'class-validator';

export class AnswerQuestionDto {
    @IsString()
    @IsNotEmpty()
    question_id: string

    @IsString()
    @IsNotEmpty()
    answer_id: string

    @IsString()
    @IsNotEmpty()
    user_id: string
}
