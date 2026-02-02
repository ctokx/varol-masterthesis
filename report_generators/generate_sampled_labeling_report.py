#!/usr/bin/env python3
"""
Generate a stratified sampled labeling report for fair ground truth creation.

Usage:
    python generate_sampled_labeling_report.py <clones.json> [--size 150] [--seed 42]

Features:
    - Keeps ALL malicious clones (too important to sample)
    - Stratified random sampling for clones and legitimate
    - Reproducible with fixed seed
    - Generates standard labeling HTML
"""

import json
import sys
import argparse
import random
from datetime import datetime


def stratified_sample(data: dict, target_size: int = 150, seed: int = 42) -> dict:
    """Create a stratified sample of the dataset."""
    random.seed(seed)
    
    mal = data.get('malicious_clones', [])
    clones = data.get('clones', [])
    legit = data.get('legitimate', [])
    
    total = len(mal) + len(clones) + len(legit)
    
    print(f"\nOriginal distribution:")
    print(f"  MALICIOUS_CLONE: {len(mal)}")
    print(f"  CLONE: {len(clones)}")
    print(f"  LEGITIMATE: {len(legit)}")
    print(f"  TOTAL: {total}")
    
    # Keep ALL malicious (too important to sample)
    sampled_mal = mal.copy()
    remaining_budget = target_size - len(sampled_mal)
    
    if remaining_budget <= 0:
        print(f"\nWarning: Target size {target_size} is smaller than malicious count {len(mal)}")
        remaining_budget = 50  # Minimum for clones + legit
    
    # Calculate proportional sampling for clones and legitimate
    clone_ratio = len(clones) / (len(clones) + len(legit)) if (len(clones) + len(legit)) > 0 else 0.5
    
    clone_sample_size = min(len(clones), max(10, int(remaining_budget * clone_ratio)))
    legit_sample_size = min(len(legit), remaining_budget - clone_sample_size)
    
    # Random sample
    sampled_clones = random.sample(clones, clone_sample_size) if len(clones) >= clone_sample_size else clones
    sampled_legit = random.sample(legit, legit_sample_size) if len(legit) >= legit_sample_size else legit
    
    print(f"\nSampled distribution (seed={seed}):")
    print(f"  MALICIOUS_CLONE: {len(sampled_mal)} (kept all)")
    print(f"  CLONE: {len(sampled_clones)} (sampled from {len(clones)})")
    print(f"  LEGITIMATE: {len(sampled_legit)} (sampled from {len(legit)})")
    print(f"  TOTAL: {len(sampled_mal) + len(sampled_clones) + len(sampled_legit)}")
    
    return {
        'keyword': data.get('keyword', 'unknown'),
        'anchors': data.get('anchors', []),
        'malicious_clones': sampled_mal,
        'clones': sampled_clones,
        'legitimate': sampled_legit,
        'stats': {
            **data.get('stats', {}),
            'sampling': {
                'original_total': total,
                'sampled_total': len(sampled_mal) + len(sampled_clones) + len(sampled_legit),
                'seed': seed,
                'target_size': target_size
            }
        }
    }


def generate_labeling_html(data: dict, output_path: str):
    """Generate the labeling HTML (reusing logic from generate_labeling_report.py)."""
    from generate_labeling_report import generate_labeling_report
    

    temp_path = output_path.replace('.html', '_temp.json')
    with open(temp_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    

    generate_labeling_report(temp_path, output_path)
    
    import os
    os.remove(temp_path)


def main():
    parser = argparse.ArgumentParser(description='Generate stratified sampled labeling report')
    parser.add_argument('input_json', help='Path to clones JSON file')
    parser.add_argument('--size', type=int, default=150, help='Target sample size (default: 150)')
    parser.add_argument('--seed', type=int, default=42, help='Random seed for reproducibility (default: 42)')
    parser.add_argument('--output', '-o', help='Output HTML path')
    
    args = parser.parse_args()
    
    # Load data
    with open(args.input_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Create stratified sample
    sampled_data = stratified_sample(data, args.size, args.seed)
    
    # Generate output path
    if args.output:
        output_path = args.output
    else:
        output_path = args.input_json.replace('.json', f'_sampled_{args.size}_labeling.html')
    
    # Generate HTML
    generate_labeling_html(sampled_data, output_path)
    
    print(f"\n✅ Sampled labeling report generated: {output_path}")
    print(f"   Document your sampling: seed={args.seed}, target_size={args.size}")


if __name__ == "__main__":
    main()
