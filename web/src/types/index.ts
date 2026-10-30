export type Category = "Cà phê" | "Trà" | "Trà sữa" | "Đá xay"
export type OrderStatus = "PAID" | "CANCELLED"

export interface SizeOption {
  id: "S" | "M" | "L"
  label: string
  extra: number
}

export interface Topping {
  id: string
  name: string
  price: number
}

export interface DrinkLevel {
  value: 0 | 50 | 100 | 120
  label: "Không" | "Ít" | "Bình thường" | "Nhiều"
}

export interface Product {
  id: string
  name: string
  category: Category
  description: string
  longDescription: string
  price: number
  image: string
  rating: number
  isBestSeller?: boolean
  isNew?: boolean
  stock: number
  sizes: SizeOption[]
  toppings: Topping[]
}

export interface CartItem {
  key: string
  productId: string
  name: string
  image: string
  size: SizeOption
  toppings: Topping[]
  sweetness: DrinkLevel
  ice: DrinkLevel
  note: string
  unitPrice: number
  quantity: number
  isReward?: boolean
  rewardPoints?: number
  unavailable?: boolean
  availabilityMessage?: string
}

export interface RewardProduct {
  productCode: string
  name: string
  image: string
  pointsRequired: number
  allowed: boolean
}

export interface RewardCatalog {
  pointsBalance: number
  products: RewardProduct[]
}

export interface User {
  id: string
  name: string
  email: string
  phone?: string
}

export interface Order {
  id: string
  userId: string
  createdAt: string
  status: OrderStatus
  items: CartItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: "wallet" | "card"
}

export interface ToastMessage {
  id: string
  message: string
  type: "success" | "error" | "info"
}
