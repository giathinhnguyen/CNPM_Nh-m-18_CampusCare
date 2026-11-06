# Kiểm thử Payment — 04/11/2026

## Kết quả chạy lại

- Backend: 63/63 unit tests đạt; 41/41 integration tests đạt (15 test checkout/kho/thanh toán).
- Frontend: 23/23 tests đạt. Build API và web thành công.
- Giao diện đã kiểm tra với API giả lập: thành công/thất bại về hóa đơn; đang chờ/cần đối soát ở lại trang kết quả. Đây không phải giao dịch VNPay sandbox thực tế.
- Lint toàn API vẫn chưa đạt: `src/main.ts` gọi `bootstrap()` không xử lý Promise; còn cảnh báo ở giỏ hàng và test. Cảnh báo ép kiểu chữ ký trong gateway đã sửa bằng kiểm tra kiểu string.

## Những điểm cần biết khi nhóm test

1. Chỉ có QR chuyển khoản mô phỏng và thẻ nội địa VNPay sandbox. Nút xác nhận chuyển khoản không xác minh giao dịch ngân hàng thật.
2. Máy local chưa có IPN công khai. Nếu đóng trang VNPay trước khi quay về, hệ thống phụ thuộc QueryDR; trước đây sandbox trả lỗi 99, nên đơn có thể tiếp tục chờ đối soát. Chưa xác nhận dịch vụ này đã hoạt động lại bằng giao dịch thực tế.
3. Return có chữ ký hợp lệ xử lý trực tiếp thành công và hủy (mã 24). Các lỗi VNPay khác đi qua đối soát, nên có thể chưa hiện thất bại ngay khi QueryDR lỗi.
4. Thất bại giữ nguyên liệu đến hạn giữ đơn để thử lại; món được trả lại giỏ khi hủy/hết hạn, không ngay lúc thất bại. Cần thống nhất điều này nếu yêu cầu môn học đòi giữ giỏ ngay khi thất bại.
5. Token hết hạn phải đăng nhập lại để xem hóa đơn, nhưng không ngăn máy chủ xử lý kết quả VNPay đã ký.

## Sau khi checkout nhánh Payment

Chạy tại thư mục gốc, Docker Desktop đang bật:

```powershell
pnpm.cmd install --frozen-lockfile
docker compose up -d
docker compose exec -T api pnpm --filter api exec prisma migrate deploy
docker compose exec -T api pnpm --filter api exec prisma generate
docker compose restart api
docker compose exec -T api pnpm --filter api test:e2e
```

Các test tích hợp tạo dữ liệu riêng rồi dọn dẹp; chạy trên database phát triển/test. `.env` phải tự cấu hình theo `.env.example`; không lấy merchant secret hoặc JWT secret từ GitHub. Bật `BANK_TRANSFER_DEMO_ENABLED=true` cho môi trường development; sửa biến môi trường thì chạy `docker compose up -d --force-recreate api`. VNPay cần mã merchant, hash secret riêng và Return URL đúng origin web đang dùng.

## Test API bằng Postman

Import `docs/api/BrewLite-Payment.postman_collection.json`. Collection dùng `http://localhost:3000/api`; chưa tích hợp Swagger nên không có trang `/api/docs` từ bộ này.

1. Trong Variables, điền `email`, `password` của tài khoản khách test ở máy bạn. Gửi **Login**; token được lưu tự động vào collection local. Không export/chia sẻ token hay mật khẩu đã điền.
2. Gửi **Current user**, **Payment config**, **List orders** để kiểm tra phiên đăng nhập và cấu hình.
3. Trên web, tạo một đơn mới, chọn chuyển khoản nhưng chưa xác nhận. Sao chép UUID đơn từ URL vào biến `orderId`. Không dùng mã đơn hiển thị thay UUID. Gửi **Order detail** để kiểm tra đúng đơn của tài khoản này.
4. Gửi **Demo failure** → phải có `PAYMENT_FAILED`; gửi lại cùng request → không thêm giao dịch thất bại. Gửi **Retry** → `PENDING_PAYMENT`; gửi **Demo success** → `PAID`; gửi lần nữa → không trừ kho/cộng điểm lần hai.
5. Với đơn mới khác, gửi **Cancel order** → `CANCELLED`. Với đơn chưa thanh toán khác nữa, gửi **Create VNPay card payment**, mở `paymentUrl` trong trình duyệt. Chạy riêng đường thành công và đường hủy rồi kiểm tra hóa đơn, **Order detail**.
6. Các request trong nhóm **Negative checks** kiểm tra thiếu token (401), body sai (400), chữ ký giả (400 khi VNPay đã cấu hình). Không tự tạo chữ ký thành công bằng secret merchant để giả làm kết quả ngân hàng.
7. Muốn kiểm tra quyền sở hữu: dùng token tài khoản khác và UUID đơn hiện tại; GET chi tiết phải trả 404. Muốn kiểm tra số tiền bị sửa: dùng test tích hợp đã có, hoặc tạo đơn qua API với `expectedAmount` sai và kiểm tra bị từ chối.

`failureKey` và `paymentKey` tự sinh một lần để kiểm tra gửi lặp. Khi đổi sang đơn mới, xóa giá trị hai biến này trước khi gửi. Không chạy cả collection bằng Runner: các nhánh thành công, hủy và VNPay cần đơn riêng; mỗi request có thể thay đổi dữ liệu.

## Checklist nghiệm thu thủ công

- Chuyển khoản thất bại → chỉ một thông báo lớn trên hóa đơn; thử lại chọn được phương thức.
- VNPay thành công/hủy → tự về đúng hóa đơn; hủy không cộng điểm/trừ kho thực tế.
- Refresh URL Return hoặc gửi lại callback → không xử lý trùng.
- Đơn hết hạn không trả thêm tiền; giao dịch đến muộn cần đối soát.
- Đổi số điện thoại hợp lệ giữa hai đơn vẫn tạo đơn được.
- Đơn của người khác không đọc/xác nhận/hủy được.

Các bài tự động không thay thế kiểm thử sandbox thực tế và không chứng minh toàn hệ thống không còn lỗi.
