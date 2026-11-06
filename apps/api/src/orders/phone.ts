import { BadRequestException } from '@nestjs/common';

export function normalizeCustomerPhone(value: unknown): string {
  const error = () =>
    new BadRequestException(
      'Số điện thoại không hợp lệ. Nhập 10 chữ số bắt đầu bằng 0 hoặc dạng +84, ví dụ 0912345678.',
    );
  if (
    typeof value !== 'string' ||
    value.length > 40 ||
    !/^[+\d\s().-]+$/.test(value)
  )
    throw error();
  const compact = value.replace(/[\s().-]/g, '');
  const phone = /^\+?84\d{9}$/.test(compact)
    ? `0${compact.replace(/^\+?84/, '')}`
    : compact;
  if (!/^0\d{9}$/.test(phone)) throw error();
  return phone;
}
