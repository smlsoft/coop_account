# COOP ACCOUNT

## Development

```bash
npm install
npm run dev
```

---

## Deploy

### UAT

Push code ขึ้น branch `main`:

```bash
git push origin main
```

GitHub Actions จะ build และ push image อัตโนมัติ

- Image: `ghcr.io/smlsoft/coopaccount:latest`
- API: `https://glapi-uat.rspcoop.com/`

---

### Production

สร้าง tag version ใหม่และ push:

```bash
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions จะ build และ push image อัตโนมัติ

- Image: `ghcr.io/smlsoft/coopaccount:prod`
- API: `https://glapi.rspcoop.com/`

> เพิ่ม version ทุกครั้งที่ deploy prod เช่น v1.0.1, v1.0.2, v1.1.0

---

## สำหรับทีม Deploy

### 1. สร้างไฟล์ `.env` ข้างๆ `docker-compose.yml`

```env
APP_PORT=8080
```

### 2. แก้ image ใน `docker-compose.yml`

UAT:
```yaml
image: ghcr.io/smlsoft/coopaccount:latest
```

Production (ระบุ version ที่ต้องการ):
```yaml
image: ghcr.io/smlsoft/coopaccount:1.0.0
```

### 3. รัน

```bash
docker compose pull && docker compose up -d
```
