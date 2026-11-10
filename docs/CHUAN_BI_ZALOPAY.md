# ZaloPay QR sandbox — BrewLite, 10/11/2026

## Test nhanh trên máy hiện tại

Đã cấu hình `.env` local bằng tài khoản sandbox mẫu **App ID 2554** từ [mã mẫu chính thức ZaloPay](https://github.com/zalopay-samples/quickstart-nextjs-dynamic-qrcode/blob/main/next.config.js). Đây là tài khoản test công khai dùng chung, không phải tài khoản nhận tiền của nhóm. Không dùng nó cho thanh toán thật. Bộ khóa chỉ ở `.env` backend, không đưa vào frontend hoặc Git.

Đã gọi API sandbox thật để tạo yêu cầu chưa thanh toán và nhận `return_code=1`; URL trả về thuộc `qcgateway.zalopay.vn`. Việc tạo link thành công chưa chứng minh thanh toán trên điện thoại đã hoàn tất.

1. Mở [trang tải ZaloPay Sandbox chính thức](https://docs.zalopay.vn/vi/docs/developer-tools/test-instructions/test-wallets/). Trang này đã trả HTTP 200 khi kiểm tra từ máy bạn.
2. Cài đúng bản sandbox cho Android/iOS. Đăng ký ví test; tài liệu ghi mã xác minh **111111**. Nạp số dư thử nghiệm theo hướng dẫn trên trang đó.
3. Bật Docker Desktop, chạy `docker compose up -d`. Truy cập `http://localhost:5173`, đăng nhập khách hàng, chọn món trong giỏ và đến checkout.
4. Chọn **Ví ZaloPay**, xác nhận đặt hàng. QR xuất hiện ngay trên hóa đơn; mở ứng dụng **ZaloPay Sandbox** để quét và chấp nhận thanh toán bằng số dư test.
5. Trang hóa đơn kiểm tra kết quả mỗi 6 giây thông qua backend. Khi máy chủ xác nhận thành công, trang tự chuyển sang hóa đơn thành công. Không có nút khách tự ép kết quả.

Không dùng ứng dụng ngân hàng/ ví thật để thử QR sandbox. Việc cài ví, đăng nhập và quét trên điện thoại cần người trong nhóm thực hiện; chưa được xác minh bằng điện thoại trong lượt tích hợp.

## Cấu hình cho máy khác

```dotenv
ZALOPAY_APP_ID=
ZALOPAY_KEY1=
ZALOPAY_KEY2=
ZALOPAY_RETURN_URL=http://localhost:5173/payments/zalopay/return
ZALOPAY_CALLBACK_URL=
```

Nhóm có thể lấy bộ test mẫu từ mã nguồn chính thức ở trên hoặc dùng App ID/Key1/Key2 sandbox được ZaloPay cấp riêng. Khóa phải cùng một bộ; không dùng khóa của cổng khác. `.env` local không được push lên GitHub.

`ZALOPAY_CALLBACK_URL` có thể để trống khi test local: backend chủ động gọi API query. Khi deploy/tunnel, dùng `https://TEN-MIEN-API/api/payments/zalopay/callback`. Callback công khai giúp nhận kết quả ngay cả khi khách đóng trang.

Sau khi pull code hoặc sửa `.env`:

```powershell
pnpm.cmd install --frozen-lockfile
docker compose up -d
docker compose exec -T api pnpm install --frozen-lockfile
docker compose exec -T api pnpm --filter api exec prisma migrate deploy
docker compose exec -T api pnpm --filter api exec prisma generate
docker compose up -d --force-recreate api
```

Kiểm tra `http://localhost:3000/api/payments/config`: `zalopayConfigured: true`. Giá trị này chỉ kiểm tra đủ cấu hình; tạo QR mới xác minh được kết nối và khóa. Trang vẫn có thẻ nội địa VNPay sandbox độc lập.

## Luồng code để vấn đáp

- `zalopay.gateway.ts`: chỉ gọi `https://sb-openapi.zalopay.vn/v2/create` và `/query`. Ký yêu cầu bằng Key1; xác minh callback/redirect bằng Key2.
- Mã `app_trans_id` là `YYMMDD_UUID32`, tối đa 39 ký tự; ngày tính theo giờ Việt Nam và được giữ cố định cho mỗi giao dịch.
- `zalopay-payments.service.ts`: lấy giá từ đơn, lưu giao dịch trước khi gọi mạng, chống tạo trùng, kiểm tra số tiền/tham chiếu, dùng transaction và khóa khách hàng để xử lý kho/điểm một lần.
- QR được tạo bằng thư viện trong backend từ URL sandbox, không gửi dữ liệu đơn sang website tạo QR bên thứ ba. Endpoint QR yêu cầu JWT và đúng chủ đơn.
- Callback phải có `type=1`, `data` nguyên vẹn và MAC đúng. Thành công trả HTTP 200 với `{ return_code: 1 }`; chữ ký sai trả `{ return_code: 2 }`.
- Redirect có checksum hợp lệ chỉ dùng để nhận diện giao dịch; nếu chưa có kết quả, backend query ZaloPay. Không coi `status=1` do trình duyệt gửi là bằng chứng đã nhận tiền.
- Query thành công, số tiền và mã giao dịch khớp → Payment SUCCESS, Order PAID, trừ kho và cộng điểm một lần. IPN/redirect/polling gửi lặp không xử lý lại.
- Query đang chờ hoặc lỗi cấu hình/mạng → giữ PENDING, không cho đổi cổng khi chưa rõ kết quả. Số dư không đủ chưa chắc là thất bại cuối cùng vì khách có thể nạp ví rồi trả tiếp.
- Query xác nhận QR hết hạn (`return_code=2`, `sub_return_code=-54`) → FAILED; không phụ thuộc `is_processing`, vì sandbox thực tế có thể vẫn trả true cho đơn hết hạn. Nếu đơn hết hạn thì giải phóng kho/điểm theo luồng EXPIRED. Query mã 4 được ghi nhận từ sandbox sau khi hủy thành công và được xử lý là FAILED. Thành công quá hạn hoặc sau thất bại đã chốt được đánh dấu `needsReview`, không tự hoàn tất đơn.

**Hủy màn hình ví không nhất thiết hủy QR.** Vì QR có thể còn được thanh toán, BrewLite chờ kết quả query cuối cùng thay vì cho trả tiếp qua cổng khác ngay. VNPay thẻ vẫn xử lý hủy theo phản hồi ký hợp lệ của VNPay như trước.

Nút **Hủy đơn** trên BrewLite dùng `POST /api/payments/orders/:id/cancel`: backend kiểm tra kết quả rồi gọi `/v2/cancel` của ZaloPay. Chỉ sau khi cổng xác nhận hủy hoặc đã hết hạn mới hủy đơn và hoàn kho/điểm. Nếu tiền đã được trả trong lúc hủy, đơn cập nhật PAID; lỗi mạng không được coi là hủy thành công. Đã xác minh create/cancel/query trên sandbox thật bằng yêu cầu test riêng.

Trang lịch sử và chi tiết tự tải trạng thái; tới hạn, giao diện hiển thị hết thời gian thanh toán ngay và ẩn QR/nút trả tiền. Backend đối soát và chuyển EXPIRED khi xác nhận chưa thanh toán, không dùng thời gian phía trình duyệt để tự kết luận giao dịch thất bại.

ZaloPay yêu cầu thời hạn tạo QR tối thiểu 300 giây. Nếu đơn chỉ còn dưới 5 phút, hãy hủy đơn chưa có giao dịch rồi đặt lại; hệ thống không kéo dài thời gian giữ kho để tạo QR.

## Gỡ tích hợp cũ và triển khai sau

Đã gỡ mã nguồn, endpoint, cấu hình và hướng dẫn tích hợp ví cũ; VNPay chỉ nhận `channel=card` và luôn dùng `VNBANK`. Migration đã áp dụng trong database được giữ nguyên để không làm sai lịch sử Prisma; nó không bật lại phương thức đã gỡ.

Khi deploy: đặt `VITE_API_URL` và `VITE_GOOGLE_CLIENT_ID` lúc build, `WEB_ORIGIN` theo domain web, Return URL theo frontend HTTPS và Callback URL theo backend HTTPS. Chạy migration và giữ khóa ở biến môi trường backend. Các cờ xác nhận thanh toán demo chỉ dành cho development/test.

## Tài liệu chính thức

Kiểm tra local: 81/81 unit tests đạt với `--testTimeout=15000 --maxWorkers=1` (lượt mặc định có 2 test auth timeout 5 giây); 52/52 integration tests, 23/23 frontend tests đạt. Build API/web và lint các file thanh toán thay đổi đạt. Gateway trong Docker đã gọi create/query ZaloPay thật thành công; chưa xác minh thao tác quét và trả tiền test trên điện thoại.

Trình duyệt với API giả lập đã kiểm tra: QR xuất hiện ngay trên hóa đơn, polling tự cập nhật thành công, thẻ chuyển đúng VNPay, redirect thành công/thất bại về hóa đơn và trạng thái chờ không bị báo thành công.

- [Ví kiểm thử](https://docs.zalopay.vn/vi/docs/developer-tools/test-instructions/test-wallets/)
- [QR động](https://docs.zalopay.vn/docs/guides/payment-acceptance/qrcode/dynamic-qr/)
- [Tạo đơn](https://docs.zalopay.vn/vi/docs/specs/order-create/)
- [Truy vấn](https://docs.zalopay.vn/vi/docs/specs/order-query/)
- [Callback](https://docs.zalopay.vn/vi/docs/specs/callback-api/)
- [Mã trạng thái](https://docs.zalopay.vn/docs/developer-tools/knowledge-base/status-codes/)
