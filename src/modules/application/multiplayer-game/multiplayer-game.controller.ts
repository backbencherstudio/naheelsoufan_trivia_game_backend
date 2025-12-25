import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Param,
  Patch,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MultiplayerGameService } from './multiplayer-game.service';
import { CreateMultiplayerGameDto } from './dto/create-multiplayer-game.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { UpdateRoomDto } from './dto/update-room.dto';

@ApiTags('Multiplayer Game')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('multiplayer-game')
export class MultiplayerGameController {
  constructor(
    private readonly multiplayerGameService: MultiplayerGameService,
  ) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new multiplayer game and room' })
  async createGame(
    @Body() createDto: CreateMultiplayerGameDto,
    @Req() req: any,
  ) {
    const hostId = req.user.userId;
    return this.multiplayerGameService.createGame(createDto, hostId);
  }

  @Get('start-game/:gameId')
  @ApiOperation({ summary: 'Start a game' })
  async startGame(@Param('gameId') gameId: string, @Req() req: any) {
    const userId = req.user.userId;
    return this.multiplayerGameService.startGame(gameId, userId);
  }

  @Patch('room/:roomId')
  @ApiOperation({ summary: 'Update room details (name and start time)' })
  async updateRoomDetails(
    @Param('roomId') roomId: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.multiplayerGameService.updateRoomDetails(
      roomId,
      updateRoomDto,
      userId,
    );
  }

  @Post('join/:identifier')
  @ApiOperation({ summary: 'Join a game using either Game ID or Room Code' })
  async joinGame(@Param('identifier') identifier: string, @Req() req: any) {
    const userId = req.user.userId;
    return this.multiplayerGameService.joinGame(identifier, userId);
  }

  @Post('grid-join/:identifier')
  @ApiOperation({ summary: 'Join a game using either Game ID or Room Code' })
  async gridJoinGame(@Param('identifier') identifier: string, @Req() req: any) {
    const userId = req.user.userId;
    return this.multiplayerGameService.joinGame(identifier, userId, 2);
  }

  @ApiOperation({ summary: 'Find unplayed game' })
  @Get('find-unplayed')
  async findUnplayedGame(@Req() req: any) {
    try {
      const userId = req.user.userId;
      return this.multiplayerGameService.findUnplayedGame(userId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
