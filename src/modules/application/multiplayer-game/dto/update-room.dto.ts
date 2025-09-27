import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

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

  @ApiProperty({
    description:
      'Scheduled start time for the game in ISO 8601 format (optional)',
    example: '2025-10-31T19:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  scheduled_at?: Date;
}
