# Xác thực và bảo vệ truy cập (CV4)

- Trang công khai: `/`, `/products/:id`, `/login` và danh sách sản phẩm đổi điểm.
- Trang riêng tư hiện có: `/account`, dùng `ProtectedRoute`. Chờ khôi phục phiên trước khi quyết định chuyển trang. Khách được chuyển tới `/login`; đăng nhập email hoặc Google xong sẽ quay về đường dẫn đã yêu cầu.
- Token lưu bằng khóa `brewlite_access_token`. Frontend dùng `exp` để kết thúc phiên đúng hạn; backend vẫn là nơi xác minh chữ ký và tài khoản. Khi tab được kích hoạt lại, frontend kiểm tra thời hạn một lần nữa.
- Các service gọi API riêng tư phải dùng `authenticatedFetch` từ `src/services/session.ts`: tự gắn Bearer token, xóa phiên khi nhận `401`. `403`, lỗi mạng và lỗi máy chủ không xóa token. Phản hồi từ token cũ không xóa phiên mới. Thay đổi đăng nhập/đăng xuất ở tab khác sẽ tải lại phiên.
- `AuthGuard` xác minh JWT HS256, thời hạn, UUID người dùng và sự tồn tại của tài khoản. `/auth/me` và controller `users`, `orders`, `payments` dùng guard. Ba controller nghiệp vụ này hiện chưa có endpoint; không có API đặt hàng/thanh toán giả được thêm vào CV4.

## Khi bổ sung đơn hàng, thanh toán và điểm thưởng cá nhân

Đặt các route frontend riêng tư bên trong `ProtectedRoute` trong `App.tsx`. Backend lấy danh tính từ `request.user.id`, không lấy từ `userId` do client gửi. Mọi truy vấn/sửa đơn hàng, thanh toán, lịch sử và điểm thưởng phải ràng buộc với người dùng này. Guard chỉ xác minh danh tính, không thay thế điều kiện quyền sở hữu trong truy vấn.

Danh sách sản phẩm đổi điểm vẫn công khai; endpoint điểm cá nhân và đổi thưởng cần `@UseGuards(AuthGuard)`. Callback của nhà cung cấp thanh toán cần xác minh chữ ký riêng; không đặt dưới guard JWT khách hàng nếu callback không có JWT.

## Kiểm tra

- `pnpm --filter api test`: kiểm tra token thiếu/sai/hết hạn, tài khoản bị xóa, lỗi database.
- `pnpm --filter web test`: Node.js 24+, kiểm tra thời hạn token, gắn Authorization, xử lý 401/403/lỗi mạng và phản hồi từ phiên cũ.
- `pnpm --filter web build` và `pnpm --filter api build`.
- Kiểm tra trình duyệt: mở `/account` khi chưa đăng nhập; đăng nhập và quay lại `/account`; tải lại trang; đăng xuất; thử token sai/hết hạn; kiểm tra tab khác khi đăng xuất. Thử cả email và Google với database/Google Client ID đã cấu hình.

Đăng xuất hiện xóa token ở client. JWT đã được sao chép vẫn có hiệu lực tới hết hạn; project chưa có cơ chế thu hồi token phía server.
