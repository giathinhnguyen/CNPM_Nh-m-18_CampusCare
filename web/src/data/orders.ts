import type { Order } from "../types"
import { defaultDrinkLevel, drinkLevels, products } from "./products"

const sampleItem = (index: number) => ({
  key: `sample-${index}`,
  productId: products[index].id,
  name: products[index].name,
  image: products[index].image,
  size: products[index].sizes[1],
  toppings: index === 0 ? [products[index].toppings[2]] : [],
  sweetness: defaultDrinkLevel,
  ice: drinkLevels[2],
  note: index === 0 ? "Ít ngọt, mình sẽ đến nhận trước 10 giờ." : "",
  unitPrice: products[index].price + products[index].sizes[1].extra,
  quantity: 1,
})

export const sampleOrders: Order[] = [
  {
    id: "1042",
    userId: "demo-user",
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    status: "PAID",
    items: [sampleItem(0), sampleItem(1)],
    subtotal: 132000,
    discount: 13000,
    total: 119000,
    paymentMethod: "wallet",
  },
  {
    id: "1038",
    userId: "demo-user",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    status: "PAID",
    items: [sampleItem(2)],
    subtotal: 67000,
    discount: 0,
    total: 67000,
    paymentMethod: "card",
  },
  {
    id: "1029",
    userId: "demo-user",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    status: "CANCELLED",
    items: [sampleItem(3)],
    subtotal: 60000,
    discount: 0,
    total: 60000,
    paymentMethod: "wallet",
  },
]
