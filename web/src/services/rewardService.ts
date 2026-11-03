import type { CartItem, RewardCatalog } from "../types"
import { defaultDrinkLevel, products } from "../data/products"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? ""
export const isRewardsMockMode = !API_BASE_URL

const mockRewardProducts = [
  { productCode: products[0].id, pointsRequired: 250, allowed: true },
  { productCode: products[1].id, pointsRequired: 350, allowed: true },
  { productCode: products[2].id, pointsRequired: 450, allowed: true },
  { productCode: products[3].id, pointsRequired: 600, allowed: false },
].map((reward) => {
  const product = products.find((item) => item.id === reward.productCode)!
  return {
    ...reward,
    name: product.name,
    image: product.image,
  }
})

const mockCatalog: RewardCatalog = {
  pointsBalance: 420,
  products: mockRewardProducts,
}

const wait = (duration: number) =>
  new Promise((resolve) => window.setTimeout(resolve, duration))

class RewardServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RewardServiceError"
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>

  let message = "Không thể xử lý yêu cầu đổi thưởng. Vui lòng thử lại."
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) message = body.message
  } catch {
    // Giữ thông báo an toàn, không hiển thị lỗi kỹ thuật từ server.
  }
  throw new RewardServiceError(message)
}

export async function getRewardCatalog(
  signal?: AbortSignal,
): Promise<RewardCatalog> {
  if (!API_BASE_URL) {
    await wait(650)
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
    return mockCatalog
  }

  const response = await fetch(`${API_BASE_URL}/rewards/products`, {
    credentials: "include",
    signal,
  })
  return parseResponse<RewardCatalog>(response)
}

export async function redeemRewardProduct(
  productCode: string,
  currentPoints?: number,
): Promise<{ cartItem: CartItem }> {
  if (!API_BASE_URL) {
    await wait(850)
    const reward = mockRewardProducts.find(
      (item) => item.productCode === productCode,
    )
    const product = products.find((item) => item.id === productCode)
    if (!reward || !product || !reward.allowed) {
      throw new RewardServiceError("Sản phẩm này hiện không thể đổi thưởng.")
    }
    if ((currentPoints ?? mockCatalog.pointsBalance) < reward.pointsRequired) {
      throw new RewardServiceError("Bạn chưa đủ điểm để đổi sản phẩm này.")
    }

    return {
      cartItem: {
        key: `reward-${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name,
        image: product.image,
        size: product.sizes[1],
        toppings: [],
        sweetness: defaultDrinkLevel,
        ice: defaultDrinkLevel,
        note: "",
        unitPrice: 0,
        quantity: 1,
        isReward: true,
        rewardPoints: reward.pointsRequired,
      },
    }
  }

  const response = await fetch(`${API_BASE_URL}/rewards/redeem`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productCode }),
  })
  return parseResponse<{ cartItem: CartItem }>(response)
}
