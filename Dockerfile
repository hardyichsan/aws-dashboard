FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN python -m venv venv \
    && . venv/bin/activate \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x start.sh

CMD ["bash", "-c", ". venv/bin/activate && ./start.sh"]