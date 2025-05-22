#!/bin/bash
. venv/bin/activate
python3 main.py &
exec python3 app.py
