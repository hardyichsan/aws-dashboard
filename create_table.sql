CREATE TABLE IF NOT EXISTS sensor_datas (
    id SERIAL PRIMARY KEY,
    temp REAL,
    hum REAL,
    press REAL,
    wspeed REAL,
    wdir REAL,
    rain REAL,
    srad REAL,
    device TEXT,
    timestamp TIMESTAMP,
    created_at TIMESTAMP,
    latitude REAL,
    longitude REAL,
    altitude REAL,
    location TEXT
);
