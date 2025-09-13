import {
    IsString,
    IsNotEmpty,
} from 'class-validator';

export class AnswerQuestionDto {
    @IsString()
    @IsNotEmpty()
    game_id: string

    @IsString()
    @IsNotEmpty()
    question_id: string

    @IsString()
    @IsNotEmpty()
    team_id: string
}
