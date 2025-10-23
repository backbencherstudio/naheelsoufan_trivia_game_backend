import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UploadedFile,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Role } from '../../../common/guard/role/role.enum';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Category')
@Controller('admin/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new category' })
  @Post()
  @UseInterceptors(FileInterceptor('file')) // Handle file upload for category image
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return await this.categoryService.create(createCategoryDto, file);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Read all categories with optional search and language filter',
  })
  @Get()
  async findAll(
    @Query()
    query: {
      q?: string;
      page?: number;
      limit?: number;
      language_id?: string;
    },
  ) {
    try {
      const searchQuery = query.q; // Optional search query
      const page = query.page ? Number(query.page) : 1;
      const limit = query.limit ? Number(query.limit) : 10;
      const languageId = query.language_id; // Optional language filter
      const categories = await this.categoryService.findAll(
        searchQuery,
        page,
        limit,
        languageId,
      ); // Fetch all categories
      return categories;
    } catch (error) {
      return {
        success: false,
        message: error.message, // Return error message if fetching fails
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Read all categories by language id' })
  @Get('topics')
  async findAllTopics(@Query() query: { language_id?: string }) {
    const languageId = query.language_id;
    return await this.categoryService.findAllByLanguageId(languageId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Import categories from file' })
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importCategories(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    try {
      if (!file) {
        return {
          success: false,
          message: 'No file uploaded',
        };
      }

      const result = await this.categoryService.importCategories(file);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Export all categories' })
  @Get('export')
  async exportCategories() {
    try {
      const result = await this.categoryService.exportCategories();
      return result.data;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Read one category' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const category = await this.categoryService.findOne(id); // Fetch a category by ID
      return category;
    } catch (error) {
      return {
        success: false,
        message: error.message, // Return error message if fetching fails
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) // Restrict to admin roles
  @ApiOperation({ summary: 'Update a category' })
  @Patch(':id')
  @UseInterceptors(FileInterceptor('file')) // Handle file upload for image
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      const category = await this.categoryService.update(
        id,
        updateCategoryDto,
        file,
      );
      return category; // Return updated category data
    } catch (error) {
      return {
        success: false,
        message: error.message, // Return error message if updating fails
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) // Restrict to admin roles
  @ApiOperation({ summary: 'Delete a category' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const category = await this.categoryService.remove(id); // Delete category by ID
      return category;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
