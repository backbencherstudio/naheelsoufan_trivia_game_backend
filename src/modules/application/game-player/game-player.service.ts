import {
  Injectable,
  BadRequestException,
  NotFoundException,
  HttpException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JoinGameDto, LeaveGameDto } from './dto/join-game.dto';
import { GameMode } from '@prisma/client';
import { AnswerQuestionDto, SkipQuestionDto } from './dto/answer-question.dto';
import {
  StartGameDto,
  EndGameDto,
  UpdateScoreDto,
  GetGameQuestionsDto,
} from './dto/gameplay.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { MessageGateway } from 'src/modules/chat/message/message.gateway';
import { checkTextAnswer } from 'src/common/helper/stringSimilarity.helper';

@Injectable()
export class GamePlayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gatway: MessageGateway,
  ) {}

  // Join a game
  async joinGame(userId: string, joinGameDto: JoinGameDto) {
    try {
      const { game_id, user_ids, room_code } = joinGameDto;

      // Check if game exists and is active
      // Check if game exists
      const game = await this.prisma.game.findUnique({
        where: { id: game_id },
        include: {
          _count: {
            select: { game_players: true },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      const isHost = game.host_id === userId;

      // Check game status - allow host to join their own game even if not active
      if (!isHost && game.status !== 'active') {
        throw new BadRequestException('Game is not active');
      }

      // If host is joining and has user_ids, handle host adding players scenario
      if (isHost && user_ids && user_ids.length > 0) {
        return await this.hostJoinWithPlayers(userId, joinGameDto, game);
      }

      // Check if game is full for single user joining (assume max 8 players)
      const maxPlayers = 8;
      if (game._count.game_players >= maxPlayers) {
        throw new BadRequestException('Game is full');
      }

      // Check if user is already in the game
      const existingPlayer = await this.prisma.gamePlayer.findFirst({
        where: {
          game_id: game_id,
          user_id: userId,
        },
      });

      if (existingPlayer) {
        throw new BadRequestException('User already in this game');
      }

      // Handle room joining if room_code is provided
      let roomId = null;
      if (room_code) {
        const room = await this.prisma.room.findUnique({
          where: { code: room_code },
          include: { game: true },
        });

        if (!room || room.game_id !== game_id) {
          throw new BadRequestException('Invalid room code for this game');
        }
        roomId = room.id;
      }

      // Determine player order
      const playerOrder = game._count.game_players + 1;

      const gamePlayer = await this.prisma.gamePlayer.create({
        data: {
          game_id: joinGameDto.game_id,
          user_id: userId,
          room_id: roomId,
          player_order: playerOrder,
        },
        select: {
          id: true,
          game_id: true,
          user_id: true,
          room_id: true,
          score: true,
          correct_answers: true,
          wrong_answers: true,
          skipped_answers: true,
          player_order: true,
          final_rank: true,
          created_at: true,
          updated_at: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          game: {
            select: {
              id: true,
              mode: true,
              status: true,
            },
          },
          room: {
            select: {
              id: true,
              code: true,
            },
          },
        },
      });

      await this.prisma.game.update({
        where: { id: game_id },
        data: {
          ...(isHost && { status: 'active' }), // Set to active when host joins
        },
      });

      return {
        success: true,
        message: isHost
          ? 'Host successfully joined the game'
          : 'Successfully joined the game',
        data: {
          ...gamePlayer,
          is_host: isHost,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error joining game: ${error.message}`,
      );
    }
  }

  // Host joins their game and adds other players
  private async hostJoinWithPlayers(
    userId: string,
    joinGameDto: JoinGameDto,
    game: any,
  ) {
    // Remove duplicates from userIds array and ensure host is included
    const uniqueUserIds = Array.from(
      new Set([userId, ...joinGameDto.user_ids]),
    );

    // Check if adding all users would exceed max_players
    const maxPlayers = 8;
    const totalPlayersAfterJoining =
      game._count.game_players + uniqueUserIds.length;
    if (totalPlayersAfterJoining > maxPlayers) {
      throw new BadRequestException(
        `Cannot add ${uniqueUserIds.length} users. Game allows maximum ${maxPlayers} players. Currently has ${game._count.game_players} players.`,
      );
    }

    // Check if any users are already in the game
    const existingPlayers = await this.prisma.gamePlayer.findMany({
      where: {
        game_id: joinGameDto.game_id,
        user_id: { in: uniqueUserIds },
      },
      select: {
        user_id: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (existingPlayers.length > 0) {
      const existingUserNames = existingPlayers
        .map((p) => p.user.name || p.user.email)
        .join(', ');
      throw new BadRequestException(
        `Some users are already in this game: ${existingUserNames}`,
      );
    }

    // Verify all user IDs exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    if (users.length !== uniqueUserIds.length) {
      const foundUserIds = users.map((u) => u.id);
      const missingUserIds = uniqueUserIds.filter(
        (id) => !foundUserIds.includes(id),
      );
      throw new BadRequestException(
        `Some users not found: ${missingUserIds.join(', ')}`,
      );
    }

    // Handle room joining if room_code is provided
    let roomId = null;
    if (joinGameDto.room_code) {
      const room = await this.prisma.room.findUnique({
        where: { code: joinGameDto.room_code },
        include: { game: true },
      });

      if (!room || room.game_id !== joinGameDto.game_id) {
        throw new BadRequestException('Invalid room code for this game');
      }
      roomId = room.id;
    }

    // Create game players for all users (host first, then others)
    const sortedUserIds = [
      userId,
      ...uniqueUserIds.filter((id) => id !== userId),
    ];
    const gamePlayersData = sortedUserIds.map((playerId, index) => ({
      game_id: joinGameDto.game_id,
      user_id: playerId,
      room_id: roomId,
      player_order: game._count.game_players + index + 1,
    }));

    // Use transaction to ensure all players are added or none
    const result = await this.prisma.$transaction(async (tx) => {
      // Create all game players
      const createdPlayers = await Promise.all(
        gamePlayersData.map((data) =>
          tx.gamePlayer.create({
            data,
            select: {
              id: true,
              game_id: true,
              user_id: true,
              room_id: true,
              score: true,
              correct_answers: true,
              wrong_answers: true,
              skipped_answers: true,
              player_order: true,
              final_rank: true,
              created_at: true,
              updated_at: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                },
              },
            },
          }),
        ),
      );

      // Set game to active
      await tx.game.update({
        where: { id: joinGameDto.game_id },
        data: {
          status: 'active',
        },
      });

      return createdPlayers;
    });

    // Get updated game info
    const updatedGame = await this.prisma.game.findUnique({
      where: { id: joinGameDto.game_id },
      include: {
        _count: {
          select: { game_players: true },
        },
      },
    });

    const hostPlayer = result.find((p) => p.user_id === userId);

    return {
      success: true,
      message: `Host joined and added ${uniqueUserIds.length - 1} additional players to the game`,
      data: {
        game: updatedGame,
        host_player: hostPlayer,
        all_players: result,
        total_players: uniqueUserIds.length,
        remaining_slots: 8 - updatedGame._count.game_players,
        is_host: true,
        added_players: result.filter((p) => p.user_id !== userId),
      },
    };
  }

  // Leave a game
  async leaveGame(userId: string, leaveGameDto: LeaveGameDto) {
    try {
      // Its for multiplayer game
      const gamePlayer = await this.prisma.gamePlayer.findFirst({
        where: {
          game_id: leaveGameDto.game_id,
          user_id: userId,
        },
      });

      if (!gamePlayer) {
        throw new NotFoundException('Player not found in this game');
      }
      // eta single mobile play er jonno
      if (gamePlayer) {
        await this.prisma.gamePlayer.deleteMany({
          where: { user_id: gamePlayer.user_id },
        });
      }

      // Game player count is automatically managed by the relation

      return {
        success: true,
        message: 'Successfully left the game',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error leaving game: ${error.message}`,
      };
    }
  }

  // Get player's game statistics
  async getPlayerStats(userId: string, gameId: string) {
    try {
      const gamePlayer = await this.prisma.gamePlayer.findFirst({
        where: {
          game_id: gameId,
          user_id: userId,
        },
        select: {
          id: true,
          score: true,
          correct_answers: true,
          wrong_answers: true,
          skipped_answers: true,
          player_order: true,
          final_rank: true,
          created_at: true,
          updated_at: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          game: {
            select: {
              id: true,
              mode: true,
            },
          },
        },
      });

      if (!gamePlayer) {
        throw new NotFoundException('Player not found in this game');
      }

      return {
        success: true,
        message: 'Player statistics retrieved successfully',
        data: gamePlayer,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching player statistics: ${error.message}`,
      };
    }
  }

  // Get all players in a game
  async getGamePlayers(gameId: string) {
    try {
      const players = await this.prisma.gamePlayer.findMany({
        where: { game_id: gameId },
        select: {
          id: true,
          score: true,
          correct_answers: true,
          wrong_answers: true,
          skipped_answers: true,
          player_order: true,
          final_rank: true,
          created_at: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          game: {
            select: {
              id: true,
              mode: true,
            },
          },
        },
        orderBy: [
          { final_rank: 'asc' },
          { score: 'desc' },
          { player_order: 'asc' },
        ],
      });

      return {
        success: true,
        message: 'Game players retrieved successfully',
        data: players,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching game players: ${error.message}`,
      };
    }
  }

  // Answer a question (for gameplay)
  async answerQuestion(gameId: string, answerDto: AnswerQuestionDto) {
    try {
      const gamePlayer = await this.prisma.gamePlayer.findFirst({
        where: {
          // game_id: gameId,
          user_id: answerDto.user_id,
        },
      });

      if (!gamePlayer) {
        throw new NotFoundException('Player not found in this game');
      }

      // Get question with answers
      const question = await this.prisma.question.findUnique({
        where: { id: answerDto.question_id },
        include: { answers: true },
      });

      if (!question) {
        throw new NotFoundException('Question not found');
      }

      // Find the selected answer
      const selectedAnswer = question.answers.find(
        (a) => a.id === answerDto.answer_id,
      );
      if (!selectedAnswer) {
        throw new BadRequestException('Invalid answer selected');
      }

      // Check if already answered
      const existingAnswer = await this.prisma.playerAnswer.findFirst({
        where: {
          game_player_id: gamePlayer.id,
          question_id: answerDto.question_id,
        },
      });

      if (existingAnswer) {
        throw new BadRequestException('Question already answered');
      }

      // Create player answer
      await this.prisma.playerAnswer.create({
        data: {
          game_player_id: gamePlayer.id,
          question_id: answerDto.question_id,
          answer_id: answerDto.answer_id,
          isCorrect: selectedAnswer.is_correct,
        },
      });

      // Update player stats
      const pointsEarned = selectedAnswer.is_correct ? question.points : 0;
      const updatedPlayer = await this.prisma.gamePlayer.update({
        where: { id: gamePlayer.id },
        data: {
          score: { increment: pointsEarned },
          ...(selectedAnswer.is_correct
            ? { correct_answers: { increment: 1 } }
            : { wrong_answers: { increment: 1 } }),
        },
      });

      return {
        success: true,
        message: selectedAnswer.is_correct ? 'Correct!' : 'Incorrect!',
        data: {
          is_correct: selectedAnswer.is_correct,
          points_earned: pointsEarned,
          current_score: updatedPlayer.score,
          correct_answer: selectedAnswer.is_correct
            ? null
            : question.answers.find((a) => a.is_correct),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error answering question: ${error.message}`,
      };
    }
  }

  // Skip a question
  async skipQuestion(userId: string, gameId: string, skipDto: SkipQuestionDto) {
    try {
      const gamePlayer = await this.prisma.gamePlayer.findFirst({
        where: {
          game_id: gameId,
          user_id: userId,
        },
      });

      if (!gamePlayer) {
        throw new NotFoundException('Player not found in this game');
      }

      await this.prisma.gamePlayer.update({
        where: { id: gamePlayer.id },
        data: {
          skipped_answers: { increment: 1 },
        },
      });

      return {
        success: true,
        message: 'Question skipped',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error skipping question: ${error.message}`,
      };
    }
  }

  // Get all available categories for a game
  async getGameCategories(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      const categories = await this.prisma.category.findMany({
        where: {
          language_id: game.language_id,
        },
        include: {
          _count: {
            select: {
              questions: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Game categories retrieved successfully',
        data: {
          game_info: {
            id: game.id,
            mode: game.mode,
            status: game.status,
            language: game.language,
          },
          categories: categories.map((category) => ({
            id: category.id,
            name: category.name,
            image: category.image,
            total_questions: category._count.questions,
          })),
          total_categories: categories.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching game categories: ${error.message}`,
      };
    }
  }

  // Start game - just initialize the game
  async startGame(userId: string, startGameDto: StartGameDto) {
    try {
      // Verify user is in the game
      const gamePlayer = await this.prisma.gamePlayer.findFirst({
        where: {
          game_id: startGameDto.game_id,
          user_id: userId,
        },
      });

      if (!gamePlayer) {
        throw new NotFoundException('Player not found in this game');
      }

      // Update game status to in_progress
      await this.prisma.game.update({
        where: { id: startGameDto.game_id },
        data: { status: 'in_progress' },
      });

      // Get game info
      const game = await this.prisma.game.findUnique({
        where: { id: startGameDto.game_id },
        include: {
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
              score: true,
              player_order: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                },
              },
            },
            orderBy: {
              player_order: 'asc',
            },
          },
        },
      });

      return {
        success: true,
        message: 'Game started successfully',
        data: {
          game_info: {
            id: game.id,
            mode: game.mode,
            status: 'in_progress',
            max_players: 8,
            current_players: game.game_players.length,
            language: game.language,
          },
          players: game.game_players,
          current_player: gamePlayer,
          message:
            'Game is now ready. Use get-questions endpoint to fetch questions with your selections.',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error starting game: ${error.message}`,
      };
    }
  }

  // Get questions with category, difficulty, and question count selection
  async getGameQuestions(
    userId: string,
    gameId: string,
    questionsDto: GetGameQuestionsDto,
  ) {
    try {
      // Verify user is in the game
      const gamePlayer = await this.prisma.gamePlayer.findFirst({
        where: {
          game_id: gameId,
          user_id: userId,
        },
      });

      if (!gamePlayer) {
        throw new NotFoundException('Player not found in this game');
      }

      // Verify categories belong to the game
      const categories = await this.prisma.category.findMany({
        where: {
          id: { in: questionsDto.category_ids },
        },
        include: {
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      if (categories.length === 0) {
        throw new NotFoundException('No valid categories found');
      }

      if (categories.length !== questionsDto.category_ids.length) {
        const foundCategoryIds = categories.map((c) => c.id);
        const missingCategoryIds = questionsDto.category_ids.filter(
          (id) => !foundCategoryIds.includes(id),
        );
        throw new NotFoundException(
          `Categories not found: ${missingCategoryIds.join(', ')}`,
        );
      }

      const whereClause = {
        category_id: { in: questionsDto.category_ids },
        difficulty_id: questionsDto.difficulty_id,
      };

      const totalAvailableQuestions = await this.prisma.question.count({
        where: whereClause,
      });

      if (totalAvailableQuestions === 0) {
        throw new NotFoundException(
          'No questions found for selected categories and difficulty',
        );
      }

      // Determine total questions to fetch (default to 10, max 10)
      const totalQuestionLimit = questionsDto.question_count
        ? Math.min(questionsDto.question_count, 10, totalAvailableQuestions)
        : Math.min(10, totalAvailableQuestions);

      // Calculate questions per category (distribute evenly)
      const questionsPerCategory = Math.ceil(
        totalQuestionLimit / questionsDto.category_ids.length,
      );

      // Get questions from each category separately to ensure distribution
      const allSelectedQuestions = [];
      const categoryResults = [];

      for (const categoryId of questionsDto.category_ids) {
        const categoryWhereClause = {
          category_id: categoryId,
          difficulty_id: questionsDto.difficulty_id,
        };

        // Count available questions for this category
        const categoryQuestionCount = await this.prisma.question.count({
          where: categoryWhereClause,
        });

        // Store category info for response (even if no questions available)
        const categoryInfo = categories.find((c) => c.id === categoryId);

        if (categoryQuestionCount > 0) {
          // Get question IDs for this category
          const categoryQuestionIds = await this.prisma.question.findMany({
            where: categoryWhereClause,
            select: {
              id: true,
            },
          });

          // Randomly shuffle and select questions for this category
          const shuffledIds = categoryQuestionIds.sort(
            () => 0.5 - Math.random(),
          );
          const categoryLimit = Math.min(
            questionsPerCategory,
            categoryQuestionCount,
          );
          const selectedCategoryIds = shuffledIds
            .slice(0, categoryLimit)
            .map((q) => q.id);

          allSelectedQuestions.push(...selectedCategoryIds);

          categoryResults.push({
            category: categoryInfo,
            questions_count: selectedCategoryIds.length,
            available_count: categoryQuestionCount,
          });
        } else {
          // Add category even if no questions available (for debugging)
          categoryResults.push({
            category: categoryInfo,
            questions_count: 0,
            available_count: 0,
          });
        }
      }

      // If we have fewer questions than requested, try to get more from available categories
      let finalSelectedIds = allSelectedQuestions;

      if (finalSelectedIds.length < totalQuestionLimit) {
        // Try to get more questions from categories that have available questions
        const categoriesWithQuestions = categoryResults.filter(
          (cr) => cr.available_count > cr.questions_count,
        );

        for (const categoryResult of categoriesWithQuestions) {
          if (finalSelectedIds.length >= totalQuestionLimit) break;

          const additionalNeeded = totalQuestionLimit - finalSelectedIds.length;
          const maxAdditionalFromCategory =
            categoryResult.available_count - categoryResult.questions_count;
          const additionalToGet = Math.min(
            additionalNeeded,
            maxAdditionalFromCategory,
          );

          if (additionalToGet > 0) {
            // Get additional questions from this category
            const additionalQuestions = await this.prisma.question.findMany({
              where: {
                category_id: categoryResult.category.id,
                difficulty_id: questionsDto.difficulty_id,
                id: { notIn: finalSelectedIds },
              },
              select: { id: true },
              take: additionalToGet,
            });

            const additionalIds = additionalQuestions.map((q) => q.id);
            finalSelectedIds.push(...additionalIds);

            // Update the category result
            categoryResult.questions_count += additionalIds.length;
          }
        }
      }

      // Shuffle the final selection and limit to requested amount
      finalSelectedIds = finalSelectedIds
        .sort(() => 0.5 - Math.random())
        .slice(0, totalQuestionLimit);

      // Fetch the selected questions with full details
      const questions = await this.prisma.question.findMany({
        where: {
          id: {
            in: finalSelectedIds,
          },
        },
        select: {
          id: true,
          text: true,
          points: true,
          time: true,
          file_url: true,
          category: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          difficulty: {
            select: {
              id: true,
              name: true,
            },
          },
          question_type: {
            select: {
              id: true,
              name: true,
            },
          },
          answers: {
            select: {
              id: true,
              text: true,
              file_url: true,
              // Don't include is_correct for security
            },
          },
        },
        orderBy: {
          points: 'asc', // Still order by points for consistency
        },
      });

      // Add file URLs for questions and answers
      for (const question of questions) {
        if (question.file_url) {
          question['file_url'] = SojebStorage.url(
            appConfig().storageUrl.question + question.file_url,
          );
        }
        if (question.answers && question.answers.length > 0) {
          for (const answer of question.answers) {
            if (answer.file_url) {
              answer['file_url'] = SojebStorage.url(
                appConfig().storageUrl.answer + answer.file_url,
              );
            }
          }
        }
      }

      // Create informative message based on results
      const totalCategoriesRequested = questionsDto.category_ids.length;
      const categoriesWithQuestions = categoryResults.filter(
        (cr) => cr.questions_count > 0,
      ).length;
      const categoriesWithoutQuestions = categoryResults.filter(
        (cr) => cr.questions_count === 0,
      );

      let message = `Questions retrieved successfully from ${categoriesWithQuestions} of ${totalCategoriesRequested} categories`;
      if (categoriesWithoutQuestions.length > 0) {
        const missingCategoryNames = categoriesWithoutQuestions
          .map((cr) => cr.category?.name || 'Unknown')
          .join(', ');
        message += `. Note: No questions available for difficulty '${questions[0]?.difficulty?.name || 'Unknown'}' in categories: ${missingCategoryNames}`;
      }

      return {
        success: true,
        message: message,
        data: {
          selected_criteria: {
            categories: categoryResults,
            difficulty: questions[0]?.difficulty || null,
            requested_questions: questionsDto.question_count || 'default',
            actual_questions: questions.length,
            total_available: totalAvailableQuestions,
            questions_per_category: questionsPerCategory,
            debug_info: {
              categories_requested: questionsDto.category_ids,
              categories_found: categories.map((c) => ({
                id: c.id,
                name: c.name,
              })),
              categories_with_questions: categoriesWithQuestions,
              categories_without_questions: categoriesWithoutQuestions.length,
            },
          },
          questions: questions.map((question, index) => ({
            question_number: index + 1,
            id: question.id,
            text: question.text,
            points: question.points,
            time_limit: question.time,
            file_url: question.file_url,
            category: question.category,
            difficulty: question.difficulty,
            question_type: question.question_type,
            answers: question.answers,
            is_answered: false, // Initially all questions are unanswered
          })),
          total_questions: questions.length,
          categories_breakdown: categoryResults.map((cr) => ({
            category_id: cr.category.id,
            category_name: cr.category.name,
            questions_selected: cr.questions_count,
            questions_available: cr.available_count,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching questions: ${error.message}`,
      };
    }
  }

  // End game - calculate final rankings and create leaderboard entries
  async endGame(userId: string, endGameDto: EndGameDto) {
    try {
      const gameId = endGameDto.game_id;
      const gamePlayer = await this.prisma.gamePlayer.findFirst({
        where: {
          game_id: gameId,
          user_id: userId,
        },
      });

      if (!gamePlayer) {
        return {
          success: false,
          message: 'You are not a player in this game and cannot end it.',
          statusCode: 403,
        };
      }

      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          language: { select: { id: true, name: true, code: true } },
          host: { select: { id: true, name: true, email: true, avatar: true } },
        },
      });

      if (!game) {
        return { success: false, message: 'Game not found', statusCode: 404 };
      }

      if (game.status !== 'completed') {
        const allPlayersForRanking = await this.prisma.gamePlayer.findMany({
          where: { game_id: gameId },
          orderBy: [
            { score: 'desc' },
            { correct_answers: 'desc' },
            { player_order: 'asc' },
          ],
        });

        const updateRankPromises = allPlayersForRanking.map((player, index) => {
          const newRank = index + 1;
          if (player.final_rank !== newRank) {
            return this.prisma.gamePlayer.update({
              where: { id: player.id },
              data: { final_rank: newRank },
            });
          }
          return Promise.resolve(null);
        });
        await Promise.all(updateRankPromises.filter(Boolean));

        await this.prisma.game.update({
          where: { id: gameId },
          data: { status: 'completed' },
        });
        game.status = 'completed';
      }

      const finalRankingsData = await this.prisma.gamePlayer.findMany({
        where: { game_id: gameId },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
          player_answers: {
            select: {
              question_id: true,
              answer_id: true,
              isCorrect: true,
              question: {
                select: {
                  text: true,
                  answers: {
                    select: {
                      id: true,
                      text: true,
                      is_correct: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ final_rank: 'asc' }],
      });

      const podium = {
        first_place: finalRankingsData.find((p) => p.final_rank === 1) || null,
        second_place: finalRankingsData.find((p) => p.final_rank === 2) || null,
        third_place: finalRankingsData.find((p) => p.final_rank === 3) || null,
      };

      return {
        success: true,
        message: 'Game results retrieved successfully',
        data: {
          game_info: {
            id: game.id,
            mode: game.mode,
            status: game.status,
            language: game.language,
            total_players: finalRankingsData.length,
            max_players: 8,
            host_user: game.host,
          },
          final_rankings: finalRankingsData.map((p) => {
            const isOnlinePlayer = !p.is_guest && p.user;
            return {
              position: p.final_rank,
              player_id: isOnlinePlayer ? p.user_id : p.id,
              player_name: isOnlinePlayer ? p.user.name : p.player_name,
              score: p.score,
              correct_answers: p.correct_answers,
              wrong_answers: p.wrong_answers,
              skipped_answers: p.skipped_answers,
              total_questions:
                p.correct_answers + p.wrong_answers + p.skipped_answers,
              accuracy:
                p.correct_answers + p.wrong_answers > 0
                  ? `${((p.correct_answers / (p.correct_answers + p.wrong_answers)) * 100).toFixed(2)}%`
                  : '0%',
              player_order: p.player_order,
              created_at: p.created_at,
            };
          }),
          podium: podium,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'An unexpected error occurred while ending the game.',
        statusCode: 500,
      };
    }
  }

  // Get UnPlayed Games for a User
  async findUnplayedGames(userId: string, mode: string) {
    try {
      const unplayedGames = await this.prisma.game.findMany({
        where: {
          host_id: userId,
          game_phase: 'waiting',
          mode: mode as GameMode,
          rooms: {
            none: {},
          },
        },

        include: {
          game_players: {
            select: {
              id: true,
              player_name: true,
              player_order: true,
              score: true,
              user_id: true,
              is_guest: true,
            },
            orderBy: {
              player_order: 'asc',
            },
          },
          language: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      if (!unplayedGames || unplayedGames.length === 0) {
        return {
          success: true,
          message: `No waiting ${mode.replace('_', ' ')} games found for this player.`,
          data: [],
        };
      }

      const formattedGames = unplayedGames.map((game) => {
        const hostPlayerInfo = game.game_players.find(
          (p) => p.user_id === userId && !p.is_guest,
        );

        return {
          game_info: {
            id: game.id,
            mode: game.mode,
            status: game.status,
            game_phase: game.game_phase,
            current_question: game.current_question,
            total_questions: game.total_questions,
            current_player_id: game.current_player_id,
            language: game.language,
            room_code: null,
          },
          your_player_info: hostPlayerInfo
            ? {
                id: hostPlayerInfo.id,
                player_name: hostPlayerInfo.player_name,
                player_order: hostPlayerInfo.player_order,
                score: hostPlayerInfo.score,
              }
            : null,
          all_players: game.game_players,
        };
      });

      return {
        success: true,
        message: `Found ${formattedGames.length} waiting ${mode.replace('_', ' ')} game(s).`,
        data: formattedGames,
      };
    } catch (error) {
      console.error(
        `Error finding unplayed games for user ${userId}: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message:
          'An unexpected error occurred while searching for active games.',
        statusCode: 500,
      };
    }
  }

  // Rejoin a game using game ID
  async rejoinUnplayedGame(userId: string, gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: {
          id: gameId,
          rooms: {
            none: {},
          },
        },
        include: {
          game_players: {
            select: {
              id: true,
              player_name: true,
              player_order: true,
              score: true,
              user_id: true,
              is_guest: true,
            },
            orderBy: {
              player_order: 'asc',
            },
          },
          language: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!game) {
        return {
          success: false,
          message: 'Offline game not found.',
          statusCode: 404,
        };
      }

      const hostPlayer = game.game_players.find(
        (p) => p.user_id === userId && !p.is_guest,
      );

      return {
        success: true,
        message: 'Game session data retrieved successfully.',
        data: {
          game_info: {
            id: game.id,
            mode: game.mode,
            status: game.status,
            game_phase: game.game_phase,
            current_question: game.current_question,
            total_questions: game.total_questions,
            current_player_id: game.current_player_id,
            language: game.language,
          },
          your_player_info: hostPlayer
            ? {
                id: hostPlayer.id,
                player_name: hostPlayer.player_name,
                player_order: hostPlayer.player_order,
                score: hostPlayer.score,
              }
            : null,
          all_players: game.game_players,
        },
      };
    } catch (error) {
      console.error(`Error rejoining game: ${error.message}`, error.stack);
      return {
        success: false,
        message: 'An unexpected error occurred while rejoining the game.',
        statusCode: 500,
      };
    }
  }

  // Get comprehensive game results with rankings and leaderboard
  async getGameResults(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Get final rankings
      const finalRankings = await this.prisma.gamePlayer.findMany({
        where: { game_id: gameId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: [
          { final_rank: 'asc' },
          { score: 'desc' },
          { correct_answers: 'desc' },
          { player_order: 'asc' },
        ],
      });

      // Get leaderboard entries for this game
      const leaderboardEntries = await this.prisma.leaderboard.findMany({
        where: { game_id: gameId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: [
          { score: 'desc' },
          { correct: 'desc' },
          { created_at: 'asc' },
        ],
      });

      // Calculate statistics
      const totalQuestions =
        finalRankings.reduce(
          (sum, player) =>
            sum +
            player.correct_answers +
            player.wrong_answers +
            player.skipped_answers,
          0,
        ) / finalRankings.length;

      const averageScore =
        finalRankings.reduce((sum, player) => sum + player.score, 0) /
        finalRankings.length;

      const topPerformer = finalRankings[0];
      const winner = finalRankings.find((player) => player.final_rank === 1);

      return {
        success: true,
        message: 'Game results retrieved successfully',
        data: {
          game_info: {
            id: game.id,
            mode: game.mode,
            status: game.status,
            language: game.language,
            total_players: finalRankings.length,
            max_players: 8,
          },
          final_rankings: finalRankings.map((player, index) => ({
            position: player.final_rank || index + 1,
            player_id: player.id,
            user: player.user,
            score: player.score,
            correct_answers: player.correct_answers,
            wrong_answers: player.wrong_answers,
            skipped_answers: player.skipped_answers,
            total_questions:
              player.correct_answers +
              player.wrong_answers +
              player.skipped_answers,
            accuracy:
              player.correct_answers + player.wrong_answers > 0
                ? (
                    (player.correct_answers /
                      (player.correct_answers + player.wrong_answers)) *
                    100
                  ).toFixed(2) + '%'
                : '0%',
            player_order: player.player_order,
            created_at: player.created_at,
          })),
          leaderboard: leaderboardEntries.map((entry, index) => ({
            leaderboard_position: index + 1,
            user: entry.user,
            score: entry.score,
            correct: entry.correct,
            wrong: entry.wrong,
            skipped: entry.skipped,
            games_played: entry.games_played,
            mode: entry.mode,
            created_at: entry.created_at,
          })),
          game_statistics: {
            winner: winner
              ? {
                  user: winner.user,
                  score: winner.score,
                  accuracy:
                    winner.correct_answers + winner.wrong_answers > 0
                      ? (
                          (winner.correct_answers /
                            (winner.correct_answers + winner.wrong_answers)) *
                          100
                        ).toFixed(2) + '%'
                      : '0%',
                }
              : null,
            top_performer: topPerformer
              ? {
                  user: topPerformer.user,
                  score: topPerformer.score,
                  correct_answers: topPerformer.correct_answers,
                }
              : null,
            average_score: Math.round(averageScore * 100) / 100,
            total_questions_per_player: Math.round(totalQuestions),
            completion_rate: finalRankings.length > 0 ? '100%' : '0%',
          },
          podium: {
            first_place: finalRankings.find((p) => p.final_rank === 1) || null,
            second_place: finalRankings.find((p) => p.final_rank === 2) || null,
            third_place: finalRankings.find((p) => p.final_rank === 3) || null,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching game results: ${error.message}`,
      };
    }
  }

  // ===== GAME FLOW METHODS =====

  /**
   * Get the current player whose turn it is
   */
  async getCurrentPlayer(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
            orderBy: { player_order: 'asc' },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      if (!game.current_player_id) {
        return {
          success: false,
          message: 'No current player set',
          data: null,
        };
      }

      const currentPlayer = game.game_players.find(
        (player) => player.id === game.current_player_id,
      );

      if (!currentPlayer) {
        return {
          success: false,
          message: 'Current player not found in game',
          data: null,
        };
      }

      return {
        success: true,
        message: 'Current player retrieved successfully',
        data: {
          player: currentPlayer,
          turn: game.current_turn,
          phase: game.game_phase,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting current player: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Move to the next turn
   */
  async nextTurn(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            orderBy: { player_order: 'asc' },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      if (game.game_players.length === 0) {
        throw new BadRequestException('No players in game');
      }

      const currentPlayerIndex = game.game_players.findIndex(
        (player) => player.id === game.current_player_id,
      );

      let nextPlayerIndex;
      if (
        currentPlayerIndex === -1 ||
        currentPlayerIndex === game.game_players.length - 1
      ) {
        // If no current player or last player, start with first player
        nextPlayerIndex = 0;
      } else {
        // Move to next player
        nextPlayerIndex = currentPlayerIndex + 1;
      }

      const nextPlayer = game.game_players[nextPlayerIndex];
      const nextTurn = game.current_turn + 1;

      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          current_player_id: nextPlayer.id,
          current_turn: nextTurn,
        },
      });

      return {
        success: true,
        message: 'Turn advanced successfully',
        data: {
          current_player: nextPlayer,
          turn: nextTurn,
          phase: game.game_phase,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error advancing turn: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Start a player's turn
   */
  async startPlayerTurn(gameId: string, playerId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            where: { id: playerId },
            include: { user: true },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      const player = game.game_players[0];
      if (!player) {
        throw new NotFoundException('Player not found in game');
      }

      // Update game to set current player and phase
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          current_player_id: playerId,
          game_phase: 'question',
        },
      });

      return {
        success: true,
        message: 'Player turn started successfully',
        data: {
          player: player,
          turn: game.current_turn,
          phase: 'question',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error starting player turn: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Update game phase
   */
  async updateGamePhase(gameId: string, phase: string) {
    try {
      const validPhases = [
        'waiting',
        'category_selection',
        'question',
        'completed',
      ];
      if (!validPhases.includes(phase)) {
        throw new BadRequestException(
          `Invalid phase. Must be one of: ${validPhases.join(', ')}`,
        );
      }

      const game = await this.prisma.game.update({
        where: { id: gameId },
        data: { game_phase: phase },
      });

      return {
        success: true,
        message: 'Game phase updated successfully',
        data: {
          game_id: gameId,
          phase: phase,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error updating game phase: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Get current game state
   */
  async getGameState(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
            orderBy: { player_order: 'asc' },
          },
          language: true,
          host: true,
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      const currentPlayer = game.game_players.find(
        (player) => player.id === game.current_player_id,
      );

      return {
        success: true,
        message: 'Game state retrieved successfully',
        data: {
          game: {
            id: game.id,
            mode: game.mode,
            status: game.status,
            phase: game.game_phase,
            current_turn: game.current_turn,
            total_questions: game.total_questions,
            current_question: game.current_question,
            language: game.language,
            host: game.host,
          },
          players: game.game_players,
          current_player: currentPlayer || null,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting game state: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Check if game should end
   */
  async shouldGameEnd(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: true,
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Game ends if all questions are answered or all players have finished
      const shouldEnd = game.current_question >= game.total_questions;

      return {
        success: true,
        message: 'Game completion check completed',
        data: {
          should_end: shouldEnd,
          current_question: game.current_question,
          total_questions: game.total_questions,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error checking game completion: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Check game completion status
   */
  async checkGameCompletion(gameId: string) {
    try {
      const result = await this.shouldGameEnd(gameId);

      if (result.success && result.data.should_end) {
        // Update game phase to completed
        await this.updateGamePhase(gameId, 'completed');

        return {
          success: true,
          message: 'Game completed',
          data: {
            completed: true,
            phase: 'completed',
          },
        };
      }

      return {
        success: true,
        message: 'Game still in progress',
        data: {
          completed: false,
          phase: result.data ? 'in_progress' : 'unknown',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error checking game completion: ${error.message}`,
        data: null,
      };
    }
  }

  // ===== GUEST PLAYER METHODS =====

  /**
   * Add a guest player to the game
   */
  async addGuestPlayer(gameId: string, playerName: string) {
    try {
      const validationResult = await this.validateGuestPlayerName(playerName);
      if (!validationResult.isValid) {
        throw new BadRequestException(validationResult.error);
      }

      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          _count: {
            select: { game_players: true },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Check if game is full (max 8 players)
      const maxPlayers = 8;
      if (game._count.game_players >= maxPlayers) {
        throw new BadRequestException('Game is full');
      }

      // Check if player name already exists in this game
      const existingPlayer = await this.prisma.gamePlayer.findFirst({
        where: {
          game_id: gameId,
          player_name: validationResult.sanitizedName,
        },
      });

      if (existingPlayer) {
        throw new BadRequestException(
          'Player name already exists in this game',
        );
      }

      // Determine player order
      const playerOrder = game._count.game_players + 1;

      const guestPlayer = await this.prisma.gamePlayer.create({
        data: {
          game_id: gameId,
          player_name: validationResult.sanitizedName,
          player_order: playerOrder,
          is_guest: true,
          score: 0,
          correct_answers: 0,
          wrong_answers: 0,
          skipped_answers: 0,
        },
      });

      return {
        success: true,
        message: 'Guest player added successfully',
        data: {
          player: guestPlayer,
          player_order: playerOrder,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error adding guest player: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Validate guest player name
   */
  async validateGuestPlayerName(playerName: string) {
    try {
      if (!playerName || typeof playerName !== 'string') {
        return { isValid: false, error: 'Player name is required' };
      }

      const trimmedName = playerName.trim();

      if (trimmedName.length < 2) {
        return {
          isValid: false,
          error: 'Player name must be at least 2 characters long',
        };
      }

      if (trimmedName.length > 20) {
        return {
          isValid: false,
          error: 'Player name must be less than 20 characters',
        };
      }

      // Check for inappropriate characters
      const validNameRegex = /^[a-zA-Z0-9\s\-_]+$/;
      if (!validNameRegex.test(trimmedName)) {
        return {
          isValid: false,
          error:
            'Player name can only contain letters, numbers, spaces, hyphens, and underscores',
        };
      }

      // Check for inappropriate words (basic check)
      const inappropriateWords = [
        'admin',
        'moderator',
        'system',
        'bot',
        'guest',
      ];
      const lowerName = trimmedName.toLowerCase();
      for (const word of inappropriateWords) {
        if (lowerName.includes(word)) {
          return {
            isValid: false,
            error: 'Player name contains inappropriate words',
          };
        }
      }

      return { isValid: true, error: null, sanitizedName: trimmedName };
    } catch (error) {
      return { isValid: false, error: 'Error validating player name' };
    }
  }

  /**
   * Remove a guest player from the game
   */
  async removeGuestPlayer(gameId: string, playerId: string) {
    try {
      const player = await this.prisma.gamePlayer.findFirst({
        where: {
          id: playerId,
          game_id: gameId,
          is_guest: true,
        },
      });

      if (!player) {
        throw new NotFoundException('Guest player not found in this game');
      }

      await this.prisma.gamePlayer.delete({
        where: { id: playerId },
      });

      return {
        success: true,
        message: 'Guest player removed successfully',
        data: {
          removed_player_id: playerId,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error removing guest player: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Get all guest players in a game
   */
  async getGuestPlayers(gameId: string) {
    try {
      const guestPlayers = await this.prisma.gamePlayer.findMany({
        where: {
          game_id: gameId,
          is_guest: true,
        },
        orderBy: { player_order: 'asc' },
      });

      return {
        success: true,
        message: 'Guest players retrieved successfully',
        data: {
          guest_players: guestPlayers,
          count: guestPlayers.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting guest players: ${error.message}`,
        data: null,
      };
    }
  }

  // ===== QUICK GAME METHODS =====

  /**
   * Add a player to Quick Game (using guest player system)
   */
  async addQuickGamePlayer(gameId: string, playerName: string) {
    try {
      // Use existing addGuestPlayer method
      return await this.addGuestPlayer(gameId, playerName);
    } catch (error) {
      return {
        success: false,
        message: `Error adding player to Quick Game: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Start Quick Game - initialize turn-based gameplay
   */
  async startQuickGame(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            orderBy: { player_order: 'asc' },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      if (game.game_players.length < 2) {
        throw new BadRequestException(
          'Need at least 2 players to start the game',
        );
      }

      if (game.game_players.length > 4) {
        throw new BadRequestException('Quick Game supports maximum 4 players');
      }

      // Set first player as current player
      const firstPlayer = game.game_players[0];

      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          status: 'in_progress',
          game_phase: 'category_selection',
          current_player_id: firstPlayer.id,
          current_turn: 1,
        },
      });

      return {
        success: true,
        message: 'Quick Game started successfully',
        data: {
          game_id: gameId,
          current_player: firstPlayer,
          turn: 1,
          phase: 'category_selection',
          total_players: game.game_players.length,
          players: game.game_players,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error starting Quick Game: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Get current turn information for Quick Game
   */
  async getQuickGameCurrentTurn(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
            orderBy: { player_order: 'asc' },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      const currentPlayer = game.game_players.find(
        (player) => player.id === game.current_player_id,
      );

      return {
        success: true,
        message: 'Current turn retrieved successfully',
        data: {
          current_player: currentPlayer,
          turn: game.current_turn,
          phase: game.game_phase,
          total_players: game.game_players.length,
          players: game.game_players,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting current turn: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Select category and difficulty for current player's turn
   */
  async selectQuickGameCategory(
    gameId: string,
    categoryId: string,
    difficultyId: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: true,
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      const currentPlayer = game.game_players.find(
        (p) => p.id === game.current_player_id,
      );
      if (!currentPlayer) {
        throw new NotFoundException('Current player not found');
      }

      // Verify category and difficulty exist
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      const difficulty = await this.prisma.difficulty.findUnique({
        where: { id: difficultyId },
      });

      if (!category || !difficulty) {
        throw new BadRequestException('Invalid category or difficulty');
      }

      // Create game selection record
      const gameSelection = await this.prisma.gameSelection.create({
        data: {
          game_id: gameId,
          player_id: currentPlayer.id,
          category_id: categoryId,
          difficulty_id: difficultyId,
          points: difficulty.points || 10,
          is_used: false,
        },
      });

      // Update game phase to question
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          game_phase: 'question',
        },
      });

      return {
        success: true,
        message: 'Category and difficulty selected successfully',
        data: {
          selection: gameSelection,
          category: category,
          difficulty: difficulty,
          points: difficulty.points || 10,
          phase: 'question',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error selecting category: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Get question for current player's turn
   */
  async getQuickGameQuestion(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: true,
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      const currentPlayer = game.game_players.find(
        (p) => p.id === game.current_player_id,
      );
      if (!currentPlayer) {
        throw new NotFoundException('Current player not found');
      }

      // Get the latest game selection for current player
      const gameSelection = await this.prisma.gameSelection.findFirst({
        where: {
          game_id: gameId,
          player_id: currentPlayer.id,
          is_used: false,
        },
        include: {
          category: true,
          difficulty: true,
        },
        orderBy: { created_at: 'desc' },
      });

      if (!gameSelection) {
        throw new BadRequestException(
          'No category/difficulty selected for current turn',
        );
      }

      // Get a random question from selected category and difficulty
      const questions = await this.prisma.question.findMany({
        where: {
          category_id: gameSelection.category_id,
          difficulty_id: gameSelection.difficulty_id,
        },
        include: {
          answers: {
            select: {
              id: true,
              text: true,
              file_url: true,
              // Don't include is_correct for security
            },
          },
        },
      });

      if (questions.length === 0) {
        throw new NotFoundException(
          'No questions available for selected category and difficulty',
        );
      }

      // Select random question
      const randomQuestion =
        questions[Math.floor(Math.random() * questions.length)];

      // Mark game selection as used
      await this.prisma.gameSelection.update({
        where: { id: gameSelection.id },
        data: { is_used: true },
      });

      // Update game with current question
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          current_question: game.current_question + 1,
        },
      });

      return {
        success: true,
        message: 'Question retrieved successfully',
        data: {
          question: {
            id: randomQuestion.id,
            text: randomQuestion.text,
            points: randomQuestion.points,
            time_limit: randomQuestion.time,
            file_url: randomQuestion.file_url,
            category: gameSelection.category,
            difficulty: gameSelection.difficulty,
            answers: randomQuestion.answers,
          },
          current_player: currentPlayer,
          turn: game.current_turn,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting question: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Answer question in Quick Game
   */
  async answerQuickGameQuestion(
    gameId: string,
    questionId: string,
    answerId: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: true,
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      const currentPlayer = game.game_players.find(
        (p) => p.id === game.current_player_id,
      );
      if (!currentPlayer) {
        throw new NotFoundException('Current player not found');
      }

      // Get question with correct answer
      const question = await this.prisma.question.findUnique({
        where: { id: questionId },
        include: { answers: true },
      });

      if (!question) {
        throw new NotFoundException('Question not found');
      }

      const selectedAnswer = question.answers.find((a) => a.id === answerId);
      if (!selectedAnswer) {
        throw new BadRequestException('Invalid answer selected');
      }

      // Check if already answered
      const existingAnswer = await this.prisma.playerAnswer.findFirst({
        where: {
          game_player_id: currentPlayer.id,
          question_id: questionId,
        },
      });

      if (existingAnswer) {
        throw new BadRequestException('Question already answered');
      }

      // Create player answer
      await this.prisma.playerAnswer.create({
        data: {
          game_player_id: currentPlayer.id,
          question_id: questionId,
          answer_id: answerId,
          isCorrect: selectedAnswer.is_correct,
        },
      });

      const isCorrect = selectedAnswer.is_correct;
      const pointsEarned = isCorrect ? question.points : 0;

      // Update player stats
      const updatedPlayer = await this.prisma.gamePlayer.update({
        where: { id: currentPlayer.id },
        data: {
          score: { increment: pointsEarned },
          ...(isCorrect
            ? { correct_answers: { increment: 1 } }
            : { wrong_answers: { increment: 1 } }),
        },
      });

      // Move to next turn
      await this.nextTurn(gameId);

      return {
        success: true,
        message: isCorrect ? 'Correct answer!' : 'Wrong answer!',
        data: {
          is_correct: isCorrect,
          points_earned: pointsEarned,
          current_score: updatedPlayer.score,
          correct_answer: isCorrect
            ? null
            : question.answers.find((a) => a.is_correct),
          next_turn: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error answering question: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Steal question when player answers wrong
   */
  async stealQuickGameQuestion(
    gameId: string,
    questionId: string,
    answerId: string,
    userId: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
            orderBy: { player_order: 'asc' },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Find the player by user_id
      const stealingPlayer = game.game_players.find(
        (p) => p.user_id === userId,
      );
      if (!stealingPlayer) {
        const availableUserIds = game.game_players
          .map((p) => p.user_id)
          .filter((id) => id !== null);
        throw new NotFoundException(
          `User not found in this game. ` +
            `Looking for user ID: ${userId}. ` +
            `Available user IDs: ${availableUserIds.join(', ')}`,
        );
      }

      // Get question with correct answer
      const question = await this.prisma.question.findUnique({
        where: { id: questionId },
        include: { answers: true },
      });

      if (!question) {
        throw new NotFoundException('Question not found');
      }

      const selectedAnswer = question.answers.find((a) => a.id === answerId);
      if (!selectedAnswer) {
        throw new BadRequestException('Invalid answer selected');
      }

      // Check if already answered by stealing player
      const existingAnswer = await this.prisma.playerAnswer.findFirst({
        where: {
          game_player_id: stealingPlayer.id,
          question_id: questionId,
        },
      });

      if (existingAnswer) {
        throw new BadRequestException(
          'Question already answered by this player',
        );
      }

      // Create player answer for stealing player
      await this.prisma.playerAnswer.create({
        data: {
          game_player_id: stealingPlayer.id,
          question_id: questionId,
          answer_id: answerId,
          isCorrect: selectedAnswer.is_correct,
        },
      });

      const isCorrect = selectedAnswer.is_correct;
      const pointsEarned = isCorrect ? question.points : 0;

      // Update stealing player's stats
      const updatedPlayer = await this.prisma.gamePlayer.update({
        where: { id: stealingPlayer.id },
        data: {
          score: { increment: pointsEarned },
          ...(isCorrect
            ? { correct_answers: { increment: 1 } }
            : { wrong_answers: { increment: 1 } }),
        },
      });

      // Move to next turn
      await this.nextTurn(gameId);

      return {
        success: true,
        message: isCorrect ? 'Stolen and correct!' : 'Stolen but wrong!',
        data: {
          is_correct: isCorrect,
          points_earned: pointsEarned,
          current_score: updatedPlayer.score,
          correct_answer: isCorrect
            ? null
            : question.answers.find((a) => a.is_correct),
          user_id: userId,
          player_id: stealingPlayer.id,
          player_name:
            stealingPlayer.player_name ||
            stealingPlayer.user?.name ||
            'Unknown',
          stolen: true,
          next_turn: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error stealing question: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Add multiple players to Quick Game at once
   */
  async addMultipleQuickGamePlayers(
    gameId: string,
    playerNames: string[],
    userId?: string,
    isMaxLimit?: number,
  ) {
    try {
      // Validate game exists
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          _count: {
            select: { game_players: true },
          },
          subscription: {
            include: {
              subscription_type: true,
            },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      let maxPlayers: number;

      if (isMaxLimit) {
        maxPlayers = isMaxLimit;
      } else if (
        game.subscription &&
        game.subscription.subscription_type.players > 0
      ) {
        maxPlayers = game.subscription.subscription_type.players;
      } else {
        maxPlayers = 4;
      }
      const totalPlayersAfterAdding =
        game._count.game_players + playerNames.length;
      if (totalPlayersAfterAdding > maxPlayers) {
        throw new BadRequestException(
          `Cannot add ${playerNames.length} players. Quick Game allows maximum ${maxPlayers} players. Currently has ${game._count.game_players} players.`,
        );
      }

      // Validate all player names
      const validationResults = await Promise.all(
        playerNames.map((name) => this.validateGuestPlayerName(name)),
      );

      const invalidNames = validationResults.filter(
        (result) => !result.isValid,
      );
      if (invalidNames.length > 0) {
        throw new BadRequestException(
          `Invalid player names: ${invalidNames.map((r) => r.error).join(', ')}`,
        );
      }

      // Check for duplicate names in the request
      const uniqueNames = [...new Set(playerNames)];
      if (uniqueNames.length !== playerNames.length) {
        throw new BadRequestException('Duplicate player names are not allowed');
      }

      // Check if any names already exist in the game
      const existingPlayers = await this.prisma.gamePlayer.findMany({
        where: {
          game_id: gameId,
          player_name: { in: playerNames },
        },
        select: { player_name: true },
      });

      if (existingPlayers.length > 0) {
        const existingNames = existingPlayers
          .map((p) => p.player_name)
          .join(', ');
        throw new BadRequestException(
          `Player names already exist in this game: ${existingNames}`,
        );
      }

      // Create all players in a transaction
      const createdPlayers = await this.prisma.$transaction(async (tx) => {
        const players = [];
        let playerOrder = game._count.game_players + 1;

        for (const playerName of playerNames) {
          const validationResult = validationResults.find(
            (r) => r.sanitizedName === playerName.trim(),
          );
          const sanitizedName =
            validationResult?.sanitizedName || playerName.trim();

          const player = await tx.gamePlayer.create({
            data: {
              game_id: gameId,
              player_name: sanitizedName,
              player_order: playerOrder,
              is_guest: true,
              score: 0,
              user_id: userId,
              correct_answers: 0,
              wrong_answers: 0,
              skipped_answers: 0,
            },
          });

          players.push(player);
          playerOrder++;
        }

        return players;
      });

      return {
        success: true,
        message: `Successfully added ${createdPlayers.length} players to Quick Game`,
        data: {
          players: createdPlayers,
          total_players: game._count.game_players + createdPlayers.length,
          remaining_slots:
            maxPlayers - (game._count.game_players + createdPlayers.length),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error adding multiple players: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Add multiple players and start the game immediately
   */
  // async addPlayersAndStartQuickGame(gameId: string, playerNames: string[]) {
  //   try {
  //     // First add all players
  //     const addResult = await this.addMultipleQuickGamePlayers(
  //       gameId,
  //       playerNames,
  //     );

  //     if (!addResult.success) {
  //       return addResult;
  //     }

  //     // Then start the game
  //     const startResult = await this.startQuickGame(gameId);

  //     if (!startResult.success) {
  //       return startResult;
  //     }

  //     return {
  //       success: true,
  //       message: `Successfully added ${playerNames.length} players and started Quick Game`,
  //       data: {
  //         players_added: addResult.data.players,
  //         game_started: startResult.data,
  //         total_players: addResult.data.total_players,
  //       },
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: `Error adding players and starting game: ${error.message}`,
  //       data: null,
  //     };
  //   }
  // }

  // ===== COMPETITIVE QUICK GAME METHODS =====

  /**
   * Start Competitive Quick Game - initialize competitive gameplay
   */
  async startCompetitiveQuickGame(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            orderBy: { player_order: 'asc' },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      if (game.game_players.length < 2) {
        throw new BadRequestException(
          'Need at least 2 players to start competitive game',
        );
      }

      if (game.game_players.length > 4) {
        throw new BadRequestException(
          'Competitive Quick Game supports maximum 4 players',
        );
      }

      // Set game to competitive mode
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          status: 'in_progress',
          game_phase: 'category_selection',
          current_turn: 0, // No turns in competitive mode
          current_question: 0,
        },
      });

      return {
        success: true,
        message: 'Competitive Quick Game started successfully',
        data: {
          game_id: gameId,
          phase: 'category_selection',
          total_players: game.game_players.length,
          players: game.game_players,
          game_mode: 'competitive',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error starting Competitive Quick Game: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Select category and difficulty for competitive game
   */
  async selectCompetitiveCategory(
    gameId: string,
    categoryId: string,
    difficultyId: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: true,
          host: true,
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Verify category and difficulty exist
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      const difficulty = await this.prisma.difficulty.findUnique({
        where: { id: difficultyId },
      });

      if (!category || !difficulty) {
        throw new BadRequestException('Invalid category or difficulty');
      }

      // Get questions count for this category and difficulty
      const questionsCount = await this.prisma.question.count({
        where: {
          category_id: categoryId,
          difficulty_id: difficultyId,
        },
      });

      if (questionsCount === 0) {
        throw new BadRequestException(
          'No questions available for selected category and difficulty',
        );
      }

      // Check subscription limits for questions
      const hostSubscription = await this.prisma.subscription.findFirst({
        where: {
          user_id: game.host_id,
          status: 'active',
        },
        include: {
          subscription_type: true,
        },
      });

      let availableQuestions = questionsCount;
      if (hostSubscription) {
        // Check if user has question limits
        if (hostSubscription.subscription_type.questions !== -1) {
          availableQuestions = Math.min(
            questionsCount,
            hostSubscription.subscription_type.questions,
          );
        }
      } else {
        // Free game - limit to 10 questions
        availableQuestions = Math.min(questionsCount, 10);
      }

      // Update game with category selection
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          game_phase: 'question',
          total_questions: availableQuestions,
          current_question: 0,
        },
      });

      return {
        success: true,
        message: 'Category and difficulty selected successfully',
        data: {
          category: category,
          difficulty: difficulty,
          total_questions: availableQuestions,
          available_questions: questionsCount,
          phase: 'question',
          game_mode: 'competitive',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error selecting category: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Get next question for competitive game
   */
  async getCompetitiveQuestion(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      if (game.game_phase !== 'question') {
        throw new BadRequestException('Game is not in question phase');
      }

      if (game.current_question >= game.total_questions) {
        // Game completed
        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            game_phase: 'completed',
            status: 'completed',
          },
        });

        return {
          success: true,
          message: 'Game completed! All questions answered.',
          data: {
            game_completed: true,
            total_questions: game.total_questions,
            questions_answered: game.current_question,
          },
        };
      }

      // Get the latest game selection to know category and difficulty
      const gameSelection = await this.prisma.gameSelection.findFirst({
        where: {
          game_id: gameId,
        },
        include: {
          category: true,
          difficulty: true,
        },
        orderBy: { created_at: 'desc' },
      });

      if (!gameSelection) {
        throw new BadRequestException(
          'No category/difficulty selected for this game',
        );
      }

      // Get questions that haven't been answered yet
      const answeredQuestionIds = await this.prisma.playerAnswer.findMany({
        where: {
          game_player: {
            game_id: gameId,
          },
        },
        select: {
          question_id: true,
        },
      });

      const answeredIds = answeredQuestionIds.map((a) => a.question_id);

      // Get a random unanswered question
      const questions = await this.prisma.question.findMany({
        where: {
          category_id: gameSelection.category_id,
          difficulty_id: gameSelection.difficulty_id,
          id: { notIn: answeredIds },
        },
        include: {
          answers: {
            select: {
              id: true,
              text: true,
              file_url: true,
            },
          },
        },
      });

      if (questions.length === 0) {
        // No more questions available
        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            game_phase: 'completed',
            status: 'completed',
          },
        });

        return {
          success: true,
          message: 'Game completed! All questions answered.',
          data: {
            game_completed: true,
            total_questions: game.total_questions,
            questions_answered: game.current_question,
          },
        };
      }

      // Select random question
      const randomQuestion =
        questions[Math.floor(Math.random() * questions.length)];

      // Update current question number
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          current_question: game.current_question + 1,
        },
      });

      return {
        success: true,
        message: 'Question retrieved successfully',
        data: {
          question: {
            id: randomQuestion.id,
            text: randomQuestion.text,
            points: randomQuestion.points,
            time_limit: randomQuestion.time,
            file_url: randomQuestion.file_url,
            category: gameSelection.category,
            difficulty: gameSelection.difficulty,
            answers: randomQuestion.answers,
          },
          game_progress: {
            current_question: game.current_question + 1,
            total_questions: game.total_questions,
            remaining_questions:
              game.total_questions - (game.current_question + 1),
          },
          players: game.game_players.map((player) => ({
            id: player.id,
            name: player.player_name || player.user?.name || 'Unknown',
            score: player.score,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting question: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Answer question in competitive game
   */

  async answerCompetitiveQuestion(
    gameId: string,
    questionId: string,
    playerId: string,
    answerId?: string,
    answerText?: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: { orderBy: { player_order: 'asc' } },
          rooms: true,
        },
      });

      if (!game) {
        return { success: false, message: 'Game not found', statusCode: 404 };
      }

      const latestGameQuestion = await this.prisma.gameQuestion.findFirst({
        where: {
          game_id: gameId,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      if (
        !latestGameQuestion ||
        latestGameQuestion.question_id !== questionId
      ) {
        return {
          success: false,
          message:
            'The submitted answer is for an incorrect or outdated question.',
          statusCode: 400,
        };
      }

      // console.log('Latest Game Question:', latestGameQuestion.question_id);

      const isMultiPhoneGame = game.rooms && game.rooms.length > 0;
      const roomId = isMultiPhoneGame ? game.rooms[0].id : null;
      const isStealMode = game.current_player_id === null;

      if (isStealMode) {
        const answerers = await this.prisma.playerAnswer.findMany({
          where: { question_id: questionId, game_player: { game_id: gameId } },
          orderBy: { created_at: 'asc' },
        });
        if (answerers.some((answer) => answer.game_player_id === playerId)) {
          return {
            success: false,
            message:
              'You have already attempted to answer this question and cannot try again.',
            statusCode: 403,
          };
        }
      } else {
        if (game.current_player_id !== playerId) {
          const currentPlayer = game.game_players.find(
            (p) => p.id === game.current_player_id,
          );
          const currentTurnPlayerName =
            currentPlayer?.player_name || 'the current player';
          return {
            success: false,
            message: `It's not your turn! Waiting for ${currentTurnPlayerName} to answer.`,
            statusCode: 403,
          };
        }
      }

      const [player, question] = await Promise.all([
        this.prisma.gamePlayer.findUnique({ where: { id: playerId } }),
        this.prisma.question.findUnique({
          where: { id: questionId },
          include: { answers: true, question_type: true },
        }),
      ]);

      if (!player || !question) {
        return {
          success: false,
          message: 'Player or Question not found.',
          statusCode: 404,
        };
      }

      let isCorrect = false;
      let selectedAnswerIdForDB: string | null = null;
      const correctAnswer = question.answers.find((a) => a.is_correct);

      if (question.question_type.name === 'Text') {
        if (answerText === undefined || answerText === null) {
          return {
            success: false,
            message: 'Answer text is required for this question type.',
            statusCode: 400,
          };
        }

        if (correctAnswer) {
          isCorrect = checkTextAnswer(answerText, correctAnswer.text);
        }
        selectedAnswerIdForDB = isCorrect ? correctAnswer.id : null;
      } else {
        if (!answerId) {
          return {
            success: false,
            message: 'Answer ID is required for this question type.',
            statusCode: 400,
          };
        }
        const selectedAnswer = question.answers.find((a) => a.id === answerId);
        if (!selectedAnswer) {
          return {
            success: false,
            message: 'Invalid answer selected',
            statusCode: 400,
          };
        }
        isCorrect = selectedAnswer.is_correct;
        selectedAnswerIdForDB = selectedAnswer.id;
      }

      const pointsEarned = isCorrect
        ? isStealMode
          ? Math.round(question.points / 2)
          : question.points
        : 0;

      // Determine if we should increment current_question
      const shouldIncrementQuestion = isCorrect || (isStealMode && !isCorrect);

      // Perform transaction with conditional current_question increment
      const transactionOperations: any[] = [
        this.prisma.playerAnswer.create({
          data: {
            game_player_id: playerId,
            question_id: questionId,
            answer_id: selectedAnswerIdForDB,
            isCorrect,
          },
        }),
        this.prisma.gamePlayer.update({
          where: { id: playerId },
          data: {
            score: { increment: pointsEarned },
            ...(isCorrect
              ? { correct_answers: { increment: 1 } }
              : { wrong_answers: { increment: 1 } }),
          },
        }),
      ];

      if (shouldIncrementQuestion) {
        transactionOperations.push(
          this.prisma.game.update({
            where: { id: gameId },
            data: {
              current_question: { increment: 0 },
            },
          }),
        );
      }

      await this.prisma.$transaction(transactionOperations);

      // Fetch updated game data to get the latest current_question
      const updatedGame = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: { orderBy: { player_order: 'asc' } },
        },
      });

      const updatedPlayer = await this.prisma.gamePlayer.findUnique({
        where: { id: playerId },
      });
      const allPlayersHistory = await this.getAllPlayersHistory(
        updatedGame.game_players,
      );

      // Check if this is the final question AFTER incrementing
      const isFinalQuestion =
        updatedGame.total_questions > 0 &&
        updatedGame.current_question > updatedGame.total_questions;

      // Game Over logic - if this is the final question, end the game
      if (isFinalQuestion) {
        await this.prisma.game.update({
          where: { id: gameId },
          data: { status: 'COMPLETED', game_phase: 'GAME_OVER' },
        });

        const gameOverResponse = {
          success: true,
          message:
            'The final question has been answered. The game is now complete!',
          data: {
            is_correct: isCorrect,
            player_score: updatedPlayer.score,
            next_action: 'GAME_OVER',
            all_players_history: allPlayersHistory,
            is_game_over: true,
            is_steal: isStealMode,
            points_earned: pointsEarned,
          },
        };

        if (isMultiPhoneGame) {
          this.gatway.emitAnswerResult(roomId, gameOverResponse.data);
        }
        return gameOverResponse;
      }

      // Rest of your existing logic for non-game-over scenarios
      let isRoundOver = true;
      const lastPlayerInOrder =
        updatedGame.game_players[updatedGame.game_players.length - 1];

      if (isCorrect) {
        if (player.player_order === lastPlayerInOrder.player_order) {
          isRoundOver = true;
        }
      } else if (isStealMode) {
        const firstAnswerer = await this.prisma.playerAnswer.findFirst({
          where: {
            question_id: questionId,
            game_player: {
              game_id: gameId,
            },
          },
          orderBy: { created_at: 'asc' },
        });

        if (firstAnswerer) {
          const originalPlayer = updatedGame.game_players.find(
            (p) => p.id === firstAnswerer.game_player_id,
          );
          if (
            originalPlayer &&
            originalPlayer.player_order === lastPlayerInOrder.player_order
          ) {
            isRoundOver = true;
          }
        }
      }

      if (isCorrect) {
        let nextTurnPlayer;
        if (isStealMode) {
          const firstAnswerer = await this.prisma.playerAnswer.findFirst({
            where: {
              question_id: questionId,
              game_player: { game_id: gameId },
            },
            orderBy: { created_at: 'asc' },
          });
          let originalPlayerIndex = -1;
          if (firstAnswerer) {
            originalPlayerIndex = updatedGame.game_players.findIndex(
              (p) => p.id === firstAnswerer.game_player_id,
            );
          }
          if (originalPlayerIndex !== -1) {
            nextTurnPlayer =
              updatedGame.game_players[
                originalPlayerIndex % updatedGame.game_players.length
              ];
          } else {
            nextTurnPlayer = updatedGame.game_players[0];
          }
        } else {
          const currentPlayerIndex = updatedGame.game_players.findIndex(
            (p) => p.id === playerId,
          );
          nextTurnPlayer =
            updatedGame.game_players[
              currentPlayerIndex % updatedGame.game_players.length
            ];
        }

        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            game_phase: 'ROUND_COMPLETED',
            current_player_id: nextTurnPlayer.id,
          },
        });

        const successResponse = {
          success: true,
          message: isStealMode
            ? `Successful steal by ${player.player_name}!`
            : 'Correct answer!',
          data: {
            is_correct: true,
            is_steal: isStealMode,
            points_earned: pointsEarned,
            player_score: updatedPlayer.score,
            next_action: 'SELECT_NEW_QUESTION',
            player_id: playerId,
            player_name: player.player_name,
            next_turn_for: {
              player_id: nextTurnPlayer.id,
              player_name: nextTurnPlayer.player_name,
            },
            all_players_history: allPlayersHistory,
            is_round_over: isRoundOver,
          },
        };

        if (isMultiPhoneGame) {
          this.gatway.emitAnswerResult(roomId, successResponse.data);
        }
        return successResponse;
      } else {
        if (isStealMode) {
          const firstAnswerer = await this.prisma.playerAnswer.findFirst({
            where: {
              question_id: questionId,
              game_player: { game_id: gameId },
            },
            orderBy: { created_at: 'asc' },
          });
          let nextPlayerForNewQuestion = updatedGame.game_players[0];
          if (firstAnswerer) {
            const originalPlayerIndex = updatedGame.game_players.findIndex(
              (p) => p.id === firstAnswerer.game_player_id,
            );
            if (originalPlayerIndex !== -1) {
              nextPlayerForNewQuestion =
                updatedGame.game_players[
                  (originalPlayerIndex + 0) % updatedGame.game_players.length
                ];
            }
          }

          await this.prisma.game.update({
            where: { id: gameId },
            data: {
              game_phase: 'ROUND_COMPLETED',
              current_player_id: nextPlayerForNewQuestion.id,
            },
          });

          const stealFailResponse = {
            success: true,
            message: 'Incorrect steal attempt. Moving to the next round.',
            data: {
              is_correct: false,
              is_steal: true,
              player_score: updatedPlayer.score,
              correct_answer: {
                id: correctAnswer?.id,
                text: correctAnswer?.text,
              },
              next_action: 'SELECT_NEW_QUESTION_FOR_NEXT_PLAYER',
              next_player_id: nextPlayerForNewQuestion.id,
              all_players_history: allPlayersHistory,
              is_round_over: isRoundOver,
            },
          };

          if (isMultiPhoneGame) {
            this.gatway.emitAnswerResult(roomId, stealFailResponse.data);
          }
          return stealFailResponse;
        } else {
          await this.prisma.game.update({
            where: { id: gameId },
            data: { current_player_id: null, game_phase: 'STEAL_MODE_ACTIVE' },
          });

          const openForStealResponse = {
            success: true,
            message: `Wrong answer! The question is now open for anyone to steal.`,
            data: {
              is_correct: false,
              player_score: updatedPlayer.score,
              correct_answer: {
                id: correctAnswer?.id,
                text: correctAnswer?.text,
              },
              next_action: 'OPEN_FOR_STEAL',
              current_question: {
                id: question.id,
                text: question.text,
                answers: question.answers.map((a) => ({
                  id: a.id,
                  text: a.text,
                })),
              },
              all_players_history: allPlayersHistory,
            },
          };

          if (isMultiPhoneGame) {
            this.gatway.emitAnswerResult(roomId, openForStealResponse.data);
          }
          return openForStealResponse;
        }
      }
    } catch (error) {
      console.error('Error in answerCompetitiveQuestion:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while answering the question.',
        statusCode: 500,
      };
    }
  }
  // --- Helper Functions ---

  private async getAllPlayersHistory(players: any[]) {
    const allPlayersHistory = {};
    for (const p of players) {
      const history = await this.getPlayerPlayHistory(p.id);
      allPlayersHistory[p.id] = history.map((h) => ({
        category: h.category_id,
        difficulty: h.difficulty_id,
      }));
    }
    return allPlayersHistory;
  }

  private async getPlayerPlayHistory(playerId: string) {
    const playerAnswers = await this.prisma.playerAnswer.findMany({
      where: { game_player_id: playerId },
      select: {
        question: {
          select: {
            category_id: true,
            difficulty_id: true,
          },
        },
      },
    });

    return playerAnswers.map((answer) => ({
      category_id: answer.question.category_id,
      difficulty_id: answer.question.difficulty_id,
    }));
  }

  // timeout steal mode
  async handleQuestionTimeout(
    gameId: string,
    questionId: string,
    playerId?: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: { game_players: { orderBy: { player_order: 'asc' } } },
      });

      if (!game) {
        return { success: false, message: 'Game not found', statusCode: 404 };
      }

      const isStealModeTimeout = !playerId;

      if (isStealModeTimeout) {
        const firstAnswerer = await this.prisma.playerAnswer.findFirst({
          where: {
            question_id: questionId,
            game_player: {
              game_id: gameId,
            },
          },
          orderBy: { created_at: 'asc' },
        });

        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            game_phase: 'ROUND_COMPLETED',
            current_player_id: firstAnswerer.game_player_id,
          },
        });

        return {
          success: true,
          message: 'Steal time is over! Moving to the next round.',
          data: {
            next_action: 'SELECT_NEW_QUESTION_FOR_NEXT_PLAYER',
            // next_player_id: nextPlayerForNewQuestion.id,
          },
        };
      } else {
        if (game.current_player_id !== playerId) {
          return {
            success: false,
            message: "It's not this player's turn to time out.",
            statusCode: 403,
          };
        }

        // Timeout player record
        await this.prisma.$transaction([
          this.prisma.gamePlayer.update({
            where: { id: playerId },
            data: { skipped_answers: { increment: 1 } },
          }),
          this.prisma.playerAnswer.create({
            data: {
              game_player_id: playerId,
              question_id: questionId,
              isCorrect: false,
            },
          }),
          this.prisma.game.update({
            where: { id: gameId },
            data: {
              current_player_id: null,
              game_phase: 'STEAL_MODE_ON_TIMEOUT',
            },
          }),
        ]);

        return {
          success: true,
          message: `Time is up! The question is now open for anyone to steal.`,
          data: {
            next_action: 'OPEN_FOR_STEAL',
            question_id: questionId,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'An unexpected error occurred while handling the timeout.',
        statusCode: 500,
      };
    }
  }

  /**
   * Select category/difficulty and start game in one step
   */
  // multiplayer-game.service.ts

  async selectSingleQuestionForGame(
    gameId: string,
    categoryId: string,
    difficultyId: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            orderBy: { player_order: 'asc' },
          },
          game_questions: true,
          rooms: true,
          subscription: {
            include: {
              subscription_type: true,
            },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      if (game.game_players.length === 0) {
        throw new BadRequestException(
          'No players have been added to this game yet.',
        );
      }

      // Check if game is free and validate free_bundle
      const isFreeGame = !game.subscription;

      // --- new logic ---
      if (game.current_question === 0) {
        let totalQuestionsForGame;
        const numberOfPlayers = game.game_players.length;

        if (
          game.subscription &&
          game.subscription.subscription_type.questions > 0
        ) {
          totalQuestionsForGame =
            game.subscription.subscription_type.questions * numberOfPlayers;
        } else {
          totalQuestionsForGame = numberOfPlayers;
        }

        await this.prisma.game.update({
          where: { id: gameId },
          data: { total_questions: totalQuestionsForGame },
        });
        game.total_questions = totalQuestionsForGame;
      }

      if (
        game.total_questions > 0 &&
        game.current_question >= game.total_questions
      ) {
        throw new BadRequestException(
          'The game is complete. No more questions can be played.',
        );
      }

      let currentPlayer;
      const totalPlayers = game.game_players.length;

      if (game.current_player_id === null) {
        currentPlayer = game.game_players[0];
      } else {
        const lastPlayerIndex = game.game_players.findIndex(
          (p) => p.id === game.current_player_id,
        );
        const nextPlayerIndex = (lastPlayerIndex + 1) % totalPlayers;
        currentPlayer = game.game_players[nextPlayerIndex];
      }

      // Build where condition for questions
      const whereCondition: any = {
        category_id: categoryId,
        difficulty_id: difficultyId,
      };

      // If it's a free game, only include questions with free_bundle: true
      if (isFreeGame) {
        whereCondition.free_bundle = true;
      }
      // For subscription games, no free_bundle restriction

      const allQuestions = await this.prisma.question.findMany({
        where: whereCondition,
        include: {
          answers: {
            select: { id: true, text: true, file_url: true, is_correct: true },
          },
          question_type: {
            select: { id: true, name: true },
          },
        },
      });

      if (!allQuestions.length) {
        if (isFreeGame) {
          throw new BadRequestException(
            'No free questions available for selected category and difficulty',
          );
        } else {
          throw new BadRequestException(
            'No questions available for selected category and difficulty',
          );
        }
      }

      const usedQuestionIds = game.game_questions.map((q) => q.question_id);
      const availableQuestions = allQuestions.filter(
        (q) => !usedQuestionIds.includes(q.id),
      );

      if (!availableQuestions.length) {
        if (isFreeGame) {
          throw new BadRequestException(
            'All free questions for this category/difficulty have already been used in this game',
          );
        } else {
          throw new BadRequestException(
            'All questions for this category/difficulty have already been used in this game',
          );
        }
      }

      const selectedQuestion =
        availableQuestions[
          Math.floor(Math.random() * availableQuestions.length)
        ];

      await this.prisma.$transaction([
        this.prisma.gameQuestion.create({
          data: {
            game_id: gameId,
            question_id: selectedQuestion.id,
          },
        }),
        this.prisma.game.update({
          where: { id: gameId },
          data: {
            game_phase: 'QUESTION_SELECTED',
            current_player_id: currentPlayer.id,
            current_question: game.current_question + 1,
            question_asked_at: new Date(),
          },
        }),
      ]);

      const correctAnswer = selectedQuestion.answers.find(
        (a) => a.is_correct === true,
      );

      let fileUrl = null;
      if (selectedQuestion.file_url) {
        const file_url = SojebStorage.url(
          appConfig().storageUrl.question + selectedQuestion.file_url,
        );

        fileUrl = file_url;
      }

      const formattedQuestion = {
        id: selectedQuestion.id,
        text: selectedQuestion.text,
        points: selectedQuestion.points,
        time_limit: selectedQuestion.time,
        file_url: fileUrl,
        question_type: selectedQuestion.question_type,
        answers: selectedQuestion.answers.map((a) => ({
          id: a.id,
          text: a.text,
          file_url: a.file_url,
        })),
        correct_answer: {
          id: correctAnswer?.id,
          text: correctAnswer?.text,
        },
      };

      const responseData = {
        question: formattedQuestion,
        currentPlayer: {
          id: currentPlayer.id,
          name: currentPlayer.player_name,
          player_order: currentPlayer.player_order,
        },
        game_info: {
          total_question_number: game.total_questions,
          current_question_number: game.current_question + 1,
          remainig_qustion_number:
            game.total_questions - game.current_question - 1,
        },
      };

      const isMultiPhoneGame = game.rooms && game.rooms.length > 0;

      if (isMultiPhoneGame) {
        const roomId = game.rooms[0].id;
        this.gatway.emitNewQuestionForMultiplayer(roomId, responseData);
      }

      return {
        success: true,
        message: `Question selected for ${currentPlayer.player_name}. It's their turn to answer.`,
        data: responseData,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An unexpected error occurred while selecting a question.',
      );
    }
  }

  /**
   * Get player IDs for a game (helper method for debugging)
   */
  async getGamePlayerIds(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
            orderBy: { player_order: 'asc' },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      return {
        success: true,
        message: 'Player IDs retrieved successfully',
        data: {
          game_id: gameId,
          players: game.game_players.map((player) => ({
            id: player.id,
            name: player.player_name || player.user?.name || 'Unknown',
            player_order: player.player_order,
            is_guest: player.is_guest,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting player IDs: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Get competitive game status
   */
  async getCompetitiveGameStatus(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
            orderBy: { score: 'desc' },
          },
        },
      });

      if (!game) {
        return {
          success: true,
          message: 'Game not found',
          statusCode: 403,
        };
      }

      return {
        success: true,
        message: 'Competitive game status retrieved successfully',
        data: {
          game: {
            id: game.id,
            mode: game.mode,
            status: game.status,
            phase: game.game_phase,
            current_question: game.current_question,
            total_questions: game.total_questions,
          },
          players: game.game_players.map((player) => ({
            id: player.id,
            name: player.player_name || player.user?.name || 'Unknown',
            score: player.score,
            correct_answers: player.correct_answers,
            wrong_answers: player.wrong_answers,
            player_order: player.player_order,
          })),
          game_progress: {
            questions_answered: game.current_question,
            total_questions: game.total_questions,
            remaining_questions: game.total_questions - game.current_question,
            progress_percentage:
              game.total_questions > 0
                ? Math.round(
                    (game.current_question / game.total_questions) * 100,
                  )
                : 0,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting competitive game status: ${error.message}`,
        data: null,
      };
    }
  }

  // ===== HOST-CONTROLLED GAME METHODS =====

  /**
   * Host starts the competitive game (authenticated user controls the game)
   */
  async hostStartCompetitiveGame(gameId: string, hostUserId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
            orderBy: { player_order: 'asc' },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Verify host is the game host
      if (game.host_id !== hostUserId) {
        throw new ForbiddenException('Only the game host can start the game');
      }

      if (game.game_players.length < 2) {
        throw new BadRequestException(
          'Need at least 2 players to start competitive game',
        );
      }

      if (game.game_players.length > 4) {
        throw new BadRequestException(
          'Competitive Quick Game supports maximum 4 players',
        );
      }

      // Set game to competitive mode with host control
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          status: 'in_progress',
          game_phase: 'category_selection',
          current_turn: 0,
          current_question: 0,
        },
      });

      return {
        success: true,
        message: 'Host-controlled competitive game started successfully',
        data: {
          game_id: gameId,
          host_id: hostUserId,
          phase: 'category_selection',
          total_players: game.game_players.length,
          players: game.game_players.map((player) => ({
            id: player.id,
            name: player.player_name || player.user?.name || 'Unknown',
            is_guest: player.is_guest,
            player_order: player.player_order,
          })),
          game_mode: 'host_controlled_competitive',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error starting host-controlled game: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Host selects category and difficulty for the game
   */
  async hostSelectCategory(
    gameId: string,
    categoryId: string,
    difficultyId: string,
    hostUserId: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: true,
          host: true,
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Verify host is the game host
      if (game.host_id !== hostUserId) {
        throw new ForbiddenException('Only the game host can select category');
      }

      // Verify category and difficulty exist
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      const difficulty = await this.prisma.difficulty.findUnique({
        where: { id: difficultyId },
      });

      if (!category || !difficulty) {
        throw new BadRequestException('Invalid category or difficulty');
      }

      // Get questions count for this category and difficulty
      const questionsCount = await this.prisma.question.count({
        where: {
          category_id: categoryId,
          difficulty_id: difficultyId,
        },
      });

      if (questionsCount === 0) {
        throw new BadRequestException(
          'No questions available for selected category and difficulty',
        );
      }

      // Check subscription limits for questions
      const hostSubscription = await this.prisma.subscription.findFirst({
        where: {
          user_id: game.host_id,
          status: 'active',
        },
        include: {
          subscription_type: true,
        },
      });

      let availableQuestions = questionsCount;
      if (hostSubscription) {
        // Check if user has question limits
        if (hostSubscription.subscription_type.questions !== -1) {
          availableQuestions = Math.min(
            questionsCount,
            hostSubscription.subscription_type.questions,
          );
        }
      } else {
        // Free game - limit to 10 questions
        availableQuestions = Math.min(questionsCount, 10);
      }

      // Update game with category selection
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          game_phase: 'question',
          total_questions: availableQuestions,
          current_question: 0,
        },
      });

      return {
        success: true,
        message: 'Host selected category and difficulty successfully',
        data: {
          category: category,
          difficulty: difficulty,
          total_questions: availableQuestions,
          available_questions: questionsCount,
          phase: 'question',
          game_mode: 'host_controlled_competitive',
          host_id: hostUserId,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error selecting category: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Host gets next question for the game
   */
  async hostGetQuestion(gameId: string, hostUserId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Verify host is the game host
      if (game.host_id !== hostUserId) {
        throw new ForbiddenException('Only the game host can get questions');
      }

      if (game.game_phase !== 'question') {
        throw new BadRequestException('Game is not in question phase');
      }

      if (game.current_question >= game.total_questions) {
        // Game completed
        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            game_phase: 'completed',
            status: 'completed',
          },
        });

        return {
          success: true,
          message: 'Game completed! All questions answered.',
          data: {
            game_completed: true,
            total_questions: game.total_questions,
            questions_answered: game.current_question,
          },
        };
      }

      // Get the latest game selection to know category and difficulty
      const gameSelection = await this.prisma.gameSelection.findFirst({
        where: {
          game_id: gameId,
        },
        include: {
          category: true,
          difficulty: true,
        },
        orderBy: { created_at: 'desc' },
      });

      if (!gameSelection) {
        throw new BadRequestException(
          'No category/difficulty selected for this game',
        );
      }

      // Get questions that haven't been answered yet
      const answeredQuestionIds = await this.prisma.playerAnswer.findMany({
        where: {
          game_player: {
            game_id: gameId,
          },
        },
        select: {
          question_id: true,
        },
      });

      const answeredIds = answeredQuestionIds.map((a) => a.question_id);

      // Get a random unanswered question
      const questions = await this.prisma.question.findMany({
        where: {
          category_id: gameSelection.category_id,
          difficulty_id: gameSelection.difficulty_id,
          id: { notIn: answeredIds },
        },
        include: {
          answers: {
            select: {
              id: true,
              text: true,
              file_url: true,
            },
          },
        },
      });

      if (questions.length === 0) {
        // No more questions available
        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            game_phase: 'completed',
            status: 'completed',
          },
        });

        return {
          success: true,
          message: 'Game completed! All questions answered.',
          data: {
            game_completed: true,
            total_questions: game.total_questions,
            questions_answered: game.current_question,
          },
        };
      }

      // Select random question
      const randomQuestion =
        questions[Math.floor(Math.random() * questions.length)];

      // Update current question number
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          current_question: game.current_question + 1,
        },
      });

      return {
        success: true,
        message: 'Question retrieved successfully',
        data: {
          question: {
            id: randomQuestion.id,
            text: randomQuestion.text,
            points: randomQuestion.points,
            time_limit: randomQuestion.time,
            file_url: randomQuestion.file_url,
            category: gameSelection.category,
            difficulty: gameSelection.difficulty,
            answers: randomQuestion.answers,
          },
          game_progress: {
            current_question: game.current_question + 1,
            total_questions: game.total_questions,
            remaining_questions:
              game.total_questions - (game.current_question + 1),
          },
          players: game.game_players.map((player) => ({
            id: player.id,
            name: player.player_name || player.user?.name || 'Unknown',
            score: player.score,
            is_guest: player.is_guest,
          })),
          host_id: hostUserId,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting question: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Host submits answer on behalf of a guest player
   */
  async hostAnswerQuestion(
    gameId: string,
    questionId: string,
    answerId: string,
    playerId: string,
    hostUserId: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Verify host is the game host
      if (game.host_id !== hostUserId) {
        throw new ForbiddenException('Only the game host can submit answers');
      }

      const player = game.game_players.find((p) => p.id === playerId);
      if (!player) {
        const availablePlayerIds = game.game_players.map((p) => p.id);
        const availablePlayerNames = game.game_players.map(
          (p) => p.player_name || p.user?.name || 'Unknown',
        );

        throw new NotFoundException(
          `Player not found in this game. ` +
            `Looking for player ID: ${playerId}. ` +
            `Available players: ${availablePlayerIds.join(', ')} ` +
            `(${availablePlayerNames.join(', ')})`,
        );
      }

      // Get question with correct answer
      const question = await this.prisma.question.findUnique({
        where: { id: questionId },
        include: { answers: true },
      });

      if (!question) {
        throw new NotFoundException('Question not found');
      }

      const selectedAnswer = question.answers.find((a) => a.id === answerId);
      if (!selectedAnswer) {
        throw new BadRequestException('Invalid answer selected');
      }

      // Check if already answered by this player
      const existingAnswer = await this.prisma.playerAnswer.findFirst({
        where: {
          game_player_id: playerId,
          question_id: questionId,
        },
      });

      if (existingAnswer) {
        throw new BadRequestException(
          'Question already answered by this player',
        );
      }

      // Create player answer
      await this.prisma.playerAnswer.create({
        data: {
          game_player_id: playerId,
          question_id: questionId,
          answer_id: answerId,
          isCorrect: selectedAnswer.is_correct,
        },
      });

      const isCorrect = selectedAnswer.is_correct;
      const pointsEarned = isCorrect ? question.points : 0;

      // Update player stats
      const updatedPlayer = await this.prisma.gamePlayer.update({
        where: { id: playerId },
        data: {
          score: { increment: pointsEarned },
          ...(isCorrect
            ? { correct_answers: { increment: 1 } }
            : { wrong_answers: { increment: 1 } }),
        },
      });

      return {
        success: true,
        message: isCorrect ? 'Correct answer!' : 'Wrong answer!',
        data: {
          is_correct: isCorrect,
          points_earned: pointsEarned,
          player_score: updatedPlayer.score,
          correct_answer: isCorrect
            ? null
            : question.answers.find((a) => a.is_correct),
          player_id: playerId,
          player_name: player.player_name || player.user?.name || 'Unknown',
          host_id: hostUserId,
          game_continues: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error answering question: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Host skips a question
   */
  async hostSkipQuestion(
    gameId: string,
    questionId: string,
    hostUserId: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Verify host is the game host
      if (game.host_id !== hostUserId) {
        throw new ForbiddenException('Only the game host can skip questions');
      }

      // Update current question number (skip this question)
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          current_question: game.current_question + 1,
        },
      });

      return {
        success: true,
        message: 'Question skipped successfully',
        data: {
          question_id: questionId,
          host_id: hostUserId,
          game_continues: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error skipping question: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Host gets game status
   */
  async hostGetGameStatus(gameId: string, hostUserId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
            orderBy: { score: 'desc' },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Verify host is the game host
      if (game.host_id !== hostUserId) {
        throw new ForbiddenException('Only the game host can view game status');
      }

      return {
        success: true,
        message: 'Host game status retrieved successfully',
        data: {
          game: {
            id: game.id,
            mode: game.mode,
            status: game.status,
            phase: game.game_phase,
            current_question: game.current_question,
            total_questions: game.total_questions,
          },
          players: game.game_players.map((player) => ({
            id: player.id,
            name: player.player_name || player.user?.name || 'Unknown',
            score: player.score,
            correct_answers: player.correct_answers,
            wrong_answers: player.wrong_answers,
            player_order: player.player_order,
            is_guest: player.is_guest,
          })),
          game_progress: {
            questions_answered: game.current_question,
            total_questions: game.total_questions,
            remaining_questions: game.total_questions - game.current_question,
            progress_percentage:
              game.total_questions > 0
                ? Math.round(
                    (game.current_question / game.total_questions) * 100,
                  )
                : 0,
          },
          host_id: hostUserId,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting host game status: ${error.message}`,
        data: null,
      };
    }
  }

  // ===== MODIFIED GAME FLOW METHODS =====

  /**
   * Add players only (don't start game)
   */
  // async addPlayersOnly(gameId: string, playerNames: string[]) {
  //   try {
  //     // Use existing addMultipleQuickGamePlayers method but don't start game
  //     return await this.addMultipleQuickGamePlayers(gameId, playerNames, userId);
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: `Error adding players: ${error.message}`,
  //       data: null,
  //     };
  //   }
  // }

  /**
   * Player selects their own category and difficulty on their turn
   */
  async playerSelectCategory(
    gameId: string,
    categoryId: string,
    difficultyId: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      const currentPlayer = game.game_players.find(
        (p) => p.id === game.current_player_id,
      );
      if (!currentPlayer) {
        throw new NotFoundException('Current player not found');
      }

      // Verify category and difficulty exist
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      const difficulty = await this.prisma.difficulty.findUnique({
        where: { id: difficultyId },
      });

      if (!category || !difficulty) {
        throw new BadRequestException('Invalid category or difficulty');
      }

      // Get questions count for this category and difficulty
      const questionsCount = await this.prisma.question.count({
        where: {
          category_id: categoryId,
          difficulty_id: difficultyId,
        },
      });

      if (questionsCount === 0) {
        throw new BadRequestException(
          'No questions available for selected category and difficulty',
        );
      }

      // Create game selection record for this player
      await this.prisma.gameSelection.create({
        data: {
          game_id: gameId,
          player_id: currentPlayer.id,
          category_id: categoryId,
          difficulty_id: difficultyId,
          points: difficulty.points || 0,
        },
      });

      return {
        success: true,
        message: 'Category and difficulty selected for current player',
        data: {
          category: category,
          difficulty: difficulty,
          available_questions: questionsCount,
          current_player: {
            id: currentPlayer.id,
            name:
              currentPlayer.player_name ||
              currentPlayer.user?.name ||
              'Unknown',
            player_order: currentPlayer.player_order,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error selecting category: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Get question for current player (based on their category selection)
   */
  async getPlayerQuestion(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
          },
          game_selections: {
            orderBy: { created_at: 'desc' },
            take: 1,
            include: {
              category: true,
              difficulty: true,
            },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      if (!game.game_selections.length) {
        throw new BadRequestException(
          'No category/difficulty selected for this game. Please select category and difficulty first.',
        );
      }

      const gameSelection = game.game_selections[0];

      // Get all questions from the selected category and difficulty
      const allQuestions = await this.prisma.question.findMany({
        where: {
          category_id: gameSelection.category_id,
          difficulty_id: gameSelection.difficulty_id,
        },
        include: {
          answers: {
            select: {
              id: true,
              text: true,
              file_url: true,
            },
          },
        },
      });

      if (allQuestions.length === 0) {
        return {
          success: true,
          message: 'No questions available for this category and difficulty',
          data: {
            no_questions_available: true,
          },
        };
      }

      // Get a random question from the selected category and difficulty
      const randomIndex = Math.floor(Math.random() * allQuestions.length);
      const currentQuestion = allQuestions[randomIndex];

      return {
        success: true,
        message: 'Question retrieved successfully',
        data: {
          question: {
            id: currentQuestion.id,
            text: currentQuestion.text,
            points: currentQuestion.points,
            time_limit: currentQuestion.time,
            file_url: currentQuestion.file_url,
            category: gameSelection.category,
            difficulty: gameSelection.difficulty,
            answers: currentQuestion.answers,
          },
          game_info: {
            category: gameSelection.category.name,
            difficulty: gameSelection.difficulty.name,
            points: gameSelection.points,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting question: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Player answers question
   */
  async playerAnswerQuestion(
    gameId: string,
    questionId: string,
    answerId: string,
    playerId: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
          },
        },
      });

      if (!game) {
        return 'Game not found';
      }

      // Find the player who is answering (not necessarily current player)
      const answeringPlayer = game.game_players.find((p) => p.id === playerId);
      if (!answeringPlayer) {
        throw new NotFoundException('Player not found in this game');
      }

      // Get question with correct answer
      const question = await this.prisma.question.findUnique({
        where: { id: questionId },
        include: { answers: true },
      });

      if (!question) {
        throw new NotFoundException('Question not found');
      }

      const selectedAnswer = question.answers.find((a) => a.id === answerId);
      if (!selectedAnswer) {
        throw new BadRequestException('Invalid answer selected');
      }

      // Check if already answered by this player
      const existingAnswer = await this.prisma.playerAnswer.findFirst({
        where: {
          game_player_id: answeringPlayer.id,
          question_id: questionId,
        },
      });

      if (existingAnswer) {
        throw new BadRequestException(
          'Question already answered by this player',
        );
      }

      // Create player answer
      await this.prisma.playerAnswer.create({
        data: {
          game_player_id: answeringPlayer.id,
          question_id: questionId,
          answer_id: answerId,
          isCorrect: selectedAnswer.is_correct,
        },
      });

      const isCorrect = selectedAnswer.is_correct;
      const pointsEarned = isCorrect ? question.points : 0;

      // Update player stats
      const updatedPlayer = await this.prisma.gamePlayer.update({
        where: { id: answeringPlayer.id },
        data: {
          score: { increment: pointsEarned },
          ...(isCorrect
            ? { correct_answers: { increment: 1 } }
            : { wrong_answers: { increment: 1 } }),
        },
      });

      // If correct answer, move to next question. If wrong, question can be stolen
      if (isCorrect) {
        // Just increment the question counter, don't change the game state
        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            current_question: { increment: 1 },
          },
        });
      }

      return {
        success: true,
        message: isCorrect ? 'Correct answer!' : 'Wrong answer!',
        data: {
          is_correct: isCorrect,
          points_earned: pointsEarned,
          player_score: updatedPlayer.score,
          correct_answer: isCorrect
            ? null
            : question.answers.find((a) => a.is_correct),
          player_id: answeringPlayer.id,
          player_name:
            answeringPlayer.player_name ||
            answeringPlayer.user?.name ||
            'Unknown',
          next_turn: isCorrect,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error answering question: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Steal question - forwards the same question to all players
   */
  async stealQuestion(
    gameId: string,
    questionId: string,
    answerId: string,
    playerId: string,
  ) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Get question with correct answer
      const question = await this.prisma.question.findUnique({
        where: { id: questionId },
        include: { answers: true },
      });

      if (!question) {
        throw new NotFoundException('Question not found');
      }

      const selectedAnswer = question.answers.find((a) => a.id === answerId);
      if (!selectedAnswer) {
        throw new BadRequestException('Invalid answer selected');
      }

      // Find the stealing player
      const stealingPlayer = game.game_players.find((p) => p.id === playerId);
      if (!stealingPlayer) {
        throw new NotFoundException('Stealing player not found in this game');
      }

      // Check if stealing player has already answered this question
      const existingAnswer = await this.prisma.playerAnswer.findFirst({
        where: {
          game_player_id: stealingPlayer.id,
          question_id: questionId,
        },
      });

      if (existingAnswer) {
        throw new BadRequestException(
          'You have already answered this question',
        );
      }

      // Record the stealing player's answer
      await this.prisma.playerAnswer.create({
        data: {
          game_player_id: stealingPlayer.id,
          question_id: questionId,
          answer_id: answerId,
          isCorrect: selectedAnswer.is_correct,
        },
      });

      const isCorrect = selectedAnswer.is_correct;
      const pointsEarned = isCorrect ? question.points : 0;

      // Update stealing player's stats
      await this.prisma.gamePlayer.update({
        where: { id: stealingPlayer.id },
        data: {
          score: { increment: pointsEarned },
          ...(isCorrect
            ? { correct_answers: { increment: 1 } }
            : { wrong_answers: { increment: 1 } }),
        },
      });

      // If correct answer, move to next question
      if (isCorrect) {
        // Just increment the question counter, don't change the game state
        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            current_question: { increment: 1 },
          },
        });
        return {
          success: true,
          message: 'Correct answer! Question stolen successfully!',
          data: {
            is_correct: true,
            points_earned: pointsEarned,
            player_id: stealingPlayer.id,
            player_name:
              stealingPlayer.player_name ||
              stealingPlayer.user?.name ||
              'Unknown',
            next_question: true,
          },
        };
      }

      // Find the next player who hasn't answered this question yet
      const answeredPlayerIds = await this.prisma.playerAnswer.findMany({
        where: {
          question_id: questionId,
        },
        select: {
          game_player_id: true,
        },
      });

      const answeredIds = answeredPlayerIds.map((a) => a.game_player_id);

      // Find next player who hasn't answered
      const nextPlayer = game.game_players.find(
        (p) => !answeredIds.includes(p.id),
      );

      if (!nextPlayer) {
        // All players have answered this question
        return {
          success: true,
          message: 'All players have answered this question',
          data: {
            all_players_answered: true,
            question_id: questionId,
          },
        };
      }

      // Set the next player as current
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          current_player_id: nextPlayer.id,
          current_turn: nextPlayer.player_order,
        },
      });

      return {
        success: true,
        message: 'Question forwarded to next player',
        data: {
          question: {
            id: question.id,
            text: question.text,
            points: question.points,
            time_limit: question.time,
            file_url: question.file_url,
            answers: question.answers,
          },
          current_player: {
            id: nextPlayer.id,
            name: nextPlayer.player_name || nextPlayer.user?.name || 'Unknown',
            player_order: nextPlayer.player_order,
          },
          question_forwarded: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error stealing question: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Move to next question from the same category and difficulty
   */
  private async nextQuestionFromSameCategory(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_selections: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });

      if (!game || !game.game_selections.length) {
        throw new Error('Game or category selection not found');
      }

      const categorySelection = game.game_selections[0];
      const categoryId = categorySelection.category_id;
      const difficultyId = categorySelection.difficulty_id;

      // Get all questions for this category and difficulty
      const allQuestions = await this.prisma.question.findMany({
        where: {
          category_id: categoryId,
          difficulty_id: difficultyId,
        },
      });

      // Check if we've reached the total questions limit
      if (game.current_question >= game.total_questions) {
        // Game completed
        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            status: 'completed',
            game_phase: 'completed',
          },
        });
        return;
      }

      // Move to next question (increment counter for tracking)
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          current_question: game.current_question + 1,
        },
      });
    } catch (error) {
      // console.error('Error moving to next question:', error);
    }
  }

  /**
   * Debug method to get game details
   */
  async getGameDebugInfo(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
          },
          game_selections: {
            include: {
              category: true,
              difficulty: true,
            },
          },
        },
      });

      if (!game) {
        return {
          success: false,
          message: 'Game not found',
          data: null,
        };
      }

      return {
        success: true,
        message: 'Game debug info retrieved',
        data: {
          game: {
            id: game.id,
            status: game.status,
            game_phase: game.game_phase,
            current_question: game.current_question,
            total_questions: game.total_questions,
            current_player_id: game.current_player_id,
            current_turn: game.current_turn,
          },
          players: game.game_players.map((p) => ({
            id: p.id,
            name: p.player_name || p.user?.name || 'Unknown',
            player_order: p.player_order,
          })),
          game_selections: game.game_selections.map((gs) => ({
            id: gs.id,
            category: gs.category.name,
            difficulty: gs.difficulty.name,
            points: gs.points,
            player_id: gs.player_id,
            created_at: gs.created_at,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting debug info: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Get Quick Game status with scores and progress
   */
  async getQuickGameStatus(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
            orderBy: { score: 'desc' },
          },
          game_selections: {
            orderBy: { created_at: 'desc' },
            take: 1,
            include: {
              category: true,
              difficulty: true,
            },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Get total answers for this game
      const totalAnswers = await this.prisma.playerAnswer.count({
        where: {
          game_player: {
            game_id: gameId,
          },
        },
      });

      // Get correct answers count
      const correctAnswers = await this.prisma.playerAnswer.count({
        where: {
          game_player: {
            game_id: gameId,
          },
          isCorrect: true,
        },
      });

      return {
        success: true,
        message: 'Game status retrieved successfully',
        data: {
          game: {
            id: game.id,
            status: game.status,
            game_phase: game.game_phase,
            current_question: game.current_question,
            total_questions: game.total_questions,
            progress_percentage: Math.round(
              (game.current_question / game.total_questions) * 100,
            ),
          },
          category: game.game_selections[0]?.category || null,
          difficulty: game.game_selections[0]?.difficulty || null,
          players: game.game_players.map((player) => ({
            id: player.id,
            name: player.player_name || player.user?.name || 'Unknown',
            score: player.score,
            correct_answers: player.correct_answers,
            wrong_answers: player.wrong_answers,
            skipped_answers: player.skipped_answers,
            player_order: player.player_order,
          })),
          game_stats: {
            total_answers: totalAnswers,
            correct_answers: correctAnswers,
            wrong_answers: totalAnswers - correctAnswers,
            accuracy_percentage:
              totalAnswers > 0
                ? Math.round((correctAnswers / totalAnswers) * 100)
                : 0,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting game status: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * End Quick Game and get final results
   */
  async endQuickGame(gameId: string) {
    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        include: {
          game_players: {
            include: { user: true },
            orderBy: { score: 'desc' },
          },
          game_selections: {
            orderBy: { created_at: 'desc' },
            take: 1,
            include: {
              category: true,
              difficulty: true,
            },
          },
        },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      // Update game status to completed
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          status: 'completed',
          game_phase: 'completed',
        },
      });

      // Calculate final rankings
      const rankedPlayers = game.game_players.map((player, index) => ({
        id: player.id,
        name: player.player_name || player.user?.name || 'Unknown',
        score: player.score,
        correct_answers: player.correct_answers,
        wrong_answers: player.wrong_answers,
        skipped_answers: player.skipped_answers,
        final_rank: index + 1,
        player_order: player.player_order,
      }));

      // Get game statistics
      const totalAnswers = await this.prisma.playerAnswer.count({
        where: {
          game_player: {
            game_id: gameId,
          },
        },
      });

      const correctAnswers = await this.prisma.playerAnswer.count({
        where: {
          game_player: {
            game_id: gameId,
          },
          isCorrect: true,
        },
      });

      return {
        success: true,
        message: 'Game ended successfully',
        data: {
          game: {
            id: game.id,
            status: 'completed',
            total_questions: game.total_questions,
            current_question: game.current_question,
          },
          category: game.game_selections[0]?.category || null,
          difficulty: game.game_selections[0]?.difficulty || null,
          final_leaderboard: rankedPlayers,
          winner: rankedPlayers[0], // Highest score
          game_stats: {
            total_answers: totalAnswers,
            correct_answers: correctAnswers,
            wrong_answers: totalAnswers - correctAnswers,
            accuracy_percentage:
              totalAnswers > 0
                ? Math.round((correctAnswers / totalAnswers) * 100)
                : 0,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error ending game: ${error.message}`,
        data: null,
      };
    }
  }
}
