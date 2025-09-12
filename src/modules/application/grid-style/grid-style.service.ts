import { HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GridStyleService {
    constructor(private readonly prisma: PrismaService) { }

    async getQuestion(gameID: string, categories: string[]) {
        try {
            const questions = await this.prisma.category.findMany({
                where: {
                    id: { in: categories },
                },
                select: {
                    _count: true,
                    id: true,
                    questions: {
                        select: {
                            id: true,
                            answers: true
                        }
                    },
                }
            });

            const foundIds = questions.map(q => q.id);
            const missingIds = categories.filter(id => !foundIds.includes(id));

            if (missingIds.length > 0) {
                throw new NotFoundException(
                    `The following category IDs were not found: ${missingIds.join(', ')}`
                );
            }

            return {
                success: true,
                categories,
                questions,
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException(
                `Error fetching questions: ${error.message}`
            );
        }
    }

}
