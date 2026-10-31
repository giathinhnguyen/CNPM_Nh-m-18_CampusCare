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
  async getBalance(signal?: AbortSignal): Promise<RewardBalance> {
    return parse(
      await authenticatedFetch(`${API_URL}/rewards/balance`, { signal }),
    );
  },
  async redeem(rewardProductId: string, idempotencyKey: string) {
    return parse<{
      redemptionId: string;
      status: string;
      cartItem: { id: string } | null;
    }>(
      await authenticatedFetch(`${API_URL}/rewards/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardProductId, idempotencyKey }),
      }),
    );
  },
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
import { authenticatedFetch } from "./session";

export interface RewardBalance {
  pointsBalance: number;
  reservedPoints: number;
  availablePoints: number;
  hasRewardInCart: boolean;
}

async function parse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : "Không thể xử lý đổi thưởng",
    );
  return data as T;
}
