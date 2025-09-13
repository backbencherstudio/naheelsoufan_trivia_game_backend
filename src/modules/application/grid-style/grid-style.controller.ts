import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { DifficultyDto } from './dto/difficulty.dto';
import { GridStyleService } from './grid-style.service';

@Controller('grid-style')
export class GridStyleController {
    constructor(private readonly service: GridStyleService) { }

    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'List Difficulty.' })
    @Get('list-difficulty')
    async listDifficulty(
        @Query() questionsDto: DifficultyDto,) {
        return this.service.listDifficultyLevel(questionsDto.categories)
    }
}
