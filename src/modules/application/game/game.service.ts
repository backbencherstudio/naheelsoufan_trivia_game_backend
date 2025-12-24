import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { GamePlayerService } from '../game-player/game-player.service';

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamePlayerService: GamePlayerService,
  ) { }

  // Create a new game with subscription validation
  async create(createGameDto: CreateGameDto, user_id: string) {
    try {
      const totalGamesCount = await this.prisma.game.count({
        where: {
          host_id: user_id,
          mode: {
            in: ['QUICK_GAME', 'GRID_STYLE'],
          },
        },
      });

      let activeSubscriptionId: string | null = null;
      let requiresSubscription = false;

      // If user has already created any game (free one used), check for specific subscription
      if (totalGamesCount > 0) {
        requiresSubscription = true;

        const activeSubscription = await this.prisma.subscription.findFirst({
          where: {
            user_id,
            status: 'active',
            subscription_type: {
              type: createGameDto.mode,
            },
          },
          include: {
            subscription_type: true,
          },
        });

        if (!activeSubscription) {
          const gameTypesCreated = await this.getGameTypesCreated(user_id);
          const formattedModeName = createGameDto.mode.replace('_', ' ');
          return {
            success: false,

            message: `No active subscription found for ${formattedModeName}. Please purchase a ${formattedModeName} subscription to create this game.`,
            data: {
              requires_subscription: true,
              required_subscription_type: createGameDto.mode,
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
            message: `No games remaining in your ${createGameDto.mode.replace('_', ' ')} subscription. Please upgrade or purchase a new subscription.`,
            data: {
              subscription_exhausted: true,
              games_limit: activeSubscription.subscription_type.games,
              games_played: activeSubscription.games_played_count,
            },
          };
        }
        activeSubscriptionId = activeSubscription.id;
      }

      // Check games of this specific type (for informational purposes)
      const gamesOfThisType = await this.prisma.game.count({
        where: {
          host_id: user_id,
          mode: createGameDto.mode,
        },
      });

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

      // If user has used their free game and has a subscription, increment the games played count
      if (requiresSubscription && activeSubscriptionId) {
        await this.prisma.subscription.update({
          where: { id: activeSubscriptionId },
          data: { games_played_count: { increment: 1 } },
        });
      }

      const gameTypesCreated = await this.getGameTypesCreated(user_id);
      const isFirstGameOverall = totalGamesCount === 0;

      return {
        success: true,
        message: isFirstGameOverall
          ? `Congratulations! Your first free game created successfully. You can create one free game of any type.`
          : `${createGameDto.mode.replace('_', ' ')} game created successfully using your subscription.`,
        data: {
          ...game,
          is_first_game_overall: isFirstGameOverall,
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

  // Get all categories with optional search and language filter
  async findAllCategory(
    searchQuery: string | null,
    page: number,
    limit: number,
    languageId?: string,
    mode?: string,
    gameId?: string,
    playerId?: string,
  ) {
    try {
      const whereClause: any = {};
      const questionCountWhere: any = {};
      const skip = (page - 1) * limit;

      // --- 1. Base Filters (Search and Language) ---
      if (searchQuery) {
        whereClause['OR'] = [
          { name: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }
      if (languageId) {
        whereClause['language_id'] = languageId;
      }

      // --- 2. GRID_STYLE Mode Logic (Filter by 'Text' Question Type) ---
      let textQuestionTypeId: string | null = null;
      if (mode === 'GRID_STYLE') {
        let questionTypeWhere: any = { name: 'Text' };
        if (languageId) {
          questionTypeWhere.language_id = languageId;
        }

        const textQuestionType = await this.prisma.questionType.findFirst({
          where: questionTypeWhere,
          select: { id: true },
        });

        if (textQuestionType) {
          textQuestionTypeId = textQuestionType.id;
          // Filter categories to only include those that have at least one text question
          whereClause.questions = {
            some: {
              question_type_id: textQuestionTypeId,
            },
          };
          questionCountWhere.question_type_id = textQuestionTypeId;
        } else {
          // If 'Text' question type doesn't exist, ensure an empty list is returned
          whereClause.id = 'impossible_id_to_return_empty_list';
        }
      }

      // Ensure only categories with at least one question are returned
      if (!whereClause.questions) {
        whereClause.questions = {
          some: {},
        };
      }

      // --- 3. Pagination Setup and Data Fetch ---
      const total = await this.prisma.category.count({ where: whereClause });

      let categories = await this.prisma.category.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          image: true,
          same_category_selection: true,
          created_at: true,
          updated_at: true,
          language: { select: { id: true, name: true } },
          // Use Prisma's aggregation to count related questions
          _count: {
            select: {
              questions:
                Object.keys(questionCountWhere).length > 0
                  ? { where: questionCountWhere }
                  : true,
            },
          },
        },
      });

      // --- 4. Mapping: Image URL and Question Count ---
      let finalCategories = categories.map((category) => {
        let image_url = null;
        if (category.image) {
          // Correctly generate the image URL
          image_url = SojebStorage.url(
            appConfig().storageUrl.category + category.image,
          );
        }

        return {
          id: category.id,
          name: category.name,
          image: category.image,
          same_category_selection: category.same_category_selection,
          created_at: category.created_at,
          updated_at: category.updated_at,
          language: category.language,
          image_url: image_url,
          // Map the aggregated question count
          question_count: category._count.questions,
        };
      });

      // --- 5. Integration: Player Category Selection Counts ---
      if (gameId && playerId) {
        try {
          const result =
            await this.gamePlayerService.countPlayerCategorySelections(gameId);
          if (result.success && result.data.length > 0) {
            const playerSelections = result.data.find(
              (p: any) => p.player_id === playerId,
            );

            if (playerSelections && playerSelections.category_counts) {
              const playerCategoryMap = new Map<string, number>();
              playerSelections.category_counts.forEach(
                (item: { category_name: string; count: number }) => {
                  playerCategoryMap.set(item.category_name, item.count);
                },
              );

              // Map counts to the categories
              finalCategories = finalCategories
                .map((category) => ({
                  ...category,
                  selected_count: playerCategoryMap.get(category.name) || 0,
                }))
                .filter(
                  (category) =>
                    category.selected_count < category.same_category_selection,
                );
            }
          }
        } catch (error) {
          // Log error but continue with fetching categories
          console.error(
            `Error fetching player category selections for game ${gameId} and player ${playerId}:`,
            error,
          );
        }
      }

      // --- 6. Final Response and Pagination ---
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        success: true,
        message: finalCategories.length
          ? 'Categories retrieved successfully'
          : 'No categories found',
        data: finalCategories,
        pagination: {
          total: total,
          page: page,
          limit: limit,
          totalPages: totalPages,
          hasNextPage: hasNextPage,
          hasPreviousPage: hasPreviousPage,
        },
      };
    } catch (error) {
      // Log the full error for debugging purposes
      console.error('Failed to fetch category:', error);
      return {
        success: false,
        message: 'Failed to fetch category',
      };
    }
  }
}
