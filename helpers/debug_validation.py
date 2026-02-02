#!/usr/bin/env python3
"""
Debug script to test Gemini validation on a small batch and show exactly what the model receives.
Shows: token counts, full prompts, file contents, and estimated costs.
"""

import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from validate_batch_gemini import (
    extract_patterns_structured, 
    format_patterns_for_prompt,
)


def estimate_tokens(text: str) -> int:
    """Rough token estimate (1 token ≈ 4 chars for English)"""
    return len(text) // 4


def analyze_extension_prompt(ext: dict) -> dict:
    """Build and analyze what would be sent to Gemini for one extension."""
    
    static = ext.get('static_analysis', {})
    name = ext.get('name', 'Unknown')
    ext_id = ext.get('id', 'unknown')
    
    # Extract structured patterns (same as validate_batch_gemini.py)
    patterns = extract_patterns_structured(static)
    patterns_text = format_patterns_for_prompt(patterns)
    
    # Count patterns
    pattern_counts = {}
    for cat, items in patterns.items():
        if items:
            pattern_counts[cat] = len(items)
    
    # Get manifest size
    manifest = ext.get('manifest', {})
    manifest_text = json.dumps(manifest, indent=2)[:3000]
    
    # Simulate prompt size (prompt + patterns + code sample)
    # Code sample is typically ~50-100k chars for big extensions
    code_sample_estimate = 50000  # Assume 50k average
    
    full_prompt_size = len(patterns_text) + len(manifest_text) + code_sample_estimate
    
    return {
        'name': name,
        'id': ext_id,
        'category': ext.get('_category', 'unknown'),
        'patterns_length': len(patterns_text),
        'pattern_counts': pattern_counts,
        'manifest_length': len(manifest_text),
        'estimated_full_prompt': full_prompt_size,
        'estimated_tokens': full_prompt_size // 4,
        'patterns_preview': patterns_text
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Debug Gemini validation")
    parser.add_argument("--input", "-i", required=True, help="Input clones.json file")
    parser.add_argument("--limit", "-l", type=int, default=10, help="Number of extensions to analyze")
    parser.add_argument("--show-patterns", action="store_true", help="Show full patterns for first extension")
    args = parser.parse_args()
    
    # Load data
    with open(args.input, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print("=" * 70)
    print("GEMINI VALIDATION DEBUG")
    print("=" * 70)
    print(f"Input: {args.input}")
    print()
    
    # Collect extensions with findings
    extensions = []
    for cat in ['malicious_clones', 'clones', 'legitimate', 'anchors']:
        for ext in data.get(cat, []):
            static = ext.get('static_analysis', {})
            if static.get('success'):
                # Check if has any patterns
                caps = static.get('capabilities', {})
                risks = static.get('security_risks', {})
                total_caps = sum(len(v) for v in caps.values() if v)
                total_risks = sum(len(v) for v in risks.values() if v)
                if total_caps > 0 or total_risks > 0:
                    ext['_category'] = cat
                    ext['_total_findings'] = total_caps + total_risks
                    extensions.append(ext)
    
    extensions = extensions[:args.limit]
    print(f"Extensions with findings: {len(extensions)}")
    print()
    
    # Analyze each
    print("=" * 70)
    print("TOKEN ANALYSIS PER EXTENSION")
    print("=" * 70)
    
    total_tokens = 0
    for i, ext in enumerate(extensions, 1):
        analysis = analyze_extension_prompt(ext)
        total_tokens += analysis['estimated_tokens']
        
        print(f"\n[{i}] {analysis['name'][:45]}")
        print(f"    ID: {analysis['id']}")
        print(f"    Category: {analysis['category']}")
        print(f"    Total findings: {ext.get('_total_findings')}")
        print(f"    Pattern text: {analysis['patterns_length']:,} chars")
        print(f"    Pattern counts: {analysis['pattern_counts']}")
        print(f"    Est. full prompt: ~{analysis['estimated_full_prompt']:,} chars")
        print(f"    Est. tokens: ~{analysis['estimated_tokens']:,}")
    
    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total extensions to validate: {len(extensions)}")
    print(f"Total estimated tokens: ~{total_tokens:,}")
    print(f"Average tokens per extension: ~{total_tokens // len(extensions):,}" if extensions else "N/A")
    print()
    
    # Gemini pricing
    print("Gemini 2.0 Flash pricing:")
    print(f"  Input: $0.10 per 1M tokens")
    print(f"  Output: $0.40 per 1M tokens (assume ~500 tokens/response)")
    output_tokens = len(extensions) * 500
    input_cost = total_tokens * 0.10 / 1_000_000
    output_cost = output_tokens * 0.40 / 1_000_000
    print(f"\nEstimated cost for {len(extensions)} extensions:")
    print(f"  Input: ${input_cost:.4f}")
    print(f"  Output: ${output_cost:.4f}")
    print(f"  Total: ${input_cost + output_cost:.4f}")
    
    # Show patterns for first extension if requested
    if args.show_patterns and extensions:
        analysis = analyze_extension_prompt(extensions[0])
        print()
        print("=" * 70)
        print(f"WHAT GEMINI SEES FOR: {analysis['name']}")
        print("=" * 70)
        print("\n--- DETECTED PATTERNS (from static analysis) ---")
        print(analysis['patterns_preview'])
        print("\n--- PLUS: manifest.json, extension source files ---")
        print("(Files flagged by static analysis are included, sorted by severity)")


if __name__ == "__main__":
    main()
