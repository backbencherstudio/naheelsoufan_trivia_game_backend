import { Injectable } from '@nestjs/common';
import { CreateLeaderboardDto } from './dto/create-leaderboard.dto';
import { UpdateLeaderboardDto } from './dto/update-leaderboard.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { GameMode } from '@prisma/client';

@Injectable()
export class LeaderboardService {
    constructor(private readonly prisma: PrismaService) { }

    // Create a new leaderboard entry
    async create(createLeaderboardDto: CreateLeaderboardDto) {
        try {
            const leaderboard = await this.prisma.leaderboard.create({
                data: {
                    ...createLeaderboardDto,
                    tts_speed: createLeaderboardDto.tts_speed || 50,
                    games_played: createLeaderboardDto.games_played || 1,
                },
                select: {
                    id: true,
                    score: true,
                    correct: true,
                    wrong: true,
                    skipped: true,
                    tts_speed: true,
                    games_played: true,
                    mode: true,
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
                            status: true,
                        },
                    },
                },
            });

            return {
                success: true,
                message: 'Leaderboard entry created successfully',
                data: leaderboard,
            };
        } catch (error) {
            return {
                success: false,
                message: `Error creating leaderboard entry: ${error.message}`,
            };
        }
    }

    // Get all leaderboard entries with pagination and filters
    async findAll(
        searchQuery: string | null,
        page: number,
        limit: number,
        sort: string,
        order: string,
        filters: {
            mode?: GameMode;
            category_id?: string;
            user_id?: string;
        }
    ) {
        try {
            const skip = (page - 1) * limit;
            const whereClause = {};

            // Apply filters
            if (filters.mode) {
                whereClause['mode'] = filters.mode;
            }

            if (filters.category_id) {
                whereClause['category_id'] = filters.category_id;
            }

            if (filters.user_id) {
                whereClause['user_id'] = filters.user_id;
            }

            // Add search filter if provided
            if (searchQuery) {
                const searchConditions = [
                    {
                        user: {
                            name: { contains: searchQuery, mode: 'insensitive' }
                        }
                    },
                    {
                        user: {
                            email: { contains: searchQuery, mode: 'insensitive' }
                        }
                    }
                ];

                if (Object.keys(whereClause).length > 0) {
                    whereClause['AND'] = [
                        { ...whereClause },
                        { OR: searchConditions }
                    ];

                    // Clear direct conditions
                    if (filters.mode) delete whereClause['mode'];
                    if (filters.category_id) delete whereClause['category_id'];
                    if (filters.user_id) delete whereClause['user_id'];
                } else {
                    whereClause['OR'] = searchConditions;
                }
            }

            // Count total records for pagination
            const total = await this.prisma.leaderboard.count({ where: whereClause });

            // Query leaderboard entries
            const leaderboards = await this.prisma.leaderboard.findMany({
                where: whereClause,
                skip: skip,
                take: limit,
                orderBy: {
                    [sort]: order,
                },
                select: {
                    id: true,
                    score: true,
                    correct: true,
                    wrong: true,
                    skipped: true,
                    tts_speed: true,
                    games_played: true,
                    mode: true,
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
                            status: true,
                        },
                    },
                },
            });

            // Pagination metadata calculation
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPreviousPage = page > 1;

            return {
                success: true,
                message: leaderboards.length ? 'Leaderboard entries retrieved successfully' : 'No leaderboard entries found',
                data: leaderboards,
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
                message: `Error fetching leaderboard entries: ${error.message}`,
            };
        }
    }

    // Get a single leaderboard entry by ID
    async findOne(id: string) {
        try {
            const leaderboard = await this.prisma.leaderboard.findUnique({
                where: { id },
                select: {
                    id: true,
                    score: true,
                    correct: true,
                    wrong: true,
                    skipped: true,
                    tts_speed: true,
                    games_played: true,
                    mode: true,
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
                            status: true,
                        },
                    },
                    category: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                        },
                    },
                },
            });

            return {
                success: true,
                message: leaderboard ? 'Leaderboard entry retrieved successfully' : 'Leaderboard entry not found',
                data: leaderboard,
            };
        } catch (error) {
            return {
                success: false,
                message: `Error fetching leaderboard entry: ${error.message}`,
            };
        }
    }

    // Update an existing leaderboard entry
    async update(id: string, updateLeaderboardDto: UpdateLeaderboardDto) {
        try {
            const updatedLeaderboard = await this.prisma.leaderboard.update({
                where: { id },
                data: updateLeaderboardDto,
                select: {
                    id: true,
                    score: true,
                    correct: true,
                    wrong: true,
                    skipped: true,
                    tts_speed: true,
                    games_played: true,
                    mode: true,
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
                            status: true,
                        },
                    },
                    category: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                        },
                    },
                },
            });

            return {
                success: true,
                message: 'Leaderboard entry updated successfully',
                data: updatedLeaderboard,
            };
        } catch (error) {
            return {
                success: false,
                message: `Error updating leaderboard entry: ${error.message}`,
            };
        }
    }

    // Delete a leaderboard entry by ID
    async remove(id: string) {
        try {
            await this.prisma.leaderboard.delete({
                where: { id },
            });

            return {
                success: true,
                message: 'Leaderboard entry deleted successfully',
            };
        } catch (error) {
            return {
                success: false,
                message: `Error deleting leaderboard entry: ${error.message}`,
            };
        }
    }

    // Get top players by score (global leaderboard)
    async getTopPlayers(mode?: GameMode, category_id?: string, limit: number = 10) {
        try {
            const whereClause = {};

            if (mode) {
                whereClause['mode'] = mode;
            }

            if (category_id) {
                whereClause['category_id'] = category_id;
            }

            const topPlayers = await this.prisma.leaderboard.findMany({
                where: whereClause,
                orderBy: [
                    { score: 'desc' },
                    { correct: 'desc' },
                    { created_at: 'asc' }
                ],
                take: limit,
                select: {
                    id: true,
                    score: true,
                    correct: true,
                    wrong: true,
                    skipped: true,
                    games_played: true,
                    mode: true,
                    created_at: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatar: true,
                        },
                    },
                    category: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                        },
                    },
                },
            });

            // Add ranking
            const rankedPlayers = topPlayers.map((player, index) => ({
                ...player,
                rank: index + 1,
            }));

            return {
                success: true,
                message: 'Top players retrieved successfully',
                data: rankedPlayers,
            };
        } catch (error) {
            return {
                success: false,
                message: `Error fetching top players: ${error.message}`,
            };
        }
    }

    // Get user's ranking and stats
    async getUserRanking(user_id: string, mode?: GameMode, category_id?: string) {
        try {
            const whereClause = { user_id };

            if (mode) {
                whereClause['mode'] = mode;
            }

            if (category_id) {
                whereClause['category_id'] = category_id;
            }

            // Get user's best score
            const userBest = await this.prisma.leaderboard.findFirst({
                where: whereClause,
                orderBy: [
                    { score: 'desc' },
                    { correct: 'desc' },
                    { created_at: 'asc' }
                ],
                select: {
                    id: true,
                    score: true,
                    correct: true,
                    wrong: true,
                    skipped: true,
                    games_played: true,
                    mode: true,
                    created_at: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatar: true,
                        },
                    },
                    category: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                        },
                    },
                },
            });

            if (!userBest) {
                return {
                    success: false,
                    message: 'No leaderboard entries found for this user',
                };
            }

            // Count how many players have better scores
            const betterPlayersCount = await this.prisma.leaderboard.count({
                where: {
                    mode: mode,
                    category_id: category_id,
                    user_id: { not: user_id },
                    OR: [
                        { score: { gt: userBest.score } },
                        {
                            AND: [
                                { score: userBest.score },
                                { correct: { gt: userBest.correct } }
                            ]
                        }
                    ]
                }
            });

            const rank = betterPlayersCount + 1;

            return {
                success: true,
                message: 'User ranking retrieved successfully',
                data: {
                    ...userBest,
                    rank: rank,
                },
            };
        } catch (error) {
            return {
                success: false,
                message: `Error fetching user ranking: ${error.message}`,
            };
        }
    }
}