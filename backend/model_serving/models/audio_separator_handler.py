import logging
import os
import shutil
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# audio-separator provides a unified interface for RoFormer-family models.
# ---------------------------------------------------------------------------

_SEPARATOR_AVAILABLE = False

try:
    from audio_separator.separator import Separator

    _SEPARATOR_AVAILABLE = True
except ImportError:
    logger.warning(
        "audio-separator package not found. "
        "AudioSeparatorHandler will be unavailable. "
        "Install it with: pip install audio-separator[gpu]"
    )


# Pre-defined model configs (from experiment results on MUSDB18, 50 tracks)
MODEL_REGISTRY = {
    "bs_roformer": {
        "model_id": "model_bs_roformer_ep_317_sdr_12.9755.ckpt",
        "display_name": "BS-RoFormer (ViperX-1297)",
        "description": "BS-RoFormer — best vocal separation quality (SDR 12.39 dB)",
        "speed_rating": 1,
        "quality_rating": 5,
    },
    "melband_roformer": {
        "model_id": "model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt",
        "display_name": "MelBand RoFormer (ViperX-1143)",
        "description": "Mel-Band RoFormer — excellent vocal quality, faster than BS-RoFormer (SDR 10.18 dB)",
        "speed_rating": 2,
        "quality_rating": 4,
    },
}


class AudioSeparatorHandler:
    """Wraps audio-separator for RoFormer-family vocal/instrumental separation."""

    def __init__(self, model_key: str, model_dir: str = "/models",
                 device: str | None = None):
        if model_key not in MODEL_REGISTRY:
            raise ValueError(f"Unknown model key '{model_key}'. Available: {list(MODEL_REGISTRY.keys())}")

        self._config = MODEL_REGISTRY[model_key]
        self._model_key = model_key
        self._model_id = self._config["model_id"]
        self.model_dir = Path(model_dir)
        if device is not None:
            self.device = torch.device(device)
        else:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._separator = None
        self._loaded = False
        self._available = _SEPARATOR_AVAILABLE
        self._cpu_optimized = False

    def load_model(self) -> None:
        """Load the model via audio-separator's Separator class."""
        if not self._available:
            logger.error("Cannot load %s: audio-separator package is not installed.", self._model_key)
            return

        logger.info("Loading %s on %s", self._config["display_name"], self.device)

        model_file_dir = str(self.model_dir / "audio_separator")
        os.makedirs(model_file_dir, exist_ok=True)

        self._separator = Separator(
            output_format="WAV",
            log_level=logging.WARNING,
            model_file_dir=model_file_dir,
            use_autocast=self.device.type == "cuda",
        )

        # Force CPU if explicitly requested (Separator auto-detects CUDA)
        if self.device.type == "cpu":
            self._separator.torch_device = torch.device("cpu")

        self._separator.load_model(self._model_id)

        # CPU optimization: INT8 quantization
        if self.device.type == "cpu" and hasattr(self._separator, "model_instance"):
            mi = self._separator.model_instance
            if hasattr(mi, "model_run") and isinstance(mi.model_run, torch.nn.Module):
                mi.model_run = torch.quantization.quantize_dynamic(
                    mi.model_run, {torch.nn.Linear}, dtype=torch.qint8
                )
                logger.info("Applied INT8 quantization to %s", self._model_key)
                self._cpu_optimized = True

        self._loaded = True
        logger.info("%s loaded successfully", self._config["display_name"])

    # RoFormer models require a minimum chunk length (352800 samples = 8s at 44100Hz).
    _MIN_SAMPLES_44K = 352800

    def _pad_if_short(self, audio_path: str, tmp_dir: Path) -> tuple[str, int]:
        """Pad audio to minimum length if needed. Returns (path, original_samples)."""
        data, sr = sf.read(audio_path)
        original_samples = data.shape[0]
        min_samples = int(self._MIN_SAMPLES_44K * sr / 44100)
        if original_samples >= min_samples:
            return audio_path, original_samples
        pad_width = min_samples - original_samples
        if data.ndim == 1:
            data = np.pad(data, (0, pad_width), mode="constant")
        else:
            data = np.pad(data, ((0, pad_width), (0, 0)), mode="constant")
        padded_path = str(tmp_dir / "padded_input.wav")
        sf.write(padded_path, data, sr)
        logger.info("Padded short audio from %d to %d samples", original_samples, min_samples)
        return padded_path, original_samples

    def _trim_output(self, wav_path: str, original_samples: int) -> None:
        """Trim output back to original length."""
        data, sr = sf.read(wav_path)
        original_at_sr = int(original_samples * sr / 44100) if sr != 44100 else original_samples
        if data.shape[0] > original_at_sr:
            data = data[:original_at_sr]
            sf.write(wav_path, data, sr)

    def separate(self, audio_path: str, output_dir: str) -> dict:
        """
        Run vocal/instrumental separation on *audio_path*.

        Returns:
            {"vocal_path": str, "instrumental_path": str}
        """
        if not self._loaded:
            raise RuntimeError("Model is not loaded — call load_model() first")

        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # audio-separator writes output files to its own output dir.
        # We use a temp dir then move the results.
        tmp_out = Path(tempfile.mkdtemp(prefix="asep_"))
        try:
            # Pad short audio to avoid RoFormer chunk size mismatch
            actual_input, original_samples = self._pad_if_short(audio_path, tmp_out)

            self._separator.output_dir = str(tmp_out)
            output_files = self._separator.separate(actual_input)

            vocal_path = None
            instrumental_path = None

            for fpath in output_files:
                fname = Path(fpath).name.lower()
                if "vocal" in fname and "no_vocal" not in fname and "instrument" not in fname:
                    vocal_path = fpath
                elif "instrument" in fname or "no_vocal" in fname or "accompaniment" in fname:
                    instrumental_path = fpath

            if vocal_path is None or instrumental_path is None:
                # Fallback: if exactly 2 files, assume first=vocals, second=instrumental
                if len(output_files) == 2:
                    vocal_path = output_files[0]
                    instrumental_path = output_files[1]
                else:
                    raise RuntimeError(
                        f"Could not identify vocal/instrumental from output files: {output_files}"
                    )

            # Move to final output dir
            final_vocal = str(output_dir / "vocals.wav")
            final_instrumental = str(output_dir / "instrumental.wav")
            shutil.move(vocal_path, final_vocal)
            shutil.move(instrumental_path, final_instrumental)

            # Trim back to original length if we padded
            if original_samples < int(self._MIN_SAMPLES_44K * 44100 / 44100):
                self._trim_output(final_vocal, original_samples)
                self._trim_output(final_instrumental, original_samples)

            logger.info(
                "%s separation complete → %s, %s",
                self._config["display_name"],
                final_vocal,
                final_instrumental,
            )
            return {"vocal_path": final_vocal, "instrumental_path": final_instrumental}

        finally:
            shutil.rmtree(tmp_out, ignore_errors=True)

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def metadata(self) -> dict:
        return {
            "name": self._model_key,
            "display_name": self._config["display_name"],
            "description": self._config["description"],
            "speed_rating": self._config["speed_rating"],
            "quality_rating": self._config["quality_rating"],
            "device": str(self.device),
            "loaded": self._loaded,
            "available": self._available,
            "cpu_optimized": self._cpu_optimized,
        }
