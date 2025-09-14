import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Role } from '../../../common/guard/role/role.enum';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @ApiOperation({ summary: 'Get dashboard overview statistics' })
  @Get('stats')
  async getDashboardStats() {
    return await this.dashboardService.getDashboardStats();
  }

  @ApiOperation({ summary: 'Get statistics broken down by language' })
  @Get('stats-by-language')
  async getStatsByLanguage() {
    return await this.dashboardService.getStatsByLanguage();
  }

  @ApiOperation({ summary: 'Get recent activity (users, games, subscriptions)' })
  @Get('recent-activity')
  async getRecentActivity(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit) : 10;
    return await this.dashboardService.getRecentActivity(limitNumber);
  }

  @ApiOperation({ summary: 'Get subscription analytics and revenue data' })
  @Get('subscription-analytics')
  async getSubscriptionAnalytics() {
    return await this.dashboardService.getSubscriptionAnalytics();
  }
}