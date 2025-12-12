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
          same_category_selection: true,
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

  // find all categories by language id
  async findAllByLanguageId(languageId: string) {
    try {
      const whereClause: any = {};
      if (languageId) {
        whereClause['language_id'] = languageId;
      }

      const categories = await this.prisma.category.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          language: { select: { id: true, name: true } },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      return {
        success: true,
        message: 'Categories retrieved successfully',
        data: categories,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching categories: ${error.message}`,
      };
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
          same_category_selection: true,
          created_at: true,
          updated_at: true,
          language: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              questions: true,
            },
          },
        },
      });

      // Add image URLs and question count
      for (const category of categories) {
        if (category.image) {
          category['image_url'] = SojebStorage.url(appConfig().storageUrl.category + category.image);
        }
        category['questions_count'] = category['_count']?.questions || 0;
        delete category['_count'];
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
          same_category_selection: true,
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
          same_category_selection: true,
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

  // Import categories from uploaded file
  async importCategories(file: Express.Multer.File) {
    try {
      // Validate file type
      if (!file.mimetype.includes('json') && !file.originalname.endsWith('.json')) {
        throw new Error('Only JSON files are allowed for category import');
      }

      // Parse JSON content
      let categoriesData;
      try {
        const fileContent = file.buffer.toString('utf8');
        categoriesData = JSON.parse(fileContent);
      } catch (jsonError) {
        throw new Error('Invalid JSON file format');
      }

      // Validate JSON structure
      if (!Array.isArray(categoriesData)) {
        throw new Error('JSON file must contain an array of categories');
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Process categories in batches to avoid timeout
      const BATCH_SIZE = 5; // Process 5 categories in parallel
      const IMAGE_TIMEOUT = 30000; // 30 seconds timeout per image

      for (let batchStart = 0; batchStart < categoriesData.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, categoriesData.length);
        const batch = categoriesData.slice(batchStart, batchEnd);

        // Process batch in parallel
        const batchPromises = batch.map(async (categoryData, index) => {
          const categoryIndex = batchStart + index;

          try {
            // Validate required fields
            if (!categoryData.name || !categoryData.language) {
              throw new Error(`Missing required fields in category ${categoryIndex + 1}`);
            }

            // Handle language - find existing or create new
            let languageId;
            if (typeof categoryData.language === 'string') {
              // Language is provided as string (e.g., "English")
              const existingLanguage = await this.prisma.language.findFirst({
                where: { name: categoryData.language }
              });

              if (existingLanguage) {
                languageId = existingLanguage.id;
              } else {
                // Create new language with default code
                const newLanguage = await this.prisma.language.create({
                  data: {
                    name: categoryData.language,
                    code: categoryData.language.toLowerCase().substring(0, 2),
                  },
                });
                languageId = newLanguage.id;
              }
            } else if (typeof categoryData.language === 'object' && categoryData.language.id) {
              // Language is provided as object with id (backward compatibility)
              languageId = categoryData.language.id;
            } else {
              throw new Error(`Invalid language format in category ${categoryIndex + 1}`);
            }

            // Handle image - if image_url is provided, download and store it
            let fileName = null;
            if (categoryData.image_url && typeof categoryData.image_url === 'string') {
              try {
                // Firebase URLs should NOT be fully decoded - keep encoded slashes
                const imageUrl = categoryData.image_url.trim();

                console.log(`[Import] Downloading image for category "${categoryData.name}"`);

                // Download image with timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), IMAGE_TIMEOUT);

                let response;
                try {
                  response = await fetch(imageUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (compatible; Node.js)',
                      'Accept': 'image/*',
                    },
                    redirect: 'follow',
                    signal: controller.signal,
                  });
                } catch (fetchError) {
                  throw new Error(`Network error: ${fetchError.message}`);
                } finally {
                  clearTimeout(timeoutId);
                }

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // Check content type
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('image')) {
                  throw new Error(`Invalid content type: ${contentType}`);
                }

                const buffer = await response.arrayBuffer();
                const imageBuffer = Buffer.from(buffer);

                if (imageBuffer.length === 0) {
                  throw new Error('Downloaded image is empty');
                }

                console.log(`[Import] Downloaded: ${imageBuffer.length} bytes for "${categoryData.name}"`);

                // Generate filename: use category name + timestamp + random
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(2, 8);
                fileName = `${categoryData.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}-${randomStr}.jpg`;

                // Store image in SojebStorage
                await SojebStorage.put(appConfig().storageUrl.category + fileName, imageBuffer);
                console.log(`[Import] Stored: ${fileName}`);
              } catch (imageError) {
                // Log the error but continue with category creation without image
                console.warn(`[Import] Failed to download/store image for "${categoryData.name}": ${imageError.message}`);
              }
            } else if (categoryData.image && typeof categoryData.image === 'string') {
              // Use existing image if provided (backward compatibility)
              fileName = categoryData.image;
            }

            // Create category
            await this.prisma.category.create({
              data: {
                name: categoryData.name,
                language_id: languageId,
                image: fileName,
              },
            });

            return { success: true };
          } catch (categoryError) {
            return {
              success: false,
              error: `Category ${categoryIndex + 1}: ${categoryError.message}`,
              name: categoryData.name
            };
          }
        });

        // Wait for all categories in this batch to complete
        const batchResults = await Promise.allSettled(batchPromises);

        // Process batch results
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
          } else {
            errorCount++;
            if (result.status === 'fulfilled' && result.value.error) {
              errors.push(result.value.error);
            } else if (result.status === 'rejected') {
              errors.push(`Batch error: ${result.reason.message}`);
            }
          }
        }

        // Log progress
        console.log(`[Import] Batch complete: ${batchStart + BATCH_SIZE}/${categoriesData.length} categories processed`);
      }

      return {
        success: true,
        message: `Import completed: ${successCount} categories imported successfully, ${errorCount} failed`,
        data: {
          total_processed: categoriesData.length,
          successful: successCount,
          failed: errorCount,
          errors: errors,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error importing categories: ${error.message}`,
      };
    }
  }

  // Export all categories
  async exportCategories() {
    try {
      const categories = await this.prisma.category.findMany({
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
              code: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      // Add image URLs if available
      for (const category of categories) {
        if (category.image) {
          category['image_url'] = SojebStorage.url(appConfig().storageUrl.category + category.image);
        }
      }

      // Format data for export
      const exportData = categories.map(category => ({
        name: category.name,
        image_url: category['image_url'],
        language: category.language.name
      }));

      return {
        success: true,
        message: `${categories.length} categories exported successfully`,
        data: exportData,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error exporting categories: ${error.message}`,
      };
    }
  }
}
