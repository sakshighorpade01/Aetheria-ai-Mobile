# Dockerfile (Final, Production-Ready Version)

FROM python:3.11-slim-bookworm

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

ENV PYTHONUNBUFFERED=1

# Railway will set PORT dynamically (usually 8000-9000 range)
# Gunicorn binds to 0.0.0.0:$PORT which Railway provides
# For local development, PORT defaults to 8765
CMD ["sh", "-c", "gunicorn --worker-class eventlet -w 1 --timeout 300 --keep-alive 65 --bind 0.0.0.0:${PORT:-8765} app:app"]