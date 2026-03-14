#!/usr/bin/env python3
"""
Quick separation to generate test files for post-processing.
Separates a short audio file and saves outputs for testing.
"""
import os
import sys
import requests
from pathlib import Path

MODEL_SERVING_URL = os.environ.get("MODEL_SERVING_URL", "http://localhost:8001")

def separate_audio(input_path: str, output_dir: str, model: str = "demucs", device: str = "gpu"):
    """Run separation and save vocal/instrumental."""
    os.makedirs(output_dir, exist_ok=True)

    print(f"Separating {input_path} with model={model}, device={device}...")

    # Call model serving
    with open(input_path, "rb") as f:
        response = requests.post(
            f"{MODEL_SERVING_URL}/predict",
            params={"model": model, "device": device},
            files={"file": ("audio.wav", f, "audio/wav")},
            timeout=300,
        )

    if response.status_code != 200:
        print(f"Error: {response.status_code} - {response.text}")
        sys.exit(1)

    # Save outputs
    import zipfile
    import io

    zip_data = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_data, 'r') as zip_ref:
        zip_ref.extractall(output_dir)

    print(f"Separation complete! Files saved to {output_dir}")

    # List output files
    for f in os.listdir(output_dir):
        print(f"  - {f}")

    return output_dir

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_test_files.py <input_audio> [output_dir] [model] [device]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./separation_output"
    model = sys.argv[3] if len(sys.argv) > 3 else "demucs"
    device = sys.argv[4] if len(sys.argv) > 4 else "gpu"

    separate_audio(input_path, output_dir, model, device)
