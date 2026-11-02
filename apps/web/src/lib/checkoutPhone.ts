export function normalizeCheckoutPhone(value: string): string | null {
  if (value.length > 40 || !/^[+\d\s().-]+$/.test(value)) return null;
  const compact = value.replace(/[\s().-]/g, "");
  const phone = /^\+?84\d{9}$/.test(compact)
    ? `0${compact.replace(/^\+?84/, "")}`
    : compact;
  return /^0\d{9}$/.test(phone) ? phone : null;
}
