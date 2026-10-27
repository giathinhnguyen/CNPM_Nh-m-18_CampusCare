import { DrinkLevel } from '@prisma/client';

export class AddToCartDto {
    productId: string;
    productSizeId: string;
    sweetnessLevel?: DrinkLevel;
    iceLevel?: DrinkLevel;
    quantity: number;
    toppingIds?: string[];
    note?: string;
}

export class UpdateQuantityDto {
    quantity: number;
}