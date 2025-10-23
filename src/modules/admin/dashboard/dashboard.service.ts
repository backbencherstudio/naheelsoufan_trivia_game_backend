import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) { }

    // Get dashboard statistics
    async getDashboardStats() {
        try {
            // Get total counts in parallel for better performance
            const [
                totalPlayers,
                totalQuestions,
                totalCategories,
                totalHosts,
                totalGames,
                totalSubscriptions,
                recentPlayers,
                recentGames
            ] = await Promise.all([
                this.prisma.gamePlayer.count(),
                this.prisma.question.count(),
                this.prisma.category.count(),
                this.prisma.user.count({ where: { type: 'host' } }),
                this.prisma.game.count(),
                this.prisma.subscription.count(),
                this.prisma.gamePlayer.count({
                    where: {
                        created_at: {
                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                        }
                    }
                }),
                this.prisma.game.count({
                    where: {
                        created_at: {
                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                        }
                    }
                })
            ]);

            // Get active subscriptions count
            const activeSubscriptions = await this.prisma.subscription.count({
                where: {
                    status: 'active'
                }
            });

            // Get total revenue from subscriptions
            const revenueResult = await this.prisma.paymentTransaction.aggregate({
                where: {
                    type: 'subscription',
                    status: 'completed'
                },
                _sum: {
                    amount: true
                }
            });

            const totalRevenue = revenueResult._sum.amount || 0;

            return {
                success: true,
                message: 'Dashboard statistics retrieved successfully',
                data: {
                    overview: {
                        totalPlayers,
                        totalQuestions,
                        totalCategories,
                        totalHosts,
                        totalGames,
                        totalSubscriptions,
                        activeSubscriptions,
                        totalRevenue
                    },
                    recent: {
                        newPlayersLast7Days: recentPlayers,
                        newGamesLast7Days: recentGames
                    },
                    growth: {
                        playerGrowthRate: this.calculateGrowthRate(totalPlayers, recentPlayers),
                        gameGrowthRate: this.calculateGrowthRate(totalGames, recentGames)
                    }
                }
            };
        } catch (error) {
            return {
                success: false,
                message: `Error fetching dashboard statistics: ${error.message}`,
            };
        }
    }

    // Get detailed statistics by language
    async getStatsByLanguage() {
        try {
            const [
                categoriesByLanguage,
                questionsByLanguage,
                questionTypesByLanguage,
                difficultiesByLanguage
            ] = await Promise.all([
                this.prisma.category.groupBy({
                    by: ['language_id'],
                    _count: {
                        id: true
                    }
                }),
                this.prisma.question.groupBy({
                    by: ['language_id'],
                    _count: {
                        id: true
                    }
                }),
                this.prisma.questionType.groupBy({
                    by: ['language_id'],
                    _count: {
                        id: true
                    }
                }),
                this.prisma.difficulty.groupBy({
                    by: ['language_id'],
                    _count: {
                        id: true
                    }
                })
            ]);

            // Get language details
            const languages = await this.prisma.language.findMany({
                select: {
                    id: true,
                    name: true,
                    code: true
                }
            });

            // Combine all language statistics
            const languageStats = languages.map(language => {
                const categories = categoriesByLanguage.find(item => item.language_id === language.id);
                const questions = questionsByLanguage.find(item => item.language_id === language.id);
                const questionTypes = questionTypesByLanguage.find(item => item.language_id === language.id);
                const difficulties = difficultiesByLanguage.find(item => item.language_id === language.id);

                return {
                    language: {
                        id: language.id,
                        name: language.name,
                        code: language.code
                    },
                    counts: {
                        categories: categories?._count.id || 0,
                        questions: questions?._count.id || 0,
                        questionTypes: questionTypes?._count.id || 0,
                        difficulties: difficulties?._count.id || 0
                    }
                };
            });

            return {
                success: true,
                message: 'Language statistics retrieved successfully',
                data: languageStats
            };
        } catch (error) {
            return {
                success: false,
                message: `Error fetching language statistics: ${error.message}`,
            };
        }
    }

    // Get recent activity
    async getRecentActivity(limit: number = 10) {
        try {
            const [
                recentUsers,
                recentGames,
                recentSubscriptions
            ] = await Promise.all([
                this.prisma.user.findMany({
                    take: limit,
                    orderBy: {
                        created_at: 'desc'
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        created_at: true
                    }
                }),
                this.prisma.game.findMany({
                    take: limit,
                    orderBy: {
                        created_at: 'desc'
                    },
                    select: {
                        id: true,
                        mode: true,
                        status: true,
                        created_at: true,
                        host: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }),
                this.prisma.subscription.findMany({
                    take: limit,
                    orderBy: {
                        created_at: 'desc'
                    },
                    select: {
                        id: true,
                        status: true,
                        created_at: true,
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        },
                        subscription_type: {
                            select: {
                                id: true,
                                type: true,
                                price: true
                            }
                        }
                    }
                })
            ]);

            return {
                success: true,
                message: 'Recent activity retrieved successfully',
                data: {
                    recentUsers,
                    recentGames,
                    recentSubscriptions
                }
            };
        } catch (error) {
            return {
                success: false,
                message: `Error fetching recent activity: ${error.message}`,
            };
        }
    }

    // Get subscription analytics
    async getSubscriptionAnalytics() {
        try {
            const [
                subscriptionStats,
                revenueByMonth,
                popularPlans
            ] = await Promise.all([
                this.prisma.subscription.groupBy({
                    by: ['status'],
                    _count: {
                        id: true
                    }
                }),
                this.prisma.paymentTransaction.groupBy({
                    by: ['created_at'],
                    where: {
                        type: 'subscription',
                        status: 'completed'
                    },
                    _sum: {
                        amount: true
                    },
                    orderBy: {
                        created_at: 'desc'
                    },
                    take: 12 // Last 12 months
                }),
                this.prisma.subscription.groupBy({
                    by: ['subscription_type_id'],
                    _count: {
                        id: true
                    }
                })
            ]);

            return {
                success: true,
                message: 'Subscription analytics retrieved successfully',
                data: {
                    statusBreakdown: subscriptionStats,
                    monthlyRevenue: revenueByMonth,
                    popularPlans: popularPlans
                }
            };
        } catch (error) {
            return {
                success: false,
                message: `Error fetching subscription analytics: ${error.message}`,
            };
        }
    }

    // Helper method to calculate growth rate
    private calculateGrowthRate(total: number, recent: number): number {
        if (total === 0) return 0;
        return Math.round((recent / total) * 100);
    }
}
