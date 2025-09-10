import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDifficultyDto } from './dto/create-difficulty.dto';
import { UpdateDifficultyDto } from './dto/update-difficulty.dto';

@Injectable()
export class DifficultyService {
  constructor(private readonly prisma: PrismaService) { }

  // Create a new difficulty level
  async create(createDifficultyDto: CreateDifficultyDto) {
    try {
      const difficulty = await this.prisma.difficulty.create({
        data: createDifficultyDto,
        select: {
          id: true,
          name: true,
          created_at: true,
          language: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Difficulty level created successfully',
        data: difficulty,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error creating difficulty level: ${error.message}`,
      };
    }
  }

  // Get all difficulty levels with pagination and search
  async findAll(searchQuery: string | null, page: number, limit: number, sort: string, order: string) {
    try {
      const skip = (page - 1) * limit;

      // Construct the search filter based on query
      const whereClause = {};
      if (searchQuery) {
        whereClause['name'] = { contains: searchQuery, mode: 'insensitive' };
      }

      // Count total records for pagination
      const total = await this.prisma.difficulty.count({ where: whereClause });

      // Query the difficulties with pagination, sorting, and filtering
      const difficulties = await this.prisma.difficulty.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: {
          [sort]: order,  // Dynamically sort by the field and order provided
        },
        select: {
          id: true,
          name: true,
          created_at: true,
          updated_at: true,
          language: {
            select: {
              id: true,
              name: true,
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
        message: difficulties.length ? 'Difficulties retrieved successfully' : 'No difficulties found',
        data: difficulties,
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
        message: `Error fetching difficulties: ${error.message}`,
      };
    }
  }

  // Get a single difficulty level by ID
  async findOne(id: string) {
    try {
      const difficulty = await this.prisma.difficulty.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          created_at: true,
          updated_at: true,
          language: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return {
        success: true,
        message: difficulty ? 'Difficulty retrieved successfully' : 'Difficulty not found',
        data: difficulty,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching difficulty: ${error.message}`,
      };
    }
  }

  // Update an existing difficulty level
  async update(id: string, updateDifficultyDto: UpdateDifficultyDto) {
    try {
      const updatedDifficulty = await this.prisma.difficulty.update({
        where: { id },
        data: updateDifficultyDto,
        select: {
          id: true,
          name: true,
          language_id: true,
          created_at: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        message: 'Difficulty level updated successfully',
        data: updatedDifficulty,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error updating difficulty level: ${error.message}`,
      };
    }
  }

  // Delete a difficulty level by ID
  async remove(id: string) {
    try {
      const deletedDifficulty = await this.prisma.difficulty.delete({
        where: { id },
        select: {
          id: true,
          name: true,
          language_id: true,
        },
      });

      return {
        success: true,
        message: 'Difficulty level deleted successfully',
        data: deletedDifficulty,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error deleting difficulty level: ${error.message}`,
      };
    }
  }
}
