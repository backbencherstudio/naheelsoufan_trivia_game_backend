import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateQuestionTypeDto } from './dto/create-question-type.dto';
import { UpdateQuestionTypeDto } from './dto/update-question-type.dto';

@Injectable()
export class QuestionTypeService {
  constructor(private readonly prisma: PrismaService) { }

  // Create a new question type
  async create(createQuestionTypeDto: CreateQuestionTypeDto) {
    try {
      const questionType = await this.prisma.questionType.create({
        data: createQuestionTypeDto,
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
        message: 'Question type created successfully',
        data: questionType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error creating question type: ${error.message}`,
      };
    }
  }

  // Get all question types with pagination and search
  async findAll(searchQuery: string | null, page: number, limit: number, sort: string, order: string) {
    try {
      const skip = (page - 1) * limit;

      // Construct the search filter based on query
      const whereClause = {};
      if (searchQuery) {
        whereClause['name'] = { contains: searchQuery, mode: 'insensitive' };
      }

      // Count total records for pagination
      const total = await this.prisma.questionType.count({ where: whereClause });

      // Query the question types with pagination, sorting, and filtering
      const questionTypes = await this.prisma.questionType.findMany({
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
        message: questionTypes.length
          ? 'Question types retrieved successfully'
          : 'No question types found',
        data: questionTypes,
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
        message: `Error fetching question types: ${error.message}`,
      };
    }
  }

  // Get a single question type by ID
  async findOne(id: string) {
    try {
      const questionType = await this.prisma.questionType.findUnique({
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
        message: questionType ? 'Question type retrieved successfully' : 'Question type not found',
        data: questionType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching question type: ${error.message}`,
      };
    }
  }

  // Update an existing question type
  async update(id: string, updateQuestionTypeDto: UpdateQuestionTypeDto) {
    try {
      const updatedQuestionType = await this.prisma.questionType.update({
        where: { id },
        data: updateQuestionTypeDto,
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
        message: 'Question type updated successfully',
        data: updatedQuestionType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error updating question type: ${error.message}`,
      };
    }
  }

  // Delete a question type by ID
  async remove(id: string) {
    try {
      const deletedQuestionType = await this.prisma.questionType.delete({
        where: { id },
        select: {
          id: true,
          name: true,
          language_id: true,
        },
      });

      return {
        success: true,
        message: 'Question type deleted successfully',
        data: deletedQuestionType,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error deleting question type: ${error.message}`,
      };
    }
  }
}
