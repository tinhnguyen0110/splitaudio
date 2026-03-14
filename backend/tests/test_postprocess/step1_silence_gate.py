"""
Step 1: Silence Gate
Reduce noise in silent sections by detecting and suppressing frames with low energy.
"""
import numpy as np
from scipy.signal import medfilt


def apply_silence_gate(
    audio: np.ndarray,
    sr: int = 44100,
    stem_type: str = "vocal",
    threshold_db: float = None,
    attack_ms: float = 5.0,
    release_ms: float = 50.0,
) -> np.ndarray:
    """
    Noise gate based on energy threshold.
    Sections with energy below threshold will be attenuated (not zeroed completely to avoid clicks).

    Args:
        audio: Audio array, shape (samples,) or (channels, samples)
        sr: Sample rate
        stem_type: "vocal" or "instrumental"
        threshold_db: Energy threshold (dB). Lower = less gating.
        attack_ms: Attack time in milliseconds
        release_ms: Release time in milliseconds
    """
    # Set threshold based on stem type if not provided
    if threshold_db is None:
        if stem_type == "vocal":
            threshold_db = -50.0
        else:
            threshold_db = -55.0  # Instrumental gates less, preserves reverb tail

    # Calculate RMS energy per frame
    frame_length = int(sr * 0.025)  # 25ms frames
    hop_length = int(sr * 0.010)    # 10ms hop

    # Handle mono or stereo
    is_stereo = audio.ndim == 2
    if is_stereo:
        mono = np.mean(audio, axis=0)
    else:
        mono = audio

    n_frames = 1 + (len(mono) - frame_length) // hop_length
    energy_db = np.full(n_frames, -100.0)

    for i in range(n_frames):
        start = i * hop_length
        frame = mono[start : start + frame_length]
        rms = np.sqrt(np.mean(frame**2) + 1e-10)
        energy_db[i] = 20 * np.log10(rms)

    # Smooth energy curve
    energy_db = medfilt(energy_db, kernel_size=5)

    # Create gain envelope (0 = gate closed, 1 = gate open)
    gate = np.where(energy_db > threshold_db, 1.0, 0.05)  # 0.05 instead of 0 to avoid clicks

    # Attack/release smoothing
    attack_samples = max(1, int(attack_ms / 10))
    release_samples = max(1, int(release_ms / 10))

    smoothed_gate = np.copy(gate)
    for i in range(1, len(smoothed_gate)):
        if smoothed_gate[i] > smoothed_gate[i - 1]:
            # Attack: gate opening
            smoothed_gate[i] = min(1.0, smoothed_gate[i - 1] + 1.0 / attack_samples)
        else:
            # Release: gate closing
            smoothed_gate[i] = max(0.05, smoothed_gate[i - 1] - 1.0 / release_samples)

    # Interpolate gate envelope to sample level
    gate_samples = np.interp(
        np.arange(mono.shape[-1]),
        np.arange(n_frames) * hop_length,
        smoothed_gate,
    )

    if is_stereo:
        return audio * gate_samples[np.newaxis, :]
    return audio * gate_samples


if __name__ == "__main__":
    import soundfile as sf
    import sys

    if len(sys.argv) < 3:
        print("Usage: python step1_silence_gate.py <input.wav> <output.wav> [vocal|instrumental]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    stem_type = sys.argv[3] if len(sys.argv) > 3 else "vocal"

    # Load audio
    audio, sr = sf.read(input_path)
    if audio.ndim == 2:
        audio = audio.T  # Convert to (channels, samples)

    print(f"Applying silence gate to {stem_type}...")
    print(f"Input shape: {audio.shape}, SR: {sr}")

    # Apply gate
    result = apply_silence_gate(audio, sr, stem_type)

    # Save
    if result.ndim == 2:
        result = result.T  # Back to (samples, channels)
    sf.write(output_path, result, sr)

    print(f"Saved to {output_path}")
