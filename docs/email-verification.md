# Xác minh đăng ký bằng email

## Luồng

1. `POST /api/auth/register` nhận `fullName`, `email`, `password`, `confirmPassword`.
2. Dữ liệu hợp lệ được lưu vào `email_registrations`, chỉ lưu mật khẩu và mã đã băm bcrypt. SMTP gửi mã 6 chữ số. API chỉ trả `registrationId`, `email`, `expiresAt`, `resendAfter` và thông báo; không trả/log mã.
3. `POST /api/auth/verify-email` nhận `registrationId` và `code` (chuỗi 6 chữ số). Mã đúng tạo User và xóa đăng ký chờ trong cùng transaction. Sau đó khách đăng nhập.
4. `POST /api/auth/resend-verification` nhận `registrationId`. Gửi lại sau tối thiểu 60 giây, mã mới hết hạn sau 5 phút và vô hiệu mã cũ. Tối đa 5 lần sai cho mỗi mã; gửi lại mã mới sẽ đặt lại số lần thử.

Tài khoản chưa xác minh chưa tồn tại trong bảng User, vì vậy không thể đăng nhập hay nhận JWT. Tài khoản đã có trước bản cập nhật được giữ nguyên; không ép xác minh lại. Google vẫn kiểm tra token và `email_verified`, tự tạo tài khoản nếu cần, không gửi OTP BrewLite. Email đã có tài khoản mật khẩu vẫn phải xác nhận mật khẩu BrewLite để liên kết Google.

Các thao tác cho cùng email được khóa bằng PostgreSQL advisory transaction lock để tránh xác minh/gửi lại đồng thời. Gửi SMTP thất bại sẽ rollback, không báo thành công và không thay mã đang có. Đăng ký lại với thông tin khác sẽ thay ID yêu cầu, ngăn form cũ xác minh thông tin mới.

## Cấu hình gửi email thật

Điền các biến sau trong `.env` ở thư mục gốc khi chạy Docker. Không commit `.env` hay gửi mật khẩu vào chat:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=dia-chi-gui@gmail.com
SMTP_PASS=mat-khau-ung-dung
SMTP_FROM=BrewLite <dia-chi-gui@gmail.com>
```

Với Gmail, dùng App Password của tài khoản gửi (không dùng mật khẩu đăng nhập Gmail thông thường). Nếu tài khoản không có App Password, dùng nhà cung cấp SMTP khác rồi thay host/port/user/pass. SMTP port 465 dùng TLS trực tiếp, port khác yêu cầu STARTTLS. Chưa cấu hình sẽ hiển thị lỗi rõ ràng khi đăng ký; đăng nhập email tài khoản cũ và Google vẫn hoạt động.

Khi chạy backend trực tiếp, đặt cùng các biến trong `apps/api/.env` và cấu hình `DATABASE_URL` tương ứng. Cấu hình SMTP chỉ nằm ở backend, không dùng biến `VITE_`.

Sau khi điền `.env`, áp dụng:

```sh
docker compose up -d --no-deps --force-recreate api
```

## Cập nhật database/dependency trên máy mới

```sh
docker compose exec api pnpm install --frozen-lockfile
docker compose exec api pnpm --filter api exec prisma generate
docker compose exec api pnpm --filter api exec prisma migrate deploy
docker compose restart api
```

Migration mới chỉ thêm bảng `email_registrations`; không sửa/xóa User hay đơn hàng hiện có. Không dùng reset database để cập nhật tính năng này.

## Kiểm thử

- Email mới: nhận mã thật, nhập sai rồi đúng; chỉ sau mã đúng mới có tài khoản đăng nhập được.
- Sai 5 lần: mã đúng cũng bị chặn; sau 60 giây gửi mã mới và xác minh lại.
- Hết hạn 5 phút: bị từ chối; gửi mã mới, mã cũ không dùng được.
- Gửi lại quá sớm: trả 429, không gửi thêm email.
- F5 trang nhập mã: vẫn giữ email và yêu cầu đang chờ (sessionStorage chỉ giữ metadata, không lưu mật khẩu/mã).
- Email đã có tài khoản: báo trùng, không ghi đè mật khẩu.
- Google lần đầu: tự tạo và đăng nhập, không gửi OTP. Email đã đăng ký mật khẩu: liên kết sau xác nhận mật khẩu.
- `pnpm --filter api test`, `pnpm --filter web test`, build cả hai ứng dụng.

Kiểm tra transaction/khóa đồng thời với database phát triển thật (sau build):

```sh
docker compose exec api node apps/api/test/email-verification.database.mjs
```

Smoke test này giả lập gửi thư, dùng các email ngẫu nhiên ở `example.invalid` và tự xóa đúng dữ liệu test. Không gửi email thật.

Tài liệu transport SMTP: https://nodemailer.com/smtp

## Đặt mật khẩu cho tài khoản tạo bằng Google

Trong `/account`, chỉ tài khoản chưa có mật khẩu mới thấy form **Đặt mật khẩu BrewLite**. Thông tin tài khoản trả thêm `hasPassword` (boolean), không trả `passwordHash`.

- Đăng nhập Google trước, chọn gửi mã xác minh email; nhập mã, mật khẩu mới và xác nhận mật khẩu.
- `POST /api/auth/password-setup/request`: yêu cầu JWT hợp lệ; email lấy từ tài khoản trong database, không nhận email/userId từ client. Mã 6 số gửi với nội dung đặt mật khẩu, hạn 5 phút, gửi lại sau 60 giây.
- `POST /api/auth/password-setup/confirm`: yêu cầu JWT hợp lệ, nhận `challengeId`, `code`, `password`, `confirmPassword`. Chỉ tài khoản sở hữu mã được xác minh; tối đa 5 lần sai. Mật khẩu tối thiểu 8 ký tự và tối đa 72 byte UTF-8, lưu bcrypt cost 12.
- Bảng `password_setup_challenges` lưu mã đã băm, liên kết với `users` qua `user_id`. Migration chỉ thêm bảng/quan hệ, không đổi dữ liệu User hiện có.
- Chỉ đặt khi `passwordHash` còn null và đã có `googleId`. API chặn ghi đè mật khẩu đã có, kể cả gọi trực tiếp hay gửi đồng thời. Mã được xóa sau thành công; gửi lại tạo ID mới, ID cũ không dùng được.
- Đặt xong giữ nguyên user ID, Google ID, đơn hàng và điểm; có thể đăng nhập bằng Google hoặc email/mật khẩu mới. Tải lại trang không hiện form nữa.
- Đây là đặt mật khẩu lần đầu cho tài khoản Google, chưa phải chức năng quên/đổi mật khẩu.

Kiểm thử thủ công: dùng Google chưa có mật khẩu → vào `/account` → nhận mã → đặt mật khẩu → đăng xuất → đăng nhập email/mật khẩu → đăng xuất → đăng nhập Google → kiểm tra cùng email/thông tin và không còn form đặt mật khẩu. Với tài khoản email đã có mật khẩu, form không xuất hiện.
