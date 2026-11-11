export function configuredRefundMode(
  method?: string,
): 'GATEWAY' | 'SIMULATION' {
  const providerMode =
    method === 'VNPAY'
      ? process.env.VNPAY_REFUND_MODE
      : method === 'ZALOPAY'
        ? process.env.ZALOPAY_REFUND_MODE
        : undefined;
  return (providerMode || process.env.REFUND_MODE) === 'simulation'
    ? 'SIMULATION'
    : 'GATEWAY';
}
