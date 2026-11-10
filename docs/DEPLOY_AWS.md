# BrewLite tren AWS va DuckDNS

Repository: https://github.com/giathinhnguyen/CNPM_Nh-m-18_CampusCare

Nhanh trien khai: `main`, sau khi hop nhat `payment-and-administrator-ui`.
Ten mien: **brewlitesguu.duckdns.org**.

## Cau truc

- Mot EC2 Ubuntu 24.04, de xuat `t3.small` (2 GB RAM), o EBS gp3 ma hoa 30 GB va swap 2 GB cho build.
- Elastic IP gan vao EC2 de DuckDNS khong phai doi IP sau moi lan khoi dong.
- Security group: mo TCP 80/443, SSH TCP 22 chi cho IP quan tri; khong mo 3000, 5173, 5432 hay 5555.
- Docker Compose production gom PostgreSQL, API NestJS, web Nginx va Caddy. Database luu tren volume, khong publish port.
- Caddy cap/gia han HTTPS sau khi DuckDNS tro dung IP. Frontend goi `/api` cung domain; Return/Callback thanh toan dung HTTPS cung domain.

AWS tinh phi EC2, EBS va public IPv4/Elastic IP theo tai khoan va thoi gian su dung. Dung/tat tai nguyen sau dot bao ve theo nhu cau cua nhom; dung EC2 khong tu giai phong Elastic IP hay xoa o dia.

## Dang nhap AWS tren may ca nhan

Profile hien co: `whybi`, region `ap-southeast-2`.

```powershell
aws login --profile whybi
aws sts get-caller-identity --profile whybi
```

Neu session het han, dang nhap lai; khong can gui Access Key hoac mat khau vao chat. Chi tao tai nguyen sau khi xac dinh dung tai khoan AWS.

## Cau hinh bi mat

Mau cong khai: `deploy/production.env.example`.
File that tren server: `/opt/brewlite/.env.production`, quyen 600.
File chuan bi tren may local nam trong `.deployment/production.env`, da duoc Git/Docker ignore.

- Database password va JWT secret phai moi, khong dung mat khau database local.
- `DEPLOY_ADMIN_EMAIL` va `DEPLOY_ADMIN_PASSWORD` tao tai khoan admin rieng khi khoi tao database trong.
- Khong chay seed-admin test de tao admin production. `seed-deployment.ts` chi chap nhan database chua co san pham, don hoac nguoi dung.
- Che do nay giu ZaloPay/VNPay **sandbox**, khong chuyen sang thu tien that. Cac nut tu xac nhan thanh toan demo bi tat.
- `SWAGGER_ENABLED=true` neu nhom can `/api/docs` de trinh bay; cac API bao ve van yeu cau JWT. Mac dinh mau la false.
- Khong in noi dung env ra log, khong commit env, SSH key hoac thong tin dang nhap AWS.

## Tao EC2 va Elastic IP

Su dung AMI Ubuntu 24.04 chinh thuc cho x86_64 trong region da chon, VPC/subnet public, role hoac SSH key chi danh cho lan trien khai nay. Them tag `Project=BrewLite` de nhan dien tai nguyen.

User data co the dung `deploy/bootstrap-ec2.sh`; script cai Docker, tao swap va clone nhanh main vao `/opt/brewlite`. Script khong chua khoa hay env bi mat.

Sau khi cap Elastic IP va gan vao EC2, ghi IP do vao `BREWLITE_PUBLIC_IP` cua env tren server. Cap nhat DuckDNS bang IP chinh xac nay.

## Chay server

Sau khi upload env va khoi tao EC2:

```bash
cd /opt/brewlite
sudo bash deploy/start-server.sh --initialize-empty-database
```

Lan khoi tao tao catalog mon, cong thuc, ton dau ky va khuyen mai mau cho do an, cung admin co mat khau rieng. Database local khong tu duoc sao chep len AWS. Khong dung co khoi tao khi database da co du lieu.

Lan cap nhat tiep theo:

```bash
cd /opt/brewlite
git pull --ff-only origin main
sudo bash deploy/start-server.sh
```

Khong chay `docker compose down -v` tren server vi se xoa database.

## Cap nhat DuckDNS va HTTPS

1. Mo DuckDNS, chon subdomain `brewlitesguu` va dien **Elastic IP** da tao.
2. Cho DNS cap nhat. Kiem tra `nslookup brewlitesguu.duckdns.org` tra dung IP.
3. Caddy tu xin chung chi HTTPS; neu no da thu truoc khi DNS dung, co the restart rieng service caddy sau khi DNS cap nhat.

Kiem tra:

```bash
curl -f https://brewlitesguu.duckdns.org/api/health
curl -I https://brewlitesguu.duckdns.org/
curl -I https://brewlitesguu.duckdns.org/payments/zalopay/return
```

`/api/health` phai tra `{"status":"ok"}` va kiem tra duoc database; trang SPA phai mo duoc khi tai truc tiep mot route con.

## OAuth va thanh toan

- Google Cloud OAuth client can them Authorized JavaScript origin `https://brewlitesguu.duckdns.org`. Van giu localhost neu nhom con dev local. Chi chu so huu OAuth client moi cap nhat duoc muc nay.
- VNPay Return URL: `https://brewlitesguu.duckdns.org/payments/return`.
- VNPay IPN: `https://brewlitesguu.duckdns.org/api/payments/vnpay/ipn` neu portal merchant cho phep cau hinh.
- ZaloPay Return: `https://brewlitesguu.duckdns.org/payments/zalopay/return`.
- ZaloPay Callback: `https://brewlitesguu.duckdns.org/api/payments/zalopay/callback`.
- Kiem thu lai thanh cong, huy, het han va callback lap bang app sandbox sau khi domain/HTTPS hoat dong. Viec build image khong thay the kiem thu thanh toan tren dien thoai.

Nguon AWS: [EC2 public IP va Elastic IP](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-instance-addressing.html), [dang nhap AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html).

## Kiem tra production local ngay 10/11/2026

- Build image API va web thanh cong; PostgreSQL chay trong project Docker rieng, khong sua database local cua nhom.
- Migration tao database moi thanh cong; seed khoi tao 12 mon, 26 nguyen lieu, 3 khuyen mai va admin rieng.
- Qua Caddy: `/api/health`, `/api/products`, `/api/docs`, `/api/docs-json` va hai route Return deu HTTP 200.
- Admin dang nhap va goi `/api/auth/me` bang JWT thanh cong; API nhan cau hinh hai cong sandbox, cac che do demo bi tat.
- Hai shell script qua `bash -n`; cau hinh Caddy qua `caddy validate`.
- Ket qua nay chua bao gom DNS, chung chi HTTPS that, Google OAuth tren domain moi hay giao dich quet QR tren dien thoai.
