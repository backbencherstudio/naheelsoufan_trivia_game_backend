import { HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GridStyleService {
    constructor(private readonly prisma: PrismaService) { }

    async listDifficultyLevel(categoryIds: string[]) {
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
                data: result,
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException(`Error joining game: ${error.message}`);
        }
    }
}
