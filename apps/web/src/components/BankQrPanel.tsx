import { useEffect, useState } from "react";
import { orderService, type BankQrDetails } from "../services/orderService";
import { Button } from "./ui";

export default function BankQrPanel({ orderId }: { orderId: string }) {
  const [data, setData] = useState<BankQrDetails | null>(null),
    [error, setError] = useState(""),
    [imageError, setImageError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    setImageError(false);
    orderService
      .bankQr(orderId)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [orderId, retry]);
  if (error)
    return (
      <div className="mt-4 text-sm text-red-700" role="alert">
        {error}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setRetry((n) => n + 1)}
        >
          Tải lại QR
        </Button>
      </div>
    );
  if (!data)
    return <p className="mt-4 text-sm">Đang tạo mã QR theo đơn hàng...</p>;
  if (!data.configured)
    return (
      <p className="mt-4 text-sm">
        Chưa cấu hình tài khoản nhận tiền. Bạn vẫn có thể thử nút xác nhận demo.
      </p>
    );
  return (
    <div className="mt-5 rounded-2xl border border-[#d8e3d3] bg-white p-4">
      <p className="text-center text-sm font-semibold">
        Quét QR bằng ứng dụng ngân hàng
      </p>
      {imageError ? (
        <p role="alert" className="my-4 text-sm text-amber-800">
          Không tải được ảnh QR. Hãy kiểm tra kết nối hoặc dùng thông tin nhận
          tiền bên dưới.
        </p>
      ) : (
        <img
          key={`${orderId}-${retry}`}
          src={data.qrUrl}
          alt={`QR chuyển khoản ${data.amount} đồng cho đơn ${data.content}`}
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
          className="mx-auto my-3 w-full max-w-64"
        />
      )}
      {imageError && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setRetry((n) => n + 1)}
        >
          Thử tải lại QR
        </Button>
      )}
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-[#837167]">Ngân hàng</dt>
          <dd className="font-semibold">{data.bankName}</dd>
        </div>
        <div>
          <dt className="text-[#837167]">Số tài khoản</dt>
          <dd className="break-all font-semibold">{data.accountNumber}</dd>
        </div>
        <div>
          <dt className="text-[#837167]">Chủ tài khoản</dt>
          <dd className="break-words font-semibold">{data.accountName}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-5 text-amber-900">
        QR này trỏ tới tài khoản thật. Khi demo, không cần chuyển tiền; chỉ dùng
        nút xác nhận mô phỏng bên dưới. Quét QR không tự xác nhận đơn đã thanh
        toán.
      </p>
    </div>
  );
}
