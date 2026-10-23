const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export interface RewardProductResponse {
  id: string;
  pointsRequired: number;
  isActive: boolean;
  productSize: {
    id: string;
    size: "S" | "M" | "L";
    product: {
      id: string;
      name: string;
      imageUrl: string | null;
      stockQuantity: number;
    };
  };
}

export const rewardService = {
  async getRewardProducts(
    signal?: AbortSignal,
  ): Promise<RewardProductResponse[]> {
    const response = await fetch(`${API_URL}/rewards/products`, {
      signal,
    });

    if (!response.ok) {
      throw new Error(`Không thể tải sản phẩm đổi thưởng (${response.status})`);
    }

    return response.json() as Promise<RewardProductResponse[]>;
  },
};
