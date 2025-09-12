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
@Roles(Role.USER, Role.ADMIN)
export class GameController {
  constructor(private readonly gameService: GameService) { }

  @ApiOperation({ summary: 'Create a new game' })
  @Post()
  async create(
    @Body() createGameDto: CreateGameDto,
    @Req() req: any,
  ) {
    try {
      const user_id = req.user.userId;
      const game = await this.gameService.create(createGameDto, user_id);
      return game;  // Return the created game data
    } catch (error) {
      return {
        success: false,
        message: error.message,  // Return error message if creation fails
      };
    }
  }

  @ApiOperation({ summary: 'Read all games' })
  @Get()
  async findAll(@Query() query: { q?: string }) {
    try {
      const searchQuery = query.q;  // Optional search query
      const games = await this.gameService.findAll(searchQuery);  // Fetch all games
      return games;
    } catch (error) {
      return {
        success: false,
        message: error.message,  // Return error message if fetching fails
      };
    }
  }

  @ApiOperation({ summary: 'Read one game' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const game = await this.gameService.findOne(id);  // Fetch a game by ID
      return game;
    } catch (error) {
      return {
        success: false,
        message: error.message,  // Return error message if fetching fails
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)  // Restrict to admin roles
  @ApiOperation({ summary: 'Update a game' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateGameDto: UpdateGameDto,
  ) {
    try {
      const game = await this.gameService.update(id, updateGameDto);
      return game;  // Return updated game data
    } catch (error) {
      return {
        success: false,
        message: error.message,  // Return error message if updating fails
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)  // Restrict to admin roles
  @ApiOperation({ summary: 'Delete a game' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const game = await this.gameService.remove(id);  // Delete game by ID
      return game;
    } catch (error) {
      return {
        success: false,
        message: error.message,  // Return error message if deletion fails
      };
    }
  }

  @ApiOperation({ summary: 'Get game statistics' })
  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    try {
      const stats = await this.gameService.getGameStats(id);  // Get game statistics
      return stats;
    } catch (error) {
      return {
        success: false,
        message: error.message,  // Return error message if fetching fails
      };
    }
  }
}