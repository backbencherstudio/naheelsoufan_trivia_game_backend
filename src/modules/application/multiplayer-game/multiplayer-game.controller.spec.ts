import { Test, TestingModule } from '@nestjs/testing';
import { MultiplayerGameController } from './multiplayer-game.controller';
import { MultiplayerGameService } from './multiplayer-game.service';

describe('MultiplayerGameController', () => {
  let controller: MultiplayerGameController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MultiplayerGameController],
      providers: [MultiplayerGameService],
    }).compile();

    controller = module.get<MultiplayerGameController>(MultiplayerGameController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
