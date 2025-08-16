import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsInt, IsArray } from 'class-validator'

export class CreateAnswerDto {
    @IsString()
    @IsNotEmpty()
    text: string;  // The answer text

    @IsString()
    question_id: string;  // Foreign key to Question model (UUID)

    @IsBoolean()
    is_correct: boolean;  // Whether the answer is correct or not

    @IsOptional()
    @IsString()
    file_url?: string;  // Optional file URL for the answer (e.g., image or document)
}

export class CreateQuestionDto {
    @IsString()
    @IsNotEmpty()
    text: string;  // The question text

    @IsString()
    category_id: string;  // Foreign key to Category model (UUID)

    @IsString()
    language_id: string;  // Foreign key to Language model (UUID)

    @IsString()
    difficulty_id: string;  // Foreign key to Difficulty model (UUID)

    @IsString()
    question_type_id: string;  // Foreign key to QuestionType model (UUID)

    @IsOptional()
    @IsString()
    file_url?: string;  // Optional file upload (e.g., image, document)

    @IsInt()
    @Transform(({ value }) => Number(value))
    time: number;  // Time limit for answering the question (in seconds)

    @IsBoolean()
    @Transform(({ value }) => value === 'true')
    free_bundle: boolean;  // Whether this question is part of a free bundle (Yes/No)

    @IsBoolean()
    @Transform(({ value }) => value === 'true')
    firebase: boolean;  // Whether this question is stored in Firebase (Yes/No)

    @IsInt()
    @Transform(({ value }) => Number(value))
    points: number;  // Points awarded based on difficulty of the question

    @IsOptional()
    created_at?: Date;  // Automatically set by Prisma, optional

    @IsOptional()
    updated_at?: Date;  // Automatically set by Prisma, optional


    @IsArray()
    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            // Parse the answers if it's a stringified array
            try {
                return JSON.parse(value);  // Parse the JSON string into an array
            } catch (error) {
                throw new Error('Invalid format for answers');  // Throw error if parsing fails
            }
        }
        return value;  // Return the original value if it's already an array
    })
    answers?: CreateAnswerDto[];
}
