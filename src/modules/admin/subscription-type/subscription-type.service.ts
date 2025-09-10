import { Injectable } from '@nestjs/common';
import { CreateSubscriptionTypeDto } from './dto/create-subscription-type.dto';
import { UpdateSubscriptionTypeDto } from './dto/update-subscription-type.dto';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SubscriptionTypeService {
  constructor(private readonly prisma: PrismaService) { }

  // Create a new subscription type
  async create(createSubscriptionTypeDto: CreateSubscriptionTypeDto) {
    try {
      const subscriptionType = await this.prisma.subscriptionType.create({
        data: {
          ...createSubscriptionTypeDto,
          status: createSubscriptionTypeDto.status || 'active', // Default status
        },
        select: {
          id: true,
          type: true,
          games: true,
          questions: true,
          players: true,
          price: true,
          status: true,
          language_id: true,
          created_at: true,
          updated_at: true,
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Subscription type created successfully',
        data: subscriptionType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error creating subscription type: ${error.message}`,
      };
    }
  }

  // Get all subscription types with pagination and search
  async findAll(searchQuery: string | null, page: number, limit: number, sort: string, order: string) {
    try {
      const skip = (page - 1) * limit;

      // Construct the search filter based on query
      const whereClause = {};
      if (searchQuery) {
        whereClause['OR'] = [
          { type: { contains: searchQuery, mode: 'insensitive' } },
          { status: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }

      // Count total records for pagination
      const total = await this.prisma.subscriptionType.count({ where: whereClause });

      // Query the subscription types with pagination, sorting, and filtering
      const subscriptionTypes = await this.prisma.subscriptionType.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: {
          [sort]: order, // Dynamically sort by the field and order provided
        },
        select: {
          id: true,
          type: true,
          games: true,
          questions: true,
          players: true,
          price: true,
          status: true,
          created_at: true,
          language: {
            select: {
              id: true,
              name: true,
              code: true,
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
        message: subscriptionTypes.length ? 'Subscription types retrieved successfully' : 'No subscription types found',
        data: subscriptionTypes,
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
        message: `Error fetching subscription types: ${error.message}`,
      };
    }
  }

  // Get a single subscription type by ID
  async findOne(id: string) {
    try {
      const subscriptionType = await this.prisma.subscriptionType.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          games: true,
          questions: true,
          players: true,
          price: true,
          status: true,
          created_at: true,
          updated_at: true,
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      return {
        success: true,
        message: subscriptionType ? 'Subscription type retrieved successfully' : 'Subscription type not found',
        data: subscriptionType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching subscription type: ${error.message}`,
      };
    }
  }

  // Update an existing subscription type
  async update(id: string, updateSubscriptionTypeDto: UpdateSubscriptionTypeDto) {
    try {
      const updatedSubscriptionType = await this.prisma.subscriptionType.update({
        where: { id },
        data: {
          ...updateSubscriptionTypeDto,
        },
        select: {
          id: true,
          type: true,
          games: true,
          questions: true,
          players: true,
          price: true,
          status: true,
          language_id: true,
          created_at: true,
          updated_at: true,
          language: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Subscription type updated successfully',
        data: updatedSubscriptionType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error updating subscription type: ${error.message}`,
      };
    }
  }

  // Delete a subscription type by ID
  async remove(id: string) {
    try {
      const subscriptionType = await this.prisma.subscriptionType.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
        },
      });

      if (!subscriptionType) {
        return {
          success: false,
          message: 'Subscription type not found',
        };
      }

      // Delete the subscription type record
      await this.prisma.subscriptionType.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Subscription type deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error deleting subscription type: ${error.message}`,
      };
    }
  }

  // Get subscription type statistics
  async getSubscriptionTypeStats() {
    try {
      const totalSubscriptionTypes = await this.prisma.subscriptionType.count();
      const activeSubscriptionTypes = await this.prisma.subscriptionType.count({
        where: { status: 'active' },
      });
      const expiredSubscriptionTypes = await this.prisma.subscriptionType.count({
        where: { status: 'expired' },
      });

      // Get subscription types by language
      const subscriptionTypesByLanguage = await this.prisma.subscriptionType.groupBy({
        by: ['language_id'],
        _count: {
          id: true,
        },
      });

      // Get language names for the grouped results
      const subscriptionTypesWithLanguageNames = await Promise.all(
        subscriptionTypesByLanguage.map(async (item) => {
          const language = await this.prisma.language.findUnique({
            where: { id: item.language_id },
            select: { name: true, code: true },
          });
          return {
            language_id: item.language_id,
            language_name: language?.name || 'Unknown',
            language_code: language?.code || 'unknown',
            count: item._count.id,
          };
        })
      );

      return {
        success: true,
        message: 'Subscription type statistics retrieved successfully',
        data: {
          total: totalSubscriptionTypes,
          active: activeSubscriptionTypes,
          expired: expiredSubscriptionTypes,
          by_language: subscriptionTypesWithLanguageNames,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching subscription type statistics: ${error.message}`,
      };
    }
  }
}