# Remote Access - Uzaktan Erişim Sistemi

AnyDesk/TeamViewer alternatifi, WebRTC tabanlı uzaktan erişim sistemi.

## 🚀 Özellikler

- ✅ WebRTC ile peer-to-peer bağlantı
- ✅ Ekran paylaşımı
- ✅ Düşük gecikme
- ✅ Kullanıcı girişi gerektirmez
- ✅ Tek program (host ve client aynı arayüz)
- ✅ Modern ve hızlı

## 📦 Kurulum

### 1. Bağımlılıkları Yükle

```bash
cd remoteAcces
npm install
```

### 2. Sunucuyu Başlat

```bash
npm start
```

Sunucu `http://localhost:4000` adresinde çalışacak.

## 🌐 Kullanım

1. Tarayıcıda `http://localhost:4000` adresini açın
2. **Ekran Paylaşımı:** "Ekranı Paylaş" butonuna tıklayın ve paylaşmak istediğiniz ekranı seçin
3. **Bağlan:** Oda ID'sini girin (veya boş bırakın) ve "Bağlan" butonuna tıklayın
4. **Uzak Bağlantı:** Başka bir cihazdan aynı oda ID'si ile bağlanın
5. **Bağlantıyı Kes:** İşiniz bittiğinde "Bağlantıyı Kes" butonuna tıklayın

## 🔧 Konfigürasyon

### Port

Varsayılan port: `4000`

Portu değiştirmek için `server.js` dosyasındaki `PORT` değişkenini düzenleyin.

### Domain Tunnel

`remote.bychome.xyz` adresini tunnel etmek için reverse proxy (Nginx/Caddy) kullanabilirsiniz:

```nginx
server {
    listen 443 ssl;
    server_name remote.bychome.xyz;
    
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📝 Notlar

- WebRTC için STUN server kullanılıyor (Google'ın ücretsiz STUN server'ı)
- NAT arkasındaki cihazlar için TURN server gerekebilir (isteğe bağlı)
- Tarayıcı güvenlik kısıtlamaları nedeniyle fare/klavye kontrolü sınırlı olabilir
- HTTPS gerektirir (production'da)

## 🔒 Güvenlik

- Kullanıcı girişi yok (kişisel kullanım için)
- Oda ID'leri rastgele oluşturulur
- WebRTC bağlantıları şifrelenir

## 🛠️ Teknoloji

- Node.js + Express
- Socket.io (WebRTC signaling)
- WebRTC API
- HTML5 + CSS3 + Vanilla JavaScript

