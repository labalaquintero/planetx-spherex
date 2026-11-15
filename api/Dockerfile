# syntax=docker/dockerfile:1
# API de Planet X (FastAPI + Uvicorn). El contexto de build es ./api (ver compose.yaml).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

# Dependencias primero para aprovechar la caché de capas. Versiones fijadas en requirements.txt.
COPY requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt && rm /tmp/requirements.txt

# El código queda en /app/api para que «uvicorn app:app --app-dir api» sea idéntico al uso local.
COPY app.py /app/api/app.py
COPY planetx /app/api/planetx
RUN find /app/api -name __pycache__ -type d -prune -exec rm -rf {} + \
    && useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin app \
    && mkdir -p /app/data \
    && chown app /app/data

USER app
EXPOSE 8000

# Sin curl en la imagen slim: se usa la biblioteca estándar.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)"]

CMD ["python", "-m", "uvicorn", "app:app", "--app-dir", "api", "--host", "0.0.0.0", "--port", "8000"]
