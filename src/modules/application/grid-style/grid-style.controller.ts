import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { DifficultyDto } from './dto/difficulty.dto';
import { GridStyleService } from './grid-style.service';
import { GetCategoryDto } from './dto/get-question.dto';
import { AnswerQuestionDto } from './dto/answer-question.dto';
import { AddMultipleQuickGamePlayersDto } from '../game-player/dto/quick-game.dto';
import { GamePlayerService } from '../game-player/game-player.service';
import { CategoryDifficultyDto } from './dto/category-dificulty.dto';

@Controller('grid-style')
export class GridStyleController {
  constructor(
    private readonly service: GridStyleService,
    private readonly gameService: GamePlayerService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List Difficulty.' })
  @Get('list-difficulty')
  async listDifficulty(@Query() questionsDto: DifficultyDto) {
    return this.service.listDifficultyLevel(
      questionsDto.game_id,
      questionsDto.categories,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Question by category.' })
  @Get('get-question')
  async getQuestionByCategory(@Query() query: GetCategoryDto) {
    return this.service.getQuestionByCategory(query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get Question by category.' })
  @Post('answer-question')
  async answerQuestion(@Body() body: AnswerQuestionDto) {
    return this.service.answerQuestion(body);
  }

  // Grid style game

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add multiple players to Quick Game at once' })
  @Post('add-players')
  async addMultipleQuickGamePlayers(
    @Body() dto: AddMultipleQuickGamePlayersDto,
  ) {
    try {
      return await this.gameService.addMultipleQuickGamePlayers(
        dto.game_id,
        dto.player_names,
        2,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // @UseGuards(JwtAuthGuard)
  // @ApiOperation({
  //   summary: 'Select category/difficulty and start game in one step',
  // })
  // @Post('select-category-and-start')
  // async selectCategoryAndStart(@Body() dto: CategoryDifficultyDto) {
  //   try {
  //     return await this.service.selectCategoryAndStart(
  //       dto.game_id,
  //       dto.category_ids,
  //       dto.difficulty_ids,
  //     );
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }
}
