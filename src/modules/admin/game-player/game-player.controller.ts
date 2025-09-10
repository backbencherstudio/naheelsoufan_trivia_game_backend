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
  Req,
} from '@nestjs/common';
import { GamePlayerService } from './game-player.service';
import { JoinGameDto, LeaveGameDto } from './dto/join-game.dto';
import { AnswerQuestionDto, SkipQuestionDto } from './dto/answer-question.dto';
import { StartGameDto, EndGameDto, UpdateScoreDto, GetGameQuestionsDto } from './dto/gameplay.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiTags('Game Player')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/players')
@ApiBearerAuth()
export class GamePlayerController {
  constructor(private readonly gamePlayerService: GamePlayerService) { }



  @ApiOperation({ summary: 'Get all game players' })
  @Get()
  async getAllGamePlayers(@Query() query: {
    q?: string;
    page?: string;
    limit?: string;
    sort?: string;
    order?: string;
  }) {
    try {
      const searchQuery = query.q || null; // Optional search query
      const page = parseInt(query.page) || 1; // Default to page 1
      const limit = parseInt(query.limit) || 10; // Default to 10 items per page
      const sort = query.sort || 'created_at'; // Default sort by created_at
      const order = query.order || 'desc'; // Default order descending

      const result = await this.gamePlayerService.getAllGamePlayers(searchQuery, page, limit, sort, order);
      return result;
    }
    catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}