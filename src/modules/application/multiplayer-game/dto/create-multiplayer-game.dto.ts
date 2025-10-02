import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { GameMode } from '@prisma/client';

export class CreateMultiplayerGameDto {
  @ApiProperty({
    description: 'The mode of the game',
    enum: GameMode,
    example: GameMode.QUICK_GAME,
  })
  @IsNotEmpty()
  mode: GameMode;

  @ApiProperty({
    description: 'The language ID for the game',
    example: 'clx......',
  })
  @IsString()
  @IsNotEmpty()
  language_id: string;
}
