# EGEM Makine Takip Sistemi - Deployment Guide

## 🌐 Domain Mapping

```
track.bychome.xyz     → http://192.168.1.44:5173   (Frontend)
yyc.bychome.xyz       → http://192.168.1.44:5199   (Backend API)
livedata.bychome.xyz  → http://192.168.1.237:8080  (PLC Data)
basedata.bychome.xyz  → http://192.168.1.237:5199  (Reports API)
```

## 🚀 Production Deployment

### 1. Frontend (track.bychome.xyz)

**Build the application:**
```bash
cd DASHBOARD/bobst-dashboard
npm run build
```

**Serve the build:**
```bash
# Seçenek 1: Vite Preview (Geliştirme için)
npm run preview

# Seçenek 2: Static HTTP Server (Production için)
npx serve -s dist -l 5173
```

**HTTPS için reverse proxy gerekli** (Nginx/Caddy/Apache)

### 2. Backend API (yyc.bychome.xyz)

```bash
cd DASHBOARD/DashboardBackend
dotnet run
```

Port 5199'da çalışacak.

### 3. Reports API (basedata.bychome.xyz)

⚠️ **KRITIK**: Bu backend eksik! Şu endpoint'ler gerekli:
- `GET /api/reports`
- `GET /api/reports/stoppages`
- `GET /api/reports/stoppage-summary`
- `GET /api/reports/operator-summary`
- `GET /api/reports/speed-data`
- `GET /api/reports/oee-calculation/{id}`

### 4. PLC Server (livedata.bychome.xyz)

Port 8080'de çalışmalı.

## 🔧 Reverse Proxy (Nginx Örneği)

```nginx
# track.bychome.xyz - Frontend
server {
    listen 443 ssl;
    server_name track.bychome.xyz;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://192.168.1.44:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# yyc.bychome.xyz - Backend API
server {
    listen 443 ssl;
    server_name yyc.bychome.xyz;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://192.168.1.44:5199;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Authorization, Content-Type";
    }
}

# basedata.bychome.xyz - Reports API
server {
    listen 443 ssl;
    server_name basedata.bychome.xyz;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://192.168.1.237:5199;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Authorization, Content-Type";
    }
}

# livedata.bychome.xyz - PLC Data
server {
    listen 443 ssl;
    server_name livedata.bychome.xyz;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://192.168.1.237:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
    }
}
```

## 🐛 Bilinen Sorunlar ve Çözümleri

### 1. WebSocket HMR Hatası (Production)
**Hata:** `Mixed Content: attempted to connect to insecure WebSocket`

**Çözüm:** Production'da HMR gerekmez. Build yapıp static olarak serve edin:
```bash
npm run build
npx serve -s dist -l 5173
```

### 2. CORS Hatası
**Hata:** `No 'Access-Control-Allow-Origin' header`

**Çözüm:** Backend'lerde CORS'u aktif edin veya Nginx'te header ekleyin (yukarıda gösterildiği gibi).

### 3. 401 Unauthorized
**Hata:** `GET .../api/auth/users 401`

**Çözüm:** Token doğru gönderilmiyor. Kontrol edin:
- Token localStorage/sessionStorage'da var mı?
- Token geçerli mi?
- Backend JWT secret'ı doğru mu?

### 4. res.data.map is not a function
**Hata:** API response array değil

**Çözüm:** API endpoint'in doğru veri formatında response döndüğünden emin olun.

## 📝 Development vs Production

### Development (192.168.1.x)
- Vite dev server kullanılır (HMR aktif)
- HTTP üzerinden çalışır
- Direkt IP adresleri kullanılır

### Production (.bychome.xyz)
- Build edil miş static dosyalar serve edilir
- HTTPS zorunlu
- Domain'ler kullanılır
- HMR kapalı

## ✅ Checklist

- [ ] Backend API'ler çalışıyor (5199, 8080)
- [ ] CORS header'ları eklendi
- [ ] SSL sertifikaları kuruldu
- [ ] Domain → IP mapping yapıldı
- [ ] Frontend build edildi
- [ ] Reverse proxy yapılandırıldı
- [ ] Firewall portları açık

