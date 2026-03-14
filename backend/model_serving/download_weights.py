#!/usr/bin/env python3
"""
Pre-download model weights so the container can start quickly.

Usage:
    python download_weights.py [--model-dir /models]
"""

import argparse
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s — %(message)s",
)
logger = logging.getLogger(__name__)


def download_demucs(model_dir: Path, model_name: str = "htdemucs") -> None:
    """Download Demucs weights via torch.hub."""
    logger.info("Downloading Demucs '%s' weights…", model_name)
    import torch

    os.environ["TORCH_HOME"] = str(model_dir)

    try:
        model = torch.hub.load(
            "facebookresearch/demucs:main",
            model_name,
            trust_repo=True,
        )
        logger.info("Demucs '%s' weights cached to %s", model_name, model_dir)
        del model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception as exc:
        logger.error("Failed to download Demucs '%s' weights: %s", model_name, exc)


def download_audio_separator_model(model_dir: Path, model_id: str) -> None:
    """Download a model via audio-separator (auto-fetches from HuggingFace)."""
    logger.info("Downloading audio-separator model '%s'…", model_id)

    try:
        from audio_separator.separator import Separator
    except ImportError:
        logger.warning("audio-separator is not installed — skipping %s download.", model_id)
        return

    model_file_dir = str(model_dir / "audio_separator")
    os.makedirs(model_file_dir, exist_ok=True)

    try:
        sep = Separator(
            output_format="WAV",
            log_level=logging.WARNING,
            model_file_dir=model_file_dir,
        )
        sep.load_model(model_id)
        logger.info("Model '%s' downloaded to %s", model_id, model_file_dir)
        del sep
    except Exception as exc:
        logger.warning(
            "Could not download model '%s': %s\n"
            "The service will still start; this model will be unavailable.",
            model_id,
            exc,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Pre-download model weights")
    parser.add_argument(
        "--model-dir",
        default=os.getenv("MODEL_DIR", "/models"),
        help="Directory to cache weights (default: /models)",
    )
    parser.add_argument(
        "--skip-demucs", action="store_true", help="Skip Demucs downloads"
    )
    parser.add_argument(
        "--skip-roformer", action="store_true", help="Skip RoFormer downloads"
    )
    args = parser.parse_args()

    model_dir = Path(args.model_dir)
    model_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Model directory: %s", model_dir)

    if not args.skip_demucs:
        download_demucs(model_dir, "htdemucs")
        download_demucs(model_dir, "htdemucs_ft")

    if not args.skip_roformer:
        download_audio_separator_model(
            model_dir, "model_bs_roformer_ep_317_sdr_12.9755.ckpt"
        )
        download_audio_separator_model(
            model_dir, "model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt"
        )

    logger.info("Weight download complete.")


if __name__ == "__main__":
    main()
