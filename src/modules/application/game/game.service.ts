import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a new game with subscription validation
  async create(createGameDto: CreateGameDto, user_id: string) {
    try {
      // Check how many games the user has created for this specific game type
      const gamesOfThisType = await this.prisma.game.count({
        where: {
          host_id: user_id,
          mode: createGameDto.mode,
        },
      });
      let activeSubscriptionId: string | null = null;
      // Get total games created (for tracking purposes)
      const totalGamesCount = await this.prisma.game.count({
        where: {
          host_id: user_id,
          mode: {
            in: ['QUICK_GAME', 'GRID_STYLE'],
          },
        },
      });

      // If this is not the first game of this type, check for subscription
      if (gamesOfThisType > 0) {
        // Check if user has an active subscription
        const activeSubscription = await this.prisma.subscription.findFirst({
          where: {
            user_id,
            status: 'active',
          },
          include: {
            subscription_type: true,
          },
        });

        if (!activeSubscription) {
          const gameTypesCreated = await this.getGameTypesCreated(user_id);
          return {
            success: false,
            message: `No games remaining in your subscription. Please upgrade or purchase a new subscription.`,
            data: {
              requires_subscription: true,
              games_of_this_type: gamesOfThisType,
              total_games_created: totalGamesCount,
              game_type: createGameDto.mode,
              game_types_created: gameTypesCreated,
            },
          };
        }

        // Check if user has remaining games in their subscription
        const gamesRemaining =
          activeSubscription.subscription_type.games -
          activeSubscription.games_played_count;
        if (
          activeSubscription.subscription_type.games !== -1 &&
          gamesRemaining <= 0
        ) {
          await this.prisma.subscription.update({
            where: { id: activeSubscription.id },
            data: {
              status: 'completed',
            },
          });
          return {
            success: false,
            message:
              'No games remaining in your subscription. Please upgrade or purchase a new subscription.',
            data: {
              subscription_exhausted: true,
              games_limit: activeSubscription.subscription_type.games,
              games_played: activeSubscription.games_played_count,
            },
          };
        }
        activeSubscriptionId = activeSubscription.id;
      }

      // Create the game
      const game = await this.prisma.game.create({
        data: {
          ...createGameDto,
          host_id: user_id,
          subscription_id: activeSubscriptionId,
        },
        select: {
          id: true,
          mode: true,
          status: true,
          language_id: true,
          created_at: true,
          host: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // If user has a subscription and this is not their first game of this type, increment the games played count
      if (gamesOfThisType > 0) {
        if (activeSubscriptionId) {
          await this.prisma.subscription.update({
            where: { id: activeSubscriptionId },
            data: { games_played_count: { increment: 1 } },
          });
        }
      }

      const gameTypesCreated = await this.getGameTypesCreated(user_id);
      const isFirstGameOfType = gamesOfThisType === 0;

      return {
        success: true,
        message: isFirstGameOfType
          ? `Congratulations! Your first ${createGameDto.mode.replace('_', ' ')} game created successfully (FREE). You can also create one free game of the other type.`
          : `${createGameDto.mode.replace('_', ' ')} game created successfully using your subscription.`,
        data: {
          ...game,
          is_first_game_of_type: isFirstGameOfType,
          games_of_this_type: gamesOfThisType + 1,
          total_games_created: totalGamesCount + 1,
          game_types_created: {
            ...gameTypesCreated,
            [createGameDto.mode]:
              (gameTypesCreated[createGameDto.mode] || 0) + 1,
            total: gameTypesCreated.total + 1,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error creating game: ${error.message}`,
      };
    }
  }

  // Helper method to get game types created by user
  async getGameTypesCreated(user_id: string) {
    const games = await this.prisma.game.findMany({
      where: {
        host_id: user_id,
        mode: {
          in: ['QUICK_GAME', 'GRID_STYLE'],
        },
      },
      select: {
        mode: true,
        created_at: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    const gameTypes = {
      QUICK_GAME: games.filter((g) => g.mode === 'QUICK_GAME').length,
      GRID_STYLE: games.filter((g) => g.mode === 'GRID_STYLE').length,
      total: games.length,
      types_created: [...new Set(games.map((g) => g.mode))],
    };

    return gameTypes;
  }

  // Find Player all games
  async playerGames(user_id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found.',
          statusCode: 404,
        };
      }

      const gamesCreatedByUser = await this.prisma.game.findMany({
        where: {
          host_id: user_id,
        },
        select: {
          id: true,
          mode: true,
          status: true,
          created_at: true,
          language: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              game_players: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      const quickGamesCount = gamesCreatedByUser.filter(
        (game) => game.mode === 'QUICK_GAME',
      ).length;
      const gridStyleGamesCount = gamesCreatedByUser.filter(
        (game) => game.mode === 'GRID_STYLE',
      ).length;

      return {
        success: true,
        message: "Player's game information retrieved successfully.",
        data: {
          summary: {
            total_games_created: gamesCreatedByUser.length,
            quick_games_created: quickGamesCount,
            grid_style_games_created: gridStyleGamesCount,
          },
          games: gamesCreatedByUser.map((game) => ({
            id: game.id,
            mode: game.mode,
            status: game.status,
            language: game.language.name,
            player_count: game._count.game_players,
            created_at: game.created_at,
          })),
        },
      };
    } catch (error) {
      console.error(
        `Error fetching player games for user ${user_id}: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: 'An unexpected error occurred while fetching player games.',
        statusCode: 500,
      };
    }
  }

  // Check user's game creation eligibility
  async checkGameCreationEligibility(user_id: string, game_mode?: string) {
    try {
      const gameTypesCreated = await this.getGameTypesCreated(user_id);

      // If checking for a specific game mode
      if (game_mode) {
        const gamesOfThisType = gameTypesCreated[game_mode] || 0;

        // If no games of this type created yet, it's free
        if (gamesOfThisType === 0) {
          return {
            success: true,
            message: `You can create your first ${game_mode.replace('_', ' ')} game for free!`,
            data: {
              can_create_game: true,
              is_first_game_of_type: true,
              game_mode: game_mode,
              games_of_this_type: gamesOfThisType,
              requires_subscription: false,
              game_types_created: gameTypesCreated,
            },
          };
        }
      }

      // Check available free games
      const quickGamesCreated = gameTypesCreated.QUICK_GAME || 0;
      const gridGamesCreated = gameTypesCreated.GRID_STYLE || 0;
      const availableFreeGames = [];

      if (quickGamesCreated === 0) availableFreeGames.push('QUICK_GAME');
      if (gridGamesCreated === 0) availableFreeGames.push('GRID_STYLE');

      // If user still has free games available
      if (availableFreeGames.length > 0) {
        return {
          success: true,
          message: `You can create ${availableFreeGames.length === 2 ? 'both' : 'one more'} free game${availableFreeGames.length === 2 ? 's' : ''}! Available: ${availableFreeGames.map((g) => g.replace('_', ' ')).join(' and ')}.`,
          data: {
            can_create_game: true,
            has_free_games_available: true,
            available_free_games: availableFreeGames,
            requires_subscription: false,
            game_types_created: gameTypesCreated,
          },
        };
      }

      // Check for active subscription
      const activeSubscription = await this.prisma.subscription.findFirst({
        where: {
          user_id,
          status: 'active',
        },
        include: {
          subscription_type: true,
        },
      });

      if (!activeSubscription) {
        return {
          success: true,
          message:
            'You have used your free games for both game types. A subscription is required to create more games.',
          data: {
            can_create_game: false,
            has_free_games_available: false,
            available_free_games: [],
            requires_subscription: true,
            subscription_status: 'none',
            game_types_created: gameTypesCreated,
          },
        };
      }

      // Check subscription limits
      const gamesRemaining =
        activeSubscription.subscription_type.games -
        activeSubscription.games_played_count;
      const hasUnlimitedGames =
        activeSubscription.subscription_type.games === -1;

      if (!hasUnlimitedGames && gamesRemaining <= 0) {
        return {
          success: true,
          message:
            'Your subscription has no remaining games. Please upgrade or renew your subscription.',
          data: {
            can_create_game: false,
            has_free_games_available: false,
            available_free_games: [],
            requires_subscription: false,
            subscription_status: 'exhausted',
            subscription_type: activeSubscription.subscription_type.type,
            games_limit: activeSubscription.subscription_type.games,
            games_played: activeSubscription.games_played_count,
            games_remaining: 0,
            game_types_created: gameTypesCreated,
          },
        };
      }

      return {
        success: true,
        message: hasUnlimitedGames
          ? 'You can create unlimited games with your subscription!'
          : `You can create ${gamesRemaining} more games with your subscription.`,
        data: {
          can_create_game: true,
          has_free_games_available: false,
          available_free_games: [],
          requires_subscription: false,
          subscription_status: 'active',
          subscription_type: activeSubscription.subscription_type.type,
          games_limit: activeSubscription.subscription_type.games,
          games_played: activeSubscription.games_played_count,
          games_remaining: hasUnlimitedGames ? -1 : gamesRemaining,
          game_types_created: gameTypesCreated,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error checking game creation eligibility: ${error.message}`,
      };
    }
  }

  // Get all games with optional search
  async findAll(searchQuery: string | null) {
    try {
      const whereClause = {};
      if (searchQuery) {
        whereClause['OR'] = [
          { mode: { contains: searchQuery, mode: 'insensitive' } },
          { status: { contains: searchQuery, mode: 'insensitive' } },
          {
            language: {
              name: { contains: searchQuery, mode: 'insensitive' },
            },
          },
        ];
      }

      const games = await this.prisma.game.findMany({
        where: whereClause,
        select: {
          id: true,
          mode: true,
          status: true,
          created_at: true,
          updated_at: true,
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              game_players: true,
              rooms: true,
              leaderboards: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      return {
        success: true,
        message: games.length
          ? 'Games retrieved successfully'
          : 'No games found',
        data: games,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching games: ${error.message}`,
      };
    }
  }

  // Get a single game by ID
  async findOne(id: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id },
        select: {
          id: true,
          mode: true,
          status: true,
          created_at: true,
          updated_at: true,
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          game_players: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
              score: true,
              correct_answers: true,
              wrong_answers: true,
              skipped_answers: true,
              player_order: true,
              final_rank: true,
            },
          },
          rooms: {
            select: {
              id: true,
              code: true,
              host: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              game_players: true,
              rooms: true,
              leaderboards: true,
            },
          },
        },
      });

      return {
        success: true,
        message: game ? 'Game retrieved successfully' : 'Game not found',
        data: game,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching game: ${error.message}`,
      };
    }
  }

  // Update an existing game
  async update(id: string, updateGameDto: UpdateGameDto) {
    try {
      const updatedGame = await this.prisma.game.update({
        where: { id },
        data: {
          ...updateGameDto,
        },
        select: {
          id: true,
          mode: true,
          status: true,
          language_id: true,
          created_at: true,
          updated_at: true,
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Game updated successfully',
        data: updatedGame,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error updating game: ${error.message}`,
      };
    }
  }

  // Delete a game by ID
  async remove(id: string) {
    try {
      // Check if game exists
      const game = await this.prisma.game.findUnique({
        where: { id },
        select: {
          id: true,
          _count: {
            select: {
              game_players: true,
              rooms: true,
            },
          },
        },
      });

      if (!game) {
        return {
          success: false,
          message: 'Game not found',
        };
      }

      // Check if game has active players or rooms
      if (game._count.game_players > 0 || game._count.rooms > 0) {
        return {
          success: false,
          message: 'Cannot delete game with active players or rooms',
        };
      }

      // Delete the game record
      await this.prisma.game.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Game deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error deleting game: ${error.message}`,
      };
    }
  }

  // Get game statistics
  async getGameStats(id: string) {
    try {
      const stats = await this.prisma.game.findUnique({
        where: { id },
        select: {
          id: true,
          mode: true,
          status: true,
          _count: {
            select: {
              game_players: true,
              rooms: true,
              leaderboards: true,
            },
          },
          game_players: {
            select: {
              score: true,
              correct_answers: true,
              wrong_answers: true,
              skipped_answers: true,
            },
          },
        },
      });

      if (!stats) {
        return {
          success: false,
          message: 'Game not found',
        };
      }

      // Calculate aggregate statistics
      const totalQuestions = stats.game_players.reduce(
        (sum, player) =>
          sum +
          player.correct_answers +
          player.wrong_answers +
          player.skipped_answers,
        0,
      );
      const totalCorrect = stats.game_players.reduce(
        (sum, player) => sum + player.correct_answers,
        0,
      );
      const totalWrong = stats.game_players.reduce(
        (sum, player) => sum + player.wrong_answers,
        0,
      );
      const totalSkipped = stats.game_players.reduce(
        (sum, player) => sum + player.skipped_answers,
        0,
      );
      const totalScore = stats.game_players.reduce(
        (sum, player) => sum + player.score,
        0,
      );

      const aggregatedStats = {
        ...stats,
        aggregated: {
          total_questions: totalQuestions,
          total_correct: totalCorrect,
          total_wrong: totalWrong,
          total_skipped: totalSkipped,
          total_score: totalScore,
          accuracy_rate:
            totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
          average_score:
            stats._count.game_players > 0
              ? totalScore / stats._count.game_players
              : 0,
        },
      };

      return {
        success: true,
        message: 'Game statistics retrieved successfully',
        data: aggregatedStats,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching game statistics: ${error.message}`,
      };
    }
  }
}
