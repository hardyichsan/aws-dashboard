FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN apt-get update && apt-get install -y \
    && python -m venv venv \
    && . venv/bin/activate \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get clean

# Salin seluruh project
COPY . .

# Pastikan start.sh dapat dieksekusi
RUN chmod +x start.sh

# Jalankan aplikasi via start.sh
CMD ["./start.sh"]