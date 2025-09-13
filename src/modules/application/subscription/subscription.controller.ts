import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto, PurchaseSubscriptionDto, CancelSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto, PaymentIntentResponseDto, SubscriptionStatusDto } from './dto/subscription-response.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';


@UseGuards(JwtAuthGuard)
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) { }

  /**
   * Get all available subscription types for a language
   */
  @Get('types')
  async getSubscriptionTypes(@Query('language_id') language_id: string) {
    return await this.subscriptionService.getSubscriptionTypes(language_id);
  }

  /**
   * Get user's subscriptions
   */
  @Get('my-subscriptions')
  async getUserSubscriptions(@Req() req: any) {
    const user_id = req.user?.userId;
    return await this.subscriptionService.getUserSubscriptions(user_id);
  }

  /**
   * Get user's active subscription status
   */
  @Get('status')
  async getSubscriptionStatus(@Req() req: any) {
    const user_id = req.user?.userId;
    return await this.subscriptionService.getSubscriptionStatus(user_id);
  }

  /**
   * Purchase a subscription
   */
  @Post('purchase')
  @HttpCode(HttpStatus.OK)
  async purchaseSubscription(@Req() req: any, @Body() dto: PurchaseSubscriptionDto) {
    const user_id = req.user?.userId;
    return await this.subscriptionService.purchaseSubscription(user_id, dto);
  }

  /**
   * Cancel a subscription
   */
  @Put('cancel')
  async cancelSubscription(@Req() req: any, @Body() dto: CancelSubscriptionDto) {
    const user_id = req.user?.userId;
    return await this.subscriptionService.cancelSubscription(user_id, dto);
  }

  /**
   * Check if user can play a specific game mode
   */
  @Get('can-play/:game_mode')
  async canUserPlayGame(@Req() req: any, @Param('game_mode') game_mode: string) {
    const user_id = req.user?.userId;
    return await this.subscriptionService.canUserPlayGame(user_id, game_mode);
  }

  /**
   * Get subscription by ID (for admin or detailed view)
   */
  @Get(':id')
  async getSubscriptionById(@Param('id') id: string, @Req() req: any) {
    const user_id = req.user?.userId;
    return await this.subscriptionService.getSubscriptionById(user_id, id);
  }
}
