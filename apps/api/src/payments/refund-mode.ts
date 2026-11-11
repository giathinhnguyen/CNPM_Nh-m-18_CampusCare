export function configuredRefundMode(): 'GATEWAY' | 'SIMULATION' {
  return process.env.REFUND_MODE === 'simulation' ? 'SIMULATION' : 'GATEWAY';
}
