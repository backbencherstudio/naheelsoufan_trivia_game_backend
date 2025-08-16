import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UploadedFiles, UseInterceptors, Req, UseGuards } from '@nestjs/common';
import { QuestionService } from './question.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Role } from '../../../common/guard/role/role.enum';

@ApiTags('Questions')
@Controller('questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  // Create a new question with answers and handle files
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN) // Restrict to admin roles
  @ApiOperation({ summary: 'Create a new question with answers and handle files' })
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'questionFile', maxCount: 1 },
      { name: 'answerFiles', maxCount: 10 }, // Assuming up to 10 answers
    ])
  )
  async create(
    @Body() createQuestionDto: CreateQuestionDto,
    @UploadedFiles() files: { questionFile?: Express.Multer.File[]; answerFiles?: Express.Multer.File[] },
    @Req() req: any
  ) {
    const questionFile = files.questionFile ? files.questionFile[0] : null;
    const answerFiles = files.answerFiles || [];

    try {
      const result = await this.questionService.create(createQuestionDto, questionFile, answerFiles);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Get all questions with their answers and files
  @ApiOperation({ summary: 'Get all questions with answers and files' })
  @Get()
  async findAll(@Query() query: { q?: string }) {
    try {
      const result = await this.questionService.findAll(query.q);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Get a single question by ID with answers and files
  @ApiOperation({ summary: 'Get a single question by ID with answers and files' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const result = await this.questionService.findOne(id);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Update an existing question and its answers
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)  // Restrict to admin roles
  @ApiOperation({ summary: 'Update a question and its answers' })
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'questionFile', maxCount: 1 },
      { name: 'answerFiles', maxCount: 10 },
    ])
  )
  async update(
    @Param('id') id: string,
    @Body() updateQuestionDto: CreateQuestionDto,
    @UploadedFiles() files: { questionFile?: Express.Multer.File[]; answerFiles?: Express.Multer.File[] }
  ) {
    const questionFile = files.questionFile ? files.questionFile[0] : null;
    const answerFiles = files.answerFiles || [];

    try {
      const result = await this.questionService.update(id, updateQuestionDto, questionFile, answerFiles);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Delete a question by ID and its associated answers
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)  // Restrict to admin roles
  @ApiOperation({ summary: 'Delete a question by ID and its associated answers' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const result = await this.questionService.remove(id);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
