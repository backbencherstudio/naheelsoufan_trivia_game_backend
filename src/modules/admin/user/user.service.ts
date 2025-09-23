import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) { }

  async create(createUserDto: CreateUserDto) {
    try {
      const user = await UserRepository.createUser(createUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
          data: user.data,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Get all users with pagination, search, and role filtering
  async findAll(
    searchQuery: string | null,
    page: number,
    limit: number,
    sort: string,
    order: string,
    filters: {
      type?: string;
      approved?: string;
      role?: string; // host or player
    }
  ) {
    try {
      const skip = (page - 1) * limit;
      const whereClause = {};

      // Basic filters
      if (filters.type) {
        whereClause['type'] = filters.type;
      }

      if (filters.approved) {
        whereClause['approved_at'] =
          filters.approved === 'approved' ? { not: null } : { equals: null };
      }

      // Role-based filtering (host or player)
      if (filters.role) {
        if (filters.role.toLowerCase() === 'host') {
          // Users who have created rooms (hosts)
          whereClause['rooms'] = {
            some: {} // Has at least one room
          };
        } else if (filters.role.toLowerCase() === 'player') {
          // Users who have joined games as players
          whereClause['game_players'] = {
            some: {} // Has at least one game player record
          };
        }
      }

      // Search functionality
      if (searchQuery) {
        const searchConditions = [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { email: { contains: searchQuery, mode: 'insensitive' } },
        ];

        if (Object.keys(whereClause).length > 0) {
          // Combine existing filters with search using AND
          whereClause['AND'] = [
            { ...whereClause },
            { OR: searchConditions }
          ];

          // Clear the direct conditions since they're now in AND
          if (filters.type) delete whereClause['type'];
          if (filters.approved) delete whereClause['approved_at'];
          if (filters.role && filters.role.toLowerCase() === 'host') delete whereClause['rooms'];
          if (filters.role && filters.role.toLowerCase() === 'player') delete whereClause['game_players'];
        } else {
          whereClause['OR'] = searchConditions;
        }
      }

      // Count total records for pagination
      const total = await this.prisma.user.count({ where: whereClause });

      // Query users with pagination, sorting, and filtering
      const users = await this.prisma.user.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone_number: true,
          address: true,
          type: true,
          approved_at: true,
          created_at: true,
          updated_at: true,
          // Include counts for role identification
          _count: {
            select: {
              rooms: true, // Number of rooms created (host activity)
              game_players: true, // Number of games played (player activity)
            }
          }
        },
      });

      // Pagination metadata calculation
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        success: true,
        message: users.length ? 'Users retrieved successfully' : 'No users found',
        data: users,
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
        message: `Error fetching users: ${error.message}`,
      };
    }
  }

  async findOne(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
          phone_number: true,
          approved_at: true,
          created_at: true,
          updated_at: true,
          avatar: true,
          billing_id: true,
        },
      });

      // add avatar url to user
      if (user.avatar) {
        user['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + user.avatar,
        );
      }

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async approve(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      await this.prisma.user.update({
        where: { id: id },
        data: { approved_at: DateHelper.now() },
      });
      return {
        success: true,
        message: 'User approved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async reject(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      await this.prisma.user.update({
        where: { id: id },
        data: { approved_at: null },
      });
      return {
        success: true,
        message: 'User rejected successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const user = await UserRepository.updateUser(id, updateUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
          data: user.data,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string) {
    try {
      const user = await UserRepository.deleteUser(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
