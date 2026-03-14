#!/usr/bin/env python3
"""
Sync MinIO output bucket to a local directory as normal readable files.

Usage:
    python sync_minio_output.py                    # one-shot sync
    python sync_minio_output.py --watch            # continuous sync every 5s
    python sync_minio_output.py --output-dir ./my_output
"""

import argparse
import os
import time
import sys
from pathlib import Path

from minio import Minio


def get_client(endpoint: str, access_key: str, secret_key: str) -> Minio:
    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=False)


def sync_bucket(client: Minio, bucket: str, output_dir: Path, verbose: bool = True) -> int:
    """Download all objects from bucket to output_dir. Returns count of new files."""
    new_files = 0
    objects = client.list_objects(bucket, recursive=True)

    for obj in objects:
        local_path = output_dir / obj.object_name
        if local_path.exists() and local_path.stat().st_size == obj.size:
            continue  # already synced

        local_path.parent.mkdir(parents=True, exist_ok=True)
        client.fget_object(bucket, obj.object_name, str(local_path))
        new_files += 1
        if verbose:
            print(f"  Downloaded: {obj.object_name} ({obj.size:,} bytes)")

    return new_files


def main():
    parser = argparse.ArgumentParser(description="Sync MinIO buckets to local directory")
    parser.add_argument("--endpoint", default=os.getenv("MINIO_ENDPOINT", "localhost:9002"))
    parser.add_argument("--access-key", default=os.getenv("MINIO_ACCESS_KEY", "testadmin"))
    parser.add_argument("--secret-key", default=os.getenv("MINIO_SECRET_KEY", "testadmin123"))
    parser.add_argument("--output-dir", default="output_local", help="Local directory for output files")
    parser.add_argument("--bucket", default="audio-output", help="Bucket to sync")
    parser.add_argument("--input-bucket", default="audio-input", help="Also sync input bucket")
    parser.add_argument("--watch", action="store_true", help="Continuously sync every 5 seconds")
    parser.add_argument("--interval", type=int, default=5, help="Watch interval in seconds")
    parser.add_argument("--all", action="store_true", help="Sync both input and output buckets")
    args = parser.parse_args()

    client = get_client(args.endpoint, args.access_key, args.secret_key)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    buckets = [args.bucket]
    if args.all:
        buckets.append(args.input_bucket)

    print(f"Syncing to: {output_dir.resolve()}")
    print(f"Buckets: {', '.join(buckets)}")
    print()

    if args.watch:
        print(f"Watching for changes every {args.interval}s (Ctrl+C to stop)...")
        try:
            while True:
                total = 0
                for bucket in buckets:
                    total += sync_bucket(client, bucket, output_dir / bucket)
                if total > 0:
                    print(f"  Synced {total} new file(s)")
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nStopped.")
    else:
        total = 0
        for bucket in buckets:
            print(f"Bucket: {bucket}")
            total += sync_bucket(client, bucket, output_dir / bucket)
        print(f"\nDone. {total} file(s) synced to {output_dir.resolve()}")


if __name__ == "__main__":
    main()
