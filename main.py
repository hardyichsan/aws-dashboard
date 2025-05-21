import time
from datetime import datetime, timedelta
from sensor import read_sensor
from database import insert_data
import json

# Load konfigurasi
with open("config.json") as f:
    config = json.load(f)

def wait_until_next_interval(interval_minutes):
    now = datetime.now()
    next_minute = (now.minute // interval_minutes + 1) * interval_minutes
    next_time = now.replace(minute=0, second=0, microsecond=0) + timedelta(minutes=next_minute)
    if next_time <= now:
        next_time += timedelta(hours=1)
    wait_seconds = (next_time - now).total_seconds()
    print(f"⏳ Menunggu {int(wait_seconds)} detik sampai {next_time.strftime('%H:%M:%S')}")
    time.sleep(wait_seconds)

def main():
    interval = 1  # Ubah ke 1, 2, 3, atau 5 menit sesuai kebutuhan

    while True:
        print("📡 Membaca sensor...")
        sensor_data = read_sensor()

        if sensor_data:
            print("✅ Data sensor terbaca:", sensor_data)
            temp, hum, press, wspeed, wdir, rain, srad = sensor_data

            insert_data(
                temp=temp,
                hum=hum,
                press=press,
                wspeed=wspeed,
                wdir=wdir,
                rain=rain,
                srad=srad
            )
        else:
            print("⚠️ Pembacaan sensor gagal. Tidak menyimpan.")

        wait_until_next_interval(interval)

if __name__ == "__main__":
    main()
