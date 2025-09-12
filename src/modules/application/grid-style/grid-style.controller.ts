import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { QuestionsDto } from './dto/questions.dto';
import { GridStyleService } from './grid-style.service';

@Controller('grid-style')
export class GridStyleController {
    constructor(private readonly service: GridStyleService) { }

    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get questions.' })
    @Get('get-questions/:gameId')
    async getQuestion(@Param('gameId') gameId: string,
        @Query() questionsDto: QuestionsDto,) {
        return this.service.getQuestion(gameId, questionsDto.categories)
    }
}
