# Remote Access - Desktop Uygulaması

Electron tabanlı desktop uygulaması ile gerçek fare ve klavye kontrolü.

## 🚀 Kurulum

### 1. Bağımlılıkları Yükle

```bash
cd remoteAcces
npm install
```

**Not:** RobotJS native modül olduğu için build tools gerekebilir:
- Windows: Visual Studio Build Tools
- veya: `npm install --global windows-build-tools`

### 2. RobotJS'yi Electron için Rebuild Et

RobotJS native modül olduğu için Electron'un Node.js versiyonuna göre rebuild edilmesi gerekir:

```bash
npm run rebuild
```

veya

```bash
rebuild.bat
```

**İlk kurulumda mutlaka rebuild yapın!**

### 3. Desktop Uygulamasını Başlat

```bash
npm run electron
```

veya

```bash
start-electron.bat
```

## 🎯 Özellikler

- ✅ **Gerçek Fare Kontrolü**: Uzak bilgisayarın faresini kontrol edebilirsiniz
- ✅ **Gerçek Klavye Kontrolü**: Uzak bilgisayarın klavyesini kullanabilirsiniz
- ✅ **Tam Ekran**: Uzak ekranı tam ekran modunda görüntüleyebilirsiniz
- ✅ **Çoklu Ekran Desteği**: Birden fazla ekranı paylaşabilirsiniz
- ✅ **Düşük Gecikme**: WebRTC ile hızlı bağlantı

## 📦 Build (Kurulum Dosyası Oluştur)

```bash
npm run build
```

Windows için `.exe` kurulum dosyası oluşturulur.

## 🔧 Kullanım

1. **Host (Ekran Paylaşan):**
   - Uygulamayı açın
   - "Ekranı Paylaş" butonuna tıklayın
   - Paylaşmak istediğiniz ekranı seçin
   - Oda ID'sini girin ve "Bağlan" butonuna tıklayın

2. **Client (Bağlanan):**
   - Uygulamayı açın (veya web tarayıcısından `http://localhost:4000`)
   - Oda ID'sini girin (host'un kullandığı ID ile aynı)
   - "Bağlan" butonuna tıklayın
   - "Kontrol Et" butonu ile fare ve klavye kontrolünü aktif edin
   - Artık uzak bilgisayarı kontrol edebilirsiniz!

## ⚠️ Notlar

- RobotJS native modül olduğu için ilk kurulumda build gerekebilir
- Windows'ta yönetici yetkisi gerekebilir (fare/klavye kontrolü için)
- Güvenlik: Sadece güvendiğiniz kişilerle kullanın

## 🛠️ Teknoloji

- Electron
- RobotJS (Fare/Klavye kontrolü)
- WebRTC (Ekran paylaşımı)
- Socket.io (Signaling)

