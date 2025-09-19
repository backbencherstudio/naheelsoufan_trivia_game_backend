import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UploadedFiles, UseInterceptors, Req, UseGuards, UploadedFile, Res } from '@nestjs/common';
import { QuestionService } from './question.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Role } from '../../../common/guard/role/role.enum';
import { UpdateQuestionDto } from './dto/update-question.dto';

@ApiTags('Questions')
@Controller('admin/questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) { }

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Import questions from file' })
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importQuestions(
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

      const result = await this.questionService.importQuestions(file);
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
  @ApiOperation({ summary: 'Export all questions' })
  @Get('export')
  async exportQuestions(@Res() res: any) {
    try {
      const result = await this.questionService.exportQuestions();

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=questions-export.json');

      return res.send(result.data);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Get all questions with their answers and files
  @ApiOperation({ summary: 'Get all questions with answers and files' })
  @Get()
  async findAll(@Query() query: {
    q?: string,
    category_id?: string,
    language_id?: string,
    difficulty_id?: string,
    question_type_id?: string,
    page?: number,
    limit?: number,
    sort?: string,
    order?: string
  }) {
    try {
      const page = query.page ? Number(query.page) : 1;
      const limit = query.limit ? Number(query.limit) : 10;
      const sort = query.sort ? query.sort : 'created_at';
      const order = query.order ? query.order : 'desc';
      const filter = {
        category_id: query.category_id,
        language_id: query.language_id,
        difficulty_id: query.difficulty_id,
        question_type_id: query.question_type_id,
      };
      const result = await this.questionService.findAll(query.q, page, limit, sort, order, filter);
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
    @Body() updateQuestionDto: UpdateQuestionDto,
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
