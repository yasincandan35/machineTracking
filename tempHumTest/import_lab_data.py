import argparse
import csv
import json
import math
import os
import random
import sys
from datetime import datetime, timedelta

import requests

# ------------------------------------------------------------------------------
# Konfigürasyon
# ------------------------------------------------------------------------------
API_BASE_URL = "http://192.168.1.44:5001/api"
BULK_IMPORT_ENDPOINT = f"{API_BASE_URL}/sensordata/bulk"
BATCH_SIZE = 5000
TEST_MODE = False

DEVICES = [
    {"device_id": "2", "temp_base_offset": 0.0, "hum_base_offset": 0.0},
    {"device_id": "3", "temp_base_offset": 0.3, "hum_base_offset": 1.5},
    {"device_id": "4", "temp_base_offset": -0.4, "hum_base_offset": -1.0},
    {"device_id": "5", "temp_base_offset": 0.6, "hum_base_offset": 2.5},
    {"device_id": "6", "temp_base_offset": -0.5, "hum_base_offset": -2.0},
    {"device_id": "7", "temp_base_offset": 0.2, "hum_base_offset": 1.0},
    # DeviceId 8 ayrı dosyada işleniyor (import_device8_seasonal.py)
    {"device_id": "9", "temp_base_offset": -0.3, "hum_base_offset": -1.5},
    {"device_id": "10", "temp_base_offset": 0.1, "hum_base_offset": 0.5},
    {"device_id": "11", "temp_base_offset": -0.2, "hum_base_offset": -0.8},
]

# Komut satırı argümanları ile override edilebilir
TARGET_DEVICE_IDS = []  # Boş = tüm cihazlar işlenecek

STANDARD_TEMP = 22.0
STANDARD_HUM = 55.0
TEMP_LOW_LIMIT = 20.0
TEMP_HIGH_LIMIT = 24.0
HUM_LOW_LIMIT = 50.0
HUM_HIGH_LIMIT = 60.0

previous_values: dict[str, dict[str, float]] = {}
weekly_profiles: dict[str, dict] = {}
meteostat_cache: dict[datetime, tuple[float, float]] = {}  # timestamp -> (temp, hum)


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
                    # CSV'deki timestamp formatına göre parse et
                    ts_str = row.get('time', '')
                    if not ts_str:
                        continue
                    
                    # Meteostat CSV formatı: "2024-05-16 00:00:00"
                    ts = datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
                    
                    # Sıcaklık ve nem değerlerini al
                    temp_str = row.get('temp', '')
                    hum_str = row.get('rhum', '')  # Meteostat'ta relative humidity 'rhum'
                    
                    if temp_str and hum_str and temp_str != 'nan' and hum_str != 'nan':
                        temp = float(temp_str)
                        hum = float(hum_str)
                        meteostat_cache[ts] = (temp, hum)
                        count += 1
                except (ValueError, KeyError) as e:
                    continue
        
        print(f"✅ {count} saatlik veri yüklendi")
        return count > 0
    except Exception as e:
        print(f"❌ Meteostat verisi yüklenirken hata: {e}")
        return False


def seasonal_factor(ts: datetime) -> float:
    day = ts.timetuple().tm_yday
    return (math.sin((day - 80) * 2 * math.pi / 365) + 1) / 2


def outdoor_values(ts: datetime):
    """
    Manisa'nın dış hava sıcaklık ve nem değerlerini döndürür.
    Önce Meteostat cache'inden gerçek veriyi arar, bulamazsa sinüs modelini kullanır.
    """
    # Meteostat cache'inden veri ara (saatlik veriler var, en yakın saati bul)
    if meteostat_cache:
        # Saatlik veriler için en yakın saati bul
        hour_start = ts.replace(minute=0, second=0, microsecond=0)
        hour_end = hour_start + timedelta(hours=1)
        
        # Tam saat eşleşmesi varsa direkt kullan
        if hour_start in meteostat_cache:
            temp, hum = meteostat_cache[hour_start]
            return round(temp, 2), round(clamp(hum, 20, 90), 2)
        
        # Önceki ve sonraki saatleri kontrol et (interpolasyon için)
        prev_hour = hour_start - timedelta(hours=1)
        next_hour = hour_end
        
        if prev_hour in meteostat_cache and next_hour in meteostat_cache:
            # İki saat arasında interpolasyon yap
            temp1, hum1 = meteostat_cache[prev_hour]
            temp2, hum2 = meteostat_cache[next_hour]
            
            # Dakika bazında ağırlık (0-60 dakika)
            weight = ts.minute / 60.0
            temp = temp1 * (1 - weight) + temp2 * weight
            hum = hum1 * (1 - weight) + hum2 * weight
            return round(temp, 2), round(clamp(hum, 20, 90), 2)
        
        # Sadece önceki saat varsa onu kullan
        if prev_hour in meteostat_cache:
            temp, hum = meteostat_cache[prev_hour]
            return round(temp, 2), round(clamp(hum, 20, 90), 2)
        
        # Sadece sonraki saat varsa onu kullan
        if next_hour in meteostat_cache:
            temp, hum = meteostat_cache[next_hour]
            return round(temp, 2), round(clamp(hum, 20, 90), 2)
    
    # Meteostat verisi yoksa fallback: sinüs modeli
    factor = seasonal_factor(ts)  # 0 (kış) -> 1 (yaz)
    hour_decimal = ts.hour + ts.minute / 60
    
    # Günlük döngü: sabah 6'da minimum, öğleden sonra 14-15'te maksimum
    daily_temp_cycle = max(0, math.sin((hour_decimal - 6) * 2 * math.pi / 24))
    daily_hum_cycle = max(0, math.sin((hour_decimal - 3) * 2 * math.pi / 24))
    
    # Mevsimsel baz değerler (Manisa için)
    base_temp = 5 + factor * 20  # 5°C (kış) -> 25°C (yaz)
    temp_range = 8 + factor * 4
    temp = base_temp + daily_temp_cycle * temp_range + random.uniform(-1.5, 1.5)
    
    base_hum = 70 - factor * 20  # 70% (kış) -> 50% (yaz)
    hum_range = 8 + factor * 4
    hum = base_hum - daily_hum_cycle * hum_range + random.uniform(-2, 2)
    
    return round(clamp(temp, 0, 40), 2), round(clamp(hum, 35, 85), 2)


def hvac_adjust(value, previous, data_type, enabled=True):
    if data_type == "temp":
        low, high = TEMP_LOW_LIMIT, TEMP_HIGH_LIMIT
        comfort_low, comfort_high = low + 0.6, high - 0.6
        max_step = 0.25
    else:
        low, high = HUM_LOW_LIMIT, HUM_HIGH_LIMIT
        comfort_low, comfort_high = low + 1.5, high - 1.5
        max_step = 0.7

    if not enabled:
        # İklimlendirme kapalıyken değerler dış koşullara yaklaşsın
        # Sıcaklıkta ±12°C, nemde ±30% bandı tanıyoruz
        margin = 12.0 if data_type == "temp" else 30.0
        return clamp(value, low - margin, high + margin)

    if value > comfort_high:
        value -= (value - comfort_high) * 0.65
    elif value < comfort_low:
        value += (comfort_low - value) * 0.65

    if previous > high:
        value = min(value, previous - max_step)
    elif previous < low:
        value = max(value, previous + max_step)

    return clamp(value, low - 0.3, high + 0.3)


def week_profile(device_id, ts: datetime, data_type):
    week_index = ((ts - datetime(ts.year, 1, 1)).days) // 7
    key = f"{device_id}_{week_index}_{data_type}"

    if key not in weekly_profiles:
        rng = random.Random(hash(key) % 1_000_000)
        hourly_offsets = {
            h: rng.uniform(-0.6, 0.6) if data_type == "temp" else rng.uniform(-1.8, 1.8)
            for h in range(24)
        }
        weekly_profiles[key] = {
            "phase": rng.uniform(-6.0, 6.0),
            "amp": rng.uniform(0.6, 1.4),
            "base_offset": rng.uniform(-0.8, 0.8) if data_type == "temp" else rng.uniform(-2.5, 2.5),
            "wave_count": rng.uniform(3.0, 4.5),
            "phase_shift": rng.uniform(0, 2 * math.pi),
            "hourly_offsets": hourly_offsets,
        }

    return weekly_profiles[key]


def build_wave(profile, hour_decimal):
    period = 24.0 / profile["wave_count"]
    main_phase = ((hour_decimal + profile["phase"]) / period + profile["phase_shift"] / (2 * math.pi)) * 2 * math.pi
    main_wave = math.sin(main_phase) * (1 - 0.15 * math.sin(main_phase) ** 2) * profile["amp"]

    secondary_phase = (hour_decimal / (period * 1.7)) * 2 * math.pi
    secondary_wave = math.sin(secondary_phase) * (1 - 0.1 * math.sin(secondary_phase) ** 2) * 0.35

    tertiary_phase = (hour_decimal / (period * 0.5)) * 2 * math.pi
    tertiary_wave = math.sin(tertiary_phase) * 0.2

    return main_wave + secondary_wave + tertiary_wave


def deterministic_offset(device_id, ts: datetime, data_type):
    day_seed = hash(f"{device_id}_{ts:%Y-%m-%d}_{data_type}") % 1_000_000
    minute_seed = hash(f"{device_id}_{ts:%Y-%m-%d_%H:%M}_{data_type}") % 1_000_000
    day_rng = random.Random(day_seed)
    minute_rng = random.Random(minute_seed)

    if data_type == "temp":
        return day_rng.uniform(-0.2, 0.2) + minute_rng.uniform(-0.06, 0.06)
    return day_rng.uniform(-0.6, 0.6) + minute_rng.uniform(-0.18, 0.18)


def ensure_prev(device_id):
    if device_id not in previous_values:
        previous_values[device_id] = {"temp": STANDARD_TEMP, "hum": STANDARD_HUM}


def smooth_step(target, previous, data_type):
    max_step = 0.18 if data_type == "temp" else 0.45
    diff = target - previous

    if abs(diff) > max_step * 1.5:
        delta = max_step * (0.6 if diff < 0 else 0.8)
    elif abs(diff) > max_step:
        delta = max_step * (0.85 if diff < 0 else 1.0)
    else:
        return previous + diff * 0.85

    return previous + delta if diff > 0 else previous - delta


def compute_value(device, ts: datetime, data_type):
    device_id = device["device_id"]
    ensure_prev(device_id)
    previous = previous_values[device_id][data_type]

    weekday = ts.weekday()
    hour = ts.hour
    minute = ts.minute
    hour_decimal = hour + minute / 60

    temp_flag = data_type == "temp"
    outdoor_temp, outdoor_hum = outdoor_values(ts)
    outdoor_value = outdoor_temp if temp_flag else outdoor_hum

    # Haftanın her günü, her saat HVAC kontrolü altında: Normal çalışma mantığı (sinüs dalgaları, haftalık profiller)
        profile = week_profile(device_id, ts, data_type)
        base = (
            (STANDARD_TEMP if temp_flag else STANDARD_HUM)
            + device["temp_base_offset" if temp_flag else "hum_base_offset"]
            + profile["base_offset"]
        )
        daily_cycle = build_wave(profile, hour_decimal)
        hourly_offset = profile["hourly_offsets"][hour]
        seasonal_adjustment = (seasonal_factor(ts) - 0.5) * (0.8 if temp_flag else -3.5)

        target = base + daily_cycle + hourly_offset + seasonal_adjustment
        target += deterministic_offset(device_id, ts, data_type)
        target += random.uniform(-0.12, 0.12) if temp_flag else random.uniform(-0.35, 0.35)

    # HVAC: Haftanın her günü, her saat açık
    hvac_enabled = True
    target = hvac_adjust(target, previous, data_type, enabled=hvac_enabled)
    value = smooth_step(target, previous, data_type)
    
    # Haftanın her günü, her saat: normal iç ortam limitleri (HVAC her zaman aktif)
        value = clamp(value, 15.0 if temp_flag else 30.0, 30.0 if temp_flag else 80.0)

    previous_values[device_id][data_type] = value
    return round(value, 2)


def generate_entries(device, timestamps):
    entries = []
    for idx, ts in enumerate(timestamps):
        temp = compute_value(device, ts, "temp")
        hum = compute_value(device, ts, "hum")
        entries.append({"temperature": temp, "humidity": hum, "timestamp": ts})

        if (idx + 1) % 10_000 == 0:
            pct = (idx + 1) / len(timestamps) * 100
            print(f"   {device['device_id']}: {idx + 1}/{len(timestamps)} ({pct:.1f}%)")
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
    # Komut satırı argümanlarını parse et
    parser = argparse.ArgumentParser(
        description='Sıcaklık ve Nem verilerini oluştur ve API\'ye gönder',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Örnekler:
  python import_lab_data.py                    # Tüm cihazlar
  python import_lab_data.py --device 2         # Sadece Device 2
  python import_lab_data.py --device 2 --device 3  # Device 2 ve 3
  python import_lab_data.py --device 2 3 5     # Device 2, 3 ve 5
        """
    )
    parser.add_argument(
        '--device',
        nargs='+',
        type=str,
        help='İşlenecek cihaz ID\'leri (boş = tüm cihazlar). Örnek: --device 2 3 5'
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Test modu (sadece ilk cihaz, 1 kayıt)'
    )
    
    args = parser.parse_args()
    
    # Komut satırı argümanlarından device ID'leri al
    target_device_ids = args.device if args.device else TARGET_DEVICE_IDS
    test_mode = args.test or TEST_MODE
    
    # Meteostat verilerini yükle (varsa)
    load_meteostat_data()
    
    end_date = datetime(2025, 11, 23)
    start_date = end_date - timedelta(days=int(365 * 1.5))
    timestamps = generate_timestamps(start_date, end_date)

    print(f"📅 Aralık: {start_date:%Y-%m-%d} → {end_date:%Y-%m-%d} ({len(timestamps)} kayıt)")

    targets = DEVICES
    if target_device_ids:
        targets = [d for d in DEVICES if d["device_id"] in target_device_ids]
        if not targets:
            available_ids = [d["device_id"] for d in DEVICES]
            print(f"⚠️  Belirtilen cihaz ID'leri bulunamadı!")
            print(f"   İstenen: {', '.join(target_device_ids)}")
            print(f"   Mevcut: {', '.join(available_ids)}")
            return
        print(f"🎯 İşlenecek cihazlar: {', '.join(d['device_id'] for d in targets)}")
    else:
        print(f"🎯 Tüm cihazlar işlenecek: {', '.join(d['device_id'] for d in DEVICES)}")

    if test_mode:
        targets = targets[:1]
        print(f"🧪 TEST MODE: Sadece Device {targets[0]['device_id']}")

    for device in targets:
        device_id = device["device_id"]
        print(f"\n{'=' * 50}\n📱 Device {device_id} başlıyor...")

        previous_values.pop(device_id, None)
        entries = generate_entries(device, timestamps)

        temps = [e["temperature"] for e in entries]
        hums = [e["humidity"] for e in entries]
        print(f"   Sıcaklık Ort = {sum(temps)/len(temps):.2f}°C | Min={min(temps):.2f} Max={max(temps):.2f}")
        print(f"   Nem Ort = {sum(hums)/len(hums):.2f}% | Min={min(hums):.2f} Max={max(hums):.2f}")

        sent, failed = send_batches(device_id, entries)
        print(f"✅ Device {device_id}: {sent} kayıt gönderildi, {failed} hata")

    print("\n🎉 Tüm işlemler tamamlandı!")


if __name__ == "__main__":
    main()

