import csv
import math
import os
import random
from datetime import datetime, timedelta

import requests

# ------------------------------------------------------------------------------
# Konfigürasyon - DeviceId 8: Kapalı Depo (HVAC/Nemlendirme Yok)
# ------------------------------------------------------------------------------
API_BASE_URL = "http://192.168.1.44:5001/api"
BULK_IMPORT_ENDPOINT = f"{API_BASE_URL}/sensordata/bulk"
BATCH_SIZE = 5000
TEST_MODE = False

DEVICE_ID = "8"

# Kapalı depo özellikleri:
# - Üstü kapalı, ışık geçirmeyen
# - 12 metre yükseklik, 100x150 metre büyüklük (büyük hacim)
# - HVAC yok, nemlendirme yok
# - Mevsimsel değişikliklere bağlı, dış hava koşullarından yavaş etkilenir

meteostat_cache: dict[datetime, tuple[float, float]] = {}
previous_values: dict[str, float] = {"temp": None, "hum": None}  # İlk değer CSV'den gelecek


def clamp(value, low, high):
    return max(low, min(high, value))


def load_meteostat_data():
    """Meteostat CSV dosyasından verileri yükler ve cache'ler."""
    csv_file = os.path.join(os.path.dirname(__file__), "manisa_weather_data.csv")
    
    if not os.path.exists(csv_file):
        print(f"⚠️  Meteostat verisi bulunamadı: {csv_file}")
        print(f"   Önce 'python fetch_meteostat_data.py' çalıştırın!")
        return False
    
    print(f"📥 Meteostat verileri yükleniyor: {csv_file}")
    count = 0
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    ts_str = row.get('time', '')
                    if not ts_str:
                        continue
                    
                    ts = datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
                    temp_str = row.get('temp', '')
                    hum_str = row.get('rhum', '')
                    
                    if temp_str and hum_str and temp_str != 'nan' and hum_str != 'nan':
                        temp = float(temp_str)
                        hum = float(hum_str)
                        meteostat_cache[ts] = (temp, hum)
                        count += 1
                except (ValueError, KeyError):
                    continue
        
        print(f"✅ {count} saatlik veri yüklendi")
        return count > 0
    except Exception as e:
        print(f"❌ Meteostat verisi yüklenirken hata: {e}")
        return False


def seasonal_factor(ts: datetime) -> float:
    """Mevsimsel faktör: 0 (kış) -> 1 (yaz)"""
    day = ts.timetuple().tm_yday
    return (math.sin((day - 80) * 2 * math.pi / 365) + 1) / 2


def outdoor_values(ts: datetime):
    """Dış hava sıcaklık ve nem değerlerini döndürür."""
    if meteostat_cache:
        hour_start = ts.replace(minute=0, second=0, microsecond=0)
        hour_end = hour_start + timedelta(hours=1)
        
        if hour_start in meteostat_cache:
            temp, hum = meteostat_cache[hour_start]
            return round(temp, 2), round(clamp(hum, 20, 90), 2)
        
        prev_hour = hour_start - timedelta(hours=1)
        next_hour = hour_end
        
        if prev_hour in meteostat_cache and next_hour in meteostat_cache:
            temp1, hum1 = meteostat_cache[prev_hour]
            temp2, hum2 = meteostat_cache[next_hour]
            weight = ts.minute / 60.0
            temp = temp1 * (1 - weight) + temp2 * weight
            hum = hum1 * (1 - weight) + hum2 * weight
            return round(temp, 2), round(clamp(hum, 20, 90), 2)
        
        if prev_hour in meteostat_cache:
            temp, hum = meteostat_cache[prev_hour]
            return round(temp, 2), round(clamp(hum, 20, 90), 2)
        
        if next_hour in meteostat_cache:
            temp, hum = meteostat_cache[next_hour]
            return round(temp, 2), round(clamp(hum, 20, 90), 2)
    
    # Fallback: sinüs modeli
    factor = seasonal_factor(ts)
    hour_decimal = ts.hour + ts.minute / 60
    
    daily_temp_cycle = max(0, math.sin((hour_decimal - 6) * 2 * math.pi / 24))
    daily_hum_cycle = max(0, math.sin((hour_decimal - 3) * 2 * math.pi / 24))
    
    base_temp = 5 + factor * 20
    temp_range = 8 + factor * 4
    temp = base_temp + daily_temp_cycle * temp_range + random.uniform(-1.5, 1.5)
    
    base_hum = 70 - factor * 20
    hum_range = 8 + factor * 4
    hum = base_hum - daily_hum_cycle * hum_range + random.uniform(-2, 2)
    
    return round(clamp(temp, 0, 40), 2), round(clamp(hum, 35, 85), 2)


def compute_value(ts: datetime, data_type: str):
    """
    Kapalı depo için değer hesaplama - CSV'deki gerçek hava durumuna göre.
    Depo özellikleri:
    - 12m yükseklik, 100x150m büyüklük (büyük hacim: ~180,000 m³)
    - Yalıtım: az-orta arası
    - HVAC/Nemlendirme yok
    - Üstü kapalı, ışık geçirmeyen
    - Dış havadan yavaş etkilenir (büyük hacim + yalıtım)
    - Güneş ısısı birikimi nedeniyle dış havadan genelde daha sıcak
    """
    outdoor_temp, outdoor_hum = outdoor_values(ts)
    outdoor_value = outdoor_temp if data_type == "temp" else outdoor_hum
    
    # İlk değer yoksa CSV'deki dış hava değerini kullan
    if previous_values[data_type] is None:
        previous_values[data_type] = outdoor_value
    
    previous = previous_values[data_type]
    
    # Mevsimsel faktör (güneş ısısı birikimi için)
    factor = seasonal_factor(ts)
    
    if data_type == "temp":
        # CSV'deki dış hava sıcaklığını temel al
        # Yalıtım az-orta arası: dış havadan %25-30 etkilenme
        # Büyük hacim: değişimler yavaş
        # Güneş ısısı birikimi: dış havadan 2-5°C daha sıcak (mevsime göre)
        #   - Kış: +2-3°C (az güneş)
        #   - Yaz: +3-5°C (çok güneş, yalıtım ısı biriktirir)
        
        # Güneş ısısı birikimi (mevsimsel)
        heat_gain = 2.0 + factor * 3.0  # Kış: +2°C, Yaz: +5°C
        
        # Dış havadan etkilenme (yalıtım az-orta: %25-30)
        # Büyük hacim nedeniyle değişimler yavaş
        outdoor_influence = (outdoor_value - previous) * 0.27  # %27 etkilenme
        
        # Hedef sıcaklık: dış hava + güneş ısısı birikimi + dış havadan etkilenme
        target = outdoor_value + heat_gain + outdoor_influence
        
        # Günlük değişimler (büyük hacim nedeniyle çok yumuşak)
        hour_decimal = ts.hour + ts.minute / 60
        daily_variation = math.sin((hour_decimal - 6) * 2 * math.pi / 24) * 1.2  # 1.2°C günlük değişim
        target += daily_variation
        
        # Rastgele değişimler (çok küçük, büyük hacim nedeniyle)
        target += random.uniform(-0.3, 0.3)
        
        # Önceki değere yumuşak geçiş (büyük hacim, yavaş değişim)
        max_step = 0.10  # Çok yavaş değişim (büyük hacim)
        diff = target - previous
        if abs(diff) > max_step:
            value = previous + (max_step if diff > 0 else -max_step)
        else:
            value = previous + diff * 0.65  # Yumuşak geçiş
        
        # Mantıklı aralıkta tut
        value = clamp(value, -5.0, 45.0)
        
    else:  # humidity
        # CSV'deki dış hava nemini temel al
        # Kapalı depo: nem daha stabil, dış havadan yavaş etkilenir
        # Büyük hacim: değişimler çok yumuşak
        
        # Dış havadan etkilenme (yalıtım az-orta: %20-25)
        outdoor_influence = (outdoor_value - previous) * 0.22  # %22 etkilenme
        
        # Hedef nem: dış hava + dış havadan etkilenme
        target = outdoor_value + outdoor_influence
        
        # Günlük değişimler (büyük hacim nedeniyle çok yumuşak)
        hour_decimal = ts.hour + ts.minute / 60
        daily_variation = math.sin((hour_decimal - 3) * 2 * math.pi / 24) * 2.0  # 2% günlük değişim
        target += daily_variation
        
        # Rastgele değişimler
        target += random.uniform(-0.8, 0.8)
        
        # Önceki değere yumuşak geçiş
        max_step = 0.30  # Yavaş değişim
        diff = target - previous
        if abs(diff) > max_step:
            value = previous + (max_step if diff > 0 else -max_step)
        else:
            value = previous + diff * 0.70  # Yumuşak geçiş
        
        # Mantıklı aralıkta tut
        value = clamp(value, 20.0, 90.0)
    
    previous_values[data_type] = value
    return round(value, 2)


def generate_entries(timestamps):
    entries = []
    print(f"📊 {len(timestamps)} timestamp için veri üretiliyor...")
    for idx, ts in enumerate(timestamps):
        temp = compute_value(ts, "temp")
        hum = compute_value(ts, "hum")
        entries.append({"temperature": temp, "humidity": hum, "timestamp": ts})
        
        if idx < 5:  # İlk 5 kaydı göster
            print(f"   [{idx+1}] {ts} -> Temp: {temp}°C, Hum: {hum}%")
        
        if (idx + 1) % 10_000 == 0:
            pct = (idx + 1) / len(timestamps) * 100
            print(f"   {DEVICE_ID}: {idx + 1}/{len(timestamps)} ({pct:.1f}%)")
    
    print(f"✅ Toplam {len(entries)} kayıt üretildi")
    return entries


def send_batches(device_id, entries, batch_size=BATCH_SIZE):
    sent = failed = 0
    for start in range(0, len(entries), batch_size):
        batch = entries[start : start + batch_size]
        payload = {
            "deviceId": int(device_id),  # DeviceId artık int
            "entries": [
                {
                    "temperature": item["temperature"],
                    "humidity": item["humidity"],
                    "timestamp": item["timestamp"].isoformat(),
                }
                for item in batch
            ],
        }
        
        try:
            response = requests.post(BULK_IMPORT_ENDPOINT, json=payload, timeout=300)
            if response.status_code == 200:
                sent += response.json().get("count", len(batch))
            else:
                failed += len(batch)
                print(f"❌ Device {device_id} - HTTP {response.status_code}: {response.text}")
        except Exception as exc:
            failed += len(batch)
            print(f"❌ Device {device_id} - Exception: {exc}")
        
        progress = min(start + batch_size, len(entries))
        pct = progress / len(entries) * 100
        print(f"📤 Device {device_id}: {progress}/{len(entries)} ({pct:.1f}%)")
    return sent, failed


def generate_timestamps(start_date, end_date):
    stamps = []
    current = start_date
    while current <= end_date:
        stamps.append(current)
        current += timedelta(minutes=5)
    return stamps


def main():
    print(f"\n{'=' * 50}")
    print(f"🚀 Device {DEVICE_ID} - Kapalı Depo Veri Üretimi Başlıyor...")
    print(f"{'=' * 50}\n")
    
    # Meteostat verilerini yükle (varsa)
    meteostat_loaded = load_meteostat_data()
    if meteostat_loaded:
        print(f"✅ Meteostat verisi yüklendi: {len(meteostat_cache)} kayıt\n")
    else:
        print(f"⚠️  Meteostat verisi yüklenemedi, sinüs modeli kullanılacak\n")
    
    end_date = datetime(2025, 11, 23)
    start_date = end_date - timedelta(days=int(365 * 1.5))
    timestamps = generate_timestamps(start_date, end_date)
    
    print(f"📅 Aralık: {start_date:%Y-%m-%d} → {end_date:%Y-%m-%d} ({len(timestamps)} kayıt)")
    print(f"🏭 Device {DEVICE_ID}: Kapalı Depo (HVAC/Nemlendirme Yok)")
    print(f"   - Üstü kapalı, ışık geçirmeyen")
    print(f"   - 12m yükseklik, 100x150m büyüklük (~180,000 m³)")
    print(f"   - Yalıtım: az-orta arası")
    print(f"   - CSV'deki gerçek hava durumuna göre hesaplanıyor")
    print(f"   - Dış havadan %25-30 etkilenme (yalıtım az-orta)")
    print(f"   - Güneş ısısı birikimi: Kış +2°C, Yaz +5°C")
    print(f"   - Büyük hacim nedeniyle değişimler yavaş")
    print(f"   - Limit kontrolü yok\n")
    
    if TEST_MODE:
        print(f"🧪 TEST MODE aktif\n")
    
    print(f"📊 Veri üretimi başlıyor...\n")
    
    entries = generate_entries(timestamps)
    
    if not entries:
        print("❌ HATA: Hiç veri üretilemedi!")
        return
    
    temps = [e["temperature"] for e in entries]
    hums = [e["humidity"] for e in entries]
    print(f"   Sıcaklık Ort = {sum(temps)/len(temps):.2f}°C | Min={min(temps):.2f} Max={max(temps):.2f}")
    print(f"   Nem Ort = {sum(hums)/len(hums):.2f}% | Min={min(hums):.2f} Max={max(hums):.2f}")
    
    sent, failed = send_batches(DEVICE_ID, entries)
    print(f"✅ Device {DEVICE_ID}: {sent} kayıt gönderildi, {failed} hata")
    
    print("\n🎉 İşlem tamamlandı!")


if __name__ == "__main__":
    main()

