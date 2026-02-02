#!/usr/bin/env python3
"""
================================================================================
UNIFIED CLONE DETECTION PIPELINE
================================================================================

This is the ONLY script you need for scraping and detection.

USAGE:
------
    python run_detection.py <keyword> [options]

OPTIONS:
--------
    --scrape        Scrape new extensions from Chrome Web Store first
    --count N       Number of extensions to scrape (default: 500)
    --limit N       Limit detection to first N extensions
    --workers N     Parallel workers for detection (default: 5)

EXAMPLES:
---------

    1. SCRAPE + DETECT (new keyword):
       python run_detection.py grok --scrape --count 300
       python run_detection.py metamask --scrape --count 500
       python run_detection.py paypal --scrape --count 300

    2. DETECT ONLY (existing data):
       python run_detection.py chatgpt
       python run_detection.py gemini
       python run_detection.py vpn --limit 100

    3. RE-RUN DETECTION (after code changes):
       python run_detection.py gemini

WORKFLOW:
---------
    1. Scraping:  Fetches extensions from Chrome Web Store
                  Saves to: data/{keyword}_metadata.json

    2. Detection: Runs VLM-based clone detection pipeline
                  - Identifies cluster type (BRAND vs CATEGORY)
                  - Finds official anchor extensions (or uses no-anchor mode)
                  - Analyzes each extension for cloning/impersonation
                  Saves to: output/{keyword}_clones.json

    3. Report:    Generates HTML review interface
                  Saves to: output/{keyword}_review.html

KEYWORDS TO TRY:
----------------
    AI/LLM:     chatgpt, gemini, claude, grok, copilot
    Crypto:     metamask, coinbase, binance, ledger, wallet
    Security:   lastpass, bitwarden, dashlane, 1password
    VPN:        vpn, nordvpn, expressvpn
    Adblock:    adblock, ublock
    Other:      paypal, grammarly, honey

================================================================================
"""

import json
import sys
import argparse
from pathlib import Path

# Add project root to path so submodules can be found
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from pipeline.gemini_clone_detector import Extension, process_cluster, save_results, find_anchors_batch
from report_generators.generate_html_report import generate_html_report
# from analysis.generate_behavioral_json import generate_behavioral_json  # Missing module


def load_extensions(path: str, limit: int = None) -> list:
    """Load extensions from JSON file with robust None handling."""
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    extensions = []
    skipped = 0

    for item in data:
        if limit and len(extensions) >= limit:
            break

        try:
            cleaned = {
                'id': item.get('id', ''),
                'name': item.get('name') or 'Unknown',
                'developer': item.get('developer') or 'Unknown',
                'developer_address': item.get('developer_address') or '',
                'description': item.get('description') or '',
                'icon_url': item.get('icon_url') or '',
                'user_count': item.get('user_count') or 0,
                'rating': item.get('rating') or 0.0,
                'version': item.get('version') or '',
                'size': item.get('size') or '',
                'last_updated': item.get('last_updated') or '',
            }

            if not cleaned['id']:
                skipped += 1
                continue

            ext = Extension(**cleaned)
            extensions.append(ext)

        except Exception as e:
            print(f"Warning: Skipping extension: {e}")
            skipped += 1

    if skipped > 0:
        print(f"  (Skipped {skipped} invalid entries)")

    return extensions


def run_scraper(keyword: str, count: int, output_file: str):
    """Run the scraper for a keyword."""
    print(f"\nScraping {count} extensions for '{keyword}'...")

    # Import here to avoid dependency if not scraping
    from scrapers.scrape_chatgpt_extensions import scrape_extensions

    scrape_extensions(
        search_query=keyword,
        target_count=count,
        output_file=output_file
    )
    print(f"Scraping complete: {output_file}")


def run_detection(keyword: str, limit: int = None, max_workers: int = 5, 
                  input_file: str = None, output_json: str = None, 
                  output_html: str = None):
    """
    Main detection pipeline entry point.
    """
    if not input_file:
        input_file = f"data/{keyword}_metadata.json"
    if not output_json:
        output_json = f"output/{keyword}_clones.json"
    if not output_html:
        output_html = f"output/{keyword}_review.html"

    # Also check for alternate naming patterns
    if not Path(input_file).exists():
        alt_patterns = [
            f"data/{keyword}_metadata_1k.json",
            f"data/{keyword}_extensions.json",
            f"data/{keyword}.json",
        ]
        for alt in alt_patterns:
            if Path(alt).exists():
                input_file = alt
                break

    # Ensure output directory exists
    Path("output").mkdir(exist_ok=True)

    print("=" * 70)
    print(f"GEMINI CLONE DETECTION - {keyword.upper()}")
    print("=" * 70)
    print(f"\nInput: {input_file}")
    print(f"Limit: {'All' if limit is None else limit} extensions")
    print(f"Max Workers: {max_workers}")
    print(f"Output JSON: {output_json}")
    print(f"Output HTML: {output_html}")
    print()

    # Check if input file exists
    if not Path(input_file).exists():
        print(f"ERROR: Input file not found: {input_file}")
        print(f"\nTo scrape data first, run:")
        print(f"  python run_detection.py {keyword} --scrape --count 500")
        sys.exit(1)

    print("Loading extensions...")
    extensions = load_extensions(input_file, limit=limit)
    print(f"Loaded {len(extensions)} extensions")

    print("\n" + "=" * 70)
    print("Step 1: Finding official anchors (batch approach with Google Search)...")
    print("=" * 70)

    with open(input_file, 'r', encoding='utf-8') as f:
        raw_json = f.read()

    anchor_result = find_anchors_batch(raw_json, keyword=keyword)
    print(f"  Brand Owner: {anchor_result.brand_owner}")
    print(f"  Official Extension IDs: {anchor_result.official_extension_ids}")
    print(f"  Reasoning: {anchor_result.reasoning}")
    print(f"  Confidence: {anchor_result.confidence:.0%}")

    official_anchor_ids = anchor_result.official_extension_ids

    if not official_anchor_ids:
        print("\n  No official anchor found - will use brand impersonation detection mode.")
    else:
        print(f"\n  Using official anchor(s): {official_anchor_ids}")

    print("\nStarting clone detection pipeline...")
    result = process_cluster(
        extensions,
        keyword=keyword,
        max_workers=max_workers,
        official_anchor_ids=official_anchor_ids
    )

    print("\nSaving results...")
    save_results(result, output_json)

    print("\nGenerating HTML report for manual review...")
    generate_html_report(output_json, output_html)


    print("\n" + "=" * 70)
    print("COMPLETE!")
    print("=" * 70)
    print(f"\n  Results: {output_json}")
    print(f"  HTML Review: {output_html}")

    print(f"\nOpen {output_html} in your browser to review detected pairs side-by-side.")

    print("=" * 70)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Unified Chrome Extension Clone Detection",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_detection.py chatgpt                    # Detect clones in existing data
  python run_detection.py gemini --scrape --count 500   # Scrape then detect
  python run_detection.py metamask --limit 100      # Limit to first 100 extensions
  python run_detection.py vpn --workers 10          # Use 10 parallel workers
        """
    )

    parser.add_argument("keyword", help="Keyword to search/detect (e.g., chatgpt, gemini, vpn)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of extensions to analyze")
    parser.add_argument("--workers", type=int, default=5, help="Number of parallel workers (default: 5)")
    parser.add_argument("--scrape", action="store_true", help="Scrape new extensions before detection")
    parser.add_argument("--count", type=int, default=500, help="Number of extensions to scrape (default: 500)")
    parser.add_argument("--input", help="Source metadata JSON file")
    parser.add_argument("--output", help="Output clones JSON file")
    parser.add_argument("--mode", choices=['full', 'metadata'], default='full', 
                        help="Mode: 'full' (scrape+detect) or 'metadata' (use input file)")

    args = parser.parse_args()

    keyword = args.keyword.lower()
    input_file = f"data/{keyword}_metadata.json"


    if args.scrape:
        run_scraper(keyword, args.count, input_file)


    run_detection(
        keyword, 
        limit=args.limit, 
        max_workers=args.workers,
        input_file=args.input,
        output_json=args.output
    )


if __name__ == "__main__":
    main()
