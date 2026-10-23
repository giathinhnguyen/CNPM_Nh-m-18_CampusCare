# BrewLite Web

Ứng dụng giao diện khách hàng của BrewLite, được tổ chức theo hướng mobile-first.

Trong môi trường Figma Make hiện tại, ứng dụng sử dụng React, Vite, TypeScript,
Tailwind CSS, Zustand và React Router. Cấu hình Vite ở repository root là lớp
tương thích với preview và deployment scripts do Figma Make quản lý.

## Source chính

- `src/pages`: các màn hình theo route.
- `src/components`: component giao diện dùng chung.
- `src/store`: trạng thái giỏ hàng, tài khoản và đơn hàng.
- `src/services`: mock service, sẵn sàng thay bằng API NestJS.
- `src/data`: dữ liệu mẫu.
- `src/types`: kiểu dữ liệu TypeScript.
- `src/lib`: hàm tiện ích.
