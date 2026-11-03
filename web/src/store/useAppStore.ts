import { create } from "zustand"
import { persist } from "zustand/middleware"
import { sampleOrders } from "../data/orders"
import { products } from "../data/products"
import { getPromotion, getPromotionDiscount } from "../data/promotions"
import type { CartItem, Order, ToastMessage, User } from "../types"

interface AppState {
  cart: CartItem[]
  promoCode: string | null
  discount: number
  user: User | null
  orders: Order[]
  toasts: ToastMessage[]
  checkoutSelection: string[]
  loyaltyPoints: number
  settledRewardOrderIds: string[]
  accountCarts: Record<string, CartItem[]>
  addToCart: (item: CartItem) => void
  updateQuantity: (key: string, quantity: number) => void
  updateItemNote: (key: string, note: string) => void
  removeFromCart: (key: string) => void
  clearCart: () => void
  setCheckoutSelection: (keys: string[]) => void
  completeCheckout: (keys: string[]) => void
  applyPromo: (code: string, subtotal: number) => boolean
  login: (email: string, name?: string) => number
  logout: () => void
  addOrder: (order: Order) => void
  settleRewardOrder: (orderId: string, points: number) => void
  addToast: (message: string, type?: ToastMessage["type"]) => void
  removeToast: (id: string) => void
}

function mergeAndValidateCart(
  accountCart: CartItem[],
  guestCart: CartItem[],
): CartItem[] {
  const merged = [...accountCart]

  guestCart.forEach((incoming) => {
    const existing = merged.find((item) => item.key === incoming.key)
    if (existing) {
      existing.quantity += incoming.quantity
    } else {
      merged.push({ ...incoming })
    }
  })

  let hasReward = false
  return merged.map((item) => {
    const product = products.find(
      (candidate) => candidate.id === item.productId,
    )
    let availabilityMessage = ""

    if (!product || product.stock === 0) {
      availabilityMessage = "Hết hàng"
    } else if (product.stock < item.quantity) {
      availabilityMessage = `Chỉ còn ${product.stock} sản phẩm`
    } else if (item.isReward && hasReward) {
      availabilityMessage = "Giỏ hàng chỉ được có một sản phẩm đổi thưởng"
    }

    if (item.isReward && !hasReward) hasReward = true

    return {
      ...item,
      unavailable: Boolean(availabilityMessage),
      availabilityMessage,
    }
  })
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      cart: [],
      promoCode: null,
      discount: 0,
      user: null,
      orders: sampleOrders,
      toasts: [],
      checkoutSelection: [],
      loyaltyPoints: 420,
      settledRewardOrderIds: [],
      accountCarts: {},
      addToCart: (incoming) =>
        set((state) => {
          const existing = state.cart.find((item) => item.key === incoming.key)
          return {
            cart: existing
              ? state.cart.map((item) =>
                  item.key === incoming.key
                    ? { ...item, quantity: item.quantity + incoming.quantity }
                    : item,
                )
              : [...state.cart, incoming],
          }
        }),
      updateQuantity: (key, quantity) =>
        set((state) => ({
          cart: state.cart.map((item) =>
            item.key === key
              ? { ...item, quantity: Math.max(1, quantity) }
              : item,
          ),
        })),
      updateItemNote: (key, note) =>
        set((state) => ({
          cart: state.cart.map((item) =>
            item.key === key ? { ...item, note } : item,
          ),
        })),
      removeFromCart: (key) =>
        set((state) => ({
          cart: state.cart.filter((item) => item.key !== key),
        })),
      clearCart: () => set({ cart: [], promoCode: null, discount: 0 }),
      setCheckoutSelection: (keys) => set({ checkoutSelection: keys }),
      completeCheckout: (keys) =>
        set((state) => ({
          cart: state.cart.filter((item) => !keys.includes(item.key)),
          checkoutSelection: [],
          promoCode: null,
          discount: 0,
        })),
      applyPromo: (code, subtotal) => {
        const normalized = code.trim().toUpperCase()
        const promotion = getPromotion(normalized)
        if (promotion && subtotal >= promotion.minSpend) {
          set({
            promoCode: normalized,
            discount: getPromotionDiscount(normalized, subtotal),
          })
          return true
        }
        set({ promoCode: null, discount: 0 })
        return false
      },
      login: (email, name = "Khách BrewLite") => {
        let unavailableCount = 0
        set((state) => {
          const normalizedEmail = email.trim().toLowerCase()
          const mergedCart = mergeAndValidateCart(
            state.accountCarts[normalizedEmail] ?? [],
            state.cart,
          )
          unavailableCount = mergedCart.filter(
            (item) => item.unavailable,
          ).length
          return {
            user: { id: normalizedEmail, name, email: normalizedEmail },
            cart: mergedCart,
            accountCarts: {
              ...state.accountCarts,
              [normalizedEmail]: mergedCart,
            },
          }
        })
        return unavailableCount
      },
      logout: () =>
        set((state) => ({
          user: null,
          cart: [],
          checkoutSelection: [],
          accountCarts: state.user
            ? { ...state.accountCarts, [state.user.email]: state.cart }
            : state.accountCarts,
        })),
      addOrder: (order) =>
        set((state) => ({ orders: [order, ...state.orders] })),
      settleRewardOrder: (orderId, points) =>
        set((state) => {
          if (state.settledRewardOrderIds.includes(orderId)) return state
          return {
            loyaltyPoints: Math.max(0, state.loyaltyPoints - points),
            settledRewardOrderIds: [...state.settledRewardOrderIds, orderId],
          }
        }),
      addToast: (message, type = "success") =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            { id: `${Date.now()}-${Math.random()}`, message, type },
          ],
        })),
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        })),
    }),
    {
      name: "brewlite-store",
      partialize: ({
        cart,
        promoCode,
        discount,
        user,
        orders,
        checkoutSelection,
        loyaltyPoints,
        settledRewardOrderIds,
        accountCarts,
      }) => ({
        cart,
        promoCode,
        discount,
        user,
        orders,
        checkoutSelection,
        loyaltyPoints,
        settledRewardOrderIds,
        accountCarts,
      }),
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<AppState>
        if (version < 2) return { ...state, user: null }
        return state
      },
    },
  ),
)
