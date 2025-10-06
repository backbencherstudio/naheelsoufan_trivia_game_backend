import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class JoinGameDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  user_ids?: string[];

  @IsOptional()
  @IsString()
  room_code?: string;
}

export class LeaveGameDto {
  @IsString()
  @IsNotEmpty()
  game_id: string;
}
