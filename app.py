from flask import Flask, render_template, jsonify, request, send_file
import psycopg2
import pandas as pd
from datetime import datetime, timedelta
import json
import os
import io

app = Flask(__name__)

with open("config.json") as f:
    CONFIG = json.load(f)

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "database": os.environ.get("DB_NAME", "aws_db"),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", "has123456"),
    "port": os.environ.get("DB_PORT", 5432)
}

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/api/config')
def get_config():
    return jsonify(CONFIG)

@app.route('/api/latest')
def latest_data():
    try:
        print("📥 MEMASUKI /api/latest")
        params = CONFIG.get("parameters", [])
        if not params:
            print("⚠️ Parameter kosong")
            return jsonify({"error": "No parameters defined in config"}), 400

        param_fields = ', '.join(params + ["timestamp"])
        print("🔍 SQL kolom:", param_fields)

        query = f"""
        SELECT {param_fields}
        FROM sensor_datas
        ORDER BY timestamp DESC
        LIMIT 1;
        """
        conn = psycopg2.connect(**DB_CONFIG)
        df = pd.read_sql(query, conn)
        conn.close()

        print("📊 Hasil query:", df)

        if df.empty:
            print("📭 Data kosong")
            return jsonify({param: None for param in params})
        else:
            row = df.iloc[0].to_dict()
            if 'timestamp' in row and row['timestamp']:
                ts = row['timestamp']
                row['timestamp'] = ts.strftime("%Y-%m-%d %H:%M")
            print("✅ Data ditemukan:", row)
            return jsonify(row)

    except Exception as e:
        print("❌ Exception di /api/latest:", e)
        return jsonify({"error": str(e)}), 500


@app.route('/api/history')
def history_data():
    param = request.args.get('param', 'temp')
    range_time = request.args.get('range', 'realtime')
    now = datetime.now()

    start_time = {
        "realtime": now - timedelta(minutes=15),
        "1h": now - timedelta(hours=1),
        "12h": now - timedelta(hours=12),
        "1d": now - timedelta(days=1),
        "3d": now - timedelta(days=3),
        "7d": now - timedelta(days=7)
    }.get(range_time, now - timedelta(minutes=15))

    try:
        query = f"SELECT timestamp, {param} FROM sensor_datas WHERE timestamp >= %s ORDER BY timestamp ASC;"
        conn = psycopg2.connect(**DB_CONFIG)
        df = pd.read_sql(query, conn, params=(start_time,))
        conn.close()

        if param not in df.columns:
            return jsonify({"timestamps": [], "values": []})

        return jsonify({
            "timestamps": df["timestamp"].astype(str).tolist(),
            "values": df[param].tolist()
        })

    except Exception as e:
        print("❌ /api/history error:", e)
        return jsonify({"timestamps": [], "values": [], "error": str(e)}), 500

@app.route('/api/windrose')
def windrose_data():
    range_time = request.args.get('range', 'realtime')
    now = datetime.now()

    start_time = {
        "realtime": now - timedelta(minutes=15),
        "1h": now - timedelta(hours=1),
        "12h": now - timedelta(hours=12),
        "1d": now - timedelta(days=1),
        "3d": now - timedelta(days=3),
        "7d": now - timedelta(days=7)
    }.get(range_time, now - timedelta(minutes=15))

    try:
        query = "SELECT timestamp, wspeed, wdir FROM sensor_datas WHERE timestamp >= %s ORDER BY timestamp ASC;"
        conn = psycopg2.connect(**DB_CONFIG)
        df = pd.read_sql(query, conn, params=(start_time,))
        conn.close()

        if "wspeed" not in df.columns or "wdir" not in df.columns:
            return jsonify({"timestamps": [], "wspeed": [], "wdir": []})

        return jsonify({
            "timestamps": df["timestamp"].astype(str).tolist(),
            "wspeed": df["wspeed"].tolist(),
            "wdir": df["wdir"].tolist()
        })

    except Exception as e:
        print("❌ /api/windrose error:", e)
        return jsonify({"timestamps": [], "wspeed": [], "wdir": [], "error": str(e)}), 500

@app.route('/api/export', methods=['POST'])
def export_data():
    try:
        data = request.get_json()
        start = data.get("start")
        end = data.get("end")
        destination = data.get("destination", "download")

        print(f"📦 Export request: {start} → {end} to {destination}")

        # Validasi format waktu
        start_dt = datetime.fromisoformat(start)
        end_dt = datetime.fromisoformat(end)

        # Query data dari database
        query = "SELECT * FROM sensor_datas WHERE timestamp BETWEEN %s AND %s ORDER BY timestamp ASC;"
        conn = psycopg2.connect(**DB_CONFIG)
        df = pd.read_sql(query, conn, params=(start_dt, end_dt))
        conn.close()

        if df.empty:
            return jsonify({"error": "Tidak ada data dalam rentang waktu tersebut."}), 400

        filename = f"export_{start_dt.strftime('%Y%m%d%H%M')}_{end_dt.strftime('%Y%m%d%H%M')}.csv"

        if destination == "download":
            # Kirim ke browser
            csv_io = io.StringIO()
            df.to_csv(csv_io, index=False)
            mem = io.BytesIO()
            mem.write(csv_io.getvalue().encode('utf-8'))
            mem.seek(0)
            return send_file(mem, download_name=filename, as_attachment=True, mimetype='text/csv')

        else:
            # Simpan ke USB dengan mount otomatis
            usb_root = "/mnt/usb"
            usb_path = os.path.join(usb_root, destination)

            if not os.path.isdir(usb_path) or not os.access(usb_path, os.W_OK):
                return jsonify({"error": f"Folder USB '{destination}' tidak ditemukan atau tidak bisa ditulis."}), 500

            export_path = os.path.join(usb_path, filename)
            df.to_csv(export_path, index=False)

            print(f"✅ Data berhasil diekspor ke: {export_path}")
            return jsonify({"status": "success", "path": export_path})

    except Exception as e:
        print("❌ Export error:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/usb-list')
def list_usb_devices():
    usb_root = "/mnt/usb"
    try:
        devices = ["download"]  # pilihan default
        for d in os.listdir(usb_root):
            path = os.path.join(usb_root, d)
            if os.path.isdir(path) and os.access(path, os.W_OK):
                devices.append(d)
        return jsonify(devices)
    except Exception as e:
        return jsonify(["download"])

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5010
    app.run(host="0.0.0.0", port=port)
