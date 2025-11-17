import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SubscriptionService {
    constructor(private prisma: PrismaService) { }

    /**
     * Get all subscribed users with their subscription details (with pagination)
     */
    async getAllSubscribedUsers(searchQuery: string | null, page: number, limit: number, sort: string, order: string, status?: string,) {
        const skip = (page - 1) * limit;

        // Construct the search filter based on query and status
        const whereClause: any = {};

        if (status) {
            whereClause.status = status;
        }

        whereClause.payment_status = 'completed';

        if (searchQuery) {
            whereClause.OR = [
                { user: { name: { contains: searchQuery, mode: 'insensitive' } } },
                { user: { email: { contains: searchQuery, mode: 'insensitive' } } },
                { user: { username: { contains: searchQuery, mode: 'insensitive' } } },
                { subscription_type: { type: { contains: searchQuery, mode: 'insensitive' } } },
            ];
        }

        // Count total records for pagination
        const total = await this.prisma.subscription.count({ where: whereClause });

        // Build orderBy supporting related fields (user.name, user.email) and scalar fields
        const direction: Prisma.SortOrder = (order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
        const relationOrder: Prisma.SubscriptionOrderByWithRelationInput =
            sort === 'name' ? { user: { name: direction } } :
                sort === 'email' ? { user: { email: direction } } : {};

        const scalarSortField = ['created_at', 'updated_at', 'games_played_count', 'paid_amount', 'status', 'payment_status'].includes(sort)
            ? sort
            : 'created_at';

        const orderByClause: Prisma.SubscriptionOrderByWithRelationInput =
            Object.keys(relationOrder).length > 0
                ? relationOrder
                : { [scalarSortField]: direction } as Prisma.SubscriptionOrderByWithRelationInput;

        // Query the subscriptions with pagination, sorting, and filtering
        const subscriptions = await this.prisma.subscription.findMany({
            where: whereClause,
            skip: skip,
            take: limit,
            orderBy: orderByClause,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        type: true,
                        status: true,
                    },
                },
                subscription_type: {
                    select: {
                        id: true,
                        type: true,
                        game_mode: true,
                        games: true,
                        questions: true,
                        players: true,
                        price: true,
                        language: {
                            select: {
                                name: true,
                                code: true,
                            },
                        },
                    },
                },
            },
        });

        const data = subscriptions.map(sub => ({
            subscription_id: sub.id,
            subscription_status: sub.status,
            games_played_count: sub.games_played_count,
            payment_status: sub.payment_status,
            payment_provider: sub.payment_provider,
            paid_amount: sub.paid_amount ? Number(sub.paid_amount) : null,
            paid_currency: sub.paid_currency,
            subscription_created_at: sub.created_at,
            subscription_updated_at: sub.updated_at,
            user: sub.user,
            subscription_type: sub.subscription_type,
        }));

        // Pagination metadata calculation
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPreviousPage = page > 1;

        return {
            success: true,
            message: 'Subscribed users retrieved successfully',
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage,
                hasPreviousPage,
            },
        };
    }
    /**
     * Get subscription statistics
     */
    async getSubscriptionStats() {
        const [
            totalSubscriptions,
            activeSubscriptions,
            cancelledSubscriptions,
            pendingSubscriptions,
            totalRevenue,
        ] = await Promise.all([
            this.prisma.subscription.count(),
            this.prisma.subscription.count({ where: { status: 'active' } }),
            this.prisma.subscription.count({ where: { status: 'cancelled' } }),
            this.prisma.subscription.count({ where: { status: 'pending' } }),
            this.prisma.subscription.aggregate({
                where: { status: 'active' },
                _sum: { paid_amount: true },
            }),
        ]);

        // Get subscription breakdown by type
        const subscriptionsByType = await this.prisma.subscription.groupBy({
            by: ['subscription_type_id'],
            where: { status: 'active' },
            _count: true,
        });

        const data = {
            total_subscriptions: totalSubscriptions,
            active_subscriptions: activeSubscriptions,
            cancelled_subscriptions: cancelledSubscriptions,
            pending_subscriptions: pendingSubscriptions,
            total_revenue: totalRevenue._sum.paid_amount ? Number(totalRevenue._sum.paid_amount) : 0,
            subscriptions_by_type: subscriptionsByType,
        };

        return {
            success: true,
            message: 'Subscription statistics retrieved successfully',
            data,
        };
    }

    /**
     * Get user subscription details by user ID
     */
    async getUserSubscriptions(user_id: string) {
        const subscriptions = await this.prisma.subscription.findMany({
            where: { user_id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        username: true,
                        first_name: true,
                        last_name: true,
                        avatar: true,
                        phone_number: true,
                        country: true,
                        created_at: true,
                        type: true,
                        status: true,
                    },
                },
                subscription_type: {
                    select: {
                        id: true,
                        type: true,
                        games: true,
                        questions: true,
                        players: true,
                        price: true,
                        status: true,
                        language_id: true,
                        language: {
                            select: {
                                name: true,
                                code: true,
                            },
                        },
                    },
                },
                payment_transactions: {
                    select: {
                        id: true,
                        amount: true,
                        currency: true,
                        status: true,
                        provider: true,
                        reference_number: true,
                        created_at: true,
                    },
                    orderBy: {
                        created_at: 'desc',
                    },
                },
            },
            orderBy: {
                created_at: 'desc',
            },
        });

        if (!subscriptions.length) {
            return {
                success: false,
                message: 'No subscriptions found for this user',
                data: null,
            };
        }

        const data = subscriptions.map(sub => ({
            subscription_id: sub.id,
            subscription_status: sub.status,
            games_played_count: sub.games_played_count,
            payment_status: sub.payment_status,
            payment_provider: sub.payment_provider,
            paid_amount: sub.paid_amount ? Number(sub.paid_amount) : null,
            paid_currency: sub.paid_currency,
            subscription_created_at: sub.created_at,
            subscription_updated_at: sub.updated_at,
            user: sub.user,
            subscription_type: sub.subscription_type,
            payment_transactions: sub.payment_transactions.map(tx => ({
                ...tx,
                amount: tx.amount ? Number(tx.amount) : null,
            })),
        }));

        return {
            success: true,
            message: 'User subscriptions retrieved successfully',
            data,
        };
    }

    /**
     * Cancel user subscription (admin action)
     */
    async cancelUserSubscription(subscription_id: string, reason?: string) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { id: subscription_id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                subscription_type: {
                    select: {
                        type: true,
                    },
                },
            },
        });

        if (!subscription) {
            return {
                success: false,
                message: 'Subscription not found',
                data: null,
            };
        }

        if (subscription.status === 'cancelled') {
            return {
                success: false,
                message: 'Subscription is already cancelled',
                data: null,
            };
        }

        const updatedSubscription = await this.prisma.subscription.update({
            where: { id: subscription_id },
            data: {
                status: 'cancelled',
                updated_at: new Date(),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        username: true,
                        first_name: true,
                        last_name: true,
                    },
                },
                subscription_type: {
                    select: {
                        type: true,
                        game_mode: true,
                        games: true,
                        questions: true,
                        players: true,
                        price: true,
                    },
                },
            },
        });

        return {
            success: true,
            message: `Subscription cancelled successfully${reason ? ` - Reason: ${reason}` : ''}`,
            data: {
                subscription_id: updatedSubscription.id,
                subscription_status: updatedSubscription.status,
                games_played_count: updatedSubscription.games_played_count,
                user: updatedSubscription.user,
                subscription_type: updatedSubscription.subscription_type,
                cancelled_at: updatedSubscription.updated_at,
            },
        };
    }
}
