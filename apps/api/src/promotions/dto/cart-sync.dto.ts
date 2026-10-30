import type { AddToCartDto } from '../../carts/carts.dto.js';

// syncId nhận diện một lần chuyển giỏ, không phải mã khuyến mãi.
export class CartSyncDto {
  syncId: string;
  items: AddToCartDto[];
}
