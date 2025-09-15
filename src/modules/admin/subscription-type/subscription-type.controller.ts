import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SubscriptionTypeService } from './subscription-type.service';
import { CreateSubscriptionTypeDto } from './dto/create-subscription-type.dto';
import { UpdateSubscriptionTypeDto } from './dto/update-subscription-type.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Role } from '../../../common/guard/role/role.enum';

@ApiTags('Subscription Types')
@Controller('admin/subscription-types')
export class SubscriptionTypeController {
  constructor(private readonly subscriptionTypeService: SubscriptionTypeService) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) // Restrict to admin roles
  @ApiOperation({ summary: 'Create a new subscription type' })
  @Post()
  async create(
    @Body() createSubscriptionTypeDto: CreateSubscriptionTypeDto,
    @Req() req: any,
  ) {
    try {
      const subscriptionType = await this.subscriptionTypeService.create(createSubscriptionTypeDto);
      return subscriptionType; // Return the created subscription type data
    } catch (error) {
      return {
        success: false,
        message: error.message, // Return error message if creation fails
      };
    }
  }

  @ApiOperation({ summary: 'Read all subscription types' })
  @Get()
  async findAll(@Query() query: {
    q?: string;
    page?: string;
    limit?: string;
    sort?: string;
    order?: string;
    language_id?: string;
  }) {
    try {
      const searchQuery = query.q || null; // Optional search query
      const page = parseInt(query.page) || 1; // Default to page 1
      const limit = parseInt(query.limit) || 10; // Default to 10 items per page
      const sort = query.sort || 'created_at'; // Default sort by created_at
      const order = query.order || 'desc'; // Default order descending
      const languageId = query.language_id; // Optional language filter
      
      const subscriptionTypes = await this.subscriptionTypeService.findAll(searchQuery, page, limit, sort, order, languageId); // Fetch subscription types with pagination
      return subscriptionTypes;
    } catch (error) {
      return {
        success: false,
        message: error.message, // Return error message if fetching fails
      };
    }
  }

  @ApiOperation({ summary: 'Read one subscription type' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const subscriptionType = await this.subscriptionTypeService.findOne(id); // Fetch a subscription type by ID
      return subscriptionType;
    } catch (error) {
      return {
        success: false,
        message: error.message, // Return error message if fetching fails
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) // Restrict to admin roles
  @ApiOperation({ summary: 'Update a subscription type' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSubscriptionTypeDto: UpdateSubscriptionTypeDto,
  ) {
    try {
      const subscriptionType = await this.subscriptionTypeService.update(id, updateSubscriptionTypeDto);
      return subscriptionType; // Return updated subscription type data
    } catch (error) {
      return {
        success: false,
        message: error.message, // Return error message if updating fails
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) // Restrict to admin roles
  @ApiOperation({ summary: 'Delete a subscription type' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const result = await this.subscriptionTypeService.remove(id); // Delete subscription type by ID
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message, // Return error message if deletion fails
      };
    }
  }
}