# Robot Data Collector

Robot PLC'den Modbus TCP protokolü ile veri okuma programı. **Windows Forms GUI** ile kullanıcı dostu arayüz.

## Özellikler

- 🖥️ **Windows Forms GUI** - Konsol yerine görsel arayüz
- 📡 Modbus TCP haberleşmesi (ETOR üzerinden RS485 -> Ethernet)
- 🔴 Coil okuma (Function Code 01) - Alarm ve running durumları
- 📊 Hold Register okuma (Function Code 03) - Sayısal veriler
- 🔄 **CANLI VERİ ÇEKME** - Belirlenen aralıklarla (varsayılan 2 saniye) sürekli okuma
- 🔧 **Byte Order Varyantları** - Farklı byte sıralaması seçenekleri (High-Low, Low-High, Swap)
- 🐛 **Debug Modu** - Register okuma detayları ve hex response'ları log ekranında
- 📝 Log ekranı ile işlem takibi

## Modbus Ayarları

- **Interface**: RS485 (ETOR ile Ethernet'e dönüştürülür)
- **Baud Rate**: 9600 bps
- **Stop Bit**: 1 bit
- **Parity**: Even
- **Station Number**: 01 (hex)
- **Protocol**: Modbus TCP (Port 502)

## Okunan Veriler

### Coil'ler (Function Code 01)
- **0-6**: Alarm durumları
  - 0: Isometric Belt Alarm
  - 1: Good Product Gantry Alarm
  - 2: Side Push Mechanism 1 Alarm
  - 3: Side Push Mechanism 2 Alarm
  - 4: Forming Platform Alarm
  - 5: Reject Mechanism Alarm
  - 6: Pallet Line Alarm
- **20**: Reset Counter
- **50-52**: Running durumları
  - 50: Isometric Belt Running
  - 51: Palletising Mechanism Running
  - 52: Pallet Line Running

### Hold Register'lar (Function Code 03)
- **0**: Number of qualified items
- **1**: Number of defective items
- **2**: Number of pallets with good items
- **3**: Number of pallets with defective items
- **4**: Status of equidistant belt conveyor
- **5**: Status of palletising mechanism

### Status Kodları
- 1: Manuel Mod
- 2: Çalışıyor
- 3: Alarm Aktif
- 4: Cihaz Beklemede
- 5: Cihaz İnitialize Edilmemiş

## Kullanım

### EXE Dosyası Oluşturma

**Tek bir EXE dosyası oluşturmak için:**

1. **Otomatik (Batch dosyası ile):**
   ```bash
   build-exe.bat
   ```

2. **Manuel (Komut satırı ile):**
   ```bash
   dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
   ```

Oluşturulan EXE dosyası: `bin\Release\net8.0-windows\win-x64\publish\RobotDataCollector.exe`

Bu EXE dosyası bağımsız çalışır, .NET runtime'ı içerir ve başka bir bilgisayarda .NET yüklü olmasa bile çalışır.

### Geliştirme Modu

**Derleme:**
```bash
dotnet build
```

**Çalıştırma:**
```bash
dotnet run
```

Program açıldığında Windows Forms penceresi görünecektir.

### GUI Kullanımı

1. **Bağlantı Ayarları:**
   - IP Adresi: ETOR cihazının IP adresi (varsayılan: 192.168.1.31)
   - Port: Modbus TCP port (varsayılan: 502)
   - Slave ID: PLC Station Number (varsayılan: 1)
   - Interval: Okuma sıklığı milisaniye cinsinden (varsayılan: 2000ms)
   - **Byte Order:** Register verilerinin byte sıralaması (varsayılan: Varyant 1 - High-Low)

2. **Bağlan:** Butonuna tıklayarak PLC'ye bağlanın

   **NOT:** Program bağlandıktan sonra **CANLI olarak** belirlediğiniz aralıklarla (örn: 2 saniye) sürekli veri çeker ve ekranda günceller. "Bağlantıyı Kes" butonuna basana kadar okuma devam eder.

3. **Veri Görüntüleme:**
   - **Alarm Durumları:** Kırmızı/yeşil renklerle alarm durumları (gerçek zamanlı)
   - **Çalışma Durumları:** Yeşil/gri renklerle çalışma durumları (gerçek zamanlı)
   - **Veriler:** Sayısal değerler (qualified items, defective items, vb.) (gerçek zamanlı)
   - **Cihaz Durumları:** Status kodları ve açıklamaları (gerçek zamanlı)
   - **Log:** Tüm işlemlerin kaydı ve debug bilgileri (register response'ları, varyant değerleri)

4. **Register Okuma Sorunları:**
   - Eğer register değerleri yanlış geliyorsa, **Byte Order** seçeneğini değiştirin
   - Log ekranında her register için 3 varyant değeri gösterilir
   - Hangi varyantın doğru olduğunu görmek için log ekranını kontrol edin

5. **Bağlantıyı Kes:** Butonuna tıklayarak bağlantıyı sonlandırın

## Excel'den Okunan Tüm Veriler

Program Excel'deki tüm Modbus haberleşme bilgilerini içerir:

### Coil'ler (Function Code 01)
- ✅ **0-6:** Tüm alarm durumları (7 adet)
- ✅ **20:** Reset Counter
- ✅ **50-52:** Tüm running durumları (3 adet)

### Hold Register'lar (Function Code 03)
- ✅ **0:** Qualified items count
- ✅ **1:** Defective items count
- ✅ **2:** Good pallets count
- ✅ **3:** Defective pallets count
- ✅ **4:** Equidistant belt status
- ✅ **5:** Palletising mechanism status

### Status Kodları
- ✅ **1:** Manuel Mod
- ✅ **2:** Çalışıyor
- ✅ **3:** Alarm Aktif
- ✅ **4:** Cihaz Beklemede
- ✅ **5:** Cihaz İnitialize Edilmemiş

## Varsayılan Ayarlar

- IP: `192.168.1.31` (ETOR IP adresi)
- Port: `502` (Modbus TCP)
- Slave ID: `1` (0x01)
- Okuma Sıklığı: `2000ms` (2 saniye)

## Notlar

- Program sistemden bağımsız çalışır, test amaçlıdır
- Başarılı olursa ana sisteme entegre edilebilir
- ETOR cihazı RS485'i Ethernet'e dönüştürür
- Ctrl+C ile program durdurulabilir

