# Audio Separation Model Evaluation Report

**Date:** 2026-03-13
**GPU:** NVIDIA GeForce RTX 3060
**Dataset:** MUSDB18 Test Set (50 tracks, 7s stereo @ 44100Hz)
**Metrics:** SDR / SIR / SAR via museval (median across tracks, in dB)

---

## Summary Comparison

| Model | Type | Vocals SDR | Instr. SDR | Avg/Track | Realtime Factor |
|---|---|---|---|---|---|
| Demucs v4 HTDemucs | 4-stem | 9.08 dB | 13.81 dB | 0.277s | **24.6x** |
| Demucs v4 HTDemucs FT | 4-stem | 8.63 dB | 12.93 dB | 1.074s | 6.3x |
| **BS-RoFormer (ViperX-1297)** | 2-stem | **12.39 dB** | **15.76 dB** | 2.028s | 3.4x |
| MelBand RoFormer (ViperX-1143) | 2-stem | 10.18 dB | 15.04 dB | 1.412s | 4.8x |

---

## 1. Demucs v4 HTDemucs

> Fast mode — hybrid transformer, good quality, near real-time

- **Model ID:** `htdemucs`
- **Library:** demucs (torch.hub)
- **Stems:** vocals, drums, bass, other
- **Speed:** 0.277s/track (24.6x realtime)

### Aggregate Metrics (median)

| Stem | SDR | SIR | SAR |
|---|---|---|---|
| Vocals | 9.08 dB | 14.24 dB | 9.34 dB |
| Drums | 9.52 dB | 15.49 dB | 10.38 dB |
| Bass | 9.57 dB | 14.55 dB | 10.19 dB |
| Other | 5.73 dB | 8.88 dB | 6.62 dB |
| Instrumental | 13.81 dB | inf | 14.03 dB |

### Per-Track Results

| Track | Vocals SDR | Drums SDR | Bass SDR | Other SDR | Instr. SDR | Time |
|---|---|---|---|---|---|---|
| AM Contra - Heart Peripheral | 11.57 | 8.03 | 3.85 | 0.64 | 14.36 | 0.614s |
| Al James - Schoolboy Facination | 9.33 | 6.40 | 14.61 | 5.69 | 10.38 | 0.265s |
| Angels In Amplifiers - I'm Alright | 10.52 | 6.77 | 9.63 | 7.34 | 12.65 | 0.275s |
| Arise - Run Run Run | 9.26 | -2.58 | 12.89 | 1.01 | 18.19 | 0.277s |
| BKS - Bulldozer | 6.27 | 10.36 | 8.69 | 4.94 | 11.79 | 0.276s |
| BKS - Too Much | 11.42 | 9.89 | 13.80 | 6.27 | 14.22 | 0.269s |
| Ben Carrigan - We'll Talk About It All Tonight | 5.77 | 9.73 | 15.83 | 5.46 | 14.69 | 0.264s |
| Bobby Nobody - Stitch Up | 9.56 | 6.43 | 5.87 | 5.86 | 14.84 | 0.269s |
| Buitraker - Revo X | 4.52 | 13.69 | 10.55 | 7.23 | 12.40 | 0.264s |
| Carlos Gonzalez - A Place For Us | 7.90 | 5.82 | -0.59 | 4.57 | 7.35 | 0.262s |
| Cristina Vane - So Easy | 15.47 | 14.08 | 5.21 | 4.39 | 19.94 | 0.272s |
| Detsky Sad - Walkie Talkie | 11.07 | 9.81 | 1.29 | 1.41 | 12.49 | 0.266s |
| Enda Reilly - Cur An Long Ag Seol | 12.30 | 14.79 | 10.02 | 8.49 | 13.92 | 0.267s |
| Forkupines - Semantics | 9.00 | 8.58 | 8.79 | 6.92 | 13.00 | 0.270s |
| Georgia Wonder - Siren | 8.31 | 10.15 | 9.96 | 5.88 | 11.12 | 0.267s |
| Girls Under Glass - We Feel Alright | 5.96 | 7.32 | 2.24 | 4.12 | 10.13 | 0.267s |
| Hollow Ground - Ill Fate | 7.64 | 6.80 | 3.38 | 4.44 | 13.70 | 0.273s |
| James Elder & Mark M Thompson - The English Actor | 6.47 | 6.48 | 10.53 | 5.76 | 8.67 | 0.278s |
| Juliet's Rescue - Heartbeats | 11.11 | 17.81 | -3.91 | 3.87 | 17.32 | 0.269s |
| Little Chicago's Finest - My Own | 9.26 | 13.79 | 17.91 | 7.33 | 15.75 | 0.269s |
| Louis Cressy Band - Good Time | 9.16 | 8.47 | 11.62 | 8.22 | 14.00 | 0.267s |
| Lyndsey Ollard - Catching Up | 13.29 | 10.04 | 10.49 | 5.91 | 14.75 | 0.272s |
| M.E.R.C. Music - Knockout | 7.93 | 9.19 | 15.59 | 4.12 | 9.85 | 0.271s |
| Moosmusic - Big Dummy Shake | 13.33 | 11.52 | 12.13 | 5.94 | 15.89 | 0.279s |
| Motor Tapes - Shore | 0.00 | 10.91 | 9.51 | 9.75 | 11.33 | 0.269s |
| Mu - Too Bright | 14.83 | 15.97 | 7.73 | 8.06 | 17.38 | 0.270s |
| Nerve 9 - Pray For The Rain | 8.07 | 13.99 | 7.12 | 4.50 | 9.05 | 0.268s |
| PR - Happy Daze | -0.40 | 16.60 | 15.05 | 7.97 | 25.78 | 0.267s |
| PR - Oh No | 0.50 | 7.66 | -0.00 | -0.11 | 8.86 | 0.266s |
| Punkdisco - Oral Hygiene | 10.67 | 1.06 | 1.81 | 0.42 | 17.02 | 0.271s |
| Raft Monk - Tiring | 6.64 | 8.22 | 6.05 | 3.39 | 12.33 | 0.269s |
| Sambasevam Shanmugam - Kaathaadi | 11.31 | 15.82 | 10.89 | 7.19 | 15.91 | 0.272s |
| Secretariat - Borderline | 7.58 | 4.79 | 6.63 | 7.00 | 9.02 | 0.267s |
| Secretariat - Over The Top | 10.78 | 8.93 | 10.93 | 5.11 | 16.25 | 0.268s |
| Side Effects Project - Sing With Me | 13.24 | 14.58 | 13.90 | 4.51 | 15.23 | 0.270s |
| Signe Jakobsen - What Have You Done To Me | 11.53 | 4.27 | -0.78 | 4.79 | 14.42 | 0.269s |
| Skelpolu - Resurrection | 0.20 | 10.37 | 13.83 | -1.43 | 6.05 | 0.277s |
| Speak Softly - Broken Man | 7.19 | 8.65 | 17.90 | 8.05 | 16.57 | 0.270s |
| Speak Softly - Like Horses | 7.19 | 7.33 | 21.19 | 6.55 | 12.18 | 0.273s |
| The Doppler Shift - Atrophy | 7.50 | 11.72 | 6.06 | 6.15 | 12.13 | 0.266s |
| The Easton Ellises (Baumi) - SDRNR | 4.89 | 11.05 | 6.54 | 1.60 | 8.74 | 0.270s |
| The Easton Ellises - Falcon 69 | 4.65 | 9.31 | 7.38 | 3.12 | 9.71 | 0.264s |
| The Long Wait - Dark Horses | 9.62 | 8.72 | 11.51 | 6.78 | 13.01 | 0.267s |
| The Mountaineering Club - Mallory | 9.53 | 12.71 | 13.03 | 5.19 | 17.21 | 0.264s |
| The Sunshine Garcia Band - For I Am The Moon | 11.42 | 10.39 | 14.89 | 8.76 | 15.93 | 0.265s |
| Timboz - Pony | 5.66 | 4.33 | 1.40 | 8.51 | 14.58 | 0.266s |
| Tom McKenzie - Directions | 7.36 | 15.49 | -0.05 | -3.97 | 16.67 | 0.282s |
| Triviul feat. The Fiend - Widow | 10.87 | 5.86 | 16.34 | 4.39 | 10.56 | 0.289s |
| We Fell From The Sky - Not You | 6.85 | 11.64 | 4.45 | 8.28 | 14.10 | 0.278s |
| Zeno - Signs | 9.43 | 9.16 | 4.69 | 6.47 | 11.56 | 0.264s |

### Performance

| Metric | Value |
|---|---|
| Total audio | 340.0s |
| Total processing | 13.8s |
| Avg per track | 0.277s |
| Realtime factor | 24.6x |

---

## 2. Demucs v4 HTDemucs FT (Fine-Tuned)

> Fine-tuned — higher quality, slower (bag of 4 models)

- **Model ID:** `htdemucs_ft`
- **Library:** demucs (torch.hub)
- **Stems:** vocals, drums, bass, other
- **Speed:** 1.074s/track (6.3x realtime)

### Aggregate Metrics (median)

| Stem | SDR | SIR | SAR |
|---|---|---|---|
| Vocals | 8.63 dB | 14.70 dB | 9.32 dB |
| Drums | 9.45 dB | 15.82 dB | 10.26 dB |
| Bass | 9.81 dB | 14.53 dB | 10.09 dB |
| Other | 5.66 dB | 8.62 dB | 6.67 dB |
| Instrumental | 12.93 dB | inf | 13.59 dB |

### Per-Track Results

| Track | Vocals SDR | Drums SDR | Bass SDR | Other SDR | Instr. SDR | Time |
|---|---|---|---|---|---|---|
| AM Contra - Heart Peripheral | 11.45 | 7.37 | 4.90 | 0.88 | 13.26 | 1.047s |
| Al James - Schoolboy Facination | 9.50 | 6.72 | 13.94 | 5.89 | 10.45 | 1.051s |
| Angels In Amplifiers - I'm Alright | 10.76 | 6.49 | 9.92 | 7.50 | 12.51 | 1.045s |
| Arise - Run Run Run | 9.82 | -2.07 | 13.49 | 0.92 | 14.55 | 1.063s |
| BKS - Bulldozer | 6.65 | 10.79 | 8.92 | 5.19 | 11.85 | 1.048s |
| BKS - Too Much | 11.40 | 10.00 | 14.27 | 6.33 | 14.00 | 1.041s |
| Ben Carrigan - We'll Talk About It All Tonight | 6.21 | 10.12 | 15.87 | 5.91 | 14.58 | 1.065s |
| Bobby Nobody - Stitch Up | 9.96 | 7.01 | 5.58 | 6.03 | 14.10 | 1.058s |
| Buitraker - Revo X | 4.83 | 13.57 | 10.67 | 7.27 | 11.97 | 1.042s |
| Carlos Gonzalez - A Place For Us | 8.08 | 6.91 | 0.21 | 5.22 | 7.29 | 1.080s |
| Cristina Vane - So Easy | 15.81 | 14.20 | 6.04 | 4.21 | 18.85 | 1.055s |
| Detsky Sad - Walkie Talkie | 11.47 | 8.70 | 4.67 | 2.60 | 11.04 | 1.079s |
| Enda Reilly - Cur An Long Ag Seol | 13.02 | 14.90 | 10.19 | 9.04 | 14.05 | 1.087s |
| Forkupines - Semantics | 9.10 | 8.71 | 9.11 | 7.10 | 12.88 | 1.083s |
| Georgia Wonder - Siren | 8.49 | 11.02 | 10.50 | 6.14 | 10.98 | 1.086s |
| Girls Under Glass - We Feel Alright | 6.08 | 7.46 | 2.34 | 4.44 | 9.98 | 1.087s |
| Hollow Ground - Ill Fate | 7.70 | 6.96 | 3.97 | 4.49 | 13.08 | 1.053s |
| James Elder & Mark M Thompson - The English Actor | 5.83 | 6.84 | 11.19 | 5.57 | 8.26 | 1.076s |
| Juliet's Rescue - Heartbeats | 11.48 | 17.74 | -4.18 | 3.93 | 16.48 | 1.106s |
| Little Chicago's Finest - My Own | 7.42 | 13.97 | 17.63 | 6.57 | 14.46 | 1.079s |
| Louis Cressy Band - Good Time | 8.76 | 8.73 | 11.71 | 8.53 | 12.80 | 1.075s |
| Lyndsey Ollard - Catching Up | 12.53 | 8.84 | 9.96 | 6.04 | 13.78 | 1.112s |
| M.E.R.C. Music - Knockout | 7.91 | 9.44 | 15.93 | 4.64 | 9.80 | 1.110s |
| Moosmusic - Big Dummy Shake | 13.44 | 11.83 | 11.00 | 5.98 | 14.91 | 1.089s |
| Motor Tapes - Shore | 0.00 | 10.94 | 9.70 | 9.74 | 11.22 | 1.090s |
| Mu - Too Bright | 15.52 | 16.17 | 7.57 | 7.69 | 16.78 | 1.085s |
| Nerve 9 - Pray For The Rain | 8.02 | 14.27 | 7.01 | 4.46 | 8.39 | 1.049s |
| PR - Happy Daze | -8.75 | 15.07 | 10.74 | 1.71 | 15.24 | 1.085s |
| PR - Oh No | 0.31 | 7.94 | 0.00 | -0.11 | 8.90 | 1.086s |
| Punkdisco - Oral Hygiene | 10.56 | 2.72 | 2.67 | -0.48 | 12.64 | 1.072s |
| Raft Monk - Tiring | 6.67 | 8.14 | 6.56 | 3.68 | 12.06 | 1.088s |
| Sambasevam Shanmugam - Kaathaadi | 11.55 | 17.36 | 10.41 | 7.09 | 15.63 | 1.073s |
| Secretariat - Borderline | 8.29 | 4.39 | 7.38 | 7.26 | 9.14 | 1.067s |
| Secretariat - Over The Top | 11.26 | 9.46 | 10.55 | 5.15 | 15.67 | 1.127s |
| Side Effects Project - Sing With Me | 13.12 | 14.84 | 14.51 | 5.00 | 15.26 | 1.067s |
| Signe Jakobsen - What Have You Done To Me | 11.52 | 4.56 | -2.02 | 3.48 | 13.71 | 1.068s |
| Skelpolu - Resurrection | 1.38 | 10.46 | 13.81 | -0.29 | 7.17 | 1.067s |
| Speak Softly - Broken Man | 7.54 | 8.77 | 17.92 | 9.29 | 15.47 | 1.096s |
| Speak Softly - Like Horses | 5.41 | 6.93 | 21.53 | 5.74 | 11.96 | 1.088s |
| The Doppler Shift - Atrophy | 7.37 | 11.67 | 5.77 | 5.86 | 11.82 | 1.056s |
| The Easton Ellises (Baumi) - SDRNR | 4.38 | 11.50 | 6.49 | 1.44 | 8.33 | 1.059s |
| The Easton Ellises - Falcon 69 | 5.22 | 9.54 | 7.17 | 3.75 | 10.46 | 1.094s |
| The Long Wait - Dark Horses | 9.92 | 9.12 | 11.61 | 6.79 | 12.99 | 1.081s |
| The Mountaineering Club - Mallory | 9.63 | 13.03 | 13.03 | 4.98 | 16.41 | 1.070s |
| The Sunshine Garcia Band - For I Am The Moon | 12.48 | 11.70 | 14.46 | 9.26 | 15.93 | 1.079s |
| Timboz - Pony | 5.65 | 4.75 | 1.21 | 8.15 | 13.77 | 1.057s |
| Tom McKenzie - Directions | 7.53 | 15.54 | 6.43 | 1.95 | 15.50 | 1.073s |
| Triviul feat. The Fiend - Widow | 10.86 | 6.13 | 16.43 | 4.72 | 10.79 | 1.093s |
| We Fell From The Sky - Not You | 6.93 | 11.83 | 4.30 | 8.35 | 13.87 | 1.063s |
| Zeno - Signs | 9.19 | 9.42 | 5.38 | 6.77 | 11.30 | 1.075s |

### Performance

| Metric | Value |
|---|---|
| Total audio | 340.0s |
| Total processing | 53.7s |
| Avg per track | 1.074s |
| Realtime factor | 6.3x |

---

## 3. BS-RoFormer (ViperX-1297)

> BS-RoFormer — SOTA vocal separation by ViperX

- **Model ID:** `model_bs_roformer_ep_317_sdr_12.9755.ckpt`
- **Library:** audio-separator
- **Stems:** vocals, instrumental (2-stem only)
- **Speed:** 2.028s/track (3.4x realtime)

### Aggregate Metrics (median)

| Stem | SDR | SIR | SAR |
|---|---|---|---|
| Vocals | **12.39 dB** | inf | 12.17 dB |
| Instrumental | **15.76 dB** | inf | 16.91 dB |

### Per-Track Results

| Track | Vocals SDR | Instr. SDR | Time |
|---|---|---|---|
| AM Contra - Heart Peripheral | 14.63 | 16.56 | 10.620s |
| Al James - Schoolboy Facination | 11.37 | 12.21 | 1.843s |
| Angels In Amplifiers - I'm Alright | 14.02 | 15.65 | 1.842s |
| Arise - Run Run Run | 16.13 | 23.87 | 1.841s |
| BKS - Bulldozer | 8.12 | 13.80 | 1.875s |
| BKS - Too Much | 13.94 | 17.34 | 1.870s |
| Ben Carrigan - We'll Talk About It All Tonight | 9.93 | 18.47 | 1.902s |
| Bobby Nobody - Stitch Up | 12.55 | 17.96 | 1.884s |
| Buitraker - Revo X | 8.25 | 15.76 | 1.875s |
| Carlos Gonzalez - A Place For Us | 9.58 | 9.02 | 1.889s |
| Cristina Vane - So Easy | 19.73 | 24.51 | 1.888s |
| Detsky Sad - Walkie Talkie | 15.46 | 17.86 | 1.851s |
| Enda Reilly - Cur An Long Ag Seol | 16.41 | 17.16 | 1.825s |
| Forkupines - Semantics | 10.27 | 13.95 | 1.825s |
| Georgia Wonder - Siren | 10.36 | 12.63 | 1.840s |
| Girls Under Glass - We Feel Alright | 7.44 | 11.48 | 1.884s |
| Hollow Ground - Ill Fate | 8.28 | 14.69 | 1.872s |
| James Elder & Mark M Thompson - The English Actor | 7.88 | 10.20 | 1.871s |
| Juliet's Rescue - Heartbeats | 13.47 | 20.40 | 1.834s |
| Little Chicago's Finest - My Own | 15.06 | 19.24 | 1.827s |
| Louis Cressy Band - Good Time | 13.62 | 17.80 | 1.866s |
| Lyndsey Ollard - Catching Up | 15.86 | 18.60 | 1.830s |
| M.E.R.C. Music - Knockout | 11.63 | 14.09 | 1.868s |
| Moosmusic - Big Dummy Shake | 15.54 | 17.15 | 1.873s |
| Motor Tapes - Shore | 0.00 | 11.30 | 1.878s |
| Mu - Too Bright | 17.60 | 20.19 | 1.875s |
| Nerve 9 - Pray For The Rain | 12.50 | 12.51 | 1.817s |
| PR - Happy Daze | 1.87 | 28.03 | 1.869s |
| PR - Oh No | 1.68 | 8.96 | 1.882s |
| Punkdisco - Oral Hygiene | 13.86 | 19.56 | 1.868s |
| Raft Monk - Tiring | 8.67 | 14.57 | 1.825s |
| Sambasevam Shanmugam - Kaathaadi | 17.01 | 22.21 | 1.871s |
| Secretariat - Borderline | 12.41 | 13.30 | 1.864s |
| Secretariat - Over The Top | 12.72 | 18.47 | 1.885s |
| Side Effects Project - Sing With Me | 18.30 | 19.46 | 1.916s |
| Signe Jakobsen - What Have You Done To Me | 12.70 | 15.34 | 1.910s |
| Skelpolu - Resurrection | 0.01 | 6.59 | 1.887s |
| Speak Softly - Broken Man | 12.37 | 22.66 | 1.852s |
| Speak Softly - Like Horses | 8.40 | 14.12 | 1.815s |
| The Doppler Shift - Atrophy | 10.43 | 15.00 | 1.830s |
| The Easton Ellises (Baumi) - SDRNR | 6.66 | 9.77 | 1.843s |
| The Easton Ellises - Falcon 69 | 8.58 | 12.67 | 1.837s |
| The Long Wait - Dark Horses | 13.05 | 17.15 | 1.809s |
| The Mountaineering Club - Mallory | 11.24 | 16.54 | 1.846s |
| The Sunshine Garcia Band - For I Am The Moon | 16.89 | 21.22 | 1.793s |
| Timboz - Pony | 6.23 | 15.28 | 1.803s |
| Tom McKenzie - Directions | 10.54 | 20.27 | 1.813s |
| Triviul feat. The Fiend - Widow | 12.61 | 12.72 | 1.800s |
| We Fell From The Sky - Not You | 9.18 | 15.77 | 1.808s |
| Zeno - Signs | 12.55 | 14.30 | 1.815s |

### Performance

| Metric | Value |
|---|---|
| Total audio | 340.0s |
| Total processing | 101.4s |
| Avg per track | 2.028s |
| Realtime factor | 3.4x |

---

## 4. MelBand RoFormer (ViperX-1143)

> Mel-Band RoFormer — excellent vocal separation quality

- **Model ID:** `model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt`
- **Library:** audio-separator
- **Stems:** vocals, instrumental (2-stem only)
- **Speed:** 1.412s/track (4.8x realtime)

### Aggregate Metrics (median)

| Stem | SDR | SIR | SAR |
|---|---|---|---|
| Vocals | 10.18 dB | inf | 10.25 dB |
| Instrumental | 15.04 dB | inf | 15.27 dB |

### Per-Track Results

| Track | Vocals SDR | Instr. SDR | Time |
|---|---|---|---|
| AM Contra - Heart Peripheral | 13.53 | 15.89 | 1.411s |
| Al James - Schoolboy Facination | 10.29 | 11.09 | 1.422s |
| Angels In Amplifiers - I'm Alright | 12.11 | 13.84 | 1.394s |
| Arise - Run Run Run | 13.29 | 21.75 | 1.423s |
| BKS - Bulldozer | 7.16 | 12.98 | 1.422s |
| BKS - Too Much | 11.99 | 15.74 | 1.416s |
| Ben Carrigan - We'll Talk About It All Tonight | 7.72 | 16.62 | 1.422s |
| Bobby Nobody - Stitch Up | 11.66 | 16.56 | 1.393s |
| Buitraker - Revo X | 5.82 | 13.99 | 1.393s |
| Carlos Gonzalez - A Place For Us | 8.79 | 8.51 | 1.412s |
| Cristina Vane - So Easy | 17.48 | 22.72 | 1.419s |
| Detsky Sad - Walkie Talkie | 13.01 | 15.47 | 1.406s |
| Enda Reilly - Cur An Long Ag Seol | 14.78 | 15.54 | 1.444s |
| Forkupines - Semantics | 9.79 | 13.63 | 1.429s |
| Georgia Wonder - Siren | 9.17 | 11.46 | 1.432s |
| Girls Under Glass - We Feel Alright | 6.55 | 10.99 | 1.392s |
| Hollow Ground - Ill Fate | 7.69 | 14.06 | 1.416s |
| James Elder & Mark M Thompson - The English Actor | 7.11 | 9.53 | 1.408s |
| Juliet's Rescue - Heartbeats | 12.80 | 19.61 | 1.403s |
| Little Chicago's Finest - My Own | 9.82 | 16.31 | 1.405s |
| Louis Cressy Band - Good Time | 11.74 | 15.71 | 1.397s |
| Lyndsey Ollard - Catching Up | 14.54 | 16.49 | 1.427s |
| M.E.R.C. Music - Knockout | 9.90 | 12.15 | 1.393s |
| Moosmusic - Big Dummy Shake | 14.46 | 16.10 | 1.406s |
| Motor Tapes - Shore | 0.86 | 11.75 | 1.422s |
| Mu - Too Bright | 16.28 | 18.99 | 1.397s |
| Nerve 9 - Pray For The Rain | 9.54 | 10.98 | 1.405s |
| PR - Happy Daze | 1.72 | 27.68 | 1.403s |
| PR - Oh No | 1.71 | 8.94 | 1.413s |
| Punkdisco - Oral Hygiene | 12.61 | 18.42 | 1.398s |
| Raft Monk - Tiring | 7.71 | 13.82 | 1.400s |
| Sambasevam Shanmugam - Kaathaadi | 14.10 | 19.55 | 1.428s |
| Secretariat - Borderline | 10.93 | 12.10 | 1.409s |
| Secretariat - Over The Top | 12.27 | 17.98 | 1.389s |
| Side Effects Project - Sing With Me | 15.49 | 17.76 | 1.403s |
| Signe Jakobsen - What Have You Done To Me | 9.69 | 12.42 | 1.426s |
| Skelpolu - Resurrection | 0.45 | 6.44 | 1.401s |
| Speak Softly - Broken Man | 10.70 | 19.89 | 1.409s |
| Speak Softly - Like Horses | 8.25 | 13.01 | 1.399s |
| The Doppler Shift - Atrophy | 9.42 | 14.00 | 1.397s |
| The Easton Ellises (Baumi) - SDRNR | 5.91 | 9.11 | 1.396s |
| The Easton Ellises - Falcon 69 | 7.15 | 12.18 | 1.393s |
| The Long Wait - Dark Horses | 11.30 | 15.47 | 1.407s |
| The Mountaineering Club - Mallory | 10.43 | 16.25 | 1.469s |
| The Sunshine Garcia Band - For I Am The Moon | 14.76 | 18.63 | 1.428s |
| Timboz - Pony | 5.97 | 14.88 | 1.430s |
| Tom McKenzie - Directions | 10.07 | 19.47 | 1.427s |
| Triviul feat. The Fiend - Widow | 11.13 | 10.41 | 1.412s |
| We Fell From The Sky - Not You | 8.38 | 15.20 | 1.410s |
| Zeno - Signs | 11.80 | 13.59 | 1.426s |

### Performance

| Metric | Value |
|---|---|
| Total audio | 340.0s |
| Total processing | 70.6s |
| Avg per track | 1.412s |
| Realtime factor | 4.8x |

---

## Recommendations

| Use Case | Recommended Model | Reason |
|---|---|---|
| **Fast mode (production)** | Demucs v4 HTDemucs | 24.6x realtime, 4-stem support, good quality |
| **Quality mode (premium)** | BS-RoFormer (ViperX-1297) | Best vocals SDR (12.39 dB), best instrumental SDR (15.76 dB) |
| **Balanced** | MelBand RoFormer (ViperX-1143) | Strong quality (10.18 dB vocals), faster than BS-RoFormer (4.8x RT) |
| **4-stem separation** | Demucs v4 HTDemucs | Only Demucs supports drums/bass/other stems |

### Key Observations

1. **BS-RoFormer wins on quality** — +3.31 dB over Demucs HTDemucs for vocals, +1.95 dB for instrumental
2. **Demucs HTDemucs wins on speed** — 7.2x faster than BS-RoFormer, 5.2x faster than MelBand
3. **Fine-tuned Demucs (FT) underperforms** — slower than standard HTDemucs with slightly worse vocals SDR; catastrophic failure on some tracks (PR - Happy Daze: -8.75 dB)
4. **RoFormer models are 2-stem only** — vocals + instrumental; no drums/bass/other separation
5. **All models struggle with quiet/absent vocals** — Motor Tapes - Shore (~0 dB across all models), tracks with minimal vocals get low SDR
