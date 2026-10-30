# Đề xuất bổ sung tích hợp giỏ hàng và khuyến mãi — chờ duyệt

Trạng thái: người dùng đã duyệt triển khai sau phần giải thích về đồng bộ giỏ. Đây là bản đề xuất gốc; các điều chỉnh theo yêu cầu đặt backend trong khuyến mãi và báo cáo thực hiện nằm ở `docs/reports/cart-promotions-additive.md`.

## 1. Những phần được tái sử dụng

- Giữ nguyên `carts.controller.ts`, `carts.service.ts`, `carts.dto.ts`, `carts.module.ts` và `ProductPage.tsx`.
- Dùng lại `CartsService.syncCart()` để gộp món, cộng số lượng và giới hạn theo tồn kho; không viết lại thuật toán gộp.
- Dùng lại `CartsService.getCart()` để trả giỏ tài khoản.
- Dùng lại `PATCH /api/cart/items/:id` với `isSelected` để lưu lựa chọn. API này đã có, không cần bổ sung `/cart/selection`.
- Dùng lại `promotionService.quote()` và `POST /api/promotions/quote`. API đã hỗ trợ tính giá không có mã, giá bao gồm topping và kiểm tra điều kiện mã.
- Dùng lại `guestCartSync.ts`, bảng `CartSync` và migration đã có. Không tạo bảng hoặc migration trùng; không reset database.
- Giữ các hàm thêm món, đổi số lượng, xóa món, ghi chú của frontend.

## 2. File mới dự kiến thêm

### Backend: `apps/api/src/cart-sync/`

- `cart-sync.dto.ts`: request riêng `{ syncId, items }`; tái sử dụng kiểu món từ `AddToCartDto`. Không sửa DTO gốc.
- `cart-sync.controller.ts`: thêm `POST /api/cart/sync-once`, dùng `AuthGuard` hiện có. Endpoint `/api/cart/sync` hiện tại được giữ nguyên để tránh thay đổi hợp đồng API của nhóm.
- `cart-sync.service.ts`: kiểm tra request, giữ transaction và biên nhận chống gộp trùng. Lớp bổ sung sẽ gọi thuật toán `CartsService.syncCart()` hiện có với Prisma client của transaction; không gọi Prisma gốc bên ngoài transaction để gộp món. Khi replay cùng lô, chỉ đọc lại giỏ; payload khác với cùng ID bị từ chối. Lưu biên nhận và món cùng transaction.
- `cart-sync.module.ts`: đăng ký controller/service mới và tái sử dụng module hiện có.

Lớp mới kiểm tra ID, số lượng, quan hệ sản phẩm–size và topping trước khi giao cho hàm gộp cũ. Không thay đổi cách gộp món theo ghi chú của hàm cũ. Những giới hạn tồn kho đã có vẫn do hàm cũ xử lý và trả cảnh báo.

### Frontend

- `apps/web/src/hooks/useCartPromotion.ts`: quản lý mã, trạng thái đang kiểm tra, lỗi và kết quả API. Chỉ kết quả khớp các món/số lượng/topping/tài khoản hiện tại mới được hiển thị; hủy hoặc bỏ qua response cũ. Đổi giỏ sẽ kiểm tra lại. Có thao tác bỏ mã, thử lại và kiểm tra lại trước khi tiếp tục.
- `apps/web/src/services/cartIntegrationService.ts`: lưu lựa chọn qua PATCH hiện có hoặc cờ localStorage cho khách; tái sử dụng `authenticatedFetch`. Nếu lưu lỗi một phần, báo lỗi và tải lại trạng thái thực tế, không báo thành công toàn bộ.

## 3. File có sẵn cần sửa — phải được duyệt trước

### A. `apps/api/src/app.module.ts`

Chỉ thêm import `CartSyncModule` và một mục trong `imports`. Không thay thế module giỏ hàng hoặc module khuyến mãi.

### B. `apps/web/src/services/cartService.ts`

Chỉ sửa phần đồng bộ bên trong `getCart()`:

1. Thêm import `syncGuestCart` và cách xác định tài khoản từ token hiện có.
2. Thay khối dùng `isSyncing` và xóa localStorage trước khi gửi bằng lời gọi helper hiện có; gửi tới endpoint mới `/cart/sync-once`.
3. Giữ đoạn lưu `brewlite_sync_warnings` để trang tiếp tục hiển thị cảnh báo như cũ.
4. Bỏ biến `isSyncing` vì helper đã chia sẻ request đang chạy.
5. Khi đồng bộ hoặc tải giỏ tài khoản thất bại, trả lỗi cho trang thay vì tiếp tục hiển thị giỏ khách như một kết quả thành công.

Giữ nguyên các hàm `addToCart`, `updateQuantity`, `removeItem`, `updateNote`; không đổi cách tính giá giỏ khách hay tự thêm tải lại danh mục.

Lý do phải thay một khối: nếu chỉ thêm lời gọi mới nhưng vẫn chạy khối đồng bộ cũ, giỏ có thể bị gửi hai lần hoặc bị xóa trước khi nhận xác nhận.

### C. `apps/web/src/pages/CartPage.tsx`

Chỉ chỉnh các điểm nối, giữ bố cục và các handler thêm/giảm số lượng, xóa, ghi chú hiện có:

1. Thêm import hook và helper mới; bỏ import `getPromotion/getPromotionDiscount` ở trang này vì dữ liệu cố định không kiểm tra được hiệu lực từ database. Không xóa file dữ liệu dùng chung.
2. Kết nối state mã/lỗi với hook; hook nhận các món được chọn còn khả dụng và tài khoản hiện tại. Không thay toàn bộ component.
3. Lấy tạm tính/giảm giá/tổng từ kết quả API khớp giỏ hiện tại. Trong lúc chờ hoặc khi lỗi, không dùng lại khoản giảm cũ và chặn tiếp tục.
4. Đổi riêng `submitPromo` sang gọi hook kiểm tra API; chỉ hiện thành công khi API xác nhận.
5. Bổ sung bỏ mã, trạng thái đang kiểm tra và thử lại ngay tại khối mã hiện có; giữ kiểu trình bày của các component UI.
6. Bổ sung lưu lựa chọn trong `toggleItem/toggleSelectAll` qua helper; khi tải giỏ, đọc `isSelected` và giữ cả trường hợp không chọn món nào. Không coi danh sách rỗng là yêu cầu tự chọn tất cả.
7. Bổ sung chờ khôi phục đăng nhập trước khi tải giỏ và xử lý lỗi tải với nút thử lại. Không hiển thị lỗi tải thành giỏ rỗng.
8. Trong `handleProceedToCheckout`, gọi kiểm tra lại giá/mã trước, lưu lựa chọn và mã hợp lệ; xóa mã lưu cũ khi đã bỏ mã. Khách đăng nhập được quay lại `/cart` qua `state.from` đã được LoginPage hỗ trợ. Đề xuất tài khoản đã đăng nhập nhận thông báo chưa có chức năng đặt hàng thay vì chuyển tới `/checkout` chưa tồn tại; điểm thay đổi điều hướng này cũng cần duyệt.
9. Bổ sung điều kiện `disabled` cho nút tiếp tục khi đang kiểm tra, đang cập nhật món hoặc có lỗi. Không đổi điều kiện tồn kho trong handler số lượng.

### D. Test và tài liệu có sẵn

- `apps/api/test/cart-promotions.e2e-spec.ts`: điều chỉnh bài test bổ sung trước đó để kiểm tra lớp sync mới và API PATCH lựa chọn hiện có, thay vì gọi các hàm đã bị hoàn tác khỏi `CartsService`. Không sửa test nghiệp vụ gốc của nhóm để ép kết quả qua.
- `docs/promotions.md`: thay các mô tả `/cart/selection` và sync cũ bằng hợp đồng API của phương án được duyệt; ghi rõ phần đã có và phần chưa triển khai.
- Thêm test cho lớp sync và hook/helper theo hành vi: lỗi mạng giữ giỏ, retry không cộng trùng, mã hết hiệu lực, giỏ xuống dưới điều kiện, response cũ, chọn rỗng và đổi tài khoản.

## 4. Giới hạn cần hiểu trước khi duyệt

- Transaction/biên nhận mới chống gộp trùng cho endpoint mới. Không tuyên bố mọi thao tác giỏ đều được khóa: endpoint thêm/cập nhật/xóa và sync cũ vẫn dùng code gốc; khóa trong endpoint mới không tự chặn những endpoint không tham gia cùng cơ chế khóa.
- Lưu lựa chọn bằng các PATCH có sẵn không phải một thao tác nguyên tử cho toàn bộ giỏ. Nếu muốn API cập nhật lựa chọn nguyên tử, cần một đề xuất bổ sung riêng.
- Kiểm tra sản phẩm–size và topping tại lớp sync/quote không tự sửa được lỗ hổng tương tự trong endpoint thêm món gốc. Muốn sửa endpoint đó phải báo riêng và được duyệt.
- Tính giá API chỉ là báo giá, không giữ giá/tồn kho. Chưa xây dựng đơn hàng, thanh toán hoặc tự đặt quy tắc tích điểm.
- Các file source giỏ hàng gốc vẫn được giữ nguyên cho tới khi các chỉnh sửa B/C được duyệt; không tự chạy formatter cho toàn bộ file hoặc repo.

## 5. Kiểm tra sau khi được duyệt và triển khai

1. Xem diff theo từng file để đảm bảo không có thay thế toàn bộ file hoặc đổi định dạng ngoài phạm vi.
2. Chạy build backend/frontend và test hiện có cùng test mới phù hợp.
3. Kiểm thử PostgreSQL trong transaction rollback: sync replay, payload khác cùng ID, lỗi giữa lô và mã theo giỏ đã chọn.
4. Kiểm thử UI: 177.000đ với PICKUP15 giảm 26.550đ; giảm giỏ xuống 118.000đ thì mất khoản giảm; tải lại giữ lựa chọn; mã được kiểm tra lại sau đăng nhập/gộp giỏ.

Chỉ triển khai các chỉnh sửa trên sau khi người dùng duyệt. Phát sinh ngoài danh sách này phải báo lại trước khi sửa.
