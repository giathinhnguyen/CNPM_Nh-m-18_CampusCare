# Khuyến mãi BrewLite

## Các file và luồng xử lý

- `apps/web/src/pages/PromotionsPage.tsx`: trang theo giao diện `web2`, tải danh sách, hiển thị điều kiện và sao chép. Chỉ báo thành công sau khi Clipboard API ghi được mã; khi bị từ chối, khách có thể chọn mã để chép thủ công.
- `apps/web/src/services/promotionService.ts`: gọi API, đổi các chuỗi Decimal thành số để định dạng giao diện.
- `apps/api/src/promotions/promotions.controller.ts`: nhận HTTP request và gọi service.
- `apps/api/src/promotions/promotions.service.ts`: lọc hiệu lực và tính tiền bằng Prisma Decimal.
- `apps/api/src/promotions/dto/quote-promotion.dto.ts`: cấu trúc một mã và danh sách món. Service kiểm tra dữ liệu thực tế khi chạy vì interface TypeScript không tự kiểm tra request.
- `apps/api/src/promotions/promotions.module.ts`: đăng ký Prisma, controller, service; export service cho module đơn hàng dùng sau này.

Luồng xem: Header → `/promotions` → `promotionService.getPromotions()` → `GET /api/promotions` → controller → service → PostgreSQL → các thẻ ưu đãi.

Luồng tính thử: mã + ID size/số lượng/topping → `POST /api/promotions/quote` → kiểm tra đầu vào → đọc mã, giá món và topping từ database trong transaction → xét điều kiện → tính giảm và trả kết quả.

## Quy tắc đã thống nhất

- Hỗ trợ `FIXED` và `PERCENTAGE`, giới hạn giảm bằng `maxDiscountAmount` nếu có.
- Chỉ nhận một chuỗi `code`. Không nhận danh sách mã hoặc số tiền do trình duyệt tự tính. `Order` chỉ có một `promotionId` và một `promotionCode`.
- Không đánh dấu mã đã dùng theo khách hàng; khách có thể dùng cùng mã cho nhiều đơn.
- Còn hiệu lực khi `isActive = true`, đã đến `startDate` nếu đặt, và chưa qua `endDate` nếu đặt. Hai mốc tính cả thời điểm bằng nhau. `null` nghĩa là không giới hạn ở mốc đó.
- Không suy ra ngày hết hạn từ tiêu đề, mô tả hoặc ngày kết thúc quảng bá. Mã còn hiệu lực tiếp tục xuất hiện trên trang.
- `appliesToAllProducts = true` áp dụng toàn menu. Khi `false`, bảng `promotion_products` xác định từng sản phẩm được giảm; danh sách rỗng không được hiểu là toàn menu.
- Đơn tối thiểu xét trên toàn bộ đơn. Giá mỗi món gồm giá gốc + phụ thu size + các topping, nhân số lượng.
- Chỉ tính giảm trên các món được áp dụng, bao gồm topping của các món đó. Làm tròn tổng tiền giảm đến đồng gần nhất với `ROUND_HALF_UP`, sau đó áp mức trần và giới hạn theo giá trị món áp dụng. Tổng phải trả luôn không âm.
- Ba mã mẫu áp dụng toàn menu, đang bật, không giới hạn thời gian, thứ tự BREW10 → PICKUP15 → MOOD20K.

## API tính thử

```http
POST /api/promotions/quote
Content-Type: application/json
```

```json
{
  "code": "BREW10",
  "items": [
    {
      "productSizeId": "UUID-size-lấy-từ-API-sản-phẩm",
      "quantity": 2,
      "toppingIds": []
    }
  ]
}
```

Lấy ID size thật từ `GET /api/products`. `toppingIds` có thể bỏ qua. Mã được bỏ khoảng trắng hai đầu và đổi sang chữ hoa. Không gửi `unitPrice`, `totalAmount`, `discountAmount`, `codes` hoặc `userId`.

Kết quả gồm `promotionId`, `promotionCode`, `totalAmount`, `eligibleAmount`, `discountAmount`, `finalAmount`. Các số tiền được serialize thành chuỗi để giữ chính xác. Ví dụ đơn đủ điều kiện 200.000đ, mã BREW10 giảm 20.000đ, còn 180.000đ.

API trả 400 khi đầu vào/điều kiện không hợp lệ, 404 khi mã không tồn tại, bị tắt hoặc ngoài thời gian hiệu lực.

Đây là API tính thử, chưa lưu vào đơn và không giữ giá/tồn kho. Phần orders hiện còn là khung; khi xây dựng tạo đơn, import `PromotionsModule` và gọi lại `calculateQuote(tx, input)` trong transaction lưu đơn. Lưu kết quả vào các trường snapshot của đơn, không nhận số tiền giảm do frontend gửi và không cộng thêm mã thứ hai.

## Tích hợp với giỏ hàng

`CartPage` gọi `promotionService.quote()` với các món được chọn. Giỏ khách dùng `toppingIds`, giỏ tài khoản có thể dùng `toppings[].id`; service chuyển cả hai về cùng request tối giản. Không gửi giá từ trình duyệt. `code: null` (hoặc bỏ `code`) yêu cầu tính giá chưa giảm; kết quả khi đó có `promotionCode: null` và `discountAmount: "0"`.

Kết quả có thêm `items`, theo thứ tự request, chứa `productSizeId`, `unitPrice`, `totalPrice` để cập nhật giá hiển thị. Backend kiểm tra tồn kho trên tổng số lượng của cùng sản phẩm, kể cả khác size/topping. Tổng đơn tối thiểu là tổng các món được chọn để đặt, không phải toàn bộ các món đang giữ trong giỏ.

Khi đổi lựa chọn/số lượng, xóa món hoặc đổi mã, kết quả cũ bị vô hiệu hóa và request cũ được hủy. Chỉ kết quả khớp đúng giỏ và tài khoản hiện tại mới được dùng. Không đủ điều kiện thì bỏ tiền giảm, hiện lý do; khách có thể bỏ mã hoặc sửa giỏ để kiểm tra lại. Nút tiếp tục bị chặn khi giá chưa được xác nhận, cập nhật món đang chạy hoặc mã chưa hợp lệ.

Mã hợp lệ được giữ qua luồng đăng nhập và được kiểm tra lại sau khi gộp giỏ. `cartIntegrationService.ts` lưu chọn/bỏ chọn bằng API có sẵn `PATCH /api/cart/items/:id` với `{ "isSelected": true/false }`. Giỏ khách lưu cờ tương tự ở localStorage. Danh sách rỗng nghĩa là không chọn món nào. Các PATCH không nguyên tử cho toàn giỏ; nếu có lỗi một phần, trang tải lại trạng thái thực tế và báo lỗi.

`useCartPromotion.ts` tách việc gọi API, quản lý mã/lỗi và bỏ qua phản hồi cũ khỏi trang giỏ. Tổng tiền và giá của các dòng được chọn lấy từ báo giá khớp giỏ hiện tại. Không thay cách tải giỏ khách từ danh mục hoặc viết lại các hàm thêm/sửa/xóa của giỏ. Kiểm tra quan hệ sản phẩm–size và trạng thái bán nằm trong lớp sync bổ sung và API báo giá; endpoint thêm món gốc được giữ nguyên.

### Đồng bộ giỏ khách

Endpoint bổ sung `POST /api/cart/sync-once` nhận `{ "syncId": "UUID-của-lô", "items": [...] }`, yêu cầu đăng nhập. Controller, service và DTO mới nằm trong `apps/api/src/promotions/`, được đăng ký trong `PromotionsModule`. Endpoint gốc `POST /api/cart/sync` và toàn bộ các file backend giỏ hàng giữ nguyên.

`guestCartSync.ts` giữ nguyên snapshot cùng `syncId` trong localStorage cho đến khi server xác nhận. Đồng bộ diễn ra khi trang lấy giỏ của khách đã đăng nhập, không phụ thuộc việc đã bấm thanh toán hay chưa. Lỗi mạng/server không xóa giỏ khách. Các lần tải giỏ đồng thời trong cùng tab dùng chung một request.

`CartSyncService` khóa các lần đồng bộ mới theo tài khoản, đọc biên nhận rồi gọi lại nguyên `CartsService.syncCart()` với Prisma client của transaction. Hàm gốc vẫn xử lý tìm món trùng, cộng số lượng và giới hạn tồn kho. Service bổ sung lưu biên nhận `CartSync` cùng các món trong transaction đó. Gửi lại cùng `syncId` và payload trả giỏ hiện tại, không gọi gộp lại; gửi payload khác với ID đã dùng bị từ chối. Biên nhận này chỉ chống gộp trùng giỏ, không giới hạn việc dùng lại mã khuyến mãi.

Khóa trên chỉ phối hợp các lần gọi endpoint mới, không tự khóa các endpoint thêm/sửa/xóa và sync gốc. Việc gộp tùy chọn, ghi chú và trạng thái mặc định của món mới vẫn theo hàm gốc; không bổ sung quy tắc gộp khác.

Nếu món đã ngừng bán hoặc số lượng phải giảm do tồn kho, response có `warnings` để thông báo. Những món thêm từ tab khác sau khi gửi snapshot được giữ lại ở giỏ khách. Một lô đang chờ xác nhận được gắn với tài khoản nhận, tránh tự chuyển lô sang tài khoản khác sau khi đăng xuất.

### Phần cần nối khi có chức năng đặt hàng

Hiện repo chưa có trang checkout, backend tạo đơn/thanh toán. Nút tiếp tục kiểm tra lại giá và lưu lựa chọn/mã, đưa khách về giỏ sau đăng nhập; với tài khoản đã đăng nhập, giao diện thông báo chức năng đặt hàng chưa khả dụng thay vì chuyển sang route không tồn tại.

Khi xây dựng phần đó, đọc các món thuộc tài khoản, tính lại mã trong transaction lưu đơn, giữ snapshot mã và số tiền. Thanh toán phải đọc `finalAmount` từ đơn. Tích điểm theo số tiền trước/sau giảm và điều kiện cho món đổi thưởng cần được thống nhất trước khi viết; phần tích hợp này chưa tự đặt các quy tắc đó.

## Migration, seed và kiểm thử với Docker

Chạy từ thư mục gốc khi Docker Compose đang bật:

```powershell
docker compose exec -T -w /workspace/apps/api api pnpm exec prisma migrate deploy
docker compose exec -T -w /workspace/apps/api api pnpm exec prisma generate
docker compose exec -T -w /workspace/apps/api api pnpm exec tsx prisma/seed-promotions.ts
docker compose restart api
docker compose exec -T -w /workspace/apps/api api pnpm exec vitest run --config vitest.config.e2e.ts test/promotions.e2e-spec.ts test/cart-promotions.e2e-spec.ts
```

Migration bổ sung cột và bảng liên kết, giữ dữ liệu hiện có. Prisma Client trong Docker và Windows nằm ở thư mục thư viện riêng; cần generate trong môi trường chạy backend.

Database local từng áp dụng migration nội dung khuyến mãi cũ có thể đã có `title`, `description`, `display_order`. Migration mới giữ các cột này bằng `IF NOT EXISTS`. Nếu repo đã xóa migration cũ, `prisma migrate status` vẫn có thể báo lịch sử khác nhau; không reset database hay xóa lịch sử migration để xử lý cảnh báo đó. Kiểm tra các migration bị thiếu trước khi dùng `migrate dev`.

Script seed chỉ tạo/cập nhật ba mã theo thiết kế. Chạy lại sẽ khôi phục nội dung, giá trị, trạng thái bật, phạm vi toàn menu và thời hạn không giới hạn của ba mã đó.

Kiểm thử PostgreSQL dùng transaction rồi rollback cả khi thành công hoặc thất bại, không để lại dữ liệu thử.
