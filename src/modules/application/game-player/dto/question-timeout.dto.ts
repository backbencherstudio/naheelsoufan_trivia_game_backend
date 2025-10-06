import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class QuestionTimeoutDto {
  @ApiProperty({
    description: 'The ID of the game where the timeout occurred',
    example: 'clxkfzium000008l4f14m2b1q',
  })
  @IsString()
  @IsNotEmpty()
  game_id: string;

  @ApiProperty({
    description: 'The ID of the question that timed out',
    example: 'clxkfziun000108l4h2g3f0c2',
  })
  @IsString()
  @IsNotEmpty()
  question_id: string;

  @ApiProperty({
    description: 'The ID of the GamePlayer whose turn it was',
    example: 'clxkfziup000208l4b5n6a7d8',
  })
  @IsString()
  @IsOptional()
  player_id: string;
}
