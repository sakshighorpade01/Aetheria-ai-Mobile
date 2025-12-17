# Dockerfile (Final, Production-Ready Version)

FROM python:3.12-slim-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    python3-dev \
    libffi-dev \
    libssl-dev \
 && rm -rf /var/lib/apt/lists/*


WORKDIR /app

COPY python-backend/requirements.txt . 

RUN pip install --no-cache-dir -r requirements.txt

COPY python-backend/ . 

EXPOSE 8765

ENV PORT=8765

ENV PYTHONUNBUFFERED=1

# CRITICAL FIX: Use the JSON array "exec" form for CMD.
# This bypasses the shell and prevents any misinterpretation of quotes.
# CMD now points directly to the instantiated app in `app.py`.
# Added logging flags for better visibility
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--timeout", "300", "--keep-alive", "65", "--bind", "0.0.0.0:8765", "--log-level", "info", "--access-logfile", "-", "--error-logfile", "-", "app:app"]