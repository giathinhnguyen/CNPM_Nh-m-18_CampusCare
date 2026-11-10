# Test API BrewLite bằng Swagger

Swagger chạy cùng API trong môi trường development:

- Giao diện: http://localhost:3000/api/docs
- OpenAPI JSON: http://localhost:3000/api/docs-json
- API gốc: http://localhost:3000/api

Swagger không được bật khi `NODE_ENV=production`. Các request Execute đi vào database thật của môi trường đang chạy. UUID trong Example Value là mẫu; hãy thay bằng ID lấy từ response.

## Khởi động bằng Docker

Tại PowerShell, thư mục `D:\CNPM`:

```powershell
docker compose up -d --build
```

Nếu vừa cập nhật dependency hoặc database, chạy lần lượt:

```powershell
docker compose exec -T api pnpm install --frozen-lockfile
docker compose exec -T api pnpm --filter api exec prisma migrate deploy
docker compose exec -T api pnpm --filter api exec prisma generate
docker compose exec -T api pnpm --filter api exec prisma db seed
docker compose restart api
```

Đợi API biên dịch xong rồi mở Swagger. Trong Docker API dùng `postgres:5432`; truy cập PostgreSQL từ Windows dùng `localhost:5435` theo `.env` hiện tại. Không cần đổi DATABASE_URL để thử API qua Swagger.

## 1. Thử API không cần đăng nhập

1. Mở nhóm **products**, chọn `GET /api/products`.
2. Bấm **Try it out** → **Execute**.
3. Kiểm tra **Server response / Code** là `200`, body là danh sách món. Sau khi seed có 12 món.
4. Lưu `id` của một món và `sizes[].id` thuộc chính món đó để dùng khi thêm giỏ hàng. Có thể gọi `GET /api/products/{id}` để xem chi tiết.
5. Thử thêm `GET /api/categories`, `GET /api/toppings`, `GET /api/promotions`.

**Response body** là kết quả thực tế. **Example Value / Schema** là mô tả dữ liệu, không phải kết quả request.

## 2. Đăng nhập và nhập JWT

Trong nhóm **auth**, mở `POST /api/auth/login` → **Try it out**. Với tài khoản quản trị do seed tạo, nhập:

```json
{
  "email": "admin@brewlite.test",
  "password": "BrewLite@Admin2026!"
}
```

Đây là tài khoản development trong `prisma/seed-admin.ts`. Seed không đặt lại mật khẩu nếu tài khoản đã tồn tại; nếu bạn đã đổi mật khẩu thì dùng mật khẩu hiện tại.

1. Bấm **Execute**. Thành công trả `201` và body có `accessToken`.
2. Sao chép giá trị `accessToken`, bỏ dấu ngoặc kép.
3. Bấm **Authorize** phía trên → dán token → **Authorize** → **Close**. Không thêm chữ `Bearer`; Swagger tự thêm header.
4. Gọi `GET /api/auth/me`: nhận `200` và thông tin tài khoản.
5. Gọi `GET /api/admin/me` hoặc `GET /api/admin/overview`: tài khoản ADMIN nhận `200`.

Token hết hạn sau khoảng một giờ theo response đăng nhập; đăng nhập lại để lấy token mới. Tải lại trang sẽ cần Authorize lại.

Muốn thử luồng khách hàng, dùng tài khoản khách đang có. Hoặc `POST /api/auth/register` với `fullName`, email thật của bạn, `password`, `confirmPassword`; lấy `registrationId`, nhận mã email và gọi `POST /api/auth/verify-email`. Luồng này cần SMTP được cấu hình và có gửi email thật. Token Google phải lấy từ luồng Google đăng nhập thật.

## 3. Thử giỏ hàng

Sau khi Authorize, mở **cart**:

1. `GET /api/cart` để xem giỏ hiện tại.
2. `POST /api/cart/items` với ID lấy ở bước 1:

```json
{
  "productId": "THAY_BANG_ID_MON",
  "productSizeId": "THAY_BANG_ID_SIZE_CUA_MON",
  "quantity": 1,
  "sweetnessLevel": "HUNDRED",
  "iceLevel": "HUNDRED",
  "toppingIds": [],
  "note": "Test Swagger"
}
```

3. Kiểm tra response `201`, gọi lại `GET /api/cart` và lưu `items[].id` của dòng vừa thêm. ID dòng giỏ khác với ID món và ID size.
4. `PATCH /api/cart/items/{id}` với ID dòng giỏ, body `{"quantity": 2}`; kiểm tra `200`.
5. `POST /api/cart/quote` với `{"itemIds": ["ID_DONG_GIO"]}`; kiểm tra `201` và lưu `finalAmount`. Với `/api/rewards/cart/quote`, mã thành công là `200`.
6. Sau khi thử, có thể xoá dòng giỏ đã tạo bằng `DELETE /api/cart/items/{id}`; kiểm tra `200`.

Mức đường/đá được phép phụ thuộc công thức từng món. Dùng `HUNDRED` để bắt đầu; nhập giá trị khác chính sách có thể bị từ chối dù enum hợp lệ.

## 4. Thử tạo đơn (có thay đổi dữ liệu và giữ tồn kho)

Giữ lại dòng giỏ để thử đặt hàng. Gọi quote ngay trước khi tạo đơn, sau đó `POST /api/orders`:

```json
{
  "itemIds": ["ID_DONG_GIO"],
  "idempotencyKey": "UUID_MOI",
  "customerName": "Khách Test",
  "customerPhone": "0901234567",
  "expectedAmount": 35000,
  "note": "Test Swagger"
}
```

- Thay `expectedAmount` bằng `finalAmount` từ quote, không dùng cố định 35000.
- Nếu quote có mã ưu đãi, truyền cùng `code` khi tạo đơn.
- Tạo UUID trong PowerShell bằng `[guid]::NewGuid().ToString()`. Mỗi thao tác mới dùng UUID mới. Khi retry cùng thao tác, giữ nguyên UUID và body.
- Thành công trả `201`. Dùng ID đơn để gọi `GET /api/orders/{id}` hoặc xem danh sách bằng `GET /api/orders`.
- Với đơn test còn được phép huỷ, gọi `POST /api/orders/{id}/cancel` để huỷ sau khi thử.

Phần thanh toán có thể tạo giao dịch hoặc chuyển trạng thái đơn. Xem `GET /api/payments/config` trước. Các API demo chỉ hoạt động khi cờ demo tương ứng được bật. VNPay return/IPN cần dữ liệu và chữ ký thật từ gateway; JSON tự điền sẽ bị từ chối.

## 5. Kiểm tra các trường hợp lỗi

| Tình huống | Cách thử | Kết quả mong đợi |
| --- | --- | --- |
| Thiếu token | Authorize → Logout, gọi `GET /api/auth/me` | `401` |
| Sai mật khẩu | Login với email hợp lệ và mật khẩu sai | `401` |
| Thiếu dữ liệu | Login với `{}` | `400` |
| Sai dữ liệu giỏ | Đã Authorize, thêm món với `quantity: 0` | `400` |
| Sai quyền | Token CUSTOMER gọi `GET /api/admin/overview` | `403` |

Các mã thường gặp: `200/201` thành công; `400` dữ liệu không hợp lệ; `401` lỗi đăng nhập/JWT; `403` thiếu quyền; `404` không tìm thấy tài nguyên; `409` xung đột dữ liệu. Đọc thêm `message` trong Response body để biết nguyên nhân cụ thể.

Nếu Swagger không mở hoặc báo Failed to fetch, kiểm tra `docker compose ps` và `docker compose logs --tail 60 api`. API phải biên dịch và khởi động xong; mở Swagger bằng URL cổng 3000 ở đầu hướng dẫn.
