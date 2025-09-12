import { GameMode } from '@prisma/client';

export class Leaderboard {
    id: string;
    user_id: string;
    game_id?: string;
    category_id?: string;
    score: number;
    correct: number;
    wrong: number;
    skipped: number;
    tts_speed: number;
    games_played: number;
    mode: GameMode;
    created_at: Date;
}
