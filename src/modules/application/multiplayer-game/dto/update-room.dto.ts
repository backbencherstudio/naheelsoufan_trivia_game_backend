import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, MaxLength, IsNumber } from 'class-validator';

export class UpdateRoomDto {
  @ApiProperty({
    description: 'A custom name for the game room (optional)',
    example: 'Friday Night Trivia',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsNumber()
  question_time?: number;
}
