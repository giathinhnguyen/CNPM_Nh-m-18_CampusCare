// Proposed DEVELOPMENT recipes, not commercially validated brewing standards.
// Each array lists independently specified quantities for S / M / L in base units.
// Water and ice are intentionally excluded. Topping add-ons are outside this MVP.
export const ingredientCatalog = [
  ['NL001', 'Bột cà phê Robusta', 'g', 180],
  ['NL002', 'Sữa đặc có đường', 'g', 48],
  ['NL003', 'Sữa tươi không đường', 'ml', 35],
  ['NL004', 'Whipping cream', 'ml', 140],
  ['NL005', 'Muối tinh', 'g', 5],
  ['NL006', 'Bột matcha', 'g', 900],
  ['NL007', 'Trà lài khô', 'g', 250],
  ['NL008', 'Nước cốt tắc', 'ml', 60],
  ['NL009', 'Nước cốt chanh', 'ml', 65],
  ['NL010', 'Bột cacao nguyên chất', 'g', 220],
  ['NL011', 'Nước đường', 'ml', 20],
  ['NL020', 'Sữa dừa', 'ml', 70],
  ['NL021', 'Đào ngâm đã ráo', 'g', 90],
  ['NL022', 'Cam tươi sơ chế', 'g', 55],
  ['NL023', 'Xoài sơ chế', 'g', 65],
  ['NL024', 'Dâu tây sơ chế', 'g', 140],
  ['NL025', 'Sốt caramel', 'g', 120],
  ['NL026', 'Trà ô long khô', 'g', 300],
  ['NL027', 'Sữa chua', 'g', 55],
  ['NL028', 'Bột hojicha', 'g', 700],
  ['NL029', 'Cream cheese', 'g', 180],
  ['NL030', 'Sữa yến mạch', 'ml', 65],
  ['NL031', 'Syrup đường nâu', 'ml', 65],
  ['NL032', 'Trân châu chín', 'g', 45],
  ['NL033', 'Tonic', 'ml', 40],
  ['NL034', 'Mật ong', 'g', 130],
] as const;

export const menuRecipes: Record<
  string,
  Record<string, [number, number, number]>
> = {
  'Salted Cloud Coffee': {
    NL001: [15, 20, 26],
    NL002: [18, 25, 32],
    NL004: [30, 45, 55],
    NL003: [10, 15, 20],
    NL005: [0.25, 0.4, 0.5],
  },
  'Kyoto Matcha Latte': {
    NL006: [3.5, 5, 6.5],
    NL003: [150, 220, 300],
    NL011: [10, 15, 20],
  },
  'Brown Sugar Boba': {
    NL026: [5, 7, 9],
    NL003: [120, 170, 230],
    NL031: [20, 28, 36],
    NL032: [35, 50, 65],
  },
  'Caramel Cold Brew': {
    NL001: [18, 25, 32],
    NL025: [15, 22, 28],
    NL011: [5, 8, 10],
  },
  'Strawberry Matcha': {
    NL006: [3, 4.5, 6],
    NL024: [35, 50, 70],
    NL030: [130, 190, 260],
    NL011: [8, 12, 16],
  },
  'Cocoa Frost': {
    NL010: [12, 18, 24],
    NL003: [100, 150, 200],
    NL004: [20, 30, 40],
    NL011: [15, 22, 28],
  },
  'Coconut Latte': {
    NL001: [15, 20, 26],
    NL020: [100, 150, 210],
    NL003: [40, 60, 80],
    NL004: [15, 20, 25],
    NL011: [8, 12, 16],
  },
  'Jasmine Peach Tea': {
    NL007: [5, 8, 10],
    NL021: [35, 50, 70],
    NL022: [15, 25, 35],
    NL011: [18, 25, 32],
  },
  'Roasted Oolong Milk Tea': {
    NL026: [5, 8, 10],
    NL003: [120, 180, 250],
    NL034: [12, 18, 24],
  },
  'Citrus Espresso Tonic': {
    NL001: [15, 20, 26],
    NL033: [120, 180, 250],
    NL022: [20, 30, 45],
    NL011: [5, 8, 12],
  },
  'Mango Yogurt Frost': {
    NL023: [60, 90, 125],
    NL027: [70, 100, 140],
    NL003: [30, 50, 70],
    NL011: [8, 12, 16],
  },
  'Hojicha Cream Cloud': {
    NL028: [3, 4.5, 6],
    NL003: [120, 180, 250],
    NL029: [15, 22, 30],
    NL004: [15, 22, 30],
    NL011: [8, 12, 16],
  },
};
