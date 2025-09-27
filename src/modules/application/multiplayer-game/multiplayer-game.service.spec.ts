import { Test, TestingModule } from '@nestjs/testing';
import { MultiplayerGameService } from './multiplayer-game.service';

describe('MultiplayerGameService', () => {
  let service: MultiplayerGameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MultiplayerGameService],
    }).compile();

    service = module.get<MultiplayerGameService>(MultiplayerGameService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
