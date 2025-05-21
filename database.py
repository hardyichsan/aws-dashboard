import psycopg2
from datetime import datetime
import json

# Load konfigurasi dari file
with open("config.json") as f:
    config = json.load(f)

# DB config tetap hardcode karena dipakai di app.py dan docker-compose
DB_CONFIG = {
    "host": "db",
    "database": "aws_db",
    "user": "postgres",
    "password": "has123456",
    "port": 5432
}

def insert_data(temp, hum, press, wspeed, wdir, rain, srad):
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        query = """
        INSERT INTO sensor_datas (
            temp, hum, press, wspeed, wdir, rain, srad,
            device, timestamp, created_at,
            latitude, longitude, altitude, location
        ) VALUES (%s, %s, %s, %s, %s, %s, %s,
                  %s, %s, %s, %s, %s, %s, %s)
        """

        now = datetime.now()
        geo = config["geo"]
        values = (
            temp, hum, press, wspeed, wdir, rain, srad,
            config["device"], now, now,
            geo["latitude"], geo["longitude"], geo["altitude"],
            config["location"]
        )

        cur.execute(query, values)
        conn.commit()
        cur.close()
        print("✅ Data inserted successfully:", now.strftime('%Y-%m-%d %H:%M:%S'))

    except Exception as e:
        print("❌ Database insert error:", e)

    finally:
        if conn:
            conn.close()
