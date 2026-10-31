# Báo cáo bổ sung giỏ hàng và khuyến mãi

Triển khai sau khi người dùng duyệt phần giải thích: "ok mình đã hiểu ý bạn, giờ hãy bắt đầu làm đi nhe". Giữ công nghệ hiện tại; không viết lại các file nghiệp vụ giỏ hàng của nhóm.

## Cập nhật vị trí file ngày 31/10/2026

Theo yêu cầu sắp xếp lại trách nhiệm chức năng, đã chuyển nguyên controller/service đồng bộ sang `apps/api/src/carts/` và DTO sang `apps/api/src/carts/dto/cart-sync.dto.ts`. Chuyển đăng ký sang `CartsModule`, sửa import trong service, DTO và test. Không thay thuật toán gộp, cơ chế biên nhận, URL `/api/cart/sync-once` hay cấu trúc request/response; không thay schema hoặc migration. Các mục phía dưới ghi lại lần triển khai ban đầu, khi file còn ở `promotions`.

Backend giỏ hàng chịu trách nhiệm gộp/chống đồng bộ trùng; backend khuyến mãi chịu trách nhiệm danh sách mã và báo giá. Frontend `useCartPromotion.ts`, `promotionService.ts` và các service giỏ hàng giữ vị trí hiện tại trong `hooks/`, `services/`; không di chuyển thêm vì đã được tách theo chức năng. `CartsController`, `CartsService`, `carts.dto.ts` gốc không đổi; `carts.module.ts` được bổ sung đăng ký hai lớp đồng bộ.

Kiểm tra riêng cho lần di chuyển: backend build và kiểm tra TypeScript toàn API thành công; 20 test khuyến mãi và cả hai bài kiểm thử PostgreSQL đều qua.

## Các file của nhóm được giữ nguyên

Đã đối chiếu bằng `git diff HEAD --exit-code`:

- `apps/api/src/carts/carts.controller.ts`
- `apps/api/src/carts/carts.service.ts`
- `apps/api/src/carts/carts.dto.ts`
- `apps/api/src/carts/carts.module.ts`
- `apps/web/src/pages/ProductPage.tsx`
- `apps/api/src/app.module.ts`

## File backend bổ sung trong khuyến mãi

- `apps/api/src/promotions/dto/cart-sync.dto.ts`: mô tả `{ syncId, items }`, dùng lại `AddToCartDto`.
- `apps/api/src/promotions/cart-sync.controller.ts`: thêm `POST /api/cart/sync-once`, dùng `AuthGuard` hiện có, trả HTTP 200. Không thay endpoint gốc.
- `apps/api/src/promotions/cart-sync.service.ts`: kiểm tra đầu vào và sản phẩm–size/topping còn khả dụng; khóa các lần sync mới theo tài khoản; kiểm tra biên nhận rồi gọi lại nguyên `CartsService.syncCart()`. Service gốc được tạo với client transaction để việc gộp món và lưu biên nhận cùng thành công hoặc cùng rollback. Không sao chép thuật toán gộp.

`CartSync` và migration `20261030000100_cart_sync_receipts` là phần bổ sung đã có từ lượt trước, được tái sử dụng. Không thêm migration trùng hoặc reset database.

## File frontend bổ sung

- `apps/web/src/hooks/useCartPromotion.ts`: giữ mã qua đăng nhập/tải lại, gọi API báo giá, kiểm tra lại khi giỏ thay đổi hoặc trang được focus, bỏ qua/hủy phản hồi cũ. Mã lỗi không được giữ khoản giảm; vẫn xin lại giá chưa giảm. Có bỏ mã, thử lại và xác nhận giá trước khi tiếp tục.
- `apps/web/src/services/cartIntegrationService.ts`: lấy ID tài khoản để nhận diện lần đồng bộ và lưu lựa chọn bằng PATCH từng món đã có. Khách chưa đăng nhập lưu cờ trong localStorage. Nếu PATCH lỗi một phần, chờ các request còn lại hoàn tất rồi báo lỗi để trang tải lại.
- `apps/web/src/services/guestCartSync.ts`: helper đã có từ lượt trước được tái sử dụng, không viết lại. Giữ dữ liệu và mã lần gửi đến khi xác nhận; không xóa giỏ khách khi lỗi mạng/server hoặc tài khoản đổi giữa chừng.

## Những đoạn trong file có sẵn đã sửa theo phạm vi duyệt

### `apps/api/src/promotions/promotions.module.ts`

Thêm hai import và đăng ký `CartSyncController`, `CartSyncService` trong hai mảng hiện có. Không tạo module riêng; vì vậy không sửa `AppModule` như đề xuất gốc.

### `apps/web/src/services/cartService.ts`

- Thêm import hai helper, bỏ biến `isSyncing` vì helper quản lý request đang gửi.
- Chỉ thay khối đồng bộ của `getCart()` bằng helper gửi tới `/cart/sync-once`. Vẫn lưu cảnh báo vào `brewlite_sync_warnings`.
- Lỗi đồng bộ/tải giỏ được đưa về trang; kiểm tra tài khoản còn khớp sau khi nhận giỏ.
- Giữ nguyên thân các hàm `addToCart`, `updateQuantity`, `removeItem`, `updateNote` và nhánh tính tiền giỏ khách. Không format lại cả file.

### `apps/web/src/pages/CartPage.tsx`

- Thay phần dùng dữ liệu khuyến mãi cố định bằng hook API; bỏ riêng import không còn dùng, giữ file dữ liệu dùng chung.
- Tạm tính, tiền giảm, tổng và giá dòng được chọn lấy từ kết quả báo giá khớp giỏ. Trong lúc chờ, không dùng khoản giảm cũ và không cho tiếp tục.
- `submitPromo` chuyển mã nhập vào hook. Bổ sung thông báo đang kiểm tra, nút thử lại và bỏ mã tại khu vực khuyến mãi sẵn có.
- Thêm helper lưu lựa chọn; `toggleItem/toggleSelectAll` gọi helper. Khi tải lại đọc `isSelected`, kể cả không chọn món nào. Không thêm endpoint chọn món.
- Bổ sung chờ khôi phục đăng nhập, nhận diện lần tải để bỏ phản hồi tải cũ, hiển thị lỗi tải và nút thử lại. Lưu lựa chọn lỗi một phần sẽ tải lại giỏ thực tế.
- Nút tiếp tục xác nhận báo giá lần nữa, lưu ID món và mã hợp lệ. Khách được dẫn tới đăng nhập với đường quay lại `/cart`; tài khoản đã đăng nhập nhận thông báo chức năng đặt hàng chưa khả dụng. Chưa tạo đơn hoặc thanh toán.
- Thêm điều kiện khóa nút khi đang lưu lựa chọn, cập nhật món, xác nhận hoặc báo giá chưa hợp lệ. Không thay thân các handler tăng/giảm số lượng, xóa món, ghi chú; không thay bố cục danh sách món.

### Test và tài liệu

- Điều chỉnh bài test bổ sung `apps/api/test/cart-promotions.e2e-spec.ts` để gọi lớp sync mới và `updateQuantity(..., isSelected)` gốc, không đòi các phương thức đã bị hoàn tác.
- Thêm `apps/web/tests/cart-integration.test.mjs`: chọn rỗng, giữ món mới từ tab khác, tái sử dụng PATCH chỉ gửi `isSelected`, xử lý lỗi một phần.
- Cập nhật `docs/promotions.md` về endpoint mới, thời điểm đồng bộ, các file được tái sử dụng và giới hạn.

## Kiểm tra và giới hạn

- Backend và frontend build thành công.
- Backend: 56 test hiện có qua, không sửa test gốc của các chức năng khác.
- Frontend: 16 test qua, gồm helper đồng bộ, gọi API khuyến mãi, lưu lựa chọn và session.
- PostgreSQL: cả hai bài `promotions.e2e-spec.ts`, `cart-promotions.e2e-spec.ts` qua; dữ liệu thử rollback.
- UI trên phiên Vite đã khởi động lại: 177.000đ + PICKUP15 giảm 26.550đ, còn 150.450đ; giảm giỏ xuống 118.000đ thì giảm 0 và chặn tiếp tục. Bỏ chọn, tải lại vẫn bỏ chọn. Món thử đã được xóa, giỏ trở lại trống như trước kiểm tra.

PATCH lựa chọn chưa nguyên tử cho toàn bộ giỏ. Khóa sync mới không tự bảo vệ các endpoint giỏ gốc không dùng cùng khóa. Những hạn chế của endpoint thêm món gốc không được sửa ngầm qua đợt này. Việc gộp ghi chú và cờ mặc định món mới giữ theo hàm gốc. Đơn hàng, thanh toán và quy tắc tích điểm vẫn cần triển khai/thống nhất riêng. Không commit hoặc push.
