import { HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetCategoryDto } from './dto/get-question.dto';
import { AnswerQuestionDto } from './dto/answer-question.dto';

@Injectable()
export class GridStyleService {
    constructor(private readonly prisma: PrismaService) { }

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
                where: { game_id: game_id }
            })

            const foundIds = new Set(categories.map(c => c.id));
            const missingIds = categoryIds.filter(id => !foundIds.has(id));
            if (missingIds.length) {
                throw new NotFoundException(
                    `The following category IDs were not found: ${missingIds.join(', ')}`
                );
            }

            const result = categories.map(cat => {
                const difficultyMap: Record<string, { name: string; points: number }> = {};

                cat.questions.forEach(q => {
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
                    players
                },
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException(`Error getting difficulty level: ${error.message}`);
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
            throw new InternalServerErrorException(`Error getting question: ${error.message}`);
        }
    }


    async answerQuestion(payload: AnswerQuestionDto) {
        try {
            const players = await this.prisma.gamePlayer.findMany({
                where: { game_id: payload.game_id }
            })



            return {
                success: true,
                message: 'Answer a question successfully.',
                data: {
                    players
                },
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException(`Error answering question: ${error.message}`);
        }
    }
}
