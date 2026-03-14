"""
Step 7: AI Denoise (Aggressive Mode Only)
Run pretrained denoise model on separated stem.
This is a placeholder - requires model serving endpoint.
"""
import numpy as np


def apply_ai_denoise(
    audio: np.ndarray,
    sr: int = 44100,
    stem_type: str = "vocal",
    model_serving_url: str = "http://model-serving:8001",
) -> np.ndarray:
    """
    Run pretrained denoise model (MelBand RoFormer Denoise) on separated stem.
    Only for aggressive mode due to GPU inference time cost (~5-10s).

    Model: denoise_mel_band_roformer_aufr33_sdr_27.9959.ckpt
    Source: ZFTurbo/Music-Source-Separation-Training

    NOTE: This requires a /denoise endpoint in model serving.
    For now, this is a placeholder that returns the input unchanged.

    Args:
        audio: Audio array, shape (samples,) or (channels, samples)
        sr: Sample rate
        stem_type: "vocal" or "instrumental"
        model_serving_url: URL of model serving service
    """
    print("AI Denoise: Not implemented yet (requires model serving /denoise endpoint)")
    print("Returning input unchanged...")
    return audio


if __name__ == "__main__":
    import soundfile as sf
    import sys

    if len(sys.argv) < 3:
        print("Usage: python step7_ai_denoise.py <input.wav> <output.wav> [vocal|instrumental]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    stem_type = sys.argv[3] if len(sys.argv) > 3 else "vocal"

    # Load audio
    audio, sr = sf.read(input_path)
    if audio.ndim == 2:
        audio = audio.T  # Convert to (channels, samples)

    print(f"Applying AI denoise to {stem_type}...")
    print(f"Input shape: {audio.shape}, SR: {sr}")

    # Apply denoise
    result = apply_ai_denoise(audio, sr, stem_type)

    # Save
    if result.ndim == 2:
        result = result.T  # Back to (samples, channels)
    sf.write(output_path, result, sr)

    print(f"Saved to {output_path}")
