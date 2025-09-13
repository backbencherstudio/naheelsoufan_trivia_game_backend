import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { DifficultyDto } from './dto/difficulty.dto';
import { GridStyleService } from './grid-style.service';
import { GetCategoryDto } from './dto/get-question.dto';
import { AnswerQuestionDto } from './dto/answer-question.dto';

@Controller('grid-style')
export class GridStyleController {
    constructor(private readonly service: GridStyleService) { }

    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'List Difficulty.' })
    @Get('list-difficulty')
    async listDifficulty(
        @Query() questionsDto: DifficultyDto,) {
        return this.service.listDifficultyLevel(questionsDto.game_id, questionsDto.categories)
    }


    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get Question by category.' })
    @Get('get-question')
    async getQuestionByCategory(
        @Query() query: GetCategoryDto,) {
        return this.service.getQuestionByCategory(query)
    }

    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get Question by category.' })
    @Post('answer-question')
    async answerQuestion(
        @Body() body: AnswerQuestionDto,) {
        return this.service.answerQuestion(body)
    }
}
