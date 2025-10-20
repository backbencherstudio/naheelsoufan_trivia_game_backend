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
import { DifficultyService } from './difficulty.service';
import { CreateDifficultyDto } from './dto/create-difficulty.dto';
import { UpdateDifficultyDto } from './dto/update-difficulty.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Role } from '../../../common/guard/role/role.enum';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Difficulty')
@Controller('admin/difficulties')
export class DifficultyController {
  constructor(private readonly difficultyService: DifficultyService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.USER) // Restrict to admin roles
  @ApiOperation({ summary: 'Create a new difficulty level' })
  @Post()
  async createDifficulty(@Body() createDifficultyDto: CreateDifficultyDto) {
    try {
      const difficulty =
        await this.difficultyService.create(createDifficultyDto);
      return difficulty;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Read all difficulty levels with optional search, sorting, and language filter',
  })
  @Get()
  async findAll(
    @Query()
    query: {
      q?: string;
      page?: string;
      limit?: string;
      sort?: string;
      order?: string;
      language_id?: string;
    },
  ) {
    try {
      const searchQuery = query.q || null; // Optional search query
      const page = parseInt(query.page) || 1; // Default to page 1
      const limit = parseInt(query.limit) || 10; // Default to 10 items per page
      const sort = query.sort || 'created_at'; // Default sort by created_at
      const order = query.order || 'desc'; // Default order descending
      const languageId = query.language_id; // Optional language filter

      const difficulties = await this.difficultyService.findAll(
        searchQuery,
        page,
        limit,
        sort,
        order,
        languageId,
      );
      return difficulties;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Read all difficulty levels',
  })
  @Get('/all')
  getAllDifficulties() {
    return this.difficultyService.findAllDifficulties();
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Read one difficulty level by ID' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const difficulty = await this.difficultyService.findOne(id);
      return difficulty;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) // Restrict to admin roles
  @ApiOperation({ summary: 'Update an existing difficulty level' })
  @Patch(':id')
  async updateDifficulty(
    @Param('id') id: string,
    @Body() updateDifficultyDto: UpdateDifficultyDto,
  ) {
    try {
      const difficulty = await this.difficultyService.update(
        id,
        updateDifficultyDto,
      );
      return difficulty;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) // Restrict to admin roles
  @ApiOperation({ summary: 'Delete a difficulty level by ID' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const difficulty = await this.difficultyService.remove(id);
      return difficulty;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
