# Stage 1: builder
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: final
FROM python:3.11-slim

WORKDIR /worker

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

COPY . .

RUN useradd -m -u 1000 workeruser && chown -R workeruser:workeruser /worker
USER workeruser

CMD ["celery", "-A", "celery_app", "worker", "--loglevel=info", "--concurrency=2"]
