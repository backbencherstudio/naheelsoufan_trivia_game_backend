import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class JoinGameDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;  // Game to join

    @IsOptional()
    @IsString()
    room_code?: string;  // Optional room code for joining via room
}

export class LeaveGameDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;  // Game to leave
}
