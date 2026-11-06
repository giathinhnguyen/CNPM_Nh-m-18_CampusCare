# Quản trị BrewLite

Mở `http://localhost:5173/login` cho cả khách hàng và quản trị viên. Sau đăng nhập, tài khoản ADMIN được chuyển tới `/admin/ingredients`; tài khoản CUSTOMER trở về trang khách hàng. Đường dẫn cũ `/admin/login` chuyển về `/login`. Trang khách không có liên kết quản trị. Các màn hình `/admin/*` nằm ngoài Layout khách hàng, không có thanh menu, giỏ hàng hay footer của khách. Giao diện theo màu sắc và bố cục `wweb/src/pages/AdminPage.tsx`, sử dụng dữ liệu thật.

## Tài khoản phát triển

```powershell
docker compose up -d
docker compose exec -T api pnpm --filter api exec tsx prisma/seed-admin.ts
docker compose restart api
```

Seed tạo `admin@brewlite.test`, mật khẩu thử `BrewLite@Admin2026!`. Không chạy ở production, không nâng quyền tài khoản khách trùng email và không đặt lại mật khẩu của admin đã có. Không có chức năng đăng ký admin công khai.

## Chức năng

- Nguyên liệu: xem tồn thực tế/đang giữ/khả dụng, giá trị tồn và cảnh báo; thêm nguyên liệu, sửa thông tin, kiểm kê tồn, bật/tắt. Không giảm tồn xuống dưới lượng đang giữ. Không đổi đơn vị của nguyên liệu đã được dùng trong công thức hoặc còn tồn.
- Khách hàng: tìm theo tên/email, xem điểm khả dụng/đang giữ, 100 đơn gần nhất. Danh sách giới hạn 500 khách mới nhất. Không cung cấp sửa điểm hoặc nâng quyền từ giao diện này.
- Sản phẩm: thêm/sửa tên, mô tả, ảnh, danh mục, giá, bật/tắt; chỉnh công thức và giá cộng thêm riêng cho S/M/L. Món mới chưa có công thức sẽ chưa bán được. Chỉ NL011 được điều chỉnh theo mức đường. Đơn đã đặt tiếp tục dùng snapshot cũ.
- Khuyến mãi: thêm/sửa mã, phần trăm hoặc số tiền, đơn tối thiểu, giảm tối đa, ngày hiệu lực và trạng thái. Mã mới áp dụng toàn menu; sửa mã hiện có giữ nguyên phạm vi sản phẩm đã cấu hình.

API `/api/admin/*` kiểm tra JWT và quyền ADMIN hiện tại trong database trên mỗi yêu cầu. Cả hai loại tài khoản dùng `/api/auth/login` và một phiên `brewlite_access_token`. Quyền được lấy từ database, không nhận quyền do người dùng tự gửi. Đăng xuất trong quản trị cũng kết thúc phiên chung. Không có API đăng nhập quản trị riêng. Chỉ ẩn giao diện không thay thế kiểm tra quyền ở backend.

Các form gửi thời điểm cập nhật để phát hiện chỉnh sửa đồng thời. Kho khóa bản ghi và kiểm tra lại tồn đang giữ trong transaction. Đây là chức năng kiểm kê trực tiếp; chưa có phiếu nhập/xuất, lịch sử chỉnh sửa hoặc quản lý lô/hạn dùng.

## Phần thanh toán tiếp theo

Đồ án hiện dùng chuyển khoản mô phỏng: bật `BANK_TRANSFER_DEMO_ENABLED=true` ở môi trường phát triển. Khách tạo đơn rồi nhấn “Xác nhận đã chuyển khoản”; hệ thống cập nhật kho/điểm và ghi giao dịch `DEMO-...`. Lịch sử đơn phía khách và quản trị đều có nhãn mô phỏng. Không cần merchant VNPay để trình diễn luồng này. Chi tiết tại [hướng dẫn thanh toán demo](inventory-checkout.md#chuyển-khoản-demo-cho-đồ-án).

Nếu tiếp tục tích hợp thanh toán qua cổng, thực hiện:

1. Cấu hình merchant VNPay sandbox trong `.env`: `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL`. Khởi tạo lại API bằng `docker compose up -d api` để nhận biến mới.
2. Chuẩn bị địa chỉ HTTPS công khai cho backend và cấu hình IPN `/api/payments/vnpay/ipn` với VNPay; return URL phải quay về `/payments/return` của frontend.
3. Thử giao dịch thực trên sandbox: thành công, thất bại, đóng trình duyệt, thanh toán lại và phản hồi muộn. Đối chiếu trạng thái đơn, giao dịch, điểm và kho. Các test tự động với chữ ký giả lập không thay thế lượt thử này.
4. Bổ sung màn hình đối soát đơn/thanh toán cho quản trị: giao dịch chờ, `needsReview`, kết quả QueryDR, xử lý thanh toán đến muộn và quy trình hoàn tiền. Hiện bốn màn hình theo wweb chưa có nghiệp vụ hoàn tiền hay đối soát quản trị.

Không chuyển sang merchant thật trước khi hoàn tất các lượt kiểm thử sandbox. Hướng dẫn kho và VNPay chi tiết tại [inventory-checkout.md](inventory-checkout.md).
