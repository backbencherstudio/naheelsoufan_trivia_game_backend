import { Injectable, NotFoundException } from '@nestjs/common';
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
                whereClause['OR'] = [
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
                    {
                        game: {
                            mode: { contains: searchQuery, mode: 'insensitive' }
                        }
                    }
                ];
            }

            // Count total records for pagination
            const total = await this.prisma.gamePlayer.count({ where: whereClause });

            // Query the game players with pagination, sorting, and filtering
            const gamePlayers = await this.prisma.gamePlayer.findMany({
                where: whereClause,
                skip: skip,
                take: limit,
                orderBy: {
                    [sort]: order, // Dynamically sort by the field and order provided
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