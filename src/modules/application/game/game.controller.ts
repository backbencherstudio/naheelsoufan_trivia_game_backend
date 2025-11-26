import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { GameService } from './game.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Role } from '../../../common/guard/role/role.enum';

@ApiTags('Game')
@Controller('games')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN, Role.HOST)
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @ApiOperation({ summary: 'Check if user can create a game' })
  @Get('eligibility')
  async checkGameCreationEligibility(
    @Req() req: any,
    @Query('game_mode') game_mode?: string,
  ) {
    try {
      const user_id = req.user.userId;
      const eligibility = await this.gameService.checkGameCreationEligibility(
        user_id,
        game_mode,
      );
      return eligibility;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Create a new game' })
  @Post()
  async create(@Body() createGameDto: CreateGameDto, @Req() req: any) {
    try {
      const user_id = req.user.userId;
      const game = await this.gameService.create(createGameDto, user_id);
      return game;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Get Category by game mode
  @ApiOperation({
    summary: 'Read all categories with optional search and language filter',
  })
  @Get('categories')
  async findAllCategory(
    @Query()
    query: {
      q?: string;
      page?: number;
      limit?: number;
      language_id?: string;
      mode?: string;
      gameId?: string;
      playerId?: string;
    },
  ) {
    try {
      const searchQuery = query.q; // Optional search query
      const page = query.page ? Number(query.page) : 1;
      const limit = query.limit ? Number(query.limit) : 10;
      const languageId = query.language_id; // Optional language filter
      const mode = query.mode;
      const gameId = query.gameId;
      const playerId = query.playerId;
      const categories = await this.gameService.findAllCategory(
        searchQuery,
        page,
        limit,
        languageId,
        mode,
        gameId,
        playerId,
      ); // Fetch all categories
      return categories;
    } catch (error) {
      return {
        success: false,
        message: error.message, // Return error message if fetching fails
      };
    }
  }

  @ApiOperation({ summary: 'Read all games' })
  @Get()
  async findAll(@Query() query: { q?: string }) {
    try {
      const searchQuery = query.q;
      const games = await this.gameService.findAll(searchQuery);
      return games;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Read one game' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const game = await this.gameService.findOne(id);
      return game;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a game' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateGameDto: UpdateGameDto) {
    try {
      const game = await this.gameService.update(id, updateGameDto);
      return game;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a game' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const game = await this.gameService.remove(id);
      return game;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get game statistics' })
  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    try {
      const stats = await this.gameService.getGameStats(id);
      return stats;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get Host All the Game' })
  @Get('player/games')
  async GetPlayerGames(@Req() req: any) {
    try {
      const user_id = req.user.userId;
      const allGames = await this.gameService.playerGames(user_id);
      return allGames;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
