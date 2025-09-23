import { Injectable } from '@nestjs/common';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { StringHelper } from 'src/common/helper/string.helper';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class LanguageService {
  constructor(private readonly prisma: PrismaService) { }

  // Create a new language
  async create(createLanguageDto: CreateLanguageDto, file: Express.Multer.File) {
    try {
      let fileName = null;

      // If a file is uploaded (e.g., an image), handle it
      if (file) {
        fileName = StringHelper.generateRandomFileName(file.originalname);
        await SojebStorage.put(appConfig().storageUrl.language + fileName, file.buffer);
        createLanguageDto['file_url'] = fileName; // Attach the file_url to the DTO
      }

      const language = await this.prisma.language.create({
        data: {
          ...createLanguageDto,
        },
        select: {
          id: true,
          name: true,
          code: true,
          file_url: true,
          created_at: true,
        },
      });

      // add file url
      if (language && language.file_url) {
        language['file_url'] = SojebStorage.url(appConfig().storageUrl.language + language.file_url);
      }

      return {
        success: true,
        message: 'Language created successfully',
        data: language,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error creating language: ${error.message}`,
      };
    }
  }

  // Get all languages with pagination and search
  async findAll(searchQuery: string | null, page: number, limit: number, sort: string, order: string) {
    try {
      const skip = (page - 1) * limit;

      // Construct the search filter based on query
      const whereClause = {};
      if (searchQuery) {
        whereClause['OR'] = [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { code: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }

      // Count total records for pagination
      const total = await this.prisma.language.count({ where: whereClause });

      // Query the languages with pagination, sorting, and filtering
      const languages = await this.prisma.language.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: {
          [sort]: order,  // Dynamically sort by the field and order provided
        },
        select: {
          id: true,
          name: true,
          code: true,
          file_url: true,
          created_at: true,
          updated_at: true,
        },
      });

      // Add file URLs if the file_url is available
      for (const language of languages) {
        if (language.file_url) {
          language['file_url'] = SojebStorage.url(appConfig().storageUrl.language + language.file_url);
        }
      }

      // Pagination metadata calculation
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        success: true,
        message: languages.length ? 'Languages retrieved successfully' : 'No languages found',
        data: languages,
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
        message: `Error fetching languages: ${error.message}`,
      };
    }
  }

  // Get a single language by ID
  async findOne(id: string) {
    try {
      const language = await this.prisma.language.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          code: true,
          file_url: true,
          created_at: true,
        },
      });

      if (language && language.file_url) {
        language['file_url'] = SojebStorage.url(appConfig().storageUrl.language + language.file_url);
      }

      return {
        success: true,
        message: language ? 'Language retrieved successfully' : 'Language not found',
        data: language,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching language: ${error.message}`,
      };
    }
  }

  // Update an existing language
  async update(id: string, updateLanguageDto: UpdateLanguageDto, file: Express.Multer.File) {
    try {
      let fileName = updateLanguageDto.file_url;

      // If a new file is uploaded, handle it
      if (file) {
        // If there is an old image, delete it
        if (fileName) {
          await SojebStorage.delete(appConfig().storageUrl.language + fileName);
        }

        fileName = StringHelper.generateRandomFileName(file.originalname);
        await SojebStorage.put(appConfig().storageUrl.language + fileName, file.buffer);
      }

      const updatedLanguage = await this.prisma.language.update({
        where: { id },
        data: {
          ...updateLanguageDto,
          file_url: fileName, // Include the updated file_url if changed
        },
        select: {
          id: true,
          name: true,
          code: true,
          file_url: true,
          created_at: true,
        },
      });

      return {
        success: true,
        message: 'Language updated successfully',
        data: updatedLanguage,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error updating language: ${error.message}`,
      };
    }
  }

  // Delete a language by ID
  async remove(id: string) {
    try {
      const language = await this.prisma.language.findUnique({
        where: { id },
        select: {
          id: true,
          file_url: true,
        },
      });

      // If there is a file, delete it from storage
      if (language && language.file_url) {
        await SojebStorage.delete(appConfig().storageUrl.language + language.file_url);
      }

      // Now delete the language record
      await this.prisma.language.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Language deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error deleting language: ${error.message}`,
      };
    }
  }
}
