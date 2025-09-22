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
import { StartTurnDto, SelectCategoryDto, AddGuestPlayerDto, GetGameStateDto, NextTurnDto, AnswerQuestionDto as GameFlowAnswerDto, StealQuestionDto, EndGameDto as GameFlowEndDto } from './dto/game-flow.dto';
import { AddQuickGamePlayerDto, StartQuickGameDto, SelectQuickGameCategoryDto, AnswerQuickGameQuestionDto, StealQuickGameQuestionDto, EndQuickGameDto, GetQuickGameStatusDto, AddMultipleQuickGamePlayersDto, AddPlayersAndStartGameDto, SelectCompetitiveCategoryDto, AnswerCompetitiveQuestionDto, GetCompetitiveQuestionDto, GetCompetitiveGameStatusDto } from './dto/quick-game.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Game Player')
@Controller('game-players')
@ApiBearerAuth()
export class GamePlayerController {
  constructor(private readonly gamePlayerService: GamePlayerService) { }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Join a game',
    description: 'Join a game as a single user. If you are the host and provide user_ids, you can add multiple players when joining your own game.'
  })
  @Post('join')
  async joinGame(
    @Body() joinGameDto: JoinGameDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return await this.gamePlayerService.joinGame(userId, joinGameDto);
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
  @ApiOperation({
    summary: 'Get game questions with multiple categories, difficulty, and question count',
    description: 'Retrieve questions from multiple selected categories with specified difficulty. Questions are distributed evenly across categories.'
  })
  @Get('get-questions/:gameId')
  async getGameQuestions(
    @Param('gameId') gameId: string,
    @Query() questionsDto: GetGameQuestionsDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return await this.gamePlayerService.getGameQuestions(userId, gameId, questionsDto);
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
      const result = await this.gamePlayerService.answerQuestion(gameId, answerDto);
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
    return await this.gamePlayerService.getGameCategories(gameId);
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
  @ApiOperation({ summary: 'End game and show final rankings with leaderboard' })
  @Post('end-game')
  async endGame(
    @Body() endGameDto: EndGameDto,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.endGame(userId, endGameDto);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get comprehensive game results with rankings and leaderboard' })
  @Get('results/:gameId')
  async getGameResults(@Param('gameId') gameId: string) {
    try {
      const result = await this.gamePlayerService.getGameResults(gameId);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ===== GAME FLOW ENDPOINTS =====

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current player whose turn it is' })
  @Get('current-player/:gameId')
  async getCurrentPlayer(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.getCurrentPlayer(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Move to the next turn' })
  @Post('next-turn')
  async nextTurn(@Body() dto: NextTurnDto) {
    try {
      return await this.gamePlayerService.nextTurn(dto.game_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start a player turn' })
  @Post('start-turn')
  async startPlayerTurn(@Body() dto: StartTurnDto, @Req() req: any) {
    try {
      const userId = req.user.userId;
      // Find the player ID for the current user in this game
      const gameState = await this.gamePlayerService.getGameState(dto.game_id);
      if (!gameState.success) {
        return gameState;
      }
      
      const player = gameState.data.players.find(p => p.user_id === userId);
      if (!player) {
        return {
          success: false,
          message: 'Player not found in this game',
        };
      }
      
      return await this.gamePlayerService.startPlayerTurn(dto.game_id, player.id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current game state' })
  @Get('game-state/:gameId')
  async getGameState(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.getGameState(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check if game is completed' })
  @Get('check-completion/:gameId')
  async checkGameCompletion(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.checkGameCompletion(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ===== GUEST PLAYER ENDPOINTS =====

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add guest player to game' })
  @Post('add-guest-player')
  async addGuestPlayer(@Body() dto: AddGuestPlayerDto) {
    try {
      return await this.gamePlayerService.addGuestPlayer(dto.game_id, dto.player_name);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all guest players in a game' })
  @Get('guest-players/:gameId')
  async getGuestPlayers(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.getGuestPlayers(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Remove guest player from game' })
  @Delete('remove-guest-player/:gameId/:playerId')
  async removeGuestPlayer(@Param('gameId') gameId: string, @Param('playerId') playerId: string) {
    try {
      return await this.gamePlayerService.removeGuestPlayer(gameId, playerId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ===== QUICK GAME ENDPOINTS =====

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add player to Quick Game' })
  @Post('quick-game/add-player')
  async addQuickGamePlayer(@Body() dto: AddQuickGamePlayerDto) {
    try {
      return await this.gamePlayerService.addQuickGamePlayer(dto.game_id, dto.player_name);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start Quick Game' })
  @Post('quick-game/start')
  async startQuickGame(@Body() dto: StartQuickGameDto) {
    try {
      return await this.gamePlayerService.startQuickGame(dto.game_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current turn in Quick Game' })
  @Get('quick-game/current-turn/:gameId')
  async getQuickGameCurrentTurn(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.getQuickGameCurrentTurn(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Select category and difficulty for current turn' })
  @Post('quick-game/select-category')
  async selectQuickGameCategory(@Body() dto: SelectQuickGameCategoryDto) {
    try {
      return await this.gamePlayerService.selectQuickGameCategory(dto.game_id, dto.category_id, dto.difficulty_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get question for current turn' })
  @Get('quick-game/question/:gameId')
  async getQuickGameQuestion(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.getQuickGameQuestion(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Answer question in Quick Game' })
  @Post('quick-game/answer')
  async answerQuickGameQuestion(@Body() dto: AnswerQuickGameQuestionDto) {
    try {
      return await this.gamePlayerService.answerQuickGameQuestion(dto.game_id, dto.question_id, dto.answer_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Steal question when player answers wrong' })
  @Post('quick-game/steal-question')
  async stealQuickGameQuestion(@Body() dto: StealQuickGameQuestionDto) {
    try {
      return await this.gamePlayerService.stealQuickGameQuestion(dto.game_id, dto.question_id, dto.answer_id, dto.user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Quick Game status' })
  @Get('quick-game/status/:gameId')
  async getQuickGameStatus(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.getQuickGameStatus(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'End Quick Game' })
  @Post('quick-game/end')
  async endQuickGame(@Body() dto: EndQuickGameDto) {
    try {
      return await this.gamePlayerService.endQuickGame(dto.game_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add multiple players to Quick Game at once' })
  @Post('quick-game/add-multiple-players')
  async addMultipleQuickGamePlayers(@Body() dto: AddMultipleQuickGamePlayersDto) {
    try {
      return await this.gamePlayerService.addMultipleQuickGamePlayers(dto.game_id, dto.player_names);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add multiple players and start Quick Game immediately' })
  @Post('quick-game/add-players-and-start')
  async addPlayersAndStartQuickGame(@Body() dto: AddPlayersAndStartGameDto) {
    try {
      return await this.gamePlayerService.addPlayersAndStartQuickGame(dto.game_id, dto.player_names);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ===== COMPETITIVE QUICK GAME ENDPOINTS =====

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start Competitive Quick Game' })
  @Post('competitive-quick-game/start/:gameId')
  async startCompetitiveQuickGame(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.startCompetitiveQuickGame(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Select category and difficulty for competitive game' })
  @Post('competitive-quick-game/select-category')
  async selectCompetitiveCategory(@Body() dto: SelectCompetitiveCategoryDto) {
    try {
      return await this.gamePlayerService.selectCompetitiveCategory(dto.game_id, dto.category_id, dto.difficulty_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get next question for competitive game' })
  @Get('competitive-quick-game/question/:gameId')
  async getCompetitiveQuestion(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.getCompetitiveQuestion(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Answer question in competitive game' })
  @Post('competitive-quick-game/answer')
  async answerCompetitiveQuestion(@Body() dto: AnswerCompetitiveQuestionDto) {
    try {
      return await this.gamePlayerService.answerCompetitiveQuestion(dto.game_id, dto.question_id, dto.answer_id, dto.player_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get competitive game status' })
  @Get('competitive-quick-game/status/:gameId')
  async getCompetitiveGameStatus(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.getCompetitiveGameStatus(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get player IDs for a game (debugging helper)' })
  @Get('game/:gameId/player-ids')
  async getGamePlayerIds(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.getGamePlayerIds(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

}