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
import { GamePlayerService } from './game-player.service';
import { JoinGameDto, LeaveGameDto } from './dto/join-game.dto';
import { AnswerQuestionDto, SkipQuestionDto } from './dto/answer-question.dto';
import { StartGameDto, EndGameDto, UpdateScoreDto, GetGameQuestionsDto } from './dto/gameplay.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Game Player')
@Controller('game-players')
@ApiBearerAuth()
export class GamePlayerController {
  constructor(private readonly gamePlayerService: GamePlayerService) { }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Join a game' })
  @Post('join')
  async joinGame(
    @Body() joinGameDto: JoinGameDto,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.joinGame(userId, joinGameDto);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Leave a game' })
  @Post('leave')
  async leaveGame(
    @Body() leaveGameDto: LeaveGameDto,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.leaveGame(userId, leaveGameDto);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get player statistics in a game' })
  @Get('stats/:gameId')
  async getPlayerStats(
    @Param('gameId') gameId: string,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.getPlayerStats(userId, gameId);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get all players in a game' })
  @Get('game/:gameId')
  async getGamePlayers(@Param('gameId') gameId: string) {
    try {
      const result = await this.gamePlayerService.getGamePlayers(gameId);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get game leaderboard' })
  @Get('leaderboard/:gameId')
  async getGameLeaderboard(@Param('gameId') gameId: string) {
    try {
      // Add leaderboard logic here
      const result = await this.gamePlayerService.getGamePlayers(gameId);
      return {
        ...result,
        message: 'Game leaderboard retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get player game history' })
  @Get('history')
  async getPlayerHistory(@Req() req: any) {
    try {
      const userId = req.user.userId;
      // This would be implemented to get all games the user has played
      return {
        success: true,
        message: 'Player history retrieved successfully',
        data: [], // Placeholder
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Answer a question in game' })
  @Post('answer/:gameId')
  async answerQuestion(
    @Param('gameId') gameId: string,
    @Body() answerDto: AnswerQuestionDto,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.answerQuestion(userId, gameId, answerDto);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Skip a question in game' })
  @Post('skip/:gameId')
  async skipQuestion(
    @Param('gameId') gameId: string,
    @Body() skipDto: SkipQuestionDto,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.skipQuestion(userId, gameId, skipDto);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current game status for player' })
  @Get('status/:gameId')
  async getGameStatus(
    @Param('gameId') gameId: string,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.getPlayerStats(userId, gameId);
      return {
        ...result,
        message: 'Game status retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get player ranking in game' })
  @Get('ranking/:gameId')
  async getPlayerRanking(
    @Param('gameId') gameId: string,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.userId;
      const allPlayers = await this.gamePlayerService.getGamePlayers(gameId);

      if (allPlayers.success) {
        const playerIndex = allPlayers.data.findIndex(p => p.user.id === userId);
        const playerRank = playerIndex !== -1 ? playerIndex + 1 : null;

        return {
          success: true,
          message: 'Player ranking retrieved successfully',
          data: {
            current_rank: playerRank,
            total_players: allPlayers.data.length,
            player_stats: allPlayers.data[playerIndex] || null,
            top_3: allPlayers.data.slice(0, 3)
          },
        };
      }

      return allPlayers;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get available categories for game selection' })
  @Get('categories/:gameId')
  async getGameCategories(@Param('gameId') gameId: string) {
    try {
      const result = await this.gamePlayerService.getGameCategories(gameId);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start game with game ID' })
  @Post('start-game')
  async startGame(
    @Body() startGameDto: StartGameDto,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.startGame(userId, startGameDto);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get game questions with category, difficulty, and question count' })
  @Get('get-questions/:gameId')
  async getGameQuestions(
    @Param('gameId') gameId: string,
    @Query() questionsDto: GetGameQuestionsDto,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.getGameQuestions(userId, gameId, questionsDto);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}