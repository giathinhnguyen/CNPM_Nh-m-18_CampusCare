import { useEffect, useState } from 'react';
import { orderService } from '../services/orderService';
import { formatCurrency } from '../lib/utils';
import { InlineNotice, LoadingState } from './ui';

export default function ZalopayQrPanel({ orderId }: { orderId: string }) {
  const [qr, setQr] = useState<{ qrDataUrl: string; paymentUrl: string; amount: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void orderService.zalopayQr(orderId).then(data => { if (active) setQr(data); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Chưa tải được QR ZaloPay'); });
    return () => { active = false; };
  }, [orderId]);
  if (error) return <InlineNotice type="error">{error}</InlineNotice>;
  if (!qr) return <LoadingState label="Đang tải mã QR ZaloPay..." />;
  return <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center">
    <h3 className="font-serif text-xl text-[#302018]">Quét mã để thanh toán</h3>
    <p className="mt-2 text-sm text-[#756359]">Mở ứng dụng ZaloPay và quét mã bên dưới.</p>
    <p className="mt-3 text-xl font-bold text-[#302018]">{formatCurrency(Number(qr.amount))}</p>
    <img src={qr.qrDataUrl} width={320} height={320} alt="Mã QR thanh toán ZaloPay cho đơn hàng" className="mx-auto my-4 max-w-full rounded-xl bg-white" />
    <p role="status" className="text-sm text-blue-900">Đang chờ thanh toán...</p>
    <a href={qr.paymentUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold text-blue-800 underline">Mở trang thanh toán ZaloPay</a>
  </section>;
}
