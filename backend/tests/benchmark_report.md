# Audio Separation — Benchmark Report

> RTX 3060 12GB | CPU: 16 cores | PyTorch 2.10.0+cu128
> Test audio: 5s, 30s, 60s | FP16 autocast on GPU | INT8 quantization on CPU

## 1. Direct Model-Serving — GPU (FP16)

| Model | 5s | 30s | 60s | RT@60s | Manual vs Docker |
|-------|:---:|:---:|:---:|:---:|:---:|
| demucs | 0.24s / 0.24s | 1.32s / 1.3s | 2.46s / 2.39s | 24.4x | same |
| demucs_ft | 0.77s / 0.77s | 4.25s / 4.24s | 7.92s / 7.91s | 7.6x | same |
| bs_roformer | 1.34s / 1.37s | 3.74s / 3.81s | 7.29s / 7.28s | 8.2x | same |
| melband_roformer | 1.22s / 1.23s | 3.37s / 3.48s | 6.61s / 8.42s | 9.1x | 1.27x |

> Format: Manual / Docker

## 2. Direct Model-Serving — CPU (INT8)

| Model | 5s | 30s | 60s | RT@60s | Manual vs Docker |
|-------|:---:|:---:|:---:|:---:|:---:|
| demucs | 1.96s / 1.92s | 11.71s / 12.0s | 20.99s / 20.88s | 2.9x | same |
| demucs_ft | 7.61s / 7.38s | 44.8s / 45.13s | 81.87s / 81.05s | 0.7x | same |

> bs_roformer and melband_roformer are disabled on CPU (too slow: 15-16x slower than GPU)

## 3. API End-to-End (Client → API → Celery → Model-Serving → MinIO)

| Model | Device | 5s | 30s | 60s | Manual vs Docker |
|-------|:---:|:---:|:---:|:---:|:---:|
| demucs | gpu | 1.9s / 1.24s | 2.13s / 2.62s | 3.14s / 3.15s | same |
| melband_roformer | gpu | 2.16s / 2.13s | 4.16s / 4.19s | 7.73s / 7.19s | same |
| demucs | cpu | 2.6s / 2.68s | 11.97s / 11.97s | 21.29s / 20.25s | same |

## 4. GPU Optimization: FP16 Autocast Speedup

| Model | FP32 (before) | FP16 (after) | Speedup |
|-------|:---:|:---:|:---:|
| demucs | 2.57s | 2.46s | **1.04x** |
| demucs_ft | 8.12s | 7.92s | **1.03x** |
| bs_roformer | 16.72s | 7.29s | **2.29x** |
| melband_roformer | 13.53s | 6.61s | **2.05x** |

> FP32 baseline measured before `use_autocast=True` was added

## 5. CPU Optimization: INT8 Quantization

| Model | Optimization | Supported | Notes |
|-------|:---:|:---:|---|
| demucs | INT8 (Linear + LSTM) | Yes | ~1.37x speedup |
| demucs_ft | None | Yes | No benefit from INT8 |
| bs_roformer | INT8 (Linear) | **Disabled** | 15.9x slower than GPU, impractical |
| melband_roformer | INT8 (Linear) | **Disabled** | 14.4x slower than GPU, impractical |

## 6. Device Selection API

```
POST /api/v1/separate?model=demucs&device=cpu    # Admin only, demucs/demucs_ft
POST /api/v1/separate?model=demucs&device=gpu    # Explicit GPU
POST /api/v1/separate?model=demucs&device=auto   # Default (GPU if available)
POST /api/v1/separate?model=bs_roformer&device=cpu  # → 422 (disabled)
```

- **Users**: always `device=auto` (GPU), no device option in UI
- **Admins**: GPU/CPU toggle visible for demucs/demucs_ft models only
- **RoFormer on CPU**: returns 422 error

## 7. Deployment

| Mode | Command | Env File |
|------|---------|----------|
| Docker | `docker compose up -d` | `.env.docker` |
| Manual | Start uvicorn + celery manually | `.env` |

### Environment Files

| File | Purpose | Hosts |
|------|---------|-------|
| `.env` | Local / manual development | `localhost:5433`, `localhost:6380`, `localhost:9002` |
| `.env.docker` | Docker compose | `postgres:5432`, `redis:6379`, `minio:9000` |
| `.env.example` | Template for new setups | — |
