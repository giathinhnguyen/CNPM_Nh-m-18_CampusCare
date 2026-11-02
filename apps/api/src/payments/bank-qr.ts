export function bankQrReceiver() {
  const bankBin = process.env.BANK_QR_BIN?.trim() ?? '';
  const bankName = process.env.BANK_QR_BANK_NAME?.trim() ?? '';
  const accountNumber = process.env.BANK_QR_ACCOUNT_NUMBER?.trim() ?? '';
  const accountName = process.env.BANK_QR_ACCOUNT_NAME?.trim() ?? '';
  if (
    !/^\d{6}$/.test(bankBin) ||
    !/^[a-zA-Z0-9]{1,19}$/.test(accountNumber) ||
    !accountName ||
    accountName.length > 100 ||
    !bankName ||
    bankName.length > 100
  )
    return null;
  return { bankBin, bankName, accountNumber, accountName };
}

export function bankQrDetails(amount: string, orderCode: string) {
  const receiver = bankQrReceiver();
  if (!receiver) return { configured: false as const };
  if (
    !/^[1-9]\d{0,12}$/.test(amount) ||
    !/^[A-Za-z0-9 ]{1,50}$/.test(orderCode)
  )
    throw new Error('Invalid bank QR order data');
  const query = new URLSearchParams({
    amount,
    addInfo: orderCode,
    accountName: receiver.accountName,
  });
  return {
    configured: true as const,
    ...receiver,
    amount,
    content: orderCode,
    qrUrl: `https://img.vietqr.io/image/${receiver.bankBin}-${receiver.accountNumber}-compact2.svg?${query}`,
  };
}
