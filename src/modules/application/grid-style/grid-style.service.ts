import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetCategoryDto } from './dto/get-question.dto';
import { AnswerQuestionDto } from './dto/answer-question.dto';

@Injectable()
export class GridStyleService {
  constructor(private readonly prisma: PrismaService) {}

  async listDifficultyLevel(game_id: string, categoryIds: string[]) {
    try {
      const categories = await this.prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: {
          id: true,
          name: true,
          questions: {
            select: {
              difficulty: { select: { id: true, name: true, points: true } },
            },
          },
        },
      });
      const players = await this.prisma.gamePlayer.findMany({
        where: { game_id: game_id },
      });

      const foundIds = new Set(categories.map((c) => c.id));
      const missingIds = categoryIds.filter((id) => !foundIds.has(id));
      if (missingIds.length) {
        throw new NotFoundException(
          `The following category IDs were not found: ${missingIds.join(', ')}`,
        );
      }

      const result = categories.map((cat) => {
        const difficultyMap: Record<string, { name: string; points: number }> =
          {};

        cat.questions.forEach((q) => {
          const diff = q.difficulty;
          if (!diff) return;

          const points = diff.points ?? 10;
          difficultyMap[diff.id] = { name: diff.name, points };
        });

        return {
          id: cat.id,
          name: cat.name,
          difficulty: Object.entries(difficultyMap).map(([id, value]) => ({
            id,
            name: value.name,
            points: value.points,
          })),
        };
      });

      return {
        success: true,
        message: 'Data fetched successfully.',
        data: {
          categories: result,
          players,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error getting difficulty level: ${error.message}`,
      );
    }
  }

  async getQuestionByCategory(query: GetCategoryDto) {
    try {
      const questions = await this.prisma.question.findMany({
        where: {
          category_id: query.category_id,
          difficulty_id: query.difficulty_id,
          player_answers: {
            none: {
              game_player: {
                game_id: query.game_id,
              },
            },
          },
        },
        include: {
          answers: true,
        },
      });

      if (!questions.length) return null;
      const randomIndex = Math.floor(Math.random() * questions.length);
      const question = questions[randomIndex];
      return {
        success: true,
        message: 'Data fetched successfully.',
        data: question,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error getting question: ${error.message}`,
      );
    }
  }

  async answerQuestion(payload: AnswerQuestionDto) {
    try {
      const players = await this.prisma.gamePlayer.findMany({
        where: { game_id: payload.game_id },
      });

      return {
        success: true,
        message: 'Answer a question successfully.',
        data: {
          players,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error answering question: ${error.message}`,
      );
    }
  }

  /**
   * Select category/difficulty and start game in one step
   */
  // async selectCategoryAndStart(
  //   gameId: string,
  //   categoryIds: string[],
  //   difficultyIds: string[],
  // ) {
  //   try {
  //     const game = await this.prisma.game.findUnique({
  //       where: { id: gameId },
  //       include: {
  //         game_players: {
  //           include: { user: true },
  //           orderBy: { player_order: 'asc' },
  //         },
  //       },
  //     });

  //     if (!game) throw new NotFoundException('Game not found');
  //     if (game.game_players.length < 2)
  //       throw new BadRequestException('Need at least 2 players to start game');

  //     // Max 7 categories allowed
  //     if (categoryIds.length > 7) {
  //       throw new BadRequestException('You can select at most 7 categories');
  //     }

  //     // Validate all categories
  //     const categories = await this.prisma.category.findMany({
  //       where: { id: { in: categoryIds } },
  //     });
  //     if (categories.length !== categoryIds.length) {
  //       throw new BadRequestException('Invalid category ids provided');
  //     }

  //     // Validate all difficulties
  //     const difficulties = await this.prisma.difficulty.findMany({
  //       where: { id: { in: difficultyIds } },
  //     });
  //     if (difficulties.length !== difficultyIds.length) {
  //       throw new BadRequestException('Invalid difficulty ids provided');
  //     }

  //     // Subscription check for question limit
  //     const hostSubscription = await this.prisma.subscription.findFirst({
  //       where: { user_id: game.host_id, status: 'active' },
  //       include: { subscription_type: true },
  //     });

  //     let totalLimit = 10;
  //     if (hostSubscription) {
  //       const subLimit = hostSubscription.subscription_type.questions;
  //       if (subLimit !== -1) totalLimit = Math.min(10, subLimit);
  //     }

  //     // Distribution logic
  //     const totalCategories = categoryIds.length;
  //     const baseShare = Math.floor(totalLimit / totalCategories);
  //     let remainder = totalLimit % totalCategories;

  //     const categoryShares: number[] = categoryIds.map(() => baseShare);
  //     for (let i = 0; i < categoryShares.length && remainder > 0; i++) {
  //       categoryShares[i] += 1;
  //       remainder--;
  //     }

  //     // Collect questions category-wise
  //     const selectedQuestions: any[] = [];

  //     for (let i = 0; i < categoryIds.length; i++) {
  //       const categoryId = categoryIds[i];
  //       const share = categoryShares[i];

  //       const questions = await this.prisma.question.findMany({
  //         where: {
  //           category_id: categoryId,
  //           difficulty_id: { in: difficultyIds },
  //         },
  //         include: {
  //           answers: { select: { id: true, text: true, file_url: true } },
  //         },
  //       });

  //       // shuffle
  //       const shuffled = questions.sort(() => 0.5 - Math.random());
  //       selectedQuestions.push(...shuffled.slice(0, share));
  //     }

  //     // Start the game
  //     await this.prisma.game.update({
  //       where: { id: gameId },
  //       data: {
  //         status: 'in_progress',
  //         game_phase: 'question',
  //         total_questions: selectedQuestions.length,
  //         current_question: 1,
  //         current_turn: 1,
  //         current_player_id: game.game_players[0].id,
  //       },
  //     });

  //     return {
  //       success: true,
  //       message: 'Game started with selected categories & difficulties',
  //       data: {
  //         categories,
  //         difficulties,
  //         total_questions: selectedQuestions.length,
  //         players: game.game_players.map((p) => ({
  //           id: p.id,
  //           name: p.player_name || p.user?.name || 'Unknown',
  //         })),
  //         questions: selectedQuestions,
  //       },
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: `Error: ${error.message}`,
  //       data: null,
  //     };
  //   }
  // }
}
