import type { Product } from "../types"

export const drinkLevels = [
  { value: 120 as const, label: "Nhiều" as const },
  { value: 100 as const, label: "Bình thường" as const },
  { value: 50 as const, label: "Ít" as const },
  { value: 0 as const, label: "Không" as const },
]

export const defaultDrinkLevel = drinkLevels[1]

const coffeeSizes = [
  { id: "S" as const, label: "Nhỏ · 350ml", extra: 0 },
  { id: "M" as const, label: "Vừa · 500ml", extra: 8000 },
  { id: "L" as const, label: "Lớn · 700ml", extra: 14000 },
]

const toppings = [
  { id: "pearl", name: "Trân châu đen", price: 8000 },
  { id: "jelly", name: "Thạch cà phê", price: 9000 },
  { id: "cream", name: "Kem cheese", price: 12000 },
  { id: "pudding", name: "Pudding trứng", price: 10000 },
  { id: "aloe", name: "Nha đam", price: 8000 },
]

export const products: Product[] = [
  {
    id: "salted-cloud",
    name: "Salted Cloud Coffee",
    category: "Cà phê",
    description: "Cà phê đậm vị, kem muối mịn màng",
    longDescription:
      "Cốt cà phê Arabica rang vừa hòa cùng lớp kem muối béo nhẹ, tạo nên dư vị cân bằng giữa đắng, ngọt và mặn.",
    price: 49000,
    image:
      "https://images.unsplash.com/photo-1749105504681-1889a810be41?auto=format&fit=crop&w=1200&q=85",
    rating: 4.9,
    isBestSeller: true,
    stock: 18,
    sizes: coffeeSizes,
    toppings,
  },
  {
    id: "matcha-latte",
    name: "Kyoto Matcha Latte",
    category: "Trà",
    description: "Matcha Nhật Bản, sữa tươi thanh nhẹ",
    longDescription:
      "Matcha tuyển chọn từ Uji với hương cỏ non dịu mát, đánh cùng sữa tươi để tạo kết cấu mượt mà và vị ngọt vừa đủ.",
    price: 55000,
    image:
      "https://images.unsplash.com/photo-1749104028327-a33087ea4f47?auto=format&fit=crop&w=1200&q=85",
    rating: 4.8,
    isNew: true,
    stock: 9,
    sizes: coffeeSizes,
    toppings,
  },
  {
    id: "brown-sugar",
    name: "Brown Sugar Boba",
    category: "Trà sữa",
    description: "Trà sữa ô long, đường nâu và trân châu",
    longDescription:
      "Trà ô long ủ lạnh quyện cùng sữa tươi và đường nâu caramel, hoàn thiện bằng trân châu dẻo nấu mới mỗi ngày.",
    price: 59000,
    image:
      "https://images.unsplash.com/photo-1686139073338-ca76f475086a?auto=format&fit=crop&w=1200&q=85",
    rating: 4.9,
    isBestSeller: true,
    stock: 14,
    sizes: coffeeSizes,
    toppings,
  },
  {
    id: "caramel-cold-brew",
    name: "Caramel Cold Brew",
    category: "Cà phê",
    description: "Cold brew ủ 16 giờ, caramel cháy",
    longDescription:
      "Cold brew ủ chậm 16 giờ cho vị mượt, ít chua, kết hợp caramel cháy và một chút kem tươi.",
    price: 52000,
    image:
      "https://images.unsplash.com/photo-1694245876425-b6af2c09ddba?auto=format&fit=crop&w=1200&q=85",
    rating: 4.7,
    stock: 11,
    sizes: coffeeSizes,
    toppings,
  },
  {
    id: "strawberry-matcha",
    name: "Strawberry Matcha",
    category: "Trà",
    description: "Dâu tây tươi, matcha và sữa yến mạch",
    longDescription:
      "Ba tầng vị nổi bật: mứt dâu tươi nhà làm, sữa yến mạch thanh nhẹ và matcha Uji thơm dịu.",
    price: 62000,
    image:
      "https://images.unsplash.com/photo-1749104953222-9d6ed76e4bf0?auto=format&fit=crop&w=1200&q=85",
    rating: 4.8,
    isNew: true,
    stock: 7,
    sizes: coffeeSizes,
    toppings,
  },
  {
    id: "cocoa-frost",
    name: "Cocoa Frost",
    category: "Đá xay",
    description: "Cacao đậm, đá xay và kem tươi",
    longDescription:
      "Cacao nguyên chất xay mịn cùng sữa, phủ kem tươi và bột cacao cho một món uống mát lạnh, đậm đà.",
    price: 65000,
    image:
      "https://images.unsplash.com/photo-1629644087983-c85380e0b543?auto=format&fit=crop&w=1200&q=85",
    rating: 4.6,
    stock: 0,
    sizes: coffeeSizes,
    toppings,
  },
  {
    id: "coconut-latte",
    name: "Coconut Latte",
    category: "Cà phê",
    description: "Espresso, sữa dừa và kem mịn",
    longDescription:
      "Espresso rang vừa hòa cùng sữa dừa thơm dịu, tạo nên vị cà phê nhiệt đới cân bằng và mềm mại.",
    price: 56000,
    image:
      "https://images.unsplash.com/photo-1749105504681-1889a810be41?auto=format&fit=crop&w=1200&q=85",
    rating: 4.8,
    stock: 16,
    sizes: coffeeSizes,
    toppings,
  },
  {
    id: "jasmine-peach",
    name: "Jasmine Peach Tea",
    category: "Trà",
    description: "Trà nhài, đào vàng và cam tươi",
    longDescription:
      "Trà nhài thanh hương kết hợp đào vàng mọng nước và lát cam tươi, phù hợp cho một buổi chiều nhẹ nhàng.",
    price: 52000,
    image:
      "https://images.unsplash.com/photo-1739126164994-d555b6b11254?auto=format&fit=crop&w=1200&q=85",
    rating: 4.7,
    isNew: true,
    stock: 20,
    sizes: coffeeSizes,
    toppings,
  },
  {
    id: "oolong-milk-tea",
    name: "Roasted Oolong Milk Tea",
    category: "Trà sữa",
    description: "Ô long rang, sữa tươi và mật ong",
    longDescription:
      "Trà ô long rang đậm hương, pha cùng sữa tươi và một chút mật ong cho hậu vị ấm, thơm và ít ngọt.",
    price: 57000,
    image:
      "https://images.unsplash.com/photo-1686139073338-ca76f475086a?auto=format&fit=crop&w=1200&q=85",
    rating: 4.9,
    isBestSeller: true,
    stock: 13,
    sizes: coffeeSizes,
    toppings,
  },
  {
    id: "espresso-tonic",
    name: "Citrus Espresso Tonic",
    category: "Cà phê",
    description: "Espresso, tonic và cam vàng",
    longDescription:
      "Một lựa chọn sảng khoái với espresso đậm vị, tonic có gas và hương cam vàng tươi sáng.",
    price: 54000,
    image:
      "https://images.unsplash.com/photo-1694245876425-b6af2c09ddba?auto=format&fit=crop&w=1200&q=85",
    rating: 4.6,
    stock: 10,
    sizes: coffeeSizes,
    toppings,
  },
  {
    id: "mango-yogurt-frost",
    name: "Mango Yogurt Frost",
    category: "Đá xay",
    description: "Xoài chín, sữa chua và đá xay",
    longDescription:
      "Xoài chín tự nhiên xay cùng sữa chua thanh nhẹ, mang đến kết cấu mịn và vị chua ngọt dễ chịu.",
    price: 64000,
    image:
      "https://images.unsplash.com/photo-1749104028327-a33087ea4f47?auto=format&fit=crop&w=1200&q=85",
    rating: 4.8,
    stock: 8,
    sizes: coffeeSizes,
    toppings,
  },
  {
    id: "hojicha-cloud",
    name: "Hojicha Cream Cloud",
    category: "Trà sữa",
    description: "Hojicha rang, sữa tươi và kem cheese",
    longDescription:
      "Trà Hojicha rang thơm với sắc hạt dẻ, hòa cùng sữa tươi và lớp kem cheese mằn mặn đặc trưng.",
    price: 61000,
    image:
      "https://images.unsplash.com/photo-1749104953222-9d6ed76e4bf0?auto=format&fit=crop&w=1200&q=85",
    rating: 4.7,
    stock: 12,
    sizes: coffeeSizes,
    toppings,
  },
]

export const categories = ["Tất cả", "Cà phê", "Trà", "Trà sữa", "Đá xay"]
