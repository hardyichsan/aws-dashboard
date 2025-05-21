from flask import Flask, render_template, jsonify, request
import psycopg2
import pandas as pd
from datetime import datetime, timedelta
import json
import os

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

        param_fields = ', '.join(params)
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

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5010
    app.run(host="0.0.0.0", port=port)
