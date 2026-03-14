import logging
import os
import shutil
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import torchaudio

logger = logging.getLogger(__name__)

# Pre-defined Demucs model configs (from experiment results on MUSDB18, 50 tracks)
DEMUCS_REGISTRY = {
    "htdemucs": {
        "display_name": "Demucs v4 HTDemucs",
        "description": "Hybrid Transformer Demucs v4 — fast 4-stem separation (SDR 9.08 dB vocals, 24.6x RT)",
        "speed_rating": 5,
        "quality_rating": 3,
    },
    "htdemucs_ft": {
        "display_name": "Demucs v4 HTDemucs FT",
        "description": "Fine-tuned Demucs v4 — higher quality 4-stem separation (SDR 8.63 dB vocals, 6.3x RT)",
        "speed_rating": 3,
        "quality_rating": 4,
    },
}


class DemucsHandler:
    """Wraps Demucs v4 models for vocal/instrumental separation."""

    def __init__(self, model_name: str = "htdemucs", model_dir: str = "/models",
                 device: str | None = None):
        if model_name not in DEMUCS_REGISTRY:
            raise ValueError(f"Unknown Demucs model '{model_name}'. Available: {list(DEMUCS_REGISTRY.keys())}")

        self._model_name = model_name
        self._config = DEMUCS_REGISTRY[model_name]
        self.model_dir = Path(model_dir)
        if device is not None:
            self.device = torch.device(device)
        else:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self._apply_model = None
        self._loaded = False
        self._cpu_optimized = False

    def load_model(self) -> None:
        """Load Demucs using the installed demucs package directly."""
        logger.info("Loading Demucs model '%s' on %s", self._model_name, self.device)
        os.environ.setdefault("TORCH_HOME", str(self.model_dir))

        from demucs.pretrained import get_model
        from demucs.apply import apply_model

        self.model = get_model(self._model_name)
        self.model.eval()
        self._apply_model = apply_model

        self.model = self.model.to(self.device)

        if self.device.type == "cpu" and self._model_name == "htdemucs":
            self.model = torch.quantization.quantize_dynamic(
                self.model, {torch.nn.Linear, torch.nn.LSTM}, dtype=torch.qint8
            )
            self._cpu_optimized = True
            logger.info("Demucs '%s' loaded on CPU with INT8 quantization", self._model_name)
        else:
            logger.info("Demucs '%s' loaded on %s", self._model_name, self.device)

        self._loaded = True

    def separate(self, audio_path: str, output_dir: str) -> dict:
        """
        Run source separation on *audio_path*.

        Returns:
            {"vocal_path": str, "instrumental_path": str}
        """
        if not self._loaded:
            raise RuntimeError("Model is not loaded — call load_model() first")

        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        data, sample_rate = sf.read(audio_path, dtype="float32", always_2d=True)
        # soundfile returns (samples, channels), torch expects (channels, samples)
        waveform = torch.from_numpy(data.T)

        # Resample to 44100 Hz if needed (Demucs expects 44100)
        if sample_rate != 44100:
            waveform = torchaudio.functional.resample(waveform, sample_rate, 44100)

        # Ensure stereo
        if waveform.shape[0] == 1:
            waveform = waveform.repeat(2, 1)
        elif waveform.shape[0] > 2:
            waveform = waveform[:2]

        # apply_model expects (batch, channels, samples) on the correct device
        waveform = waveform.unsqueeze(0).to(self.device)

        try:
            with torch.no_grad():
                # apply_model handles BagOfModels properly
                sources = self._apply_model(self.model, waveform, device=self.device)
        finally:
            if self.device.type == "cuda":
                torch.cuda.empty_cache()

        # sources shape: (1, num_stems, channels, samples)
        sources = sources.squeeze(0).float().cpu()

        # Demucs htdemucs stems: drums, bass, other, vocals
        stem_names = self.model.sources
        stem_map = {name: sources[i] for i, name in enumerate(stem_names)}

        # Build vocal track
        vocals = stem_map.get("vocals", sources[0])
        vocal_path = str(output_dir / "vocals.wav")
        sf.write(vocal_path, vocals.numpy().T, 44100)

        # Instrumental = everything except vocals
        instrumental_parts = [
            stem for name, stem in stem_map.items() if name != "vocals"
        ]
        instrumental = torch.stack(instrumental_parts, dim=0).sum(dim=0)
        instrumental_path = str(output_dir / "instrumental.wav")
        sf.write(instrumental_path, instrumental.numpy().T, 44100)

        logger.info("Demucs '%s' separation complete → %s, %s", self._model_name, vocal_path, instrumental_path)
        return {"vocal_path": vocal_path, "instrumental_path": instrumental_path}

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def metadata(self) -> dict:
        return {
            "name": self._model_name,
            "display_name": self._config["display_name"],
            "description": self._config["description"],
            "speed_rating": self._config["speed_rating"],
            "quality_rating": self._config["quality_rating"],
            "device": str(self.device),
            "loaded": self._loaded,
            "cpu_optimized": self._cpu_optimized,
        }
