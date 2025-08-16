import { Injectable } from '@nestjs/common';
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
          language_id: true,
          image: true,
          created_at: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        message: 'Category created successfully',
        data: category,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error creating category: ${error.message}`,
      };
    }
  }

  // Get all categories with optional search
  async findAll(searchQuery: string | null) {
    try {
      const whereClause = {};
      if (searchQuery) {
        whereClause['OR'] = [
          { name: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }

      const categories = await this.prisma.category.findMany({
        where: whereClause,
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

      return {
        success: true,
        message: categories.length ? 'Categories retrieved successfully' : 'No categories found',
        data: categories,
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
          language_id: true,
          image: true,
          created_at: true,
          updated_at: true,
        },
      });

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
