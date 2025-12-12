#include <Ethernet.h>
#include <Wire.h>
#include <Adafruit_AHTX0.h>
#include <EEPROM.h>
#include <avr/pgmspace.h>
#include <stdlib.h>
#include <string.h>

#define OLED_ADDRESS 0x3C
#define OLED_WIDTH 128
#define OLED_HEIGHT 32
#define OLED_PAGES (OLED_HEIGHT / 8)

bool displayReady = false;
const uint8_t PROGMEM thermometerIcon[] = {
  0b00000000,
  0b01000000,
  0b11111111,
  0b11111111,
  0b11100000,
  0b11100000,
  0b01000000,
  0b00000000
};

const uint8_t PROGMEM dropletIcon[] = {
  0b00000000,
  0b00110000,
  0b01111100,
  0b11111111,
  0b01111100,
  0b00110000,
  0b00000000,
  0b00000000
};

const char glyphChars[] PROGMEM = {
  ' ', '%', ':', '.', '-', '0', '1', '2', '3', '4',
  '5', '6', '7', '8', '9', 'S', 'i', 'c', 'a', 'k',
  'l', 'N', 'e', 'm', 'C', 'y', 'D', 't', 'L', 'o',
  'g', 'r', 'H', 'z', 'O', 'E', 'Z', 'I', 'R', 'A'
};

const uint8_t glyphBitmaps[][5] PROGMEM = {
  {0x00, 0x00, 0x00, 0x00, 0x00}, // space
  {0x62, 0x64, 0x08, 0x13, 0x23}, // %
  {0x00, 0x36, 0x36, 0x00, 0x00}, // :
  {0x00, 0x60, 0x60, 0x00, 0x00}, // .
  {0x08, 0x08, 0x08, 0x08, 0x08}, // -
  {0x3E, 0x51, 0x49, 0x45, 0x3E}, // 0
  {0x00, 0x42, 0x7F, 0x40, 0x00}, // 1
  {0x62, 0x51, 0x49, 0x49, 0x46}, // 2
  {0x22, 0x41, 0x49, 0x49, 0x36}, // 3
  {0x18, 0x14, 0x12, 0x7F, 0x10}, // 4
  {0x27, 0x45, 0x45, 0x45, 0x39}, // 5
  {0x3C, 0x4A, 0x49, 0x49, 0x30}, // 6
  {0x01, 0x71, 0x09, 0x05, 0x03}, // 7
  {0x36, 0x49, 0x49, 0x49, 0x36}, // 8
  {0x06, 0x49, 0x49, 0x29, 0x1E}, // 9
  {0x26, 0x49, 0x49, 0x49, 0x32}, // S
  {0x00, 0x44, 0x7D, 0x40, 0x00}, // i
  {0x38, 0x44, 0x44, 0x44, 0x28}, // c
  {0x20, 0x54, 0x54, 0x54, 0x78}, // a
  {0x7F, 0x10, 0x28, 0x44, 0x00}, // k
  {0x40, 0x7F, 0x40, 0x00, 0x00}, // l
  {0x7F, 0x04, 0x08, 0x10, 0x7F}, // N
  {0x38, 0x54, 0x54, 0x54, 0x18}, // e
  {0x7C, 0x04, 0x18, 0x04, 0x78}, // m
  {0x3C, 0x42, 0x41, 0x41, 0x22}, // C
  {0x0C, 0x50, 0x50, 0x50, 0x3C}, // y
  {0x7F, 0x41, 0x41, 0x22, 0x1C}, // D
  {0x04, 0x3F, 0x44, 0x40, 0x20}, // t
  {0x7F, 0x40, 0x40, 0x40, 0x40}, // L
  {0x38, 0x44, 0x44, 0x44, 0x38}, // o
  {0x08, 0x54, 0x54, 0x54, 0x3C}, // g
  {0x7C, 0x08, 0x04, 0x04, 0x08}, // r
  {0x7F, 0x08, 0x08, 0x08, 0x7F}, // H
  {0x44, 0x64, 0x54, 0x4C, 0x44}, // z
  {0x3E, 0x41, 0x41, 0x41, 0x3E}, // O
  {0x7F, 0x49, 0x49, 0x49, 0x41}, // E
  {0x61, 0x51, 0x49, 0x45, 0x43}, // Z
  {0x41, 0x41, 0x7F, 0x41, 0x41}, // I
  {0x7F, 0x09, 0x19, 0x29, 0x46}, // R
  {0x7E, 0x11, 0x11, 0x11, 0x7E}  // A
};

bool initOLED();
void showStartupMessage();
void updateDisplay(float temperature, float humidity);

const uint8_t oledInitSequence[] PROGMEM = {
  0xAE,       // Display off
  0xD5, 0x80, // Clock divide ratio
  0xA8, 0x1F, // Multiplex ratio (31 for 128x32)
  0xD3, 0x00, // Display offset
  0x40,       // Display start line
  0x8D, 0x14, // Charge pump
  0x20, 0x00, // Horizontal addressing mode
  0xA1,       // Segment remap
  0xC8,       // COM output scan direction
  0xDA, 0x02, // COM pins hardware config
  0x81, 0x8F, // Contrast
  0xD9, 0xF1, // Pre-charge
  0xDB, 0x40, // VCOM detect
  0xA4,       // Output follows RAM
  0xA6,       // Normal display
  0xAF        // Display on
};

// Hardware I2C (Arduino Uno için)
Adafruit_AHTX0 aht;
EthernetServer server(80);

// MAC benzersiz olsun
//byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0x01 };
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0x04 };

// Ağ ayarları - IP: 192.168.0.174 (IT tarafından verilen)
IPAddress ip(192, 168, 0, 168);
IPAddress gateway(192, 168, 0, 1);  // Gateway: 192.168.0.1
IPAddress subnet(255, 255, 254, 0);  // Subnet mask: 255.255.254.0 (/23)

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println(F("\n[BOOT] W5100 + AHT10 (Arduino Uno) baslatiliyor..."));

  // Hardware I2C başlat (Uno: SDA=A4, SCL=A5)
  Wire.begin();
  Wire.setClock(100000); // 100 kHz
  delay(100);

  displayReady = initOLED();
  if (displayReady) {
    showStartupMessage();
  } else {
    Serial.println(F("[WARN] OLED bulunamadi veya bagli degil."));
  }
  
  if (!aht.begin()) {
    Serial.println(F("[HATA] AHT10 baslatilamadi!"));
    Serial.println(F("Kontrol edin:"));
    Serial.println(F("- SDA -> A4"));
    Serial.println(F("- SCL -> A5"));
    Serial.println(F("- VCC -> 3.3V"));
    Serial.println(F("- GND -> GND"));
  } else {
    Serial.println(F("[OK] AHT10 aktif!"));
  }

  // KRITIK: Pin 10'u LOW yap (SS sinyali -> SEN pin'i için)
  // Arduino Ethernet Shield V5'te Pin 10 -> IC3A girişi -> SEN pin'i kontrol eder
  // Pin 10 LOW -> SEN HIGH -> SPI Enable
  pinMode(10, OUTPUT);
  digitalWrite(10, LOW);
  delay(100);
  
  // SPI başlat
  SPI.begin();

  // Ethernet başlat (direkt static IP - DHCP yok)
  // DHCP'yi tamamen devre dışı bırak
  Serial.println(F("[NET] Ethernet baslatiliyor..."));
  delay(100);
  // KRITIK: Ethernet.init() ile CS pin'ini belirt (Pin 10)
  Ethernet.init(10);
  // KRITIK: Ethernet.begin() öncesi Pin 10'u LOW tut
  digitalWrite(10, LOW);
  Ethernet.begin(mac, ip, gateway, gateway, subnet);
  delay(500);
  
  // IP kontrolü
  Serial.print(F("[NET] IP kontrol ediliyor... "));
  Serial.println(Ethernet.localIP());
  if (Ethernet.localIP() != ip) {
    Serial.println(F("[WARN] IP ayarlanamadi, tekrar deneniyor..."));
    delay(1000);
    // KRITIK: Ethernet.init() ve Pin 10 kontrolü
    Ethernet.init(10);
    digitalWrite(10, LOW);
    Ethernet.begin(mac, ip, gateway, gateway, subnet);
    delay(500);
  }

  delay(300);
  server.begin();

  Serial.print(F("[NET] IP Adresi: "));
  Serial.println(Ethernet.localIP());
  Serial.println(F("[HTTP] Sunucu 80 portunda hazir (/data)"));
  Serial.print(F("Test: http://"));
  Serial.print(Ethernet.localIP());
  Serial.println(F("/data"));
  
  // EEPROM'dan kalibrasyon değerlerini oku
  loadCalibrationFromEEPROM();
}

// EEPROM adresleri
#define EEPROM_TEMP_OFFSET_ADDR 0    // Sıcaklık offset adresi (4 byte)
#define EEPROM_HUM_OFFSET_ADDR 4     // Nem offset adresi (4 byte)
#define EEPROM_MAGIC_ADDR 8          // Magic number adresi (4 byte)
#define EEPROM_MAGIC_VALUE 0x12345678 // Magic number (kalibrasyon yapıldığını gösterir)

// Kalibrasyon faktörleri (EEPROM'dan okunacak)
float temperatureOffset = 0.0;  // Sıcaklık düzeltmesi (°C)
float humidityOffset = 0.0;     // Nem düzeltmesi (%)

// Otomatik veri gönderimi için
unsigned long lastDataSend = 0;
const unsigned long DATA_INTERVAL = 300000; // 60 saniye (1 dakika) - Veritabanına kayıt

// Canlı veri gönderimi için (WebSocket için)
unsigned long lastLiveDataSend = 0;
const unsigned long LIVE_DATA_INTERVAL = 1000; // 1 saniye - Canlı veri

void loop() {
  // KRITIK: Pin 10'u sürekli LOW tut (SEN pin'i için)
  // Ethernet kütüphanesi SPI kullanırken Pin 10'un HIGH olması SEN pin'ini LOW yapar
  digitalWrite(10, LOW);
  
  // Veritabanına kayıt (1 dakikada bir)
  if (millis() - lastDataSend >= DATA_INTERVAL) {
    sensors_event_t humidity, temp;
    aht.getEvent(&humidity, &temp);
    
    // Ham veriler
    float rawTemp = temp.temperature;
    float rawHumidity = humidity.relative_humidity;
    
    // Kalibrasyon uygula
    float calibratedTemp = applyTemperatureCalibration(rawTemp);
    float calibratedHumidity = applyHumidityCalibration(rawHumidity);

    if (displayReady) {
      updateDisplay(calibratedTemp, calibratedHumidity);
    }
    
    // Backend'e kalibre edilmiş veri gönder (Veritabanına kayıt)
    sendToBackend(calibratedTemp, calibratedHumidity);
    lastDataSend = millis();
  }
  
  // Canlı veri gönderimi (1 saniyede bir) - WebSocket için
  if (millis() - lastLiveDataSend >= LIVE_DATA_INTERVAL) {
    sensors_event_t humidity, temp;
    aht.getEvent(&humidity, &temp);
    
    // Ham veriler
    float rawTemp = temp.temperature;
    float rawHumidity = humidity.relative_humidity;
    
    // Kalibrasyon uygula
    float calibratedTemp = applyTemperatureCalibration(rawTemp);
    float calibratedHumidity = applyHumidityCalibration(rawHumidity);

    if (displayReady) {
      updateDisplay(calibratedTemp, calibratedHumidity);
    }
    
    // Canlı veri gönder (WebSocket için)
    sendLiveDataToBackend(calibratedTemp, calibratedHumidity);
    lastLiveDataSend = millis();
  }
  
  // HTTP isteklerini dinle
  EthernetClient client = server.available();
  if (!client) return;
  
  // DEBUG: İstek geldi
  Serial.println(F("[HTTP] Yeni istek alindi!"));

  String reqLine = readRequestLine(client);
  Serial.print(F("[HTTP] Request: "));
  Serial.println(reqLine);
  
  if (reqLine.length() == 0) {
    Serial.println(F("[HTTP] Bos request, kapatiliyor"));
    client.stop();
    return;
  }

  // GET /data için JSON döndür
  if (reqLine.startsWith("GET /data")) {
    sensors_event_t humidity, temp;
    aht.getEvent(&humidity, &temp);

    // Ham veriler
    float rawTemp = temp.temperature;
    float rawHumidity = humidity.relative_humidity;
    
    // Kalibrasyon uygula
    float calibratedTemp = applyTemperatureCalibration(rawTemp);
    float calibratedHumidity = applyHumidityCalibration(rawHumidity);

    if (displayReady) {
      updateDisplay(calibratedTemp, calibratedHumidity);
    }

    // JSON (frontend ile uyumlu) - Kalibre edilmiş veriler
    String body = String("{\"temperature\":") + String(calibratedTemp, 2) +
                  ",\"humidity\":" + String(calibratedHumidity, 2) +
                  ",\"timestamp\":\"" + String(millis()) + "\"}";

    client.println(F("HTTP/1.1 200 OK"));
    client.println(F("Content-Type: application/json; charset=utf-8"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Access-Control-Allow-Methods: GET, POST, OPTIONS"));
    client.println(F("Access-Control-Allow-Headers: Content-Type"));
    client.print(F("Content-Length: "));
    client.println(body.length());
    client.println(F("Connection: close"));
    client.println();
    client.print(body);
    
    // HTTP yanıtı gönderildi
  } else if (reqLine.startsWith("POST /calibrate")) {
    // Kalibrasyon ayarları güncelle
    handleCalibrationRequest(client);
  } else if (reqLine.startsWith("GET /calibrate")) {
    // Mevcut kalibrasyon ayarlarını döndür
    handleGetCalibration(client);
  } else if (reqLine.startsWith("POST /reset-calibration")) {
    // Kalibrasyonu sıfırla
    handleResetCalibration(client);
  } else if (reqLine.startsWith("OPTIONS")) {
    // CORS preflight request
    client.println(F("HTTP/1.1 200 OK"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Access-Control-Allow-Methods: GET, POST, OPTIONS"));
    client.println(F("Access-Control-Allow-Headers: Content-Type"));
    client.println(F("Connection: close"));
    client.println();
    Serial.println(F("[CORS] Preflight request handled"));
  } else {
    // Diğer istekler 404
    client.println(F("HTTP/1.1 404 Not Found"));
    client.println(F("Content-Type: text/plain; charset=utf-8"));
    client.println(F("Connection: close"));
    client.println();
    client.println(F("Not Found"));
  }

  delay(1);
  client.stop();
}

String readRequestLine(EthernetClient& client) {
  String line = "";
  unsigned long start = millis();
  while (client.connected() && (millis() - start < 1000)) {
    if (client.available()) {
      char c = client.read();
      if (c == '\r') continue;
      if (c == '\n') break;
      line += c;
      if (line.length() > 200) break;
    }
  }
  return line;
}

// EEPROM fonksiyonları
void loadCalibrationFromEEPROM() {
  // Magic number kontrolü
  uint32_t magic = 0;
  EEPROM.get(EEPROM_MAGIC_ADDR, magic);
  
  if (magic == EEPROM_MAGIC_VALUE) {
    // Kalibrasyon değerleri var, oku
    EEPROM.get(EEPROM_TEMP_OFFSET_ADDR, temperatureOffset);
    EEPROM.get(EEPROM_HUM_OFFSET_ADDR, humidityOffset);
    
    Serial.print(F("[EEPROM] Kalibrasyon yüklendi - Sıcaklık: "));
    Serial.print(temperatureOffset);
    Serial.print(F("°C, Nem: "));
    Serial.print(humidityOffset);
    Serial.println(F("%"));
  } else {
    // İlk çalıştırma, varsayılan değerler
    temperatureOffset = 0.0;
    humidityOffset = 0.0;
    Serial.println(F("[EEPROM] İlk çalıştırma - Varsayılan kalibrasyon (0.0)"));
  }
}

void saveCalibrationToEEPROM() {
  // Kalibrasyon değerlerini EEPROM'a yaz
  EEPROM.put(EEPROM_TEMP_OFFSET_ADDR, temperatureOffset);
  EEPROM.put(EEPROM_HUM_OFFSET_ADDR, humidityOffset);
  EEPROM.put(EEPROM_MAGIC_ADDR, EEPROM_MAGIC_VALUE);
  
  Serial.print(F("[EEPROM] Kalibrasyon kaydedildi - Sıcaklık: "));
  Serial.print(temperatureOffset);
  Serial.print(F("°C, Nem: "));
  Serial.print(humidityOffset);
  Serial.println(F("%"));
}

// Kalibrasyon fonksiyonları
float applyTemperatureCalibration(float rawTemp) {
  return rawTemp + temperatureOffset;
}

float applyHumidityCalibration(float rawHumidity) {
  return rawHumidity + humidityOffset;
}

// Kalibrasyon ayarlarını güncelle
void handleCalibrationRequest(EthernetClient& client) {
  // HTTP POST body'yi oku
  String body = readRequestBody(client);
  
  // JSON parse (basit) - Tek tek kalibrasyon için
  int tempStart = body.indexOf("\"temperatureOffset\":");
  int humStart = body.indexOf("\"humidityOffset\":");
  
  bool tempUpdated = false;
  bool humUpdated = false;
  
  // Sıcaklık offset'i parse et (varsa)
  if (tempStart != -1) {
    String tempStr = body.substring(tempStart + 20);
    tempStr = tempStr.substring(0, tempStr.indexOf(","));
    if (tempStr.indexOf("}") != -1) {
      tempStr = tempStr.substring(0, tempStr.indexOf("}"));
    }
    temperatureOffset = tempStr.toFloat();
    tempUpdated = true;
    Serial.print(F("[CALIB] Sıcaklık offset güncellendi: "));
    Serial.print(temperatureOffset);
    Serial.println(F("°C"));
  }
  
  // Nem offset'i parse et (varsa)
  if (humStart != -1) {
    String humStr = body.substring(humStart + 17);
    humStr = humStr.substring(0, humStr.indexOf("}"));
    if (humStr.indexOf(",") != -1) {
      humStr = humStr.substring(0, humStr.indexOf(","));
    }
    humidityOffset = humStr.toFloat();
    humUpdated = true;
    Serial.print(F("[CALIB] Nem offset güncellendi: "));
    Serial.print(humidityOffset);
    Serial.println(F("%"));
  }
  
  // En az bir değer güncellendiyse EEPROM'a kaydet
  if (tempUpdated || humUpdated) {
    saveCalibrationToEEPROM();
    
    // Başarı yanıtı
    client.println(F("HTTP/1.1 200 OK"));
    client.println(F("Content-Type: application/json"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    client.println(F("{\"success\":true}"));
  } else {
    // Hata yanıtı
    client.println(F("HTTP/1.1 400 Bad Request"));
    client.println(F("Content-Type: application/json"));
    client.println(F("Access-Control-Allow-Origin: *"));
    client.println(F("Connection: close"));
    client.println();
    client.println(F("{\"error\":\"No valid calibration data\"}"));
  }
}

// Mevcut kalibrasyon ayarlarını döndür
void handleGetCalibration(EthernetClient& client) {
  String response = "{\"temperatureOffset\":" + String(temperatureOffset, 2) +
                   ",\"humidityOffset\":" + String(humidityOffset, 2) + "}";
  
  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Content-Type: application/json"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Connection: close"));
  client.print(F("Content-Length: "));
  client.println(response.length());
  client.println();
  client.print(response);
}

// Kalibrasyonu sıfırla
void handleResetCalibration(EthernetClient& client) {
  // Kalibrasyon değerlerini sıfırla
  temperatureOffset = 0.0;
  humidityOffset = 0.0;
  
  // EEPROM'a kaydet
  saveCalibrationToEEPROM();
  
  Serial.println(F("[CALIB] Kalibrasyon sıfırlandı!"));
  
  // Başarı yanıtı
  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Content-Type: application/json"));
  client.println(F("Access-Control-Allow-Origin: *"));
  client.println(F("Connection: close"));
  client.println();
  client.println(F("{\"success\":true,\"message\":\"Kalibrasyon sıfırlandı\"}"));
}

// HTTP POST body'yi oku
String readRequestBody(EthernetClient& client) {
  String body = "";
  unsigned long start = millis();
  while (client.connected() && (millis() - start < 2000)) {
    if (client.available()) {
      char c = client.read();
      body += c;
      if (body.length() > 500) break;
    }
  }
  return body;
}

void sendToBackend(float temperature, float humidity) {
  // Backend'e HTTP POST gönder (Veritabanına kayıt)
  EthernetClient backendClient;
  
  if (backendClient.connect("192.168.1.44", 5001)) { // Backend IP (bilgisayar IP'si)
    // HTTP POST isteği - JSON formatı
    String postData = "{\"temperature\":" + String(temperature, 2) +
                      ",\"humidity\":" + String(humidity, 2) + "}";
    
    backendClient.println("POST /api/arduino/data HTTP/1.1");
    backendClient.println("Host: 192.168.1.44:5001");
    backendClient.println("Content-Type: application/json");
    backendClient.println("Connection: close");
    backendClient.print("Content-Length: ");
    backendClient.println(postData.length());
    backendClient.println();
    backendClient.print(postData);
    backendClient.println();
    
    // Yanıt bekle
    delay(100);
    backendClient.stop();
  } else {
    Serial.println(F("[BACKEND] Baglanti kurulamadi"));
  }
}

void sendLiveDataToBackend(float temperature, float humidity) {
  // Backend'e canlı veri gönder (WebSocket için - veritabanına kayıt etmez)
  EthernetClient backendClient;
  
  if (backendClient.connect("192.168.1.44", 5001)) { // Backend IP (bilgisayar IP'si)
    // HTTP POST isteği - JSON formatı
    String postData = "{\"temperature\":" + String(temperature, 2) +
                      ",\"humidity\":" + String(humidity, 2) + "}";
    
    backendClient.println("POST /api/arduino/live-data HTTP/1.1");
    backendClient.println("Host: 192.168.1.44:5001");
    backendClient.println("Content-Type: application/json");
    backendClient.println("Connection: close");
    backendClient.print("Content-Length: ");
    backendClient.println(postData.length());
    backendClient.println();
    backendClient.print(postData);
    backendClient.println();
    
    // Yanıt bekle
    delay(100);
    backendClient.stop();
  } else {
    Serial.println(F("[LIVE] Baglanti kurulamadi"));
  }
}

static void oledWriteCommand(uint8_t command) {
  Wire.beginTransmission(OLED_ADDRESS);
  Wire.write(0x00);
  Wire.write(command);
  Wire.endTransmission();
}

static const uint8_t* getGlyphData(char character) {
  const uint8_t spaceIndex = 0;
  uint8_t count = sizeof(glyphChars);

  for (uint8_t i = 0; i < count; i++) {
    if (pgm_read_byte(&glyphChars[i]) == character) {
      return glyphBitmaps[i];
    }
  }
  return glyphBitmaps[spaceIndex];
}

static void formatValue(float value, uint8_t decimals, char* buffer, size_t bufferSize) {
  if (bufferSize == 0) return;

  dtostrf(value, 5, decimals, buffer);
  char* start = buffer;
  while (*start == ' ' && *(start + 1) != '\0') {
    start++;
  }
  if (start != buffer) {
    size_t len = strlen(start);
    memmove(buffer, start, len + 1);
  }
}

static void setCursor(uint8_t column, uint8_t page) {
  oledWriteCommand(0xB0 | page);
  oledWriteCommand(0x00 | (column & 0x0F));
  oledWriteCommand(0x10 | (column >> 4));
}

static void writeDataBytes(const uint8_t* data, uint8_t length) {
  Wire.beginTransmission(OLED_ADDRESS);
  Wire.write(0x40);
  for (uint8_t i = 0; i < length; i++) {
    Wire.write(pgm_read_byte(data + i));
  }
  Wire.endTransmission();
}

static void writeLiteralBytes(const uint8_t* data, uint8_t length) {
  Wire.beginTransmission(OLED_ADDRESS);
  Wire.write(0x40);
  for (uint8_t i = 0; i < length; i++) {
    Wire.write(data[i]);
  }
  Wire.endTransmission();
}

static uint8_t drawGlyph(uint8_t column, uint8_t page, char character) {
  if (column >= OLED_WIDTH || page >= OLED_PAGES) return column;
  const uint8_t* glyph = getGlyphData(character);
  setCursor(column, page);
  writeDataBytes(glyph, 5);
  if (column + 5 < OLED_WIDTH) {
    uint8_t spacer = 0x00;
    setCursor(column + 5, page);
    writeLiteralBytes(&spacer, 1);
  }
  return column + 6;
}

static uint8_t drawText(uint8_t column, uint8_t page, const char* text) {
  while (*text && column < OLED_WIDTH) {
    column = drawGlyph(column, page, *text++);
  }
  return column;
}

static void drawIcon8x8(uint8_t column, uint8_t page, const uint8_t* icon) {
  if (page >= OLED_PAGES || column >= OLED_WIDTH) return;
  setCursor(column, page);
  writeDataBytes(icon, 8);
}

static void clearPages(uint8_t startPage, uint8_t endPage) {
  if (endPage >= OLED_PAGES) endPage = OLED_PAGES - 1;
  uint8_t zeros[16];
  memset(zeros, 0x00, sizeof(zeros));
  for (uint8_t page = startPage; page <= endPage; page++) {
    setCursor(0, page);
    for (uint8_t col = 0; col < OLED_WIDTH; col += sizeof(zeros)) {
      uint8_t chunk = OLED_WIDTH - col;
      if (chunk > sizeof(zeros)) chunk = sizeof(zeros);
      writeLiteralBytes(zeros, chunk);
    }
  }
}

bool initOLED() {
  Wire.beginTransmission(OLED_ADDRESS);
  if (Wire.endTransmission() != 0) {
    return false;
  }

  for (uint8_t i = 0; i < sizeof(oledInitSequence); i++) {
    uint8_t command = pgm_read_byte(&oledInitSequence[i]);
    oledWriteCommand(command);
  }

  clearPages(0, OLED_PAGES - 1);
  return true;
}

void showStartupMessage() {
  if (!displayReady) return;
  clearPages(0, OLED_PAGES - 1);
  drawText(0, 0, "yycDataLogger");
  drawText(0, 2, "OLED Hazir");
}

void updateDisplay(float temperature, float humidity) {
  if (!displayReady) return;

  clearPages(0, OLED_PAGES - 1);

  char valueBuffer[12];

  drawIcon8x8(0, 0, thermometerIcon);
  uint8_t x = drawText(12, 0, "Sicaklik:");
  x = drawText(x, 0, " ");
  formatValue(temperature, 1, valueBuffer, sizeof(valueBuffer));
  x = drawText(x, 0, valueBuffer);
  drawText(x, 0, " C");

  drawIcon8x8(0, 2, dropletIcon);
  uint8_t y = drawText(12, 2, "Nem:");
  y = drawText(y, 2, " ");
  formatValue(humidity, 1, valueBuffer, sizeof(valueBuffer));
  y = drawText(y, 2, valueBuffer);
  drawText(y, 2, " %");
}
