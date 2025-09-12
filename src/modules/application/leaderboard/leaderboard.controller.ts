import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { CreateLeaderboardDto } from './dto/create-leaderboard.dto';
import { UpdateLeaderboardDto } from './dto/update-leaderboard.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GameMode } from '@prisma/client';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) { }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new leaderboard entry' })
  @Post()
  async create(
    @Body() createLeaderboardDto: CreateLeaderboardDto,
    @Req() req: any,
  ) {
    try {
      const leaderboard = await this.leaderboardService.create(createLeaderboardDto);
      return leaderboard;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get all leaderboard entries' })
  @Get()
  async findAll(@Query() query: {
    q?: string;
    page?: string;
    limit?: string;
    sort?: string;
    order?: string;
    mode?: GameMode;
    category_id?: string;
    user_id?: string;
  }) {
    try {
      const searchQuery = query.q || null;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 10;
      const sort = query.sort || 'score';
      const order = query.order || 'desc';
      const filters = {
        mode: query.mode,
        category_id: query.category_id,
        user_id: query.user_id,
      };

      const leaderboards = await this.leaderboardService.findAll(
        searchQuery,
        page,
        limit,
        sort,
        order,
        filters
      );
      return leaderboards;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get top players' })
  @Get('top-players')
  async getTopPlayers(@Query() query: {
    mode?: GameMode;
    category_id?: string;
    limit?: string;
  }) {
    try {
      const mode = query.mode;
      const category_id = query.category_id;
      const limit = parseInt(query.limit) || 10;

      const topPlayers = await this.leaderboardService.getTopPlayers(mode, category_id, limit);
      return topPlayers;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user ranking' })
  @Get('user-ranking/:user_id')
  async getUserRanking(
    @Param('user_id') user_id: string,
    @Query() query: {
      mode?: GameMode;
      category_id?: string;
    }
  ) {
    try {
      const mode = query.mode;
      const category_id = query.category_id;

      const userRanking = await this.leaderboardService.getUserRanking(user_id, mode, category_id);
      return userRanking;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get one leaderboard entry' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const leaderboard = await this.leaderboardService.findOne(id);
      return leaderboard;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a leaderboard entry' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateLeaderboardDto: UpdateLeaderboardDto,
  ) {
    try {
      const leaderboard = await this.leaderboardService.update(id, updateLeaderboardDto);
      return leaderboard;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a leaderboard entry' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const result = await this.leaderboardService.remove(id);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}