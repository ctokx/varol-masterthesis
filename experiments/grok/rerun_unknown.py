#!/usr/bin/env python3
"""
Rerun UNKNOWN extensions from grok candidates.json
Fixes emoji encoding issues and API cancellations
"""

import json
import sys
import os
from pathlib import Path

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from pipeline.gemini_clone_detector import (
    Extension,
    analyze_brand_impersonation,
    download_icon,
    Relationship,
    CloneDetectionResult,
    ClusterType
)

# Use the API key from environment variable
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY

def load_unknown_extensions(candidates_path: str):
    """Load extensions marked as UNKNOWN from candidates.json"""
    with open(candidates_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    unknown = data.get('unknown', [])
    print(f"Found {len(unknown)} UNKNOWN extensions to reprocess")
    return unknown, data

def rerun_extension(ext_data: dict, keyword: str = "grok", brand_owner: str = "xAI") -> CloneDetectionResult:
    """
    Rerun analysis for a single extension in no-anchor mode

    IMPORTANT: This function does NOT use emoji in print statements
    to avoid Windows console encoding errors
    """
    # Convert dict to Extension object
    ext = Extension(**ext_data)

    print(f"\n[RERUN] {ext.name} ({ext.id})")
    print(f"  Developer: {ext.developer}")

    # Download icon
    suspect_icon = download_icon(ext.icon_url)
    if not suspect_icon:
        print("  WARNING: Could not download icon")

    try:
        # Analyze using brand impersonation (no-anchor mode)
        analysis = analyze_brand_impersonation(
            extension=ext,
            extension_icon=suspect_icon,
            keyword=keyword,
            brand_owner=brand_owner
        )

        # Map to relationship enum
        rel_map = {
            "UNAUTHORIZED_CLONE": Relationship.MALICIOUS_CLONE,  # Backwards compatibility
            "MALICIOUS_CLONE": Relationship.MALICIOUS_CLONE,
            "CLONE": Relationship.CLONE,
            "LEGITIMATE": Relationship.LEGITIMATE,
        }
        relationship = rel_map.get(analysis.relationship.upper(), Relationship.UNKNOWN)

        result = CloneDetectionResult(
            suspect=ext,
            relationship=relationship,
            confidence=analysis.confidence,
            cloned_from=None,  # No anchor in no-anchor mode
            evidence=analysis.evidence,
            icon_similarity=0.0,  # N/A in no-anchor mode
            similarity_type="BRAND_IMPERSONATION",
            is_imitative=analysis.uses_brand_imagery,
            red_flags=analysis.red_flags
        )

        # Print result without emoji
        status_map = {
            Relationship.MALICIOUS_CLONE: "[MALICIOUS_CLONE]",
            Relationship.CLONE: "[CLONE]",
            Relationship.LEGITIMATE: "[LEGITIMATE]",
            Relationship.UNKNOWN: "[UNKNOWN]"
        }
        print(f"  Result: {status_map.get(relationship, '[UNKNOWN]')}")
        print(f"  Confidence: {analysis.confidence:.0%}")
        if result.red_flags:
            print(f"  Red flags: {', '.join(result.red_flags[:3])}")

        return result

    except Exception as e:
        print(f"  ERROR: {e}")
        return CloneDetectionResult(
            suspect=ext,
            relationship=Relationship.UNKNOWN,
            confidence=0.0,
            evidence=f"Error during rerun: {e}",
            red_flags=["ANALYSIS_ERROR"]
        )

def merge_results_into_candidates(candidates_path: str, results: list):
    """
    Merge rerun results back into candidates.json
    Moves extensions from 'unknown' to their correct categories
    """
    with open(candidates_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Create a map of rerun results by ID
    results_map = {r.suspect.id: r for r in results}

    # Remove these IDs from unknown
    new_unknown = []
    for ext in data.get('unknown', []):
        if ext['id'] not in results_map:
            new_unknown.append(ext)

    data['unknown'] = new_unknown

    # Add to appropriate categories
    for result in results:
        entry = {
            "id": result.suspect.id,
            "name": result.suspect.name,
            "developer": result.suspect.developer,
            "user_count": result.suspect.user_count,
            "relationship": result.relationship.value,
            "confidence": result.confidence,
            "icon_similarity": result.icon_similarity,
            "similarity_type": result.similarity_type,
            "is_imitative": result.is_imitative,
            "evidence": result.evidence,
            "icon_url": result.suspect.icon_url,
        }

        if result.relationship == Relationship.MALICIOUS_CLONE:
            entry["red_flags"] = result.red_flags
            data.setdefault('malicious_clones', []).append(entry)
        elif result.relationship == Relationship.CLONE:
            entry["red_flags"] = result.red_flags
            data.setdefault('clones', []).append(entry)
        elif result.relationship == Relationship.LEGITIMATE:
            entry["note"] = "Uses brand name but original implementation, not deceptive"
            data.setdefault('legitimate', []).append(entry)
        else:
            # Still unknown
            data['unknown'].append(entry)

    # Update stats
    data['stats']['clones_found'] = len(data.get('clones', []))
    data['stats']['malicious_clones_found'] = len(data.get('malicious_clones', []))
    data['stats']['legitimate'] = len(data.get('legitimate', []))
    data['stats']['unknown'] = len(data.get('unknown', []))

    # Save back
    with open(candidates_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\n[SUCCESS] Updated {candidates_path}")
    print(f"  - Malicious clones: {data['stats']['malicious_clones_found']}")
    print(f"  - Clones: {data['stats']['clones_found']}")
    print(f"  - Legitimate: {data['stats']['legitimate']}")
    print(f"  - Unknown: {data['stats']['unknown']}")

def main():
    candidates_path = "experiments/grok/candidates.json"

    print("="*70)
    print("RERUN UNKNOWN EXTENSIONS")
    print("="*70)

    # Load unknown extensions
    unknown_exts, original_data = load_unknown_extensions(candidates_path)

    if not unknown_exts:
        print("No UNKNOWN extensions to reprocess!")
        return

    # Rerun each one
    results = []
    keyword = original_data.get('keyword', 'grok')
    brand_owner = original_data.get('stats', {}).get('brand_owner', 'xAI')

    for i, ext_data in enumerate(unknown_exts, 1):
        print(f"\n[{i}/{len(unknown_exts)}] Processing...")
        result = rerun_extension(ext_data, keyword=keyword, brand_owner=brand_owner)
        results.append(result)

    # Merge back into candidates.json
    print("\n" + "="*70)
    print("MERGING RESULTS")
    print("="*70)
    merge_results_into_candidates(candidates_path, results)

    print("\n" + "="*70)
    print("COMPLETE!")
    print("="*70)
    print(f"\nUpdated: {candidates_path}")
    print("\nRegenerate the grid report:")
    print("  python report_generators/generate_grid_report.py experiments/grok/candidates.json experiments/grok/grok_clones_grid.html")

if __name__ == "__main__":
    main()
