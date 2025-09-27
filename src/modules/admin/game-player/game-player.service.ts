import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GamePlayerService {
    constructor(private readonly prisma: PrismaService) { }

    // Get all game players with pagination and search
    async getAllGamePlayers(searchQuery: string | null, page: number, limit: number, sort: string, order: string) {
        try {
            const skip = (page - 1) * limit;

            // Construct the search filter based on query
            const whereClause = {};
            if (searchQuery) {
                const conditions: any[] = [
                    {
                        user: {
                            name: { contains: searchQuery, mode: 'insensitive' }
                        }
                    },
                    {
                        user: {
                            email: { contains: searchQuery, mode: 'insensitive' }
                        }
                    },
                ];

                const upper = searchQuery.toUpperCase();
                if (upper === 'QUICK_GAME' || upper === 'GRID_STYLE') {
                    conditions.push({ game: { mode: { equals: upper } } });
                } else if (searchQuery.toLowerCase().includes('quick') || searchQuery.toLowerCase().includes('game')) {
                    conditions.push({ game: { mode: { equals: 'QUICK_GAME' } } });
                } else if (searchQuery.toLowerCase().includes('grid') || searchQuery.toLowerCase().includes('style')) {
                    conditions.push({ game: { mode: { equals: 'GRID_STYLE' } } });
                }

                whereClause['OR'] = conditions;
            }

            // Count total records for pagination
            const total = await this.prisma.gamePlayer.count({ where: whereClause });

            // Normalize sort and build orderBy (supports user.name and scalar fields like score)
            const direction: Prisma.SortOrder = (order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
            const scalarFields = ['score', 'correct_answers', 'wrong_answers', 'skipped_answers', 'player_order', 'final_rank', 'created_at', 'updated_at'];
            let orderByClause: Prisma.GamePlayerOrderByWithRelationInput;
            if (sort === 'name') {
                orderByClause = { user: { name: direction } };
            } else if (scalarFields.includes(sort)) {
                orderByClause = { [sort]: direction } as Prisma.GamePlayerOrderByWithRelationInput;
            } else {
                orderByClause = { created_at: 'desc' } as Prisma.GamePlayerOrderByWithRelationInput;
            }

            // Query the game players with pagination, sorting, and filtering
            const gamePlayers = await this.prisma.gamePlayer.findMany({
                where: whereClause,
                skip: skip,
                take: limit,
                orderBy: orderByClause,
                select: {
                    id: true,
                    score: true,
                    player_name: true,
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
                        }
                    },
                    game: {
                        select: {
                            id: true,
                            mode: true,
                            status: true,
                            language: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true,
                                }
                            }
                        }
                    },
                    room: {
                        select: {
                            id: true,
                            code: true,
                        }
                    }
                },
            });

            // Pagination metadata calculation
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPreviousPage = page > 1;

            return {
                success: true,
                message: gamePlayers.length ? 'Game players retrieved successfully' : 'No game players found',
                data: gamePlayers,
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
                message: `Error fetching all game players: ${error.message}`,
            };
        }
    }

}