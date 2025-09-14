import { Controller, Get, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Role } from '../../../common/guard/role/role.enum';

@ApiBearerAuth()
@ApiTags('Admin Subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) { }

  /**
   * Get all subscribed users with pagination
   */
  @ApiOperation({ summary: 'Get all subscribed users with their subscription details (paginated)' })
  @Get('users')
  async getAllSubscribedUsers(@Query() query: {
    q?: string;
    page?: string;
    limit?: string;
    sort?: string;
    order?: string;
    status?: string;
  }) {
    const searchQuery = query.q || null;
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const sort = query.sort || 'created_at';
    const order = query.order || 'desc';
    const status = query.status || undefined;

    return await this.subscriptionService.getAllSubscribedUsers(
      searchQuery,
      page,
      limit,
      sort,
      order,
      status
    );
  }

  /**
   * Get subscription statistics
   */
  @ApiOperation({ summary: 'Get subscription statistics and analytics' })
  @Get('stats')
  async getSubscriptionStats() {
    return await this.subscriptionService.getSubscriptionStats();
  }

  /**
   * Get user subscriptions by user ID
   */
  @ApiOperation({ summary: 'Get all subscriptions for a specific user' })
  @Get('user/:user_id')
  async getUserSubscriptions(@Param('user_id') user_id: string) {
    return await this.subscriptionService.getUserSubscriptions(user_id);
  }

  /**
   * Cancel user subscription (admin action)
   */
  @ApiOperation({ summary: 'Cancel a user subscription (admin only)' })
  @Put('cancel/:subscription_id')
  async cancelUserSubscription(
    @Param('subscription_id') subscription_id: string,
    @Body() body: { reason?: string }
  ) {
    return await this.subscriptionService.cancelUserSubscription(subscription_id, body.reason);
  }
}
