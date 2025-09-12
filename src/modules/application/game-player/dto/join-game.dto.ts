import { IsString, IsNotEmpty, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class JoinGameDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;  // Game to join

    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(8)  // Max 8 users can join at once (game max_players limit)
    @IsString({ each: true })
    user_ids?: string[];  // Optional array of user IDs to add to the game (for host adding players)

    @IsOptional()
    @IsString()
    room_code?: string;  // Optional room code for joining via room
}

export class LeaveGameDto {
    @IsString()
    @IsNotEmpty()
    game_id: string;  // Game to leave
}
