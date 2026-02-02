#!/usr/bin/env python3
"""
Download all extension icons from input.json files in experiment folders
"""

import json
import requests
import time
from pathlib import Path
from typing import Dict, List, Tuple

# Experiments to process
EXPERIMENTS = ['chatgpt', 'claude', 'gemini', 'grok']
BASE_DIR = Path('experiments')

def download_icon(url: str, save_path: Path, timeout: int = 30) -> bool:
    """Download an icon from URL to save_path. Returns True if successful."""
    try:
        # Handle relative URLs (some extensions might have these)
        if url.startswith('//'):
            url = 'https:' + url
        elif not url.startswith('http'):
            url = 'https://chrome.google.com' + url

        response = requests.get(url, timeout=timeout, allow_redirects=True)

        if response.status_code == 200 and len(response.content) > 0:
            with open(save_path, 'wb') as f:
                f.write(response.content)
            return True
        else:
            return False

    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return False

def process_experiment(experiment_name: str) -> Tuple[int, int, List[Dict]]:
    """
    Process one experiment folder.
    Returns: (successful_count, failed_count, failed_extensions)
    """
    exp_dir = BASE_DIR / experiment_name
    input_file = exp_dir / 'input.json'
    icons_dir = exp_dir / 'icons'

    print(f"\n{'='*70}")
    print(f"Processing: {experiment_name}")
    print(f"{'='*70}")

    # Check if input.json exists
    if not input_file.exists():
        print(f"  WARNING: {input_file} not found, skipping...")
        return 0, 0, []

    # Create icons directory
    icons_dir.mkdir(exist_ok=True)
    print(f"  Icons directory: {icons_dir}")

    # Load input.json
    with open(input_file, 'r', encoding='utf-8') as f:
        extensions = json.load(f)

    print(f"  Total extensions: {len(extensions)}")

    successful = 0
    failed = 0
    failed_extensions = []

    # Process each extension
    for i, ext in enumerate(extensions, 1):
        ext_id = ext.get('id')
        icon_url = ext.get('icon_url')
        ext_name = ext.get('name', 'Unknown')

        if not ext_id or not icon_url:
            try:
                print(f"  [{i}/{len(extensions)}] SKIP: Missing ID or icon_url for {ext_name}")
            except UnicodeEncodeError:
                print(f"  [{i}/{len(extensions)}] SKIP: Missing ID or icon_url")
            failed += 1
            failed_extensions.append({
                'id': ext_id,
                'name': ext_name,
                'reason': 'Missing ID or icon_url'
            })
            continue

        # Icon save path
        icon_path = icons_dir / f"{ext_id}.png"

        # Skip if already exists
        if icon_path.exists() and icon_path.stat().st_size > 0:
            try:
                print(f"  [{i}/{len(extensions)}] EXISTS: {ext_id} ({ext_name[:40]})")
            except UnicodeEncodeError:
                print(f"  [{i}/{len(extensions)}] EXISTS: {ext_id}")
            successful += 1
            continue

        # Download icon
        try:
            print(f"  [{i}/{len(extensions)}] DOWNLOAD: {ext_id} ({ext_name[:40]})")
        except UnicodeEncodeError:
            print(f"  [{i}/{len(extensions)}] DOWNLOAD: {ext_id}")

        if download_icon(icon_url, icon_path):
            successful += 1
            print(f"    [OK] Saved to {icon_path.name}")
        else:
            failed += 1
            failed_extensions.append({
                'id': ext_id,
                'name': ext_name,
                'url': icon_url,
                'reason': 'Download failed'
            })
            print(f"    [FAIL] Download failed")

        # Rate limiting - be nice to Chrome Web Store
        time.sleep(0.2)

    return successful, failed, failed_extensions

def main():
    print("="*70)
    print("DOWNLOAD EXPERIMENT ICONS")
    print("="*70)

    all_results = {}
    total_successful = 0
    total_failed = 0

    for experiment in EXPERIMENTS:
        successful, failed, failed_exts = process_experiment(experiment)
        all_results[experiment] = {
            'successful': successful,
            'failed': failed,
            'failed_extensions': failed_exts
        }
        total_successful += successful
        total_failed += failed

    # Summary
    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")

    for experiment, results in all_results.items():
        print(f"\n{experiment.upper()}:")
        print(f"  Successful: {results['successful']}")
        print(f"  Failed: {results['failed']}")

        if results['failed_extensions']:
            print(f"  Failed extensions:")
            for ext in results['failed_extensions'][:5]:  # Show first 5
                print(f"    - {ext['id']}: {ext['name'][:50]} ({ext.get('reason', 'Unknown')})")
            if len(results['failed_extensions']) > 5:
                print(f"    ... and {len(results['failed_extensions']) - 5} more")

    print(f"\n{'='*70}")
    print(f"TOTAL SUCCESSFUL: {total_successful}")
    print(f"TOTAL FAILED: {total_failed}")
    print(f"{'='*70}")

    # Save failed extensions report
    if total_failed > 0:
        report_path = Path('icon_download_failures.json')
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, indent=2, ensure_ascii=False)
        print(f"\nFailed extensions report saved to: {report_path}")

if __name__ == '__main__':
    main()
