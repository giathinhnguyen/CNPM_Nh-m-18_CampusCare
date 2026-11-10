# Tài khoản kiểm thử BrewLite và thẻ VNPay sandbox

Cập nhật ngày **10/11/2026**.

## Tài khoản trên website AWS

Đăng nhập tại **https://brewlitesguu.duckdns.org/login**.

**Mật khẩu chung của 4 tài khoản: `Brewlite@2026`** — chữ `B` viết hoa, các chữ còn lại trong `Brewlite` viết thường.

| Email | Vai trò | Điểm ban đầu | Dùng để kiểm tra |
|---|---|---:|---|
| `khach1@brewlite.test` | Khách hàng | 0 | Giỏ hàng, khuyến mãi, thanh toán |
| `khach2@brewlite.test` | Khách hàng | 500 | Đổi thưởng kết hợp đặt hàng, thanh toán |
| `khach3@brewlite.test` | Khách hàng | 1.000 | Nhiều lượt đổi thưởng, lịch sử đơn hàng |
| `admin@brewlite.test` | Quản trị viên | 0 | Nguyên liệu, tồn kho, sản phẩm, khách hàng, khuyến mãi |

- Khách và admin dùng chung trang đăng nhập; quyền do backend xác định.
- Các tài khoản trên đã được tạo và kiểm tra đăng nhập, phân quyền trên **database AWS**. Pull Git không tự tạo chúng trong database local của từng thành viên.
- Điểm là số dư ban đầu, sẽ thay đổi khi mọi người kiểm thử. Không giả định số dư luôn giữ nguyên.
- Email `.test` dùng để đăng nhập kiểm thử, không nhận được thư thật. Muốn thử đăng ký và nhận mã xác minh, dùng địa chỉ email thật bạn kiểm soát.

## Thẻ nội địa VNPay sandbox

Trên trang thanh toán BrewLite, chọn **thẻ nội địa qua VNPay**. Khi được chuyển đến cổng **`sandbox.vnpayment.vn`**, chọn ngân hàng **NCB** và nhập dữ liệu bên dưới. Đây là số thẻ thử nghiệm của cổng, không phải số tài khoản nhận chuyển khoản.

Thông tin dùng chung:

| Trường | Giá trị |
|---|---|
| Ngân hàng | `NCB` |
| Tên chủ thẻ | `NGUYEN VAN A` |
| Ngày phát hành | `07/15` |
| OTP cho kịch bản thành công | `123456` |

| Kịch bản do VNPay cung cấp | Số thẻ thử nghiệm |
|---|---|
| Thanh toán thành công | `9704198526191432198` |
| Không đủ số dư | `9704195798459170488` |
| Thẻ chưa kích hoạt | `9704192181368742` |
| Thẻ bị khóa | `9704193370791314` |
| Thẻ hết hạn | `9704194841945513` |

Với các thẻ lỗi, làm theo thông báo trên cổng; không giả định mọi kịch bản đều hỏi OTP. Dùng các dữ liệu này trong môi trường sandbox, không nhập thẻ ngân hàng thật.

Nguồn: [Danh sách thẻ kiểm thử chính thức VNPay](https://sandbox.vnpayment.vn/apis/vnpay-demo/), [Hướng dẫn tích hợp VNPay](https://sandbox.vnpayment.vn/apis/docs/gioi-thieu/).

## Cách kiểm tra nhanh

1. Đăng nhập bằng tài khoản khách, thêm món vào giỏ rồi tạo đơn mới, chọn thẻ nội địa VNPay.
2. Thử thẻ thành công, nhập OTP và chờ cổng đưa về hóa đơn BrewLite. Kiểm tra trạng thái **đã thanh toán** và thông báo kết quả.
3. Tạo đơn riêng để thử **Hủy thanh toán** trên VNPay; chờ quay về hóa đơn và kiểm tra thông báo thất bại. Hủy trên cổng là một kết quả thanh toán, khác với thao tác hủy đơn hàng.
4. Với thẻ không đủ số dư, khóa hoặc hết hạn, kiểm tra thông báo từ VNPay rồi hoàn tất luồng quay về BrewLite. Đây là các kịch bản sandbox của VNPay, không phải xác nhận mọi nhánh đã được nghiệm thu end-to-end trong ứng dụng.
5. Nếu đơn vẫn chờ đối soát, dùng **Kiểm tra trạng thái** trên hóa đơn. Trạng thái phụ thuộc kết quả xác minh của backend; lỗi QueryDR ở sandbox có thể làm đơn tiếp tục chờ đối soát.

File này chỉ chứa tài khoản demo và dữ liệu thẻ sandbox. Cấu hình SMTP, JWT, khóa ký cổng thanh toán, SSH key và tài khoản quản trị triển khai riêng được giữ ngoài GitHub.
