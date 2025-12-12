#include <Ethernet.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_AHTX0.h>

// Hardware I2C (Arduino Uno için)
Adafruit_AHTX0 aht;
EthernetServer server(80);

// MAC benzersiz olsun
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0x09 };

// Ağ ayarları - IP: 192.168.0.174 (IT tarafından verilen)
IPAddress ip(192, 168, 0, 174);
IPAddress gateway(192, 168, 0, 1);
IPAddress subnet(255, 255, 254, 0);

// CS pin denemeleri için
const int CS_PINS[] = {10, 4, 53}; // Pin 10, 4, 53 sırayla denenir
int currentCS = 0;

// W5100 Register Adresleri
#define W5100_MR      0x0000  // Mode Register
#define W5100_GAR     0x0001  // Gateway Address Register (4 byte)
#define W5100_SUBR    0x0005  // Subnet Mask Register (4 byte)
#define W5100_SHAR    0x0009  // Source Hardware Address (MAC) (6 byte)
#define W5100_SIPR    0x000F  // Source IP Address Register (4 byte)

// W5100 Register okuma/yazma fonksiyonları
uint8_t readW5100Register(int csPin, uint16_t address) {
  digitalWrite(csPin, LOW);
  delayMicroseconds(10); // CS setup time
  SPI.transfer(0x0F); // Read command
  SPI.transfer((address >> 8) & 0xFF); // Address high byte
  SPI.transfer(address & 0xFF); // Address low byte
  uint8_t data = SPI.transfer(0x00);
  delayMicroseconds(10); // CS hold time
  digitalWrite(csPin, HIGH);
  delayMicroseconds(10); // CS recovery time
  return data;
}

void writeW5100Register(int csPin, uint16_t address, uint8_t data) {
  // Datasheet timing: /SS low to SCLK high: 21ns min
  // Input setup time: 7ns min, Input hold time: 28ns min
  // SCLK time: 70ns min
  
  // KRITIK: Pin 10'u LOW tut (SEN pin'i için)
  digitalWrite(10, LOW);
  
  digitalWrite(csPin, LOW);
  delayMicroseconds(1); // CS setup time (datasheet: 21ns min, biz 1us kullanıyoruz)
  
  SPI.transfer(0xF0); // Write command
  delayMicroseconds(1); // Timing için bekle
  
  SPI.transfer((address >> 8) & 0xFF); // Address high byte
  delayMicroseconds(1);
  
  SPI.transfer(address & 0xFF); // Address low byte
  delayMicroseconds(1);
  
  SPI.transfer(data); // Data
  delayMicroseconds(1); // Input hold time (datasheet: 28ns min)
  
  // SCLK high to /SS high: 21ns min
  delayMicroseconds(1);
  digitalWrite(csPin, HIGH);
  delayMicroseconds(1); // CS recovery time
  
  // KRITIK: Pin 10'u LOW tut (SEN pin'i için)
  digitalWrite(10, LOW);
}

void testW5100Registers(int csPin) {
  // W5100 chip'i reset et (MR register'ını 0x80 yaparak soft reset)
  Serial.println(F("[REG] W5100 soft reset deneniyor..."));
  writeW5100Register(csPin, W5100_MR, 0x80); // Soft reset
  delay(100);
  
  // MR'yi oku
  uint8_t mr = readW5100Register(csPin, W5100_MR);
  Serial.print(F("[REG] MR okunan deger: 0x"));
  if (mr < 0x10) Serial.print(F("0"));
  Serial.println(mr, HEX);
  
  // MR'ye yazma testi (0x03 = normal mode)
  Serial.println(F("[REG] MR'ye 0x03 yaziliyor..."));
  writeW5100Register(csPin, W5100_MR, 0x03);
  delay(50); // Daha uzun bekle
  mr = readW5100Register(csPin, W5100_MR);
  Serial.print(F("[REG] MR yazma sonrasi: 0x"));
  if (mr < 0x10) Serial.print(F("0"));
  Serial.print(mr, HEX);
  
  if (mr == 0x03) {
    Serial.println(F(" [OK] MR register yazma/okuma calisiyor!"));
  } else {
    Serial.println(F(" [HATA] MR register yazma/okuma CALISMIYOR!"));
    Serial.println(F("[DIAG] SPI yazma sorunu olabilir"));
  }
  
  // SIPR (Source IP) register testi
  Serial.println(F("[REG] SIPR (Source IP) register testi..."));
  Serial.print(F("[REG] SIPR okunan degerler: "));
  for (int i = 0; i < 4; i++) {
    uint8_t val = readW5100Register(csPin, W5100_SIPR + i);
    Serial.print(val);
    if (i < 3) Serial.print(F("."));
  }
  Serial.println();
  
  // SIPR'ye yazma testi
  Serial.println(F("[REG] SIPR'ye IP yazma testi (192.168.0.174)..."));
  writeW5100Register(csPin, W5100_SIPR + 0, 192);
  writeW5100Register(csPin, W5100_SIPR + 1, 168);
  writeW5100Register(csPin, W5100_SIPR + 2, 0);
  writeW5100Register(csPin, W5100_SIPR + 3, 174);
  delay(10);
  
  Serial.print(F("[REG] SIPR tekrar okunan degerler: "));
  bool siprOK = true;
  uint8_t expected[] = {192, 168, 0, 174};
  for (int i = 0; i < 4; i++) {
    uint8_t val = readW5100Register(csPin, W5100_SIPR + i);
    Serial.print(val);
    if (i < 3) Serial.print(F("."));
    if (val != expected[i]) siprOK = false;
  }
  Serial.println();
  
  if (siprOK) {
    Serial.println(F("[OK] SIPR register yazma/okuma calisiyor!"));
  } else {
    Serial.println(F("[HATA] SIPR register yazma/okuma CALISMIYOR!"));
    Serial.println(F("[DIAG] IP register'lari bozuk olabilir"));
  }
  
  // GAR (Gateway) register testi
  Serial.println(F("[REG] GAR (Gateway) register testi..."));
  Serial.print(F("[REG] GAR okunan degerler: "));
  for (int i = 0; i < 4; i++) {
    uint8_t val = readW5100Register(csPin, W5100_GAR + i);
    Serial.print(val);
    if (i < 3) Serial.print(F("."));
  }
  Serial.println();
  
  // SUBR (Subnet) register testi
  Serial.println(F("[REG] SUBR (Subnet) register testi..."));
  Serial.print(F("[REG] SUBR okunan degerler: "));
  for (int i = 0; i < 4; i++) {
    uint8_t val = readW5100Register(csPin, W5100_SUBR + i);
    Serial.print(val);
    if (i < 3) Serial.print(F("."));
  }
  Serial.println();
  
  Serial.println(F("[REG] Register testi tamamlandi\n"));
}

void testSPIPins() {
  // Kısa test
  Serial.println(F("[PIN] CS pin testi..."));
  for (int i = 0; i < 3; i++) {
    int csPin = CS_PINS[i];
    pinMode(csPin, OUTPUT);
    digitalWrite(csPin, LOW);
    delay(5);
    int readLow = digitalRead(csPin);
    digitalWrite(csPin, HIGH);
    delay(5);
    int readHigh = digitalRead(csPin);
    Serial.print(F("CS"));
    Serial.print(csPin);
    if (readLow == LOW && readHigh == HIGH) {
      Serial.print(F(":OK "));
    } else {
      Serial.print(F(":ERR "));
    }
  }
  Serial.println();
}

void testW5100PowerAndReset(int csPin) {
  // Kısa test - sadece SPI komutlarını dene
  uint8_t readCmds[] = {0x0F, 0x00};
  for (int i = 0; i < 2; i++) {
    digitalWrite(csPin, LOW);
    delayMicroseconds(10);
    SPI.transfer(readCmds[i]);
    SPI.transfer(0x00);
    SPI.transfer(0x00);
    uint8_t data = SPI.transfer(0x00);
    delayMicroseconds(10);
    digitalWrite(csPin, HIGH);
    delayMicroseconds(10);
    Serial.print(F("Cmd 0x"));
    if (readCmds[i] < 0x10) Serial.print(F("0"));
    Serial.print(readCmds[i], HEX);
    Serial.print(F("->0x"));
    if (data < 0x10) Serial.print(F("0"));
    Serial.print(data, HEX);
    Serial.print(F(" "));
    if (data != 0x00 && data != 0xFF) {
      Serial.print(F("[OK]"));
      break;
    }
  }
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n=========================================="));
  Serial.println(F("[TEST] Ethernet IP Alma Testi"));
  Serial.println(F("=========================================="));

  // Hardware I2C başlat (Uno: SDA=A4, SCL=A5)
  Wire.begin();
  Wire.setClock(100000); // 100 kHz
  delay(100);
  
  if (!aht.begin()) {
    Serial.println(F("[WARN] AHT10 bulunamadi (normal)"));
  } else {
    Serial.println(F("[OK] AHT10 aktif!"));
  }

  // KRITIK: Pin 10'u LOW yap (SS sinyali -> SEN pin'i için)
  Serial.println(F("\n[KRITIK] Pin 10 (SS) LOW yapiliyor (SEN pin'i icin)..."));
  pinMode(10, OUTPUT);
  digitalWrite(10, LOW);  // SS sinyali LOW -> IC3A giriş LOW -> SEN HIGH -> SPI Enable
  delay(100);
  Serial.println(F("[OK] Pin 10 LOW yapildi -> SEN pin'i HIGH olmali"));
  
  // SPI başlat - farklı modlar dene
  Serial.println(F("\n[SPI] SPI baslatiliyor..."));
  SPI.begin();
  SPI.setClockDivider(SPI_CLOCK_DIV4); // Daha yavaş clock (4MHz)
  SPI.setBitOrder(MSBFIRST);
  SPI.setDataMode(SPI_MODE0); // CPOL=0, CPHA=0
  delay(100);
  
  Serial.println(F("[SPI] SPI ayarlari:"));
  Serial.println(F("  - Clock: 4MHz (DIV4)"));
  Serial.println(F("  - Bit Order: MSBFIRST"));
  Serial.println(F("  - Mode: SPI_MODE0 (CPOL=0, CPHA=0)"));

  // Hardware reset denemesi
  Serial.println(F("[TEST] Hardware reset deneniyor..."));
  delay(500);
  
  // SPI Pin Testi - Pin'lerin çalışıp çalışmadığını kontrol et
  Serial.println(F("\n[PIN TEST] SPI pin baglantilari test ediliyor..."));
  testSPIPins();

  // CS pin'lerini sırayla dene
  bool ethernetOK = false;
  
  for (int i = 0; i < 3; i++) {
    int csPin = CS_PINS[i];
    Serial.print(F("\n========================================"));
    Serial.print(F("\n[TEST] CS Pin "));
    Serial.print(csPin);
    Serial.println(F(" deneniyor..."));
    Serial.println(F("========================================"));
    
    // CS pin'i ayarla
    pinMode(csPin, OUTPUT);
    digitalWrite(csPin, HIGH);
    delay(100);
    
    // W5100 chip reset - CS pin'i toggle et
    Serial.println(F("[TEST] W5100 chip reset (CS toggle)..."));
    for (int j = 0; j < 5; j++) {
      digitalWrite(csPin, LOW);
      delay(10);
      digitalWrite(csPin, HIGH);
      delay(10);
    }
    delay(200);
    
    // KRITIK: Pin 10'u LOW yap (Ethernet.init() öncesi)
    digitalWrite(10, LOW);
    Ethernet.init(csPin);
    delay(200);
    
    // W5100 Power ve Reset Testi
    testW5100PowerAndReset(csPin);
    
    // W5100 Register Testi - SPI haberleşmesini kontrol et
    Serial.println(F("[TEST] W5100 Register testi basliyor..."));
    testW5100Registers(csPin);
    
    // Yöntem 1: Normal Ethernet.begin() ile static IP
    Serial.println(F("[TEST] Yontem 1: Ethernet.begin(mac, ip, gateway, gateway, subnet)"));
    // KRITIK: Pin 10'u LOW yap (Ethernet.begin() öncesi)
    digitalWrite(10, LOW);
    unsigned long startTime = millis();
    
    Ethernet.begin(mac, ip, gateway, gateway, subnet);
    
    unsigned long elapsed = millis() - startTime;
    Serial.print(F("[TEST] Ethernet.begin() suresi: "));
    Serial.print(elapsed);
    Serial.println(F(" ms"));
    
    delay(1000);
    
    IPAddress receivedIP = Ethernet.localIP();
    Serial.print(F("[TEST] Alinan IP: "));
    Serial.println(receivedIP);
    
    if (receivedIP == ip) {
      Serial.println(F("[OK] IP basariyla alindi!"));
      currentCS = csPin;
      ethernetOK = true;
      break;
    } else if (receivedIP[0] != 0 || receivedIP[1] != 0 || receivedIP[2] != 0 || receivedIP[3] != 0) {
      Serial.print(F("[WARN] Farkli IP alindi: "));
      Serial.println(receivedIP);
      Serial.println(F("[INFO] Bu IP kullanilabilir, devam ediliyor..."));
      currentCS = csPin;
      ethernetOK = true;
      break;
    }
    
    // Yöntem 2: Sadece MAC ile başlat (DHCP benzeri)
    Serial.println(F("\n[TEST] Yontem 2: Ethernet.begin(mac) - DHCP benzeri"));
    delay(500);
    // KRITIK: Pin 10'u LOW yap
    digitalWrite(10, LOW);
    Ethernet.init(csPin);
    delay(200);
    
    // KRITIK: Pin 10'u LOW yap
    digitalWrite(10, LOW);
    startTime = millis();
    Ethernet.begin(mac);
    elapsed = millis() - startTime;
    
    Serial.print(F("[TEST] Ethernet.begin(mac) suresi: "));
    Serial.print(elapsed);
    Serial.println(F(" ms"));
    
    delay(2000);
    receivedIP = Ethernet.localIP();
    Serial.print(F("[TEST] Alinan IP (DHCP): "));
    Serial.println(receivedIP);
    
    if (receivedIP[0] != 0 || receivedIP[1] != 0 || receivedIP[2] != 0 || receivedIP[3] != 0) {
      Serial.println(F("[OK] DHCP ile IP alindi!"));
      currentCS = csPin;
      ethernetOK = true;
      break;
    }
    
    // Yöntem 3: Manuel IP ayarlama
    Serial.println(F("\n[TEST] Yontem 3: Manuel IP ayarlama"));
    delay(500);
    // KRITIK: Pin 10'u LOW yap
    digitalWrite(10, LOW);
    Ethernet.init(csPin);
    delay(200);
    
    // KRITIK: Pin 10'u LOW yap
    digitalWrite(10, LOW);
    Ethernet.begin(mac);
    delay(1000);
    
    // Manuel olarak IP ayarla
    Ethernet.setLocalIP(ip);
    Ethernet.setGatewayIP(gateway);
    Ethernet.setSubnetMask(subnet);
    
    delay(500);
    receivedIP = Ethernet.localIP();
    Serial.print(F("[TEST] Manuel ayarlanan IP: "));
    Serial.println(receivedIP);
    
    if (receivedIP == ip) {
      Serial.println(F("[OK] Manuel IP ayarlandi!"));
      currentCS = csPin;
      ethernetOK = true;
      break;
    }
    
    Serial.println(F("\n[HATA] Bu CS pin'de hicbir yontemle IP alinamadi"));
    delay(1000);
  }

  if (!ethernetOK) {
    Serial.println(F("\n[CRITICAL] Hicbir yontemle IP alinamadi!"));
    Serial.println(F("\n[DIAGNOSTIC] Olası sorunlar:"));
    Serial.println(F("  1. W5100 chip bozuk (kısmen calisiyor ama IP ayarlayamiyor)"));
    Serial.println(F("  2. SPI haberlesme yarim calisiyor"));
    Serial.println(F("  3. W5100 chip'in register'lari bozuk"));
    Serial.println(F("  4. Ethernet shield fiziksel olarak hasarli"));
    Serial.println(F("\n[ONERI] Shield'i degistirmeyi deneyin"));
    Serial.println(F("\n[INFO] Test modunda devam ediliyor..."));
  } else {
    Serial.print(F("\n[OK] Basarili CS Pin: "));
    Serial.println(currentCS);
    
    delay(300);
    server.begin();
    
    Serial.println(F("\n=========================================="));
    Serial.print(F("[NET] IP Adresi: "));
    Serial.println(Ethernet.localIP());
    Serial.print(F("[NET] Gateway: "));
    Serial.println(Ethernet.gatewayIP());
    Serial.print(F("[NET] Subnet: "));
    Serial.println(Ethernet.subnetMask());
    Serial.println(F("[HTTP] Sunucu 80 portunda hazir (/data)"));
    Serial.print(F("Test: http://"));
    Serial.print(Ethernet.localIP());
    Serial.println(F("/data"));
    Serial.println(F("=========================================="));
  }
  
}

void loop() {
  // KRITIK: Pin 10'u sürekli LOW tut (SEN pin'i için)
  digitalWrite(10, LOW);
  
  // Her 5 saniyede bir IP durumunu kontrol et
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck >= 5000) {
    lastCheck = millis();
    IPAddress currentIP = Ethernet.localIP();
    Serial.print(F("[MONITOR] IP Durumu: "));
    Serial.println(currentIP);
    
    if (currentIP[0] == 0 && currentIP[1] == 0 && currentIP[2] == 0 && currentIP[3] == 0) {
      Serial.println(F("[WARN] IP kaybedildi! Yeniden deneniyor..."));
      // KRITIK: Pin 10'u LOW yap
      digitalWrite(10, LOW);
      Ethernet.init(currentCS);
      delay(200);
      // KRITIK: Pin 10'u LOW yap
      digitalWrite(10, LOW);
      Ethernet.begin(mac, ip, gateway, gateway, subnet);
      delay(500);
    }
  }
  
  // Basit HTTP server testi
  EthernetClient client = server.available();
  if (client) {
    Serial.println(F("[HTTP] Yeni istemci baglandi!"));
    unsigned long startTime = millis();
    while (client.connected() && (millis() - startTime < 5000)) {
      if (client.available()) {
        String req = client.readStringUntil('\n');
        Serial.print(F("[HTTP] Request: "));
        Serial.println(req);
        
        if (req.indexOf("GET /data") >= 0) {
          Serial.println(F("[HTTP] /data endpoint'i cagrildi"));
          client.println(F("HTTP/1.1 200 OK"));
          client.println(F("Content-Type: application/json"));
          client.println(F("Access-Control-Allow-Origin: *"));
          client.println(F("Connection: close"));
          client.println();
          client.println(F("{\"test\":\"ok\",\"ip\":\"192.168.0.174\"}"));
          Serial.println(F("[HTTP] Yanit gonderildi"));
        } else if (req.indexOf("GET /") >= 0) {
          Serial.println(F("[HTTP] Genel GET istegi"));
          client.println(F("HTTP/1.1 200 OK"));
          client.println(F("Content-Type: text/plain"));
          client.println(F("Connection: close"));
          client.println();
          client.println(F("HTTP Server Test OK"));
          Serial.println(F("[HTTP] Yanit gonderildi"));
        }
        break;
      }
    }
    delay(1);
    client.stop();
    Serial.println(F("[HTTP] Baglanti kapandi"));
  }
}

