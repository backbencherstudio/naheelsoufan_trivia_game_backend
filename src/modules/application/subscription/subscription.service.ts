import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripePayment } from '../../../common/lib/Payment/stripe/StripePayment';
import { TransactionRepository } from '../../../common/repository/transaction/transaction.repository';
import {
  CreateSubscriptionDto,
  PurchaseSubscriptionDto,
  CancelSubscriptionDto,
} from './dto/create-subscription.dto';
import {
  SubscriptionResponseDto,
  PaymentIntentResponseDto,
  SubscriptionStatusDto,
} from './dto/subscription-response.dto';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all subscription types for a language
   */
  async getSubscriptionTypes(language_id: string) {
    const data = await this.prisma.subscriptionType.findMany({
      where: {
        language_id,
        status: 'active',
      },
      orderBy: {
        price: 'asc',
      },
    });

    return {
      success: true,
      message: 'Subscription types retrieved successfully',
      data,
    };
  }

  /**
   * Get user's active subscriptions
   */
  async getUserSubscriptions(user_id: string, type?: string) {
    if (!user_id) {
      return {
        success: false,
        message: 'User not authenticated',
        data: [],
      };
    }

    if (!type) {
      return {
        success: false,
        message:
          'Please provide a subscription type (e.g., QUICK_GAME or GRID_STYLE) to filter.',
        data: [],
      };
    }

    const whereCondition: any = {
      user_id,
      subscription_type: {
        type: type,
      },
    };

    // Fetch subscriptions based on the condition
    const subscriptions = await this.prisma.subscription.findMany({
      where: whereCondition,
      include: {
        subscription_type: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Format the data (same as before)
    const data = subscriptions.map((sub) => ({
      id: sub.id,
      user_id: sub.user_id,
      subscription_type_id: sub.subscription_type_id,
      status: sub.status,
      games_played_count: sub.games_played_count,
      payment_status: sub.payment_status,
      payment_raw_status: sub.payment_raw_status,
      paid_amount: sub.paid_amount ? Number(sub.paid_amount) : undefined,
      paid_currency: sub.paid_currency,
      payment_provider: sub.payment_provider,
      payment_reference_number: sub.payment_reference_number,
      payment_provider_charge_type: sub.payment_provider_charge_type,
      payment_provider_charge: sub.payment_provider_charge
        ? Number(sub.payment_provider_charge)
        : undefined,
      created_at: sub.created_at,
      updated_at: sub.updated_at,
      subscription_type: sub.subscription_type
        ? {
            id: sub.subscription_type.id,
            type: sub.subscription_type.type,
            games: sub.subscription_type.games,
            questions: sub.subscription_type.questions,
            players: sub.subscription_type.players,
            price: sub.subscription_type.price,
            status: sub.subscription_type.status,
            language_id: sub.subscription_type.language_id,
          }
        : undefined,
    }));

    // Adjust message based on whether data was found
    const formattedType = type.replace('_', ' ');
    let message = `${formattedType} subscriptions retrieved successfully`;

    if (data.length === 0) {
      return {
        success: false,
        message: `No subscriptions found for ${formattedType}.`,
        data: [],
      };
    }

    return {
      success: true,
      message: message,
      data,
    };
  }

  /**
   * Get user's active subscription status
   */
  async getSubscriptionStatus(user_id: string) {
    if (!user_id) {
      return {
        success: false,
        message: 'User not authenticated',
        data: null,
      };
    }

    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        user_id,
        status: 'active',
      },
      include: {
        subscription_type: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!activeSubscription) {
      return {
        success: true,
        message: 'No active subscription found',
        data: null,
      };
    }

    const gamesRemaining =
      activeSubscription.subscription_type.games -
      activeSubscription.games_played_count;

    const data = {
      subscription_id: activeSubscription.id,
      status: activeSubscription.status,
      is_active: activeSubscription.status === 'active',
      can_play_games:
        gamesRemaining > 0 || activeSubscription.subscription_type.games === -1,
      games_remaining:
        activeSubscription.subscription_type.games === -1
          ? undefined
          : gamesRemaining,
      subscription_type: {
        type: activeSubscription.subscription_type.type,
        games: activeSubscription.subscription_type.games,
        questions: activeSubscription.subscription_type.questions,
        players: activeSubscription.subscription_type.players,
      },
    };

    return {
      success: true,
      message: 'Subscription status retrieved successfully',
      data,
    };
  }

  /**
   * Purchase a subscription
   */
  async purchaseSubscription(user_id: string, dto: PurchaseSubscriptionDto) {
    if (!user_id) {
      return {
        success: false,
        message: 'User not authenticated',
        data: null,
      };
    }

    // Get subscription type
    const subscriptionType = await this.prisma.subscriptionType.findUnique({
      where: { id: dto.subscription_type_id },
    });

    if (!subscriptionType) {
      throw new NotFoundException('Subscription type not found');
    }

    if (subscriptionType.status !== 'active') {
      throw new BadRequestException('Subscription type is not available');
    }

    // Check if user already has an active subscription of this type
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        user_id,
        subscription_type_id: dto.subscription_type_id,
        status: 'active',
      },
    });

    if (existingSubscription) {
      throw new ConflictException(
        'User already has an active subscription of this type',
      );
    }

    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create subscription record
    const subscription = await this.prisma.subscription.create({
      data: {
        user_id,
        subscription_type_id: dto.subscription_type_id,
        status: 'pending',
        payment_status: 'pending',
        payment_provider: 'stripe',
      },
    });

    try {
      // Create or get Stripe customer
      let customerId = user.billing_id;
      if (!customerId) {
        const customer = await StripePayment.createCustomer({
          user_id: user.id,
          name: user.name || 'Unknown',
          email: user.email || '',
        });
        customerId = customer.id;

        // Update user with Stripe customer ID
        await this.prisma.user.update({
          where: { id: user.id },
          data: { billing_id: customerId },
        });
      }

      // Create Stripe PaymentIntent
      const paymentIntent = await StripePayment.createPaymentIntent({
        amount: Number(subscriptionType.price), // Convert to number
        currency: 'usd',
        customer_id: customerId,
        metadata: {
          subscriptionId: subscription.id,
          userId: user.id,
          subscriptionTypeId: subscriptionType.id,
          subscriptionType: subscriptionType.type,
        },
      });

      // Update subscription with payment reference
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          payment_reference_number: paymentIntent.id,
        },
      });

      // Create payment transaction record
      await TransactionRepository.createSubscriptionTransaction({
        subscription_id: subscription.id,
        user_id: user.id,
        amount: Number(subscriptionType.price),
        currency: 'usd',
        reference_number: paymentIntent.id,
        status: 'pending',
        provider: 'stripe',
      });

      const data = {
        client_secret: paymentIntent.client_secret,
        subscription_id: subscription.id,
        payment_intent_id: paymentIntent.id,
        amount: Number(subscriptionType.price),
        currency: 'usd',
        status: 'pending',
      };

      // update user type to host
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          type: 'host',
        },
      });

      return {
        success: true,
        message:
          'Payment intent created successfully. Complete payment to activate subscription.',
        data,
      };
    } catch (error) {
      // If payment intent creation fails, update subscription status
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'failed',
          payment_status: 'failed',
        },
      });

      console.error(
        'Error creating Stripe payment intent for subscription:',
        error,
      );
      throw new BadRequestException('Failed to create payment intent');
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(user_id: string, dto: CancelSubscriptionDto) {
    if (!user_id) {
      return {
        success: false,
        message: 'User not authenticated',
        data: null,
      };
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: dto.subscription_id,
        user_id,
      },
      include: {
        subscription_type: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status === 'cancelled') {
      throw new BadRequestException('Subscription is already cancelled');
    }

    // Update subscription status
    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'cancelled',
        updated_at: new Date(),
      },
      include: {
        subscription_type: true,
      },
    });

    const data = {
      id: updatedSubscription.id,
      user_id: updatedSubscription.user_id,
      subscription_type_id: updatedSubscription.subscription_type_id,
      status: updatedSubscription.status,
      games_played_count: updatedSubscription.games_played_count,
      payment_status: updatedSubscription.payment_status,
      payment_raw_status: updatedSubscription.payment_raw_status,
      paid_amount: updatedSubscription.paid_amount
        ? Number(updatedSubscription.paid_amount)
        : undefined,
      paid_currency: updatedSubscription.paid_currency,
      payment_provider: updatedSubscription.payment_provider,
      payment_reference_number: updatedSubscription.payment_reference_number,
      payment_provider_charge_type:
        updatedSubscription.payment_provider_charge_type,
      payment_provider_charge: updatedSubscription.payment_provider_charge
        ? Number(updatedSubscription.payment_provider_charge)
        : undefined,
      created_at: updatedSubscription.created_at,
      updated_at: updatedSubscription.updated_at,
      subscription_type: updatedSubscription.subscription_type
        ? {
            id: updatedSubscription.subscription_type.id,
            type: updatedSubscription.subscription_type.type,
            games: updatedSubscription.subscription_type.games,
            questions: updatedSubscription.subscription_type.questions,
            players: updatedSubscription.subscription_type.players,
            price: updatedSubscription.subscription_type.price,
            status: updatedSubscription.subscription_type.status,
            language_id: updatedSubscription.subscription_type.language_id,
          }
        : undefined,
    };

    return {
      success: true,
      message: 'Subscription cancelled successfully',
      data,
    };
  }

  /**
   * Handle successful payment (called by webhook)
   */
  async handlePaymentSuccess(paymentIntentId: string) {
    // Find subscription by payment reference
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        payment_reference_number: paymentIntentId,
      },
    });

    if (!subscription) {
      console.error(
        'Subscription not found for payment intent:',
        paymentIntentId,
      );
      return;
    }

    // Update subscription status to active
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'active',
        payment_status: 'completed',
      },
    });
  }

  /**
   * Handle failed payment (called by webhook)
   */
  async handlePaymentFailed(paymentIntentId: string) {
    // Find subscription by payment reference
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        payment_reference_number: paymentIntentId,
      },
    });

    if (!subscription) {
      console.error(
        'Subscription not found for payment intent:',
        paymentIntentId,
      );
      return;
    }

    // Update subscription status to failed
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'failed',
        payment_status: 'failed',
      },
    });
  }

  /**
   * Check if user can play a specific game mode
   */
  async canUserPlayGame(user_id: string, game_mode: string) {
    if (!user_id) {
      return {
        success: false,
        message: 'User not authenticated',
        data: {
          can_play: false,
          game_mode,
          requires_subscription: true,
        },
      };
    }

    const isFreeGame = game_mode === 'QUICK_GAME' || game_mode === 'GRID_STYLE';

    // Free games - always allowed
    if (isFreeGame) {
      return {
        success: true,
        message: 'User can play this game mode',
        data: {
          can_play: true,
          game_mode,
          requires_subscription: false,
        },
      };
    }

    // Check for active subscription
    const activeSubscription = await this.prisma.subscription.findFirst({
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
        success: true,
        message: 'User cannot play this game mode',
        data: {
          can_play: false,
          game_mode,
          requires_subscription: true,
        },
      };
    }

    // Check if user has remaining games
    const gamesRemaining =
      activeSubscription.subscription_type.games -
      activeSubscription.games_played_count;
    const canPlay =
      gamesRemaining > 0 || activeSubscription.subscription_type.games === -1; // -1 means unlimited

    return {
      success: true,
      message: canPlay
        ? 'User can play this game mode'
        : 'User cannot play this game mode',
      data: {
        can_play: canPlay,
        game_mode,
        requires_subscription: true,
      },
    };
  }

  /**
   * Increment game played count for user's subscription
   */
  async incrementGamePlayed(user_id: string): Promise<void> {
    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        user_id,
        status: 'active',
      },
    });

    if (activeSubscription) {
      await this.prisma.subscription.update({
        where: { id: activeSubscription.id },
        data: {
          games_played_count: {
            increment: 1,
          },
        },
      });
    }
  }

  /**
   * Get subscription by ID for specific user
   */
  async getSubscriptionById(user_id: string, subscription_id: string) {
    if (!user_id) {
      return {
        success: false,
        message: 'User not authenticated',
        data: null,
      };
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscription_id,
        user_id,
      },
      include: {
        subscription_type: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const data = {
      id: subscription.id,
      user_id: subscription.user_id,
      subscription_type_id: subscription.subscription_type_id,
      status: subscription.status,
      games_played_count: subscription.games_played_count,
      payment_status: subscription.payment_status,
      payment_raw_status: subscription.payment_raw_status,
      paid_amount: subscription.paid_amount
        ? Number(subscription.paid_amount)
        : undefined,
      paid_currency: subscription.paid_currency,
      payment_provider: subscription.payment_provider,
      payment_reference_number: subscription.payment_reference_number,
      payment_provider_charge_type: subscription.payment_provider_charge_type,
      payment_provider_charge: subscription.payment_provider_charge
        ? Number(subscription.payment_provider_charge)
        : undefined,
      created_at: subscription.created_at,
      updated_at: subscription.updated_at,
      subscription_type: subscription.subscription_type
        ? {
            id: subscription.subscription_type.id,
            type: subscription.subscription_type.type,
            games: subscription.subscription_type.games,
            questions: subscription.subscription_type.questions,
            players: subscription.subscription_type.players,
            price: subscription.subscription_type.price,
            status: subscription.subscription_type.status,
            language_id: subscription.subscription_type.language_id,
          }
        : undefined,
    };

    return {
      success: true,
      message: 'Subscription retrieved successfully',
      data,
    };
  }
}
