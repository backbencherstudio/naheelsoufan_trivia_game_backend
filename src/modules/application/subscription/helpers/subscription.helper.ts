import { PrismaService } from '../../../../prisma/prisma.service';

export class SubscriptionHelper {
    /**
     * Check if user has active subscription
     */
    static async hasActiveSubscription(prisma: PrismaService, user_id: string): Promise<boolean> {
        const subscription = await prisma.subscription.findFirst({
            where: {
                user_id,
                status: 'active',
            },
        });

        return !!subscription;
    }

    /**
     * Check if user can play a specific game mode
     */
    static async canPlayGameMode(prisma: PrismaService, user_id: string, game_mode: string): Promise<boolean> {
        // Free games are always allowed
        if (game_mode === 'QUICK_GAME' || game_mode === 'GRID_STYLE') {
            return true;
        }

        // Check for active subscription
        const activeSubscription = await prisma.subscription.findFirst({
            where: {
                user_id,
                status: 'active',
            },
            include: {
                subscription_type: true,
            },
        });

        if (!activeSubscription) {
            return false;
        }

        // Check if user has remaining games
        const gamesRemaining = activeSubscription.subscription_type.games - activeSubscription.games_played_count;
        return gamesRemaining > 0 || activeSubscription.subscription_type.games === -1; // -1 means unlimited
    }

    /**
     * Get user's subscription limits
     */
    static async getSubscriptionLimits(prisma: PrismaService, user_id: string) {
        const activeSubscription = await prisma.subscription.findFirst({
            where: {
                user_id,
                status: 'active',
            },
            include: {
                subscription_type: true,
            },
        });

        if (!activeSubscription) {
            return {
                has_subscription: false,
                games_limit: 0,
                games_played: 0,
                games_remaining: 0,
                questions_limit: 0,
                players_limit: 4,
            };
        }

        const gamesRemaining = activeSubscription.subscription_type.games === -1
            ? -1 // unlimited
            : activeSubscription.subscription_type.games - activeSubscription.games_played_count;

        return {
            has_subscription: true,
            games_limit: activeSubscription.subscription_type.games,
            games_played: activeSubscription.games_played_count,
            games_remaining: gamesRemaining,
            questions_limit: activeSubscription.subscription_type.questions,
            players_limit: activeSubscription.subscription_type.players,
            subscription_type: activeSubscription.subscription_type.type,
        };
    }

    /**
     * Validate subscription for game creation
     */
    static async validateGameCreation(
        prisma: PrismaService,
        user_id: string,
        game_mode: string,
        max_players?: number
    ): Promise<{
        valid: boolean;
        message?: string;
        subscription_required?: boolean;
    }> {
        // Free games validation
        if (game_mode === 'QUICK_GAME' || game_mode === 'GRID_STYLE') {
            return { valid: true };
        }

        // Check for active subscription
        const activeSubscription = await prisma.subscription.findFirst({
            where: {
                user_id,
                status: 'active',
            },
            include: {
                subscription_type: true,
            },
        });

        if (!activeSubscription) {
            return {
                valid: false,
                message: 'Subscription required to play this game mode',
                subscription_required: true,
            };
        }

        // Check games remaining
        const gamesRemaining = activeSubscription.subscription_type.games - activeSubscription.games_played_count;
        if (activeSubscription.subscription_type.games !== -1 && gamesRemaining <= 0) {
            return {
                valid: false,
                message: 'No games remaining in your subscription',
                subscription_required: false,
            };
        }

        // Check player limit
        if (max_players && max_players > activeSubscription.subscription_type.players) {
            return {
                valid: false,
                message: `Your subscription allows maximum ${activeSubscription.subscription_type.players} players`,
                subscription_required: false,
            };
        }

        return { valid: true };
    }

    /**
     * Get free game modes
     */
    static getFreeGameModes(): string[] {
        return ['QUICK_GAME', 'GRID_STYLE'];
    }

    /**
     * Get premium game modes
     */
    static getPremiumGameModes(): string[] {
        return ['TOURNAMENT', 'MULTIPLAYER', 'CUSTOM_QUIZ', 'TIMED_CHALLENGE', 'SURVIVAL_MODE'];
    }

    /**
     * Check if game mode is free
     */
    static isGameModeFree(game_mode: string): boolean {
        return this.getFreeGameModes().includes(game_mode);
    }

    /**
     * Check if game mode requires subscription
     */
    static requiresSubscription(game_mode: string): boolean {
        return this.getPremiumGameModes().includes(game_mode);
    }
}
