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
import { QuestionTypeService } from './question-type.service';
import { CreateQuestionTypeDto } from './dto/create-question-type.dto';
import { UpdateQuestionTypeDto } from './dto/update-question-type.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Role } from '../../../common/guard/role/role.enum';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Question Types')
@Controller('admin/question-types')
export class QuestionTypeController {
  constructor(private readonly questionTypeService: QuestionTypeService) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)  // Restrict to admin roles
  @ApiOperation({ summary: 'Create a new question type' })
  @Post()
  async createQuestionType(
    @Body() createQuestionTypeDto: CreateQuestionTypeDto,
  ) {
    try {
      const questionType = await this.questionTypeService.create(createQuestionTypeDto);
      return questionType;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Read all question types' })
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

      const questionTypes = await this.questionTypeService.findAll(searchQuery, page, limit, sort, order);
      return questionTypes;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Read one question type' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const questionType = await this.questionTypeService.findOne(id);
      return questionType;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)  // Restrict to admin roles
  @ApiOperation({ summary: 'Update an existing question type' })
  @Patch(':id')
  async updateQuestionType(
    @Param('id') id: string,
    @Body() updateQuestionTypeDto: UpdateQuestionTypeDto,
  ) {
    try {
      const questionType = await this.questionTypeService.update(id, updateQuestionTypeDto);
      return questionType;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)  // Restrict to admin roles
  @ApiOperation({ summary: 'Delete a question type' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const questionType = await this.questionTypeService.remove(id);
      return questionType;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
