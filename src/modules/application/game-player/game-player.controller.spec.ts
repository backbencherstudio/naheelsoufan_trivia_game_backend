import { Test, TestingModule } from '@nestjs/testing';
import { GamePlayerController } from './game-player.controller';
import { GamePlayerService } from './game-player.service';

describe('GamePlayerController', () => {
  let controller: GamePlayerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamePlayerController],
      providers: [GamePlayerService],
    }).compile();

    controller = module.get<GamePlayerController>(GamePlayerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
