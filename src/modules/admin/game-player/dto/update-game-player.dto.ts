import { PartialType } from '@nestjs/swagger';
import { CreateGamePlayerDto } from './create-game-player.dto';

export class UpdateGamePlayerDto extends PartialType(CreateGamePlayerDto) { }
