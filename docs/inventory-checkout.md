# Thiết kế kho nguyên liệu và thanh toán BrewLite

Bản triển khai giữ menu 12 món hiện có và giao diện tham chiếu trong `wweb`. Tồn kho được tính theo nguyên liệu dùng chung, không theo số ly lưu trong `products.stock_quantity`. Checkout tích hợp VNPay sandbox, nối tiếp khuyến mãi và đổi thưởng đã có.

## Các quyết định đã thống nhất

- Không quản lý nước lọc và đá trong kho. Mức đá chỉ là hướng dẫn pha chế.
- Giữ 11 nguyên liệu gốc và bổ sung thành phần cần cho menu hiện tại: tổng cộng 26 nguyên liệu. Không dùng công thức của một món khác để giả lập các thành phần còn thiếu.
- Bộ định lượng S/M/L trong `apps/api/prisma/ingredient-menu.ts` là **đề xuất thử nghiệm**, cần người phụ trách pha chế hiệu chỉnh trước khi áp dụng thực tế. Mỗi size có các định lượng riêng; seed không tự nhân một hệ số chung.
- Dung tích ly S/M/L là 350/500/700 ml. Đây là dung tích danh định, không phải tổng thể tích nguyên liệu.
- Chỉ nước đường NL011 thuộc nhóm SUGAR. Syrup đường nâu, mật ong, sữa đặc, sốt caramel và các thành phần khác giữ cố định. Mức 0% không có nghĩa đồ uống hoàn toàn không đường.
- Topping thêm tùy chọn chưa có công thức riêng nên chưa trừ kho; trân châu vốn có trong công thức Brown Sugar Boba vẫn được tính kho như thành phần của món.

## Cấu trúc dữ liệu

| Bảng | Vai trò |
| --- | --- |
| ingredients | Mã, tên, đơn vị g/ml/pcs, giá vốn theo đơn vị cơ sở, ngưỡng cảnh báo, trạng thái |
| product_ingredients | Định lượng theo product_size_id và ingredient_id; nhóm FIXED/SUGAR |
| customization_policies | Mức đường/đá được phép; tập con của 0/50/100/120 |
| ingredient_stocks | on_hand và reserved; CHECK bảo đảm 0 ≤ reserved ≤ on_hand |
| product_sizes | Thêm cup_volume_ml; giữ giá và quan hệ sản phẩm hiện có |
| orders | Thêm inventory_status, snapshot reserved_ingredients và mốc giữ/trừ/hoàn; thông tin khách nhận |
| payments | Thêm payment_url, needs_review và phương thức VNPAY |

Giữ cột `stock_quantity` để tương thích dữ liệu cũ, nhưng không sử dụng nó để quyết định bán hàng. Các response vẫn có `stockQuantity` nhằm tương thích UI: giá trị được tính động theo nguyên liệu. Ở cấp sản phẩm đây là mức lớn nhất trong các size, không phải tổng cộng các size. Ở trang chi tiết và giỏ, số lượng theo size đang chọn; kiểm tra tổng đơn tại backend mới là quyết định cuối cùng.

Không tạo bảng recipes, recipe_steps, stock_movements hoặc order_item_ingredient_usage. Snapshot JSON của đơn lưu quantity dưới dạng chuỗi decimal. Dữ liệu tồn kho sử dụng NUMERIC(14,3); tiền dùng Decimal. Nhu cầu được làm tròn lên đến 0,001 đơn vị để không giữ thiếu nguyên liệu.

## Công thức

```
available(i) = on_hand(i) - reserved(i)
actual(i) = standard(i) × sweetness / 100   nếu SUGAR
actual(i) = standard(i)                    nếu FIXED
required(i) = tổng actual(i, dòng) × số lượng dòng
max_cups = min floor(available(i) / actual(i)) với actual(i) > 0
cost = tổng required(i) × unit_cost_vnd(i)
```

Các món trong đơn dùng chung nguyên liệu được cộng dồn trước khi giữ tồn. Món quà 0đ cũng tiêu thụ nguyên liệu. Không bán size thiếu công thức, thiếu chính sách tùy chỉnh hoặc có nguyên liệu không hoạt động.

## Luồng checkout

1. Giỏ hàng không giữ nguyên liệu. Backend kiểm tra cấu hình và nhu cầu khi thêm/sửa, nhưng kiểm tra lại tại checkout vì khách khác có thể đã mua.
2. `POST /api/orders` nhận itemIds thuộc giỏ của tài khoản, thông tin khách, mã ưu đãi, expectedAmount và idempotencyKey. Giá do backend đọc lại và tính, expectedAmount chỉ dùng để yêu cầu xác nhận lại nếu giá thay đổi.
3. Trong một transaction: khóa tài khoản, kiểm tra quà/giá, tạo đơn PENDING_PAYMENT, giữ nguyên liệu bằng UPDATE có điều kiện, ghi snapshot, liên kết quà và xóa đúng các dòng đã thanh toán khỏi giỏ. Giữ tồn 15 phút. Bất kỳ bước nào thất bại đều rollback.
4. Khóa nguyên liệu theo thứ tự UUID để giảm deadlock. Điều kiện `on_hand - reserved >= required` ngăn bán vượt tồn khi các khách đặt đồng thời.
5. `POST /api/payments` tạo một URL VNPay cho đơn. Gửi lại cùng idempotencyKey trả lại giao dịch cũ. Đơn đang có giao dịch chờ sẽ dùng lại giao dịch đó, không tạo lượt thu tiền mới.
6. Khách thanh toán tại VNPay; BrewLite không thu thập số thẻ/CVV. Return URL chỉ mở trang kiểm tra đơn, không tự quyết định PAID từ query string của trình duyệt.
7. IPN có chữ ký HMAC-SHA512 hợp lệ hoặc kết quả QueryDR đã xác minh mới được xử lý. Backend kiểm tra merchant, mã giao dịch, số tiền và trạng thái. Lần thành công đầu tiên trừ snapshot nguyên liệu, hoàn tất đổi điểm và cộng `floor(final_amount / 1000)` điểm. Callback trùng không trừ/cộng lần nữa.
8. Đơn có tổng 0đ được xác nhận trực tiếp bằng transaction backend; không gọi cổng thanh toán. VNPay chỉ nhận tổng dương từ 5.000đ trong triển khai này.
9. Thất bại cuối cùng cho phép khách thử lại trước hạn hoặc hủy. Hủy trả món mua thường về giỏ ở trạng thái chưa chọn, giải phóng điểm quà để khách đổi lại. Không tự thêm lại quà vì có thể xung đột quy tắc chỉ một quà trong giỏ.
10. Worker mỗi phút kiểm tra đơn quá hạn. Đơn chưa tạo giao dịch hoặc có giao dịch thất bại đã xác minh được giải phóng. Giao dịch chưa rõ, timeout, chữ ký sai hoặc QueryDR không tìm thấy được giữ chờ đối soát, không mặc định thất bại.
11. Thành công đến muộn sau khi đã RELEASED được ghi payment SUCCESS và needsReview=true, không tự trừ kho/cộng điểm. Nhân viên cần đối soát và hoàn tiền trên cổng merchant; MVP chưa có API hoàn tiền tự động.

Các API đơn, thanh toán lại và lịch sử chỉ cho phép chủ đơn truy cập. IPN không yêu cầu JWT nhưng bắt buộc chữ ký nhà cung cấp. Các thao tác thay đổi đơn/điểm khóa cùng tài khoản để không đua với giỏ hàng/đổi thưởng.

## Khởi động và dữ liệu thử

```powershell
docker compose up -d postgres api web
docker compose exec -T api pnpm --filter api exec prisma generate
docker compose exec -T api pnpm --filter api exec prisma migrate deploy
docker compose exec -T api pnpm --filter api exec tsx prisma/seed-ingredients.ts
docker compose restart api
```

Seed tìm đúng tên 12 món hiện có, không tạo menu mới. Tạo 36 công thức nếu chưa tồn tại, 26 nguyên liệu và lượng tồn giả định để thử chức năng. Không ghi đè công thức đã có; không tự nạp lại stock/reserved khi chạy lần nữa. Giá nhập trong seed là giả định để thử phép tính, không phải báo giá thị trường.

Quản trị công thức và tồn tại `/admin/ingredients` và `/admin/products`, dùng tài khoản admin đăng nhập qua trang chung `/login`; xem [hướng dẫn quản trị](admin.md). Chỉnh tồn thực tế theo đơn vị cơ sở và luôn giữ on_hand ≥ reserved; hệ thống kiểm tra điều kiện này khi lưu. Không sửa reserved hay snapshot đơn bằng tay. Hiện có kiểm kê trực tiếp, chưa có phiếu nhập/xuất, lịch sử điều chỉnh hay quản lý lô/hạn dùng.

## Xem tồn kho nguyên liệu

Để xem số nguyên liệu hiện tại trong cơ sở dữ liệu local, chạy từ thư mục dự án:

```powershell
docker compose exec -T api pnpm --filter api exec tsx prisma/check-inventory.ts
```

Bảng hiển thị tên nguyên liệu, đơn vị, tồn thực tế, lượng đang giữ cho đơn chưa thanh toán và lượng có thể dùng (`on_hand - reserved`). Đây là lệnh chỉ đọc, không nạp thêm nguyên liệu. Số ly có thể pha là số nhỏ nhất của phần nguyên từng lượng nguyên liệu khả dụng chia cho định lượng tương ứng; các món dùng chung nguyên liệu nên không cộng số ly của các món với nhau.

## Cấu hình VNPay sandbox

### Chuyển khoản demo cho đồ án

Bật `BANK_TRANSFER_DEMO_ENABLED=true` trong `.env`, rồi chạy `docker compose up -d api`. Chế độ này chỉ hoạt động khi `NODE_ENV=development` hoặc `test`; ở production luôn bị chặn, kể cả khi cờ được bật.

Khách chọn “Chuyển khoản ngân hàng” ở checkout, tạo đơn rồi nhấn “Xác nhận đã chuyển khoản” trên trang chi tiết thanh toán. Đây là mô phỏng, không cần số tài khoản ngân hàng, QR hay chuyển tiền thật. Backend ghi giao dịch BANK_TRANSFER thành công với mã `DEMO-...` và metadata `simulated=true`, đồng thời trừ kho, hoàn tất đổi thưởng và cộng điểm trong một transaction. Gửi lặp chỉ xử lý một lần. Đơn hết hạn/đã hủy, đơn của người khác hoặc đơn có giao dịch VNPay chưa đối soát không được xác nhận bằng nút này. Đơn tổng 0đ vẫn hoàn tất tự động.

Giao diện khách và lịch sử đơn trong quản trị ghi rõ thanh toán mô phỏng. Endpoint demo là `POST /api/payments/orders/:id/bank-transfer-demo/confirm`, bắt buộc đăng nhập và sở hữu đơn. Để tắt, đặt cờ về `false` và tạo lại container API. Không dùng nút tự xác nhận để xác nhận tiền thật đã vào tài khoản.

### QR chuyển khoản theo số tiền đơn

Không cần VNPay để tạo QR. Cấu hình `BANK_QR_BIN`, `BANK_QR_BANK_NAME`, `BANK_QR_ACCOUNT_NUMBER`, `BANK_QR_ACCOUNT_NAME` trong `.env` rồi chạy `docker compose up -d api`. Vietcombank có BIN `970436`; thông tin tài khoản nhận tiền chỉ đặt trong cấu hình máy.

`GET /api/payments/orders/:id/bank-qr` chỉ trả QR cho chủ đơn đang chờ thanh toán và còn hạn. Số tiền lấy từ `finalAmount` sau khuyến mãi/đổi thưởng, nội dung lấy từ mã đơn trên máy chủ. Ảnh sử dụng [VietQR Quick Link](https://www.vietqr.io/qr-dong) định dạng SVG; trình duyệt gửi thông tin nhận tiền, số tiền và mã đơn tới dịch vụ ảnh VietQR. Khi dịch vụ ảnh lỗi vẫn hiển thị thông tin nhận tiền và nút thử lại.

QR trỏ đến tài khoản thật nhưng không tự kiểm chứng tiền đã vào. Khi thử đồ án không cần chuyển tiền: dùng nút xác nhận mô phỏng. Thanh toán thật cần cơ chế đối soát riêng.

### Thẻ mô phỏng

Bật `CARD_DEMO_ENABLED=true`, chạy migration bằng `docker compose exec -T api pnpm --filter api exec prisma migrate deploy`, sinh client bằng `docker compose exec -T api pnpm --filter api exec prisma generate`, rồi tạo lại API bằng `docker compose up -d api`.

Chọn “Thẻ ngân hàng (demo)” khi checkout hoặc ở chi tiết đơn. Nút “Điền dữ liệu test” điền số `4111 1111 1111 1111`, chủ thẻ `DEMO USER`, hạn `12/30`, CVV `123`. Form chỉ chấp nhận bộ mẫu này; không dùng thẻ thật. Dữ liệu thẻ không gửi lên API, không lưu vào storage/database. Endpoint `POST /api/payments/orders/:id/card-demo/confirm` chỉ xác nhận đơn bằng ID, ghi phương thức `CARD_DEMO`, mã `DEMO-...`; chỉ hoạt động ở development/test và có kiểm tra quyền, thời hạn, giao dịch đang chờ, chống xử lý trùng như chuyển khoản demo.

Ô số điện thoại không có hướng dẫn cố định. Nếu nhập sai sẽ báo ngay dưới ô; chấp nhận 10 chữ số bắt đầu bằng 0 và dạng +84, có thể dùng khoảng trắng/dấu gạch. Mỗi đơn lưu số riêng, không thay đổi số của đơn đã thanh toán.

### VNPay (tùy chọn)

Điền các giá trị merchant vào `.env` trên máy, không commit HashSecret:

```env
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_RETURN_URL=http://localhost:5173/payments/return
```

Sau khi điền chạy `docker compose up -d api`. Đăng ký IPN công khai trỏ tới `/api/payments/vnpay/ipn` của backend với VNPay. Localhost không nhận IPN từ Internet; có thể dùng HTTPS tunnel do nhóm quản lý. Khi chưa có IPN, nút Kiểm tra trạng thái gọi QueryDR từ backend. Không tự công khai server hoặc đăng ký merchant trong triển khai này.

Nếu thiếu merchant/secret, checkout báo thanh toán chưa sẵn sàng và không giả lập thành công. Có thể kiểm thử đơn chỉ có quà 0đ; kiểm thử chữ ký và cạnh tranh được thực hiện bằng dữ liệu fixture riêng. Cần tài khoản sandbox hợp lệ để thử giao dịch đầu cuối thực sự trên VNPay.

Tham chiếu chính thức: [VNPay PAY](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html) và [VNPay Post method 2.1.0](https://sandbox.vnpayment.vn/apis/files/VNPAY%20Payment%20Gateway_Techspec%20Post%20method%202.1.0-VN.pdf).

## Kiểm thử

```powershell
docker compose exec -T api pnpm --filter api test:e2e checkout-inventory.e2e-spec.ts rewards.e2e-spec.ts cart-promotions.e2e-spec.ts promotions.e2e-spec.ts
docker compose exec -T api pnpm --filter api test
docker compose exec -T web pnpm --filter web test
docker compose exec -T web pnpm --filter web build
```

Test tích hợp tạo dữ liệu riêng rồi xóa, không sử dụng tài khoản khách thật. Các ca chính gồm nguyên liệu dùng chung, đường/đá, size thiếu công thức, hai khách tranh tồn, idempotency checkout/payment, callback giả/sai tiền/lặp, giữ snapshot sau sửa công thức, timeout, hủy/đơn hết hạn, callback đến muộn, quà 0đ, giá thay đổi và quyền xem đơn.
