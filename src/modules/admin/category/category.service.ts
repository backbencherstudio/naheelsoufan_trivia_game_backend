import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { StringHelper } from 'src/common/helper/string.helper';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) { }

  // Create a new category
  async create(createCategoryDto: CreateCategoryDto, file: Express.Multer.File) {
    try {
      let fileName = null;

      // If a file (image) is uploaded, handle it
      if (file) {
        fileName = StringHelper.generateRandomFileName(file.originalname);
        await SojebStorage.put(appConfig().storageUrl.category + fileName, file.buffer);
        createCategoryDto['image'] = fileName;  // Attach image to DTO
      }

      const category = await this.prisma.category.create({
        data: {
          ...createCategoryDto,
        },
        select: {
          id: true,
          name: true,
          image: true,
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
        message: 'Category created successfully',
        data: category,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error fetching questions: ${error.message}`
      );
    }
  }

  // Get all categories with optional search and language filter
  async findAll(searchQuery: string | null, page: number, limit: number, languageId?: string) {
    try {
      const whereClause: any = {};

      // Search filter
      if (searchQuery) {
        whereClause['OR'] = [
          { name: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }

      // Language filter
      if (languageId) {
        whereClause['language_id'] = languageId;
      }

      const total = await this.prisma.category.count({
        where: whereClause,
      });

      const categories = await this.prisma.category.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
        select: {
          id: true,
          name: true,
          image: true,
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

      // Add image URLs if the image is available
      for (const category of categories) {
        if (category.image) {
          category['image_url'] = SojebStorage.url(appConfig().storageUrl.category + category.image);
        }
      }

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        success: true,
        message: categories.length ? 'Categories retrieved successfully' : 'No categories found',
        data: categories,
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
        message: `Error fetching categories: ${error.message}`,
      };
    }
  }

  // Get a single category by ID
  async findOne(id: string) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          image: true,
          created_at: true,
          updated_at: true,
          language: {
            select: {
              id: true,
              name: true,
            },
          },
          questions: {
            select: {
              id: true,
              text: true,
              time: true,
              points: true,
              answers: {
                select: {
                  id: true,
                  text: true,
                },
              },
            },
          },
        },
      });

      if (category && category.image) {
        category['image_url'] = SojebStorage.url(appConfig().storageUrl.category + category.image);
      }

      return {
        success: true,
        message: category ? 'Category retrieved successfully' : 'Category not found',
        data: category,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching category: ${error.message}`,
      };
    }
  }

  // Update an existing category
  async update(id: string, updateCategoryDto: UpdateCategoryDto, file: Express.Multer.File) {
    try {
      let fileName = updateCategoryDto.image;

      // If a new file is uploaded, handle it
      if (file) {
        // If there's an existing image, delete it
        if (fileName) {
          await SojebStorage.delete(appConfig().storageUrl.category + fileName);
        }

        fileName = StringHelper.generateRandomFileName(file.originalname);
        await SojebStorage.put(appConfig().storageUrl.category + fileName, file.buffer);
      }

      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: {
          ...updateCategoryDto,
          image: fileName, // Update image if provided
        },
        select: {
          id: true,
          name: true,
          image: true,
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

      if (updatedCategory && updatedCategory.image) {
        updatedCategory['image_url'] = SojebStorage.url(appConfig().storageUrl.category + updatedCategory.image);
      }

      return {
        success: true,
        message: 'Category updated successfully',
        data: updatedCategory,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error updating category: ${error.message}`,
      };
    }
  }

  // Delete a category by ID
  async remove(id: string) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
        select: {
          id: true,
          image: true,
        },
      });

      // If there is an image, delete it from storage
      if (category && category.image) {
        await SojebStorage.delete(appConfig().storageUrl.category + category.image);
      }

      // Now delete the category record
      await this.prisma.category.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Category deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error deleting category: ${error.message}`,
      };
    }
  }
}
