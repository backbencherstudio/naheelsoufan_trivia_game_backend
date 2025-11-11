import { GameMode } from '@prisma/client';

export class SubscriptionType {
    id: string;
    type: string;
    game_mode: GameMode;
    games: number;
    questions: number;
    players: number;
    price: number;
    status: string;
    language_id: string;
    created_at: Date;
    updated_at: Date;
}