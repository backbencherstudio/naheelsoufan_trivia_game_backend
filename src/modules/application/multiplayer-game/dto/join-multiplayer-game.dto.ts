import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class JoinMultiplayerGameDto {
  @ApiProperty({
    description: 'The unique code of the room to join',
    example: 'A3B1C5',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6) // Assuming room codes are 6 characters long
  room_code: string;
}
