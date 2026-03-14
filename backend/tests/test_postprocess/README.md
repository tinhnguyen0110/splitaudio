# Post-Processing Test Suite

This directory contains standalone implementations of all 7 post-processing steps for testing before integration into the worker.

## Files

| File | Description |
|------|-------------|
| `step1_silence_gate.py` | Noise gate for silent sections |
| `step2_spectral_denoise.py` | Spectral noise reduction |
| `step3_highfreq_restore.py` | High-frequency restoration |
| `step4_artifact_smooth.py` | Artifact smoothing via spectrogram |
| `step5_mixture_consistency.py` | Ensure vocal+instrumental=original |
| `step6_loudness_norm.py` | ITU-R BS.1770 loudness normalization |
| `step7_ai_denoise.py` | AI denoise (placeholder) |
| `run_all_steps.py` | Run complete pipeline on test audio |
| `generate_test_files.py` | Generate test files via model serving |
| `TEST_REPORT.md` | Detailed test results and analysis |

## Dependencies

```bash
pip install noisereduce>=3.0.3 pyloudnorm>=0.1.1 scipy>=1.11.0
```

## Quick Start

### 1. Generate Test Files

Separate an audio file to get vocal + instrumental:

```bash
python generate_test_files.py <input_audio> [output_dir] [model] [device]

# Example:
python generate_test_files.py ../../data/test_audio/test_5s.mp3 ./separation_output demucs gpu
```

This creates:
- `separation_output/vocals.wav`
- `separation_output/instrumental.wav`

### 2. Convert Original to WAV (for consistency check)

```bash
ffmpeg -i <input_audio> -ar 44100 -ac 2 ./separation_output/original.wav
```

### 3. Run Complete Pipeline

```bash
python run_all_steps.py <vocal.wav> <instrumental.wav> <original.wav> <output_dir> [level]

# Example (medium mode):
python run_all_steps.py \
    ./separation_output/vocals.wav \
    ./separation_output/instrumental.wav \
    ./separation_output/original.wav \
    ./enhanced_output \
    medium
```

**Levels:**
- `light` — Fast (1.5s), basic cleanup
- `medium` — Balanced (2.8s), recommended
- `aggressive` — Maximum quality (2.2s currently, ~10-15s with AI denoise)

### 4. Compare Results

Listen to the enhanced audio:
- `./enhanced_output/vocal_enhanced.wav`
- `./enhanced_output/instrumental_enhanced.wav`

Compare with raw separation:
- `./separation_output/vocals.wav` (raw)
- `./separation_output/instrumental.wav` (raw)

## Individual Step Testing

Each step can be run standalone:

```bash
# Step 1: Silence gate
python step1_silence_gate.py input.wav output.wav vocal

# Step 2: Spectral denoise
python step2_spectral_denoise.py input.wav output.wav vocal medium

# Step 3: High-freq restore
python step3_highfreq_restore.py input.wav output.wav vocal

# Step 4: Artifact smooth
python step4_artifact_smooth.py input.wav output.wav vocal medium

# Step 5: Mixture consistency (needs 3 files)
python step5_mixture_consistency.py vocal.wav inst.wav original.wav out_vocal.wav out_inst.wav

# Step 6: Loudness norm
python step6_loudness_norm.py input.wav output.wav vocal

# Step 7: AI denoise (placeholder)
python step7_ai_denoise.py input.wav output.wav vocal
```

## Test Results

See `TEST_REPORT.md` for detailed results including:
- Timing breakdown by level
- Quality metrics comparison
- Error handling validation
- Integration recommendations

## Key Findings

✅ **All 6 steps working** (Step 7 is placeholder)
✅ **Performance:** 1.5-3s overhead for 5s audio
✅ **Mixture consistency:** 100% error reduction
✅ **Loudness normalization:** Targets achieved within ±0.5 LUFS
✅ **Ready for integration** into worker pipeline

## Next Steps

1. Test with longer audio (30s, 60s)
2. Test with different models (bs_roformer, melband_roformer)
3. Implement AI denoise endpoint in model serving
4. Integrate into worker pipeline
5. Add frontend controls
