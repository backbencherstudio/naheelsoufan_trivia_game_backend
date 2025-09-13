import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateSubscriptionDto {
    @IsString()
    @IsNotEmpty()
    subscription_type_id: string;

    @IsString()
    @IsOptional()
    payment_method_id?: string;

    @IsString()
    @IsOptional()
    promo_code?: string;
}

export class PurchaseSubscriptionDto {
    @IsString()
    @IsNotEmpty()
    subscription_type_id: string;

    @IsString()
    @IsOptional()
    payment_method_id?: string;

    @IsString()
    @IsOptional()
    promo_code?: string;

    @IsString()
    @IsOptional()
    return_url?: string; // For redirect after payment
}

export class CancelSubscriptionDto {
    @IsString()
    @IsNotEmpty()
    subscription_id: string;

    @IsString()
    @IsOptional()
    reason?: string;
}
