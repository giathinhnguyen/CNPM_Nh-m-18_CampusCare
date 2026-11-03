// Chỉ nhận mã và cấu hình món; giá tiền luôn được đọc từ database.
export interface QuotePromotionDto {
  code?: string | null;
  items: {
    productSizeId: string;
    quantity: number;
    toppingIds: string[];
  }[];
}
