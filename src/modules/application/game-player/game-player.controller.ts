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
import {
  StartGameDto,
  EndGameDto,
  UpdateScoreDto,
  GetGameQuestionsDto,
} from './dto/gameplay.dto';
import {
  StartTurnDto,
  SelectCategoryDto,
  AddGuestPlayerDto,
  GetGameStateDto,
  NextTurnDto,
  AnswerQuestionDto as GameFlowAnswerDto,
  StealQuestionDto as GameFlowStealQuestionDto,
  EndGameDto as GameFlowEndDto,
} from './dto/game-flow.dto';
import {
  AddQuickGamePlayerDto,
  StartQuickGameDto,
  SelectQuickGameCategoryDto,
  AnswerQuickGameQuestionDto,
  StealQuickGameQuestionDto,
  EndQuickGameDto,
  GetQuickGameStatusDto,
  AddMultipleQuickGamePlayersDto,
  AddPlayersAndStartGameDto,
  SelectCompetitiveCategoryDto,
  AnswerCompetitiveQuestionDto,
  GetCompetitiveQuestionDto,
  GetCompetitiveGameStatusDto,
  HostSelectCategoryDto,
  HostAnswerQuestionDto,
  HostStealQuestionDto,
  HostSkipQuestionDto,
  HostStartGameDto,
  AddPlayersOnlyDto,
  SelectCategoryAndStartDto,
  PlayerAnswerQuestionDto,
  StealQuestionDto,
} from './dto/quick-game.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QuestionTimeoutDto } from './dto/question-timeout.dto';

@ApiTags('Game Player')
@Controller('game-players')
@ApiBearerAuth()
export class GamePlayerController {
  constructor(private readonly gamePlayerService: GamePlayerService) {}

  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Join a game',
    description:
      'Join a game as a single user. If you are the host and provide user_ids, you can add multiple players when joining your own game.',
  })
  @Post('join')
  async joinGame(@Body() joinGameDto: JoinGameDto, @Req() req: any) {
    const userId = req.user.userId;
    return await this.gamePlayerService.joinGame(userId, joinGameDto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Leave a game' })
  @Post('leave')
  async leaveGame(@Body() leaveGameDto: LeaveGameDto, @Req() req: any) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.leaveGame(
        userId,
        leaveGameDto,
      );
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
  async getPlayerStats(@Param('gameId') gameId: string, @Req() req: any) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.getPlayerStats(
        userId,
        gameId,
      );
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Incomplete || not verified user
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
    summary:
      'Get game questions with multiple categories, difficulty, and question count',
    description:
      'Retrieve questions from multiple selected categories with specified difficulty. Questions are distributed evenly across categories.',
  })
  @Get('get-questions/:gameId')
  async getGameQuestions(
    @Param('gameId') gameId: string,
    @Query() questionsDto: GetGameQuestionsDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return await this.gamePlayerService.getGameQuestions(
      userId,
      gameId,
      questionsDto,
    );
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
      const result = await this.gamePlayerService.answerQuestion(
        gameId,
        answerDto,
      );
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
      const result = await this.gamePlayerService.skipQuestion(
        userId,
        gameId,
        skipDto,
      );
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
  async getGameStatus(@Param('gameId') gameId: string, @Req() req: any) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.getPlayerStats(
        userId,
        gameId,
      );
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
  async getPlayerRanking(@Param('gameId') gameId: string, @Req() req: any) {
    try {
      const userId = req.user.userId;
      const allPlayers = await this.gamePlayerService.getGamePlayers(gameId);

      if (allPlayers.success) {
        const playerIndex = allPlayers.data.findIndex(
          (p) => p.user.id === userId,
        );
        const playerRank = playerIndex !== -1 ? playerIndex + 1 : null;

        return {
          success: true,
          message: 'Player ranking retrieved successfully',
          data: {
            current_rank: playerRank,
            total_players: allPlayers.data.length,
            player_stats: allPlayers.data[playerIndex] || null,
            top_3: allPlayers.data.slice(0, 3),
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
  async startGame(@Body() startGameDto: StartGameDto, @Req() req: any) {
    try {
      const userId = req.user.userId;
      const result = await this.gamePlayerService.startGame(
        userId,
        startGameDto,
      );
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'End game and show final rankings with leaderboard',
  })
  @Post('end-game')
  async endGame(@Body() endGameDto: EndGameDto, @Req() req: any) {
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

  @ApiOperation({
    summary: 'Get comprehensive game results with rankings and leaderboard',
  })
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

      const player = gameState.data.players.find((p) => p.user_id === userId);
      if (!player) {
        return {
          success: false,
          message: 'Player not found in this game',
        };
      }

      return await this.gamePlayerService.startPlayerTurn(
        dto.game_id,
        player.id,
      );
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
      return await this.gamePlayerService.addGuestPlayer(
        dto.game_id,
        dto.player_name,
      );
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
  async removeGuestPlayer(
    @Param('gameId') gameId: string,
    @Param('playerId') playerId: string,
  ) {
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
      return await this.gamePlayerService.addQuickGamePlayer(
        dto.game_id,
        dto.player_name,
      );
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
      return await this.gamePlayerService.selectQuickGameCategory(
        dto.game_id,
        dto.category_id,
        dto.difficulty_id,
      );
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
      return await this.gamePlayerService.answerQuickGameQuestion(
        dto.game_id,
        dto.question_id,
        dto.answer_id,
      );
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
      return await this.gamePlayerService.stealQuickGameQuestion(
        dto.game_id,
        dto.question_id,
        dto.answer_id,
        dto.user_id,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // add player and start game
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add multiple players to Quick Game at once' })
  @Post('quick-game/add-multiple-players')
  async addMultipleQuickGamePlayers(
    @Body() dto: AddMultipleQuickGamePlayersDto,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.userId;
      return await this.gamePlayerService.addMultipleQuickGamePlayers(
        dto.game_id,
        dto.player_names,
        userId,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // @UseGuards(JwtAuthGuard)
  // @ApiOperation({
  //   summary: 'Add multiple players and start Quick Game immediately',
  // })
  // @Post('quick-game/add-players-and-start')
  // async addPlayersAndStartQuickGame(@Body() dto: AddPlayersAndStartGameDto) {
  //   try {
  //     return await this.gamePlayerService.addPlayersAndStartQuickGame(
  //       dto.game_id,
  //       dto.player_names,
  //     );
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

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
  @ApiOperation({
    summary: 'Select category and difficulty for competitive game',
  })
  @Post('competitive-quick-game/select-category')
  async selectCompetitiveCategory(@Body() dto: SelectCompetitiveCategoryDto) {
    try {
      return await this.gamePlayerService.selectCompetitiveCategory(
        dto.game_id,
        dto.category_id,
        dto.difficulty_id,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // steal question/ player specific question || I think no neded
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

  // play game with selected player|| now not select player
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Answer question in competitive game' })
  @Post('competitive-quick-game/answer')
  async answerCompetitiveQuestion(@Body() dto: AnswerCompetitiveQuestionDto) {
    try {
      return await this.gamePlayerService.answerCompetitiveQuestion(
        dto.game_id,
        dto.question_id,
        dto.answer_id,
        dto.player_id,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // for time out or quit game
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('timeout-skiped')
  @ApiOperation({ summary: 'Handle a question timeout' })
  async handleQuestionTimeout(
    @Body() timeoutDto: QuestionTimeoutDto,
    @Req() req: any,
  ) {
    try {
      // টোকেন থেকে আসা userId এবং DTO থেকে আসা playerId একই কিনা তা নিশ্চিত করা যেতে পারে (ঐচ্ছিক নিরাপত্তা স্তর)
      // const requestingUserId = req.user.userId;
      // এখানে আরও লজিক যোগ করা যেতে পারে যে, শুধুমাত্র গেমের হোস্ট বা বর্তমান প্লেয়ারই এই কল করতে পারবে।
      // আপাতত, আমরা ধরে নিচ্ছি যেকোনো অথেনটিকেটেড ইউজার এটি করতে পারে।

      return await this.gamePlayerService.handleQuestionTimeout(
        timeoutDto.game_id,
        timeoutDto.player_id,
        timeoutDto.question_id,
      );
    } catch (error) {
      // সাধারণ এরর হ্যান্ডলিং
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

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Debug JWT token validation' })
  @Get('debug/jwt-test')
  async debugJwtTest(@Req() req: any) {
    try {
      return {
        success: true,
        message: 'JWT token is valid',
        data: {
          user: req.user,
          userId: req.user?.userId,
          email: req.user?.email,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ===== HOST-CONTROLLED GAME ENDPOINTS =====

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Host starts competitive game' })
  @Post('host-game/start/:gameId')
  async hostStartCompetitiveGame(
    @Param('gameId') gameId: string,
    @Req() req: any,
  ) {
    try {
      const hostUserId = req.user.userId;
      return await this.gamePlayerService.hostStartCompetitiveGame(
        gameId,
        hostUserId,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Host selects category and difficulty' })
  @Post('host-game/select-category')
  async hostSelectCategory(
    @Body() dto: HostSelectCategoryDto,
    @Req() req: any,
  ) {
    try {
      const hostUserId = req.user.userId;
      return await this.gamePlayerService.hostSelectCategory(
        dto.game_id,
        dto.category_id,
        dto.difficulty_id,
        hostUserId,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Host gets next question' })
  @Get('host-game/question/:gameId')
  async hostGetQuestion(@Param('gameId') gameId: string, @Req() req: any) {
    try {
      const hostUserId = req.user.userId;
      return await this.gamePlayerService.hostGetQuestion(gameId, hostUserId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Host submits answer on behalf of a player' })
  @Post('host-game/answer')
  async hostAnswerQuestion(
    @Body() dto: HostAnswerQuestionDto,
    @Req() req: any,
  ) {
    try {
      const hostUserId = req.user.userId;
      return await this.gamePlayerService.hostAnswerQuestion(
        dto.game_id,
        dto.question_id,
        dto.answer_id,
        dto.player_id,
        hostUserId,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Host skips a question' })
  @Post('host-game/skip-question')
  async hostSkipQuestion(@Body() dto: HostSkipQuestionDto, @Req() req: any) {
    try {
      const hostUserId = req.user.userId;
      return await this.gamePlayerService.hostSkipQuestion(
        dto.game_id,
        dto.question_id,
        hostUserId,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Host gets game status' })
  @Get('host-game/status/:gameId')
  async hostGetGameStatus(@Param('gameId') gameId: string, @Req() req: any) {
    try {
      const hostUserId = req.user.userId;
      return await this.gamePlayerService.hostGetGameStatus(gameId, hostUserId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ===== QUICK GAME FLOW ENDPOINTS =====

  // eta pore dekhte hobe, abadoto lagche na dekhe coment kore rakhchi

  // @UseGuards(JwtAuthGuard)
  // @ApiOperation({ summary: "Add players only (don't start game)" })
  // @Post('quick-game/add-players')
  // async addPlayersOnly(@Body() dto: AddPlayersOnlyDto) {
  //   try {
  //     return await this.gamePlayerService.addPlayersOnly(
  //       dto.game_id,
  //       dto.player_names,
  //     );
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Select category/difficulty and start game in one step',
  })
  @Post('quick-game/select-category-and-start')
  async selectCategoryAndStart(@Body() dto: SelectCategoryAndStartDto) {
    try {
      return await this.gamePlayerService.selectSingleQuestionForGame(
        dto.game_id,
        dto.category_id,
        dto.difficulty_id,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get question for current player' })
  @Get('quick-game/question/:gameId')
  async getPlayerQuestion(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.getPlayerQuestion(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Player answers question' })
  @Post('quick-game/answer')
  async playerAnswerQuestion(@Body() dto: PlayerAnswerQuestionDto) {
    try {
      return await this.gamePlayerService.playerAnswerQuestion(
        dto.game_id,
        dto.question_id,
        dto.answer_id,
        dto.player_id,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Steal question - forwards same question to next player',
  })
  @Post('quick-game/steal-question')
  async stealQuestion(@Body() dto: StealQuestionDto) {
    try {
      return await this.gamePlayerService.stealQuestion(
        dto.game_id,
        dto.question_id,
        dto.answer_id,
        dto.player_id,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Debug - Get game details and selections' })
  @Get('quick-game/debug/:gameId')
  async getGameDebugInfo(@Param('gameId') gameId: string) {
    try {
      return await this.gamePlayerService.getGameDebugInfo(gameId);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Quick Game status with scores and progress' })
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
  @ApiOperation({ summary: 'End Quick Game and get final results' })
  @Post('quick-game/end')
  async endQuickGame(@Body() dto: { game_id: string }) {
    try {
      return await this.gamePlayerService.endQuickGame(dto.game_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
