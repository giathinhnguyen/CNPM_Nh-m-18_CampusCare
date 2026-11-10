import { ApiBody } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import { DrinkLevel } from '@prisma/client';

const uuid: SchemaObject = {
  type: 'string',
  format: 'uuid',
  example: '00000000-0000-4000-8000-000000000001',
  description:
    'Thay bằng UUID thật từ response; UUID mẫu không có trong database.',
};
const text = (example: string): SchemaObject => ({ type: 'string', example });
const number = (example: number): SchemaObject => ({ type: 'number', example });
const bool: SchemaObject = { type: 'boolean', example: true };
const array = (items: SchemaObject): SchemaObject => ({ type: 'array', items });
const object = (
  properties: Record<string, SchemaObject>,
  required = Object.keys(properties),
): SchemaObject => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const password: SchemaObject = {
  type: 'string',
  format: 'password',
  example: 'YourPassword123!',
};
const level: SchemaObject = {
  type: 'string',
  enum: Object.values(DrinkLevel),
  default: 'HUNDRED',
};
const updatedAt: SchemaObject = {
  type: 'string',
  format: 'date-time',
  description: 'Giá trị updatedAt mới nhất lấy từ GET /api/admin/overview.',
};
const cartItem = object(
  {
    productId: uuid,
    productSizeId: uuid,
    quantity: { type: 'integer', minimum: 1, maximum: 10000, example: 1 },
    sweetnessLevel: level,
    iceLevel: level,
    toppingIds: { ...array(uuid), example: [] },
    note: text(''),
  },
  ['productId', 'productSizeId', 'quantity'],
);
const ingredient = object({
  code: text('TEST001'),
  name: text('Nguyên liệu test'),
  unit: { type: 'string', enum: ['g', 'ml', 'pcs'] },
  unitCostVnd: number(100),
  reorderLevel: number(100),
  onHand: number(10000),
  isActive: bool,
});
const product = object(
  {
    name: text('Món test'),
    description: text('Món dùng kiểm thử'),
    categoryId: uuid,
    basePrice: number(35000),
    imageUrl: text(''),
    isActive: bool,
  },
  ['name', 'categoryId', 'basePrice', 'isActive'],
);
const promotion = object(
  {
    code: text('TEST10'),
    title: text('Ưu đãi test'),
    description: text(''),
    discountType: {
      type: 'string',
      enum: ['FIXED', 'PERCENTAGE'],
      example: 'PERCENTAGE',
    },
    discountValue: number(10),
    minOrderAmount: number(50000),
    maxDiscountAmount: { ...number(20000), nullable: true },
    isActive: bool,
    startDate: { type: 'string', format: 'date-time', nullable: true },
    endDate: { type: 'string', format: 'date-time', nullable: true },
  },
  [
    'code',
    'title',
    'discountType',
    'discountValue',
    'minOrderAmount',
    'maxDiscountAmount',
    'isActive',
  ],
);
const edit = (schema: SchemaObject, extra: Record<string, SchemaObject> = {}) =>
  object({ ...schema.properties, updatedAt, ...extra }, [
    ...(schema.required ?? []),
    'updatedAt',
    ...Object.keys(extra),
  ]);
const vnpay: SchemaObject = {
  type: 'object',
  additionalProperties: { type: 'string' },
  description:
    'Các tham số vnp_* nguyên vẹn do VNPay trả về, bao gồm vnp_SecureHash. Dữ liệu tự điền không có chữ ký hợp lệ sẽ bị từ chối.',
};

const bodies = {
  login: object({ email: text('admin@brewlite.test'), password }),
  register: object({
    fullName: text('Khách Test'),
    email: text('your-email@example.com'),
    password,
    confirmPassword: password,
  }),
  google: object({ credential: text('GOOGLE_ID_TOKEN'), password }, [
    'credential',
  ]),
  verifyEmail: object({
    registrationId: uuid,
    code: { type: 'string', pattern: '^\\d{6}$', example: '123456' },
  }),
  resendVerification: object({ registrationId: uuid }),
  passwordSetup: object({
    challengeId: uuid,
    code: text('123456'),
    password,
    confirmPassword: password,
  }),
  cartItem,
  updateCart: object(
    {
      quantity: { type: 'integer', minimum: 0, example: 2 },
      note: text(''),
      isSelected: bool,
    },
    [],
  ),
  cartQuote: object({ itemIds: array(uuid), code: text('BREW10') }, [
    'itemIds',
  ]),
  cartSync: object({ syncId: uuid, items: array(cartItem) }),
  promotionQuote: object(
    {
      code: text('BREW10'),
      items: array(
        object(
          {
            productSizeId: uuid,
            quantity: { type: 'integer', minimum: 1, example: 1 },
            toppingIds: { ...array(uuid), example: [] },
          },
          ['productSizeId', 'quantity', 'toppingIds'],
        ),
      ),
    },
    ['items'],
  ),
  order: object(
    {
      itemIds: array(uuid),
      idempotencyKey: {
        ...uuid,
        description:
          'UUID mới cho mỗi thao tác đặt hàng; dùng lại cùng UUID và body khi retry.',
      },
      customerName: text('Khách Test'),
      customerPhone: text('0901234567'),
      expectedAmount: {
        type: 'integer',
        minimum: 0,
        description: 'Số tiền finalAmount lấy từ POST /api/cart/quote.',
      },
      code: text('BREW10'),
      note: text(''),
    },
    [
      'itemIds',
      'idempotencyKey',
      'customerName',
      'customerPhone',
      'expectedAmount',
    ],
  ),
  redeem: object({ rewardProductId: uuid, idempotencyKey: uuid }),
  payment: object({
    orderId: uuid,
    idempotencyKey: uuid,
    channel: { type: 'string', enum: ['card', 'zalopay'] },
  }),
  bankFailure: object({ idempotencyKey: uuid }),
  vnpay,
  zalopay: {
    type: 'object', additionalProperties: true,
    description: 'Callback: {data: JSON string, mac: HMAC-SHA256, type: 1}. Redirect: appid, apptransid, pmcid, bankcode, amount, discountamount, status, checksum. Không tự điền kết quả thành công.',
  },
  ingredient,
  editIngredient: edit(ingredient, { stockUpdatedAt: updatedAt }),
  product,
  editProduct: edit(product),
  promotion,
  editPromotion: edit(promotion),
  recipe: object({
    updatedAt,
    priceAdjustment: number(0),
    cupVolumeMl: number(350),
    ingredients: array(
      object({
        ingredientId: uuid,
        quantity: number(10),
        adjustmentGroup: {
          type: 'string',
          enum: ['FIXED', 'SUGAR'],
          example: 'FIXED',
        },
      }),
    ),
  }),
} satisfies Record<string, SchemaObject>;

// Documentation only: the existing service validation remains authoritative.
export function ApiRequestBody(name: keyof typeof bodies) {
  return ApiBody({ schema: bodies[name] });
}
