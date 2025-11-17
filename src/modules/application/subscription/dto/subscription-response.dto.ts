export class SubscriptionResponseDto {
    id: string;
    user_id: string;
    subscription_type_id: string;
    status: string;
    games_played_count: number;
    payment_status?: string;
    payment_raw_status?: string;
    paid_amount?: number;
    paid_currency?: string;
    payment_provider?: string;
    payment_reference_number?: string;
    payment_provider_charge_type?: string;
    payment_provider_charge?: number;
    created_at: Date;
    updated_at: Date;

    subscription_type?: {
        id: string;
        type: string;
        game_mode: string;
        games: number;
        questions: number;
        players: number;
        price: number;
        status: string;
        language_id: string;
    };
}

export class PaymentIntentResponseDto {
    client_secret: string;
    subscription_id: string;
    payment_intent_id: string;
    amount: number;
    currency: string;
    status: string;
}

export class SubscriptionStatusDto {
    subscription_id: string;
    status: string;
    is_active: boolean;
    can_play_games: boolean;
    games_remaining?: number;
    subscription_type: {
        type: string;
        game_mode: string;
        games: number;
        questions: number;
        players: number;
    };
}
