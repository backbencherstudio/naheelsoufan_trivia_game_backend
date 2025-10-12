import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) { }

  // Create a new game
  async create(createGameDto: CreateGameDto) {
    try {
      const game = await this.prisma.game.create({
        data: {
          ...createGameDto,
        },
        select: {
          id: true,
          mode: true,
          status: true,
          language_id: true,
          created_at: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        message: 'Game created successfully',
        data: game,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error creating game: ${error.message}`,
      };
    }
  }

  // Get all games with optional search and pagination
  async findAll(searchQuery: string | null, page: number, limit: number) {
    try {
      const whereClause: any = {};
      if (searchQuery) {
        const searchConditions: any[] = [
          { status: { contains: searchQuery, mode: 'insensitive' } },
          {
            language: {
              name: { contains: searchQuery, mode: 'insensitive' }
            }
          },
        ];

        // Check if searchQuery matches any GameMode enum values (case-insensitive)
        const upperSearchQuery = searchQuery.toUpperCase();
        if (upperSearchQuery === 'QUICK_GAME' || upperSearchQuery === 'GRID_STYLE') {
          searchConditions.push({ mode: { equals: upperSearchQuery } });
        } else if (searchQuery.toLowerCase().includes('quick') || searchQuery.toLowerCase().includes('game')) {
          searchConditions.push({ mode: { equals: 'QUICK_GAME' } });
        } else if (searchQuery.toLowerCase().includes('grid') || searchQuery.toLowerCase().includes('style')) {
          searchConditions.push({ mode: { equals: 'GRID_STYLE' } });
        }

        whereClause['OR'] = searchConditions;
      }

      const total = await this.prisma.game.count({
        where: whereClause,
      });

      const games = await this.prisma.game.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
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
          host: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          game_players: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  name: true,
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
        orderBy: {
          created_at: 'desc',
        },
      });

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        success: true,
        message: games.length ? 'Games retrieved successfully' : 'No games found',
        data: games,
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
        (sum, player) => sum + player.correct_answers + player.wrong_answers + player.skipped_answers,
        0
      );
      const totalCorrect = stats.game_players.reduce((sum, player) => sum + player.correct_answers, 0);
      const totalWrong = stats.game_players.reduce((sum, player) => sum + player.wrong_answers, 0);
      const totalSkipped = stats.game_players.reduce((sum, player) => sum + player.skipped_answers, 0);
      const totalScore = stats.game_players.reduce((sum, player) => sum + player.score, 0);

      const aggregatedStats = {
        ...stats,
        aggregated: {
          total_questions: totalQuestions,
          total_correct: totalCorrect,
          total_wrong: totalWrong,
          total_skipped: totalSkipped,
          total_score: totalScore,
          accuracy_rate: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
          average_score: stats._count.game_players > 0 ? totalScore / stats._count.game_players : 0,
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