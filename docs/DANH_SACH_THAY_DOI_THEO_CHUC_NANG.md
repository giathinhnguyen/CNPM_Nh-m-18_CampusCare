# Danh sách thay đổi khi gộp Codex vào admin

Ngày: 03/11/2026.

Nguồn: `codex/admin-restored-cart-compat`. Đích: `payment-administrator-ui`.
So sánh với nhánh admin tại commit `b969f9f`, trước khi khôi phục phần đã revert và gộp bản sửa.

## 1. Thành viên phụ trách giỏ hàng

### Backend

- Giữ 4 file giỏ hàng: `carts.controller.ts`, `carts.dto.ts`, `carts.module.ts`, `carts.service.ts`.
- `carts.service.ts` dùng bản giỏ gốc đã khôi phục trên Codex; `carts.dto.ts` không đổi so với admin. Các quy tắc bổ sung về kho nguyên liệu và đổi thưởng được xử lý qua `RewardsCartService`.
- `carts.controller.ts`: các API `/cart` chuyển sang gọi service an toàn dùng chung với `/rewards/cart`; giữ API tính giá `POST /cart/quote`.
- PATCH chỉ nhận `quantity`, `note`, `isSelected`. Khi xóa quà hoặc đặt số lượng về 0, service hủy lượt đổi và giải phóng điểm đang giữ trong transaction.
- `carts.module.ts` import/export `CartServicesModule` mới. Module chung cung cấp `CartsService` và `RewardsCartService`, tránh phụ thuộc vòng giữa module giỏ và đổi thưởng.
- Đồng bộ qua `/cart/sync` vẫn nhận `{ items }`; có thể gửi thêm `syncId` cố định khi thử lại. Nếu client cũ không gửi `syncId`, mỗi yêu cầu được cấp mã mới nên không có khả năng chống cộng trùng giữa các lần thử lại của client đó.

### Frontend

- `cartService.ts`: các thao tác giỏ tài khoản dùng `/rewards/cart`; đồng bộ giỏ khách qua `syncGuestCart()` thay vì xóa LocalStorage trước khi server xác nhận.
- `Layout.tsx`: thêm số lượng trên biểu tượng giỏ. Số hiển thị là tổng số ly, gồm quà; giỏ rỗng ẩn số, trên 99 hiển thị `99+`.
- `cartService.getItemCount()` chỉ đọc giỏ để cập nhật số lượng, không tự đồng bộ hay xóa giỏ khách.
- Sau khi thêm, cập nhật số lượng, xóa hoặc đồng bộ thành công, phát sự kiện `cart-updated`. Layout cũng tải lại số lượng khi đổi trang, đổi tài khoản, quay lại tab hoặc LocalStorage giỏ khách thay đổi ở tab khác.
- Luồng thanh toán hiện có đã phát `cart-updated` để cập nhật số lượng sau khi tạo đơn thành công.
- `cartIntegrationService.ts`: lưu các món được chọn qua `/rewards/cart/items/:id`.
- `guestCartSync.ts`: giữ snapshot và mã đồng bộ khi lỗi mạng; kiểm tra chủ giỏ và dùng khóa giữa các tab khi đồng bộ.

### Kiểm thử liên quan

- `apps/api/src/carts/carts.controller.spec.ts`: API cũ trả điểm đúng một lần, xóa bằng số lượng 0, không tác động giỏ người khác, chặn tăng số lượng quà, nhận dữ liệu đồng bộ cũ và chuyển báo giá sang service chung.
- `apps/web/tests/cart-integration.test.mjs`: số lượng giỏ khách cập nhật sau thao tác; đọc số lượng tài khoản không đồng bộ giỏ khách; thao tác lỗi không phát thông báo thành công.
- `apps/web/tests/guest-cart-sync.test.mjs`: giữ dữ liệu khi lỗi, thử lại cùng mã, xử lý nhiều tab và đổi tài khoản.

## 2. Thành viên phụ trách đổi thưởng và khuyến mãi

- Thêm `rewards-cart.controller.ts` và `rewards-cart.service.ts`: nhóm API `/rewards/cart` đọc giỏ, thêm/xóa/sửa món, đồng bộ và tính giá.
- `rewards.module.ts` đăng ký controller mới và import module service dùng chung.
- `RewardsCartService` bổ sung dữ liệu món thưởng trên giỏ gốc: giá quà bằng 0, điểm đổi, trạng thái hợp lệ và tồn kho nguyên liệu.
- Các món mua thường không gộp vào dòng quà; mỗi lượt đổi chỉ có một sản phẩm. Xóa quà gọi `releaseRedemption()` để giải phóng điểm đang giữ và chuyển lượt đổi sang `CANCELLED`.
- Các thay đổi giỏ qua cả hai nhóm API dùng transaction và khóa user để phối hợp với luồng đổi thưởng/đặt hàng.
- `CartQuotesService` trong thư mục carts được thay bằng `RewardsCartService.quote()`. Cả `/cart/quote` và `/rewards/cart/quote` cùng dùng logic này.
- Báo giá lấy món thuộc user từ database, kiểm tra tồn kho, chỉ tính giảm giá cho món mua thường; các dòng quà có giá 0.
- `promotionService.ts` đổi đường báo giá giỏ tài khoản sang `/rewards/cart/quote`; giỏ khách vẫn dùng `/promotions/quote`.
- `PromotionsService`, `RewardsService` và quy tắc khuyến mãi lõi không đổi so với admin tại mốc so sánh.
- Cập nhật các test `cart-promotions.e2e-spec.ts`, `rewards.e2e-spec.ts`, `promotion-service.test.mjs` để dùng lớp giỏ mới; bổ sung kiểm tra đồng bộ cùng mã không cộng trùng, rollback lô lỗi, quà và món thường tách riêng.

## 3. Thành viên phụ trách admin

- Không sửa màn hình quản trị, `AdminService`, `InventoryService`, schema hoặc migration database trong bản gộp này.
- Luồng giỏ mới tiếp tục dùng `InventoryService` có sẵn của admin để tính khả năng bán theo nguyên liệu, công thức, mức đường và đá.
- Nhánh admin có commit `b969f9f` đã revert phần Codex. Khi gộp, cần hoàn tác commit revert này trước, rồi merge commit sửa mới; merge thông thường không tự khôi phục các file đã bị revert.
- Cần lấy đủ các module/service mới và frontend tương ứng; không chép riêng controller vì controller phụ thuộc `RewardsCartService` và module chung.
- Sau khi đổi nhánh, nếu Prisma Client cũ không khớp schema thì chạy `npx --no-install prisma generate` trong `apps/api`; bản sửa này không yêu cầu migration mới.

## 4. Phạm vi giữ nguyên theo yêu cầu

- Không đưa lại sửa đổi tách dòng theo ghi chú: Codex vẫn giữ cách gộp món hiện có, có thể gộp hai món cùng cấu hình nhưng khác ghi chú.
- Không đưa lại sửa đổi bỏ chặn tải giỏ khi thiếu Web Locks: hành vi kiểm tra hỗ trợ khóa đồng bộ hiện tại được giữ nguyên. Tính số lượng trên header dùng đường đọc riêng, không chạy đồng bộ.
- Không có file `rewards-cart.service.spec.ts` của phần sửa ghi chú đã hoàn tác.

## 5. Tình trạng kiểm tra

- API: 63 kiểm thử đơn vị đã qua cho bản sửa hoàn điểm; build thành công sau khi tạo lại Prisma Client.
- Frontend: 23 kiểm thử đã qua cho phiên bản có số lượng giỏ; build thành công.
- Kiểm tra HTTP cục bộ hai nhóm `/cart` và `/rewards/cart` đã qua với database giả: xóa quà/thử lại, số lượng 0, kiểm tra đầu vào báo giá và dữ liệu đồng bộ cũ.
- Chưa xác nhận bộ kiểm thử PostgreSQL thật. Lần chạy tích hợp có test báo lỗi và đã dừng theo yêu cầu; không coi đây là kiểm tra đã qua.
- Các kết quả trên không thay thế việc thử toàn bộ ứng dụng với database đang dùng trước buổi demo.
