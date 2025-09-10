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
import { LanguageService } from './language.service';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Role } from '../../../common/guard/role/role.enum';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Language')
@Controller('admin/languages')
export class LanguageController {
  constructor(private readonly languageService: LanguageService) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)  // Restrict to admin roles
  @ApiOperation({ summary: 'Create a new language' })
  @Post()
  @UseInterceptors(FileInterceptor('file'))  // Handle file upload for language image
  async create(
    @Body() createLanguageDto: CreateLanguageDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    try {
      const language = await this.languageService.create(createLanguageDto, file);
      return language;  // Return the created language data
    } catch (error) {
      return {
        success: false,
        message: error.message,  // Return error message if creation fails
      };
    }
  }

  @ApiOperation({ summary: 'Read all languages' })
  @Get()
  async findAll(@Query() query: {
    q?: string;
    page?: string;
    limit?: string;
    sort?: string;
    order?: string;
  }) {
    try {
      const searchQuery = query.q || null;  // Optional search query
      const page = parseInt(query.page) || 1;  // Default to page 1
      const limit = parseInt(query.limit) || 10;  // Default to 10 items per page
      const sort = query.sort || 'created_at';  // Default sort by created_at
      const order = query.order || 'desc';  // Default order descending

      const languages = await this.languageService.findAll(searchQuery, page, limit, sort, order);  // Fetch languages with pagination
      return languages;
    } catch (error) {
      return {
        success: false,
        message: error.message,  // Return error message if fetching fails
      };
    }
  }

  @ApiOperation({ summary: 'Read one language' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const language = await this.languageService.findOne(id);  // Fetch a language by ID
      return language;
    } catch (error) {
      return {
        success: false,
        message: error.message,  // Return error message if fetching fails
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)  // Restrict to admin roles
  @ApiOperation({ summary: 'Update a language' })
  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))  // Handle file upload for image
  async update(
    @Param('id') id: string,
    @Body() updateLanguageDto: UpdateLanguageDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      const language = await this.languageService.update(id, updateLanguageDto, file);
      return language;  // Return updated language data
    } catch (error) {
      return {
        success: false,
        message: error.message,  // Return error message if updating fails
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)  // Restrict to admin roles
  @ApiOperation({ summary: 'Delete a language' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const language = await this.languageService.remove(id);  // Delete language by ID
      return language;
    } catch (error) {
      return {
        success: false,
        message: error.message,  // Return error message if deletion fails
      };
    }
  }
}
