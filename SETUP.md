# BrewLite – Hướng dẫn cài đặt và chạy dự án

Tài liệu này dành cho thành viên mới clone hoặc pull source BrewLite về máy.

## 1. Yêu cầu môi trường

- Git
- Node.js 20 trở lên
- pnpm 12.14.0
- Docker Desktop đang chạy

Kiểm tra phiên bản:

```powershell
node --version
pnpm --version
docker --version
docker compose version
```

Nếu PowerShell chặn `pnpm.ps1`, dùng `pnpm.cmd` thay cho `pnpm`.

## 2. Clone hoặc pull source

Clone lần đầu:

```powershell
git clone <URL_REPOSITORY>
cd brewlite
```

Đã có source:

```powershell
git pull
```

Cài dependency:

```powershell
corepack enable
corepack prepare pnpm@12.14.0 --activate
pnpm install
```

## 3. Chạy bằng Docker (khuyến nghị)

Tạo file môi trường:

```powershell
Copy-Item .env.example .env
```

Khởi động PostgreSQL:

```powershell
docker compose up -d --build postgres
```

Chạy migration và seed:

```powershell
docker compose run --rm api pnpm exec prisma migrate deploy
docker compose run --rm api pnpm exec prisma generate
docker compose run --rm api pnpm exec prisma db seed
docker compose run --rm api pnpm exec tsx prisma/seed-promotions.ts
```

Khởi động API và frontend:

```powershell
docker compose up -d --build api web
```

Địa chỉ truy cập:

- Frontend: http://localhost:5173
- API health: http://localhost:3000/api/health
- Danh mục: http://localhost:3000/api/categories
- Sản phẩm: http://localhost:3000/api/products
- Khuyến mãi: http://localhost:5173/promotions
- API khuyến mãi: http://localhost:3000/api/promotions
- Rewards: http://localhost:3000/api/rewards/products
- Đổi điểm: http://localhost:5173/rewards
- Hướng dẫn đổi thưởng, migration và tài khoản test: [docs/rewards.md](docs/rewards.md)

Xem log:

```powershell
docker compose logs -f api
docker compose logs -f web
```

Dừng hệ thống:

```powershell
docker compose down
```

`docker compose down -v` sẽ xóa cả volume database local, chỉ dùng khi muốn tạo lại dữ liệu từ đầu.

## 4. Chạy API và frontend riêng bằng Terminal

Vẫn cần PostgreSQL ở cổng `5432`:

```powershell
docker compose up -d postgres
```

Khi chạy API trực tiếp trên Windows, file `.env` cần dùng `localhost`:

```env
DATABASE_URL=postgresql://brewlite:brewlite@localhost:5432/brewlite
PORT=3000
WEB_ORIGIN=http://localhost:5173
```

Migration và seed một lần:

```powershell
pnpm.cmd --filter api exec prisma migrate deploy
pnpm.cmd --filter api exec prisma generate
pnpm.cmd --filter api exec prisma db seed
pnpm.cmd --filter api exec tsx prisma/seed-promotions.ts
```

Terminal 1 – API:

```powershell
pnpm.cmd --filter api start:dev
```

Terminal 2 – frontend:

```powershell
pnpm.cmd --filter web dev
```

Frontend dùng API tại `http://localhost:3000/api`. Có thể tạo `apps/web/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

## 5. Build và kiểm tra

```powershell
pnpm.cmd --filter api build
pnpm.cmd --filter web build
pnpm.cmd test
```
