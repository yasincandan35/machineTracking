"""
Meteostat'tan Manisa için hava durumu verilerini çeker ve CSV'ye kaydeder.
Kullanım: pip install meteostat
"""
import os
from datetime import datetime, timedelta
from meteostat import Point, Hourly
import csv

# Manisa koordinatları (Meteostat'tan: 38.612, 27.4265, elevation 77m)
MANISA = Point(38.612, 27.4265, 77)

# Tarih aralığı: 1.5 yıl geriye
end_date = datetime(2025, 11, 21)
start_date = end_date - timedelta(days=int(365 * 1.5))

print(f"📥 Meteostat'tan veri çekiliyor...")
print(f"   Tarih aralığı: {start_date:%Y-%m-%d} → {end_date:%Y-%m-%d}")

# Veri çek
data = Hourly(MANISA, start_date, end_date)
df = data.fetch()

if df.empty:
    print("❌ Veri çekilemedi!")
    exit(1)

print(f"✅ {len(df)} saatlik veri çekildi")

# CSV'ye kaydet (script'in bulunduğu klasöre)
script_dir = os.path.dirname(os.path.abspath(__file__))
csv_file = os.path.join(script_dir, "manisa_weather_data.csv")
df.to_csv(csv_file)

print(f"💾 Veriler kaydedildi: {csv_file}")
print(f"   Sütunlar: {list(df.columns)}")
print(f"\n📊 İstatistikler:")
print(f"   Sıcaklık: Min={df['temp'].min():.1f}°C, Max={df['temp'].max():.1f}°C, Ort={df['temp'].mean():.1f}°C")
if 'rhum' in df.columns:
    print(f"   Nem: Min={df['rhum'].min():.1f}%, Max={df['rhum'].max():.1f}%, Ort={df['rhum'].mean():.1f}%")

