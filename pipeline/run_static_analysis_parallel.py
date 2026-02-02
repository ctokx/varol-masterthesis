#!/usr/bin/env python3
"""
Parallel Static Analysis Runner for Chrome Extension Clone Detection

This script runs CodeQL static analysis on all detected clones/malicious extensions
using parallel processing for maximum throughput on multi-core systems.

Designed for high-core-count systems (48+ cores).

Usage:
    python run_static_analysis_parallel.py --workers 48
    python run_static_analysis_parallel.py --input output/gemini_clones.json --workers 48
    python run_static_analysis_parallel.py --all --workers 48
"""

import os
import sys
import json
import argparse
import tempfile
import shutil
import zipfile
import requests
import time
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from dataclasses import dataclass
import threading
import multiprocessing

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from staticanalysis.run_analysis import analyze_extension, check_codeql_installed, CODEQL_PATH

# JavaScript beautification for better static analysis
try:
    import jsbeautifier
    JSBEAUTIFIER_AVAILABLE = True
except ImportError:
    JSBEAUTIFIER_AVAILABLE = False
    print("Warning: jsbeautifier not installed. JS files will not be beautified.")

# ============================================================================
# Configuration
# ============================================================================

# CRX download URL template
CRX_URL_TEMPLATE = "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0&acceptformat=crx2,crx3&x=id%3D{extension_id}%26uc"

# Default directories
DEFAULT_OUTPUT_DIR = Path(__file__).parent.parent / "output"
DEFAULT_WORK_DIR = Path(tempfile.gettempdir()) / "codeql_parallel_analysis"

# Rate limiting for downloads
DOWNLOAD_RATE_LIMIT = 10  # requests per second

# Progress tracking
progress_lock = threading.Lock()
progress = {"completed": 0, "total": 0, "failed": 0}


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class ExtensionTask:
    """Task for analyzing a single extension"""
    extension_id: str
    name: str
    classification: str  # MALICIOUS_CLONE, CLONE, etc.
    source_file: str     # Which clones.json it came from


@dataclass
class AnalysisResult:
    """Result of analyzing a single extension"""
    extension_id: str
    success: bool
    error: Optional[str] = None
    version: Optional[str] = None  # Extension version from manifest.json
    network_endpoints: List[str] = None
    chrome_api_abuse: List[str] = None
    malicious_patterns: List[str] = None
    # New context-first capabilities (primary)
    capabilities: Dict[str, List[str]] = None
    # Legacy security_risks (backwards compatibility)
    security_risks: Dict[str, List[str]] = None
    risk_score: int = 0

    def to_dict(self) -> Dict:
        return {
            'success': self.success,
            'error': self.error,
            'version': self.version,
            'network_endpoints': self.network_endpoints or [],
            'chrome_api_abuse': self.chrome_api_abuse or [],
            'malicious_patterns': self.malicious_patterns or [],
            'capabilities': self.capabilities or {
                'INTERCEPTION': [], 'CREDENTIAL_ACCESS': [], 'KEYBOARD': [],
                'NETWORK': [], 'DOM': [], 'STORAGE': []
            },
            'security_risks': self.security_risks or {'CRITICAL': [], 'HIGH': [], 'MEDIUM': [], 'LOW': []},
            'risk_score': self.risk_score,
        }


# ============================================================================
# Download and Extract Functions
# ============================================================================

download_semaphore = threading.Semaphore(DOWNLOAD_RATE_LIMIT)

def download_crx(extension_id: str, output_dir: Path) -> Optional[Path]:
    """Download CRX file for an extension with rate limiting."""
    url = CRX_URL_TEMPLATE.format(extension_id=extension_id)
    crx_path = output_dir / f"{extension_id}.crx"

    # Check if already downloaded
    if crx_path.exists() and crx_path.stat().st_size > 1000:
        return crx_path

    with download_semaphore:
        try:
            response = requests.get(url, allow_redirects=True, timeout=60)
            if response.status_code == 200 and len(response.content) > 1000:
                with open(crx_path, 'wb') as f:
                    f.write(response.content)
                return crx_path
            else:
                return None
        except Exception as e:
            return None


def extract_crx(crx_path: Path, extract_dir: Path) -> bool:
    """Extract CRX file (they're ZIP files with a header)."""
    try:
        # CRX files have a header before the ZIP data
        with open(crx_path, 'rb') as f:
            data = f.read()

        # Find ZIP header
        zip_start = data.find(b'PK\x03\x04')
        if zip_start == -1:
            return False

        # Write ZIP portion to temp file
        zip_path = crx_path.with_suffix('.zip')
        with open(zip_path, 'wb') as f:
            f.write(data[zip_start:])

        # Extract
        with zipfile.ZipFile(zip_path, 'r') as z:
            z.extractall(extract_dir)

        os.unlink(zip_path)
        return True

    except Exception as e:
        return False


def beautify_extension_js(extract_dir: Path) -> int:
    """
    Beautify all JavaScript files in an extracted extension.
    This improves static analysis accuracy and makes line numbers match
    when validating findings later.
    
    Returns the number of files beautified.
    """
    if not JSBEAUTIFIER_AVAILABLE:
        return 0
    
    beautified_count = 0
    opts = jsbeautifier.default_options()
    opts.indent_size = 2
    opts.max_preserve_newlines = 2
    
    for js_file in extract_dir.rglob('*.js'):
        try:
            # Skip very large files (>2MB) to avoid slowdowns
            if js_file.stat().st_size > 2 * 1024 * 1024:
                continue
            
            content = js_file.read_text(encoding='utf-8', errors='ignore')
            
            # Skip if already beautified (has proper indentation)
            lines = content.split('\n')
            if len(lines) > 50 and sum(1 for l in lines[:50] if l.startswith('  ')) > 10:
                continue  # Already beautified
            
            beautified = jsbeautifier.beautify(content, opts)
            js_file.write_text(beautified, encoding='utf-8')
            beautified_count += 1
            
        except Exception:
            continue  # Skip files that can't be beautified
    
    return beautified_count


# ============================================================================
# Analysis Functions
# ============================================================================

def analyze_single_extension(task: ExtensionTask, work_dir: Path) -> AnalysisResult:
    """
    Analyze a single extension (download, extract, run CodeQL).
    This function is designed to run in a separate process.
    """
    ext_id = task.extension_id
    crx_dir = work_dir / "crx"
    extract_dir = work_dir / "extracted" / ext_id

    try:
        # Create directories
        crx_dir.mkdir(parents=True, exist_ok=True)
        extract_dir.mkdir(parents=True, exist_ok=True)

        # Download
        crx_path = download_crx(ext_id, crx_dir)
        if not crx_path:
            return AnalysisResult(extension_id=ext_id, success=False, error="Download failed")

        # Extract
        if not extract_crx(crx_path, extract_dir):
            return AnalysisResult(extension_id=ext_id, success=False, error="Extraction failed")

        # Beautify JS files for better analysis and accurate line numbers
        beautify_extension_js(extract_dir)

        # Extract version from manifest.json
        version = None
        manifest_path = extract_dir / 'manifest.json'
        if manifest_path.exists():
            try:
                with open(manifest_path, 'r', encoding='utf-8') as f:
                    manifest = json.load(f)
                    version = manifest.get('version')
            except:
                pass

        # Run CodeQL analysis
        analysis = analyze_extension(str(extract_dir), cleanup=True)

        result = AnalysisResult(
            extension_id=ext_id,
            success=analysis.get('success', False),
            version=version,
            network_endpoints=analysis.get('network_endpoints', []),
            chrome_api_abuse=analysis.get('chrome_api_abuse', []),
            malicious_patterns=analysis.get('malicious_patterns', []),
            capabilities=analysis.get('capabilities', {
                'INTERCEPTION': [], 'CREDENTIAL_ACCESS': [], 'KEYBOARD': [],
                'NETWORK': [], 'DOM': [], 'STORAGE': []
            }),
            security_risks=analysis.get('security_risks', {'CRITICAL': [], 'HIGH': [], 'MEDIUM': [], 'LOW': []}),
            risk_score=analysis.get('risk_score', 0),
        )

        # Cleanup extracted files to save disk space
        try:
            shutil.rmtree(extract_dir)
        except:
            pass

        return result

    except Exception as e:
        return AnalysisResult(extension_id=ext_id, success=False, error=str(e))


def update_progress(success: bool):
    """Thread-safe progress update."""
    global progress
    with progress_lock:
        progress["completed"] += 1
        if not success:
            progress["failed"] += 1


def print_progress():
    """Print current progress."""
    with progress_lock:
        completed = progress["completed"]
        total = progress["total"]
        failed = progress["failed"]
        pct = (completed / total * 100) if total > 0 else 0
        print(f"\r[{completed}/{total}] {pct:.1f}% complete, {failed} failed", end="", flush=True)


# ============================================================================
# Main Pipeline
# ============================================================================

def collect_extensions_to_analyze(clones_json_paths: List[Path], force_reanalyze: bool = False, clones_only: bool = False) -> List[ExtensionTask]:
    """
    Collect all extensions that need static analysis from the given JSON files.
    """
    tasks = []
    seen_ids: Set[str] = set()

    for json_path in clones_json_paths:
        if not json_path.exists():
            print(f"Warning: File not found: {json_path}")
            continue

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        source = json_path.stem  # e.g., "gemini_clones"

        # Check if already has static_analysis
        def needs_analysis(ext: dict) -> bool:
            """Check if extension needs static analysis."""
            if force_reanalyze:
                return True
            static = ext.get('static_analysis', {})
            # Need analysis if no static_analysis or it failed
            if not static:
                return True
            if not static.get('success', False):
                return True
            # Already has successful analysis
            return False

        # Collect anchors (official extensions) - ANALYZE FIRST for baseline comparison
        if not clones_only:
            for anchor in data.get('anchors', []):
                if anchor['id'] not in seen_ids and needs_analysis(anchor):
                    seen_ids.add(anchor['id'])
                    tasks.append(ExtensionTask(
                        extension_id=anchor['id'],
                        name=anchor.get('name', 'Unknown'),
                        classification='ANCHOR',
                        source_file=source
                    ))

        # Collect malicious clones
        for clone in data.get('malicious_clones', []):
            if clone['id'] not in seen_ids and needs_analysis(clone):
                seen_ids.add(clone['id'])
                tasks.append(ExtensionTask(
                    extension_id=clone['id'],
                    name=clone.get('name', 'Unknown'),
                    classification='MALICIOUS_CLONE',
                    source_file=source
                ))

        # Collect regular clones
        for clone in data.get('clones', []):
            if clone['id'] not in seen_ids and needs_analysis(clone):
                seen_ids.add(clone['id'])
                tasks.append(ExtensionTask(
                    extension_id=clone['id'],
                    name=clone.get('name', 'Unknown'),
                    classification='CLONE',
                    source_file=source
                ))

        # Also analyze legitimate extensions for comparison
        if not clones_only:
            for ext in data.get('legitimate', []):
                if ext['id'] not in seen_ids and needs_analysis(ext):
                    seen_ids.add(ext['id'])
                    tasks.append(ExtensionTask(
                        extension_id=ext['id'],
                        name=ext.get('name', 'Unknown'),
                        classification='LEGITIMATE',
                        source_file=source
                    ))

    return tasks


def run_parallel_analysis(
    tasks: List[ExtensionTask],
    work_dir: Path,
    num_workers: int = 64
) -> Dict[str, AnalysisResult]:
    """
    Run static analysis on all extensions in parallel.

    Args:
        tasks: List of ExtensionTask objects
        work_dir: Working directory for downloads/extraction
        num_workers: Number of parallel workers

    Returns:
        Dictionary mapping extension_id -> AnalysisResult
    """
    global progress
    progress = {"completed": 0, "total": len(tasks), "failed": 0}

    results: Dict[str, AnalysisResult] = {}

    print(f"\nStarting parallel analysis with {num_workers} workers...")
    print(f"Total extensions to analyze: {len(tasks)}")
    print("-" * 60)

    # Use ThreadPoolExecutor for I/O-bound operations (download, disk I/O)
    # Note: CodeQL itself is CPU-bound but runs as external process
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        # Submit all tasks
        future_to_task = {
            executor.submit(analyze_single_extension, task, work_dir): task
            for task in tasks
        }

        # Process results as they complete
        for future in as_completed(future_to_task):
            task = future_to_task[future]
            try:
                result = future.result()
                results[task.extension_id] = result
                update_progress(result.success)
            except Exception as e:
                results[task.extension_id] = AnalysisResult(
                    extension_id=task.extension_id,
                    success=False,
                    error=str(e)
                )
                update_progress(False)

            print_progress()

    print()  # New line after progress
    return results


def update_clones_json_files(
    clones_json_paths: List[Path],
    analysis_results: Dict[str, AnalysisResult]
) -> None:
    """
    Update all clones.json files with static analysis results.

    This adds 'static_analysis' field to each extension that was analyzed.
    """
    for json_path in clones_json_paths:
        if not json_path.exists():
            continue

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        updated_count = 0

        # Update anchors (official extensions)
        for anchor in data.get('anchors', []):
            if anchor['id'] in analysis_results:
                anchor['static_analysis'] = analysis_results[anchor['id']].to_dict()
                updated_count += 1

        # Update malicious_clones
        for clone in data.get('malicious_clones', []):
            if clone['id'] in analysis_results:
                clone['static_analysis'] = analysis_results[clone['id']].to_dict()
                updated_count += 1

        # Update clones
        for clone in data.get('clones', []):
            if clone['id'] in analysis_results:
                clone['static_analysis'] = analysis_results[clone['id']].to_dict()
                updated_count += 1

        # Update legitimate
        for ext in data.get('legitimate', []):
            if ext['id'] in analysis_results:
                ext['static_analysis'] = analysis_results[ext['id']].to_dict()
                updated_count += 1

        # Save updated JSON
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"Updated {json_path.name}: {updated_count} extensions")


def main():
    parser = argparse.ArgumentParser(
        description="Run CodeQL static analysis on Chrome extensions in parallel"
    )
    parser.add_argument(
        "--input", "-i",
        type=str,
        help="Path to a single clones.json file to analyze"
    )
    parser.add_argument(
        "--all", "-a",
        action="store_true",
        help="Analyze all *_clones.json files in output directory"
    )
    parser.add_argument(
        "--workers", "-w",
        type=int,
        default=48,
        help="Number of parallel workers (default: 48)"
    )
    parser.add_argument(
        "--work-dir",
        type=str,
        default=str(DEFAULT_WORK_DIR),
        help="Working directory for downloads/extraction"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory containing clones.json files"
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip extensions that already have static_analysis (default: True)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-analyze all extensions even if they have static_analysis"
    )
    parser.add_argument(
        "--limit", "-l",
        type=int,
        help="Limit number of extensions to analyze (for testing)"
    )
    parser.add_argument(
        "--clones-only",
        action="store_true",
        help="Only analyze CLONE and MALICIOUS_CLONE classifications (skip ANCHOR and LEGITIMATE)"
    )

    args = parser.parse_args()

    # Determine which files to process
    if args.input:
        clones_files = [Path(args.input)]
    elif args.all:
        output_dir = Path(args.output_dir)
        clones_files = list(output_dir.glob("*_clones.json"))
    else:
        parser.print_help()
        print("\nError: Must specify --input or --all")
        sys.exit(1)

    if not clones_files:
        print("No clones.json files found!")
        sys.exit(1)

    print("=" * 60)
    print("PARALLEL STATIC ANALYSIS RUNNER")
    print("=" * 60)
    print(f"Files to process: {len(clones_files)}")
    for f in clones_files:
        print(f"  - {f.name}")
    print(f"Workers: {args.workers}")
    print(f"Work directory: {args.work_dir}")

    # Check CodeQL
    if not check_codeql_installed():
        print("\nERROR: CodeQL not installed or not found at:", CODEQL_PATH)
        print("Please install CodeQL and update CODEQL_PATH in staticanalysis/run_analysis.py")
        sys.exit(1)
    print("CodeQL: OK")

    # Setup work directory
    work_dir = Path(args.work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    # Collect tasks
    print("\nCollecting extensions to analyze...")
    tasks = collect_extensions_to_analyze(
        clones_files, 
        force_reanalyze=args.force, 
        clones_only=args.clones_only
    )

    if not tasks:
        print("No extensions need analysis (all already have static_analysis)")
        print("Use --force to re-analyze all extensions")
        sys.exit(0)

    print(f"Found {len(tasks)} extensions needing analysis")

    # Apply limit if specified
    if args.limit:
        tasks = tasks[:args.limit]
        print(f"Limited to first {args.limit} extensions (--limit)")

    # Breakdown by classification
    by_class = {}
    for t in tasks:
        by_class[t.classification] = by_class.get(t.classification, 0) + 1
    for cls, count in sorted(by_class.items()):
        print(f"  - {cls}: {count}")

    # Run analysis
    start_time = time.time()
    results = run_parallel_analysis(tasks, work_dir, args.workers)
    elapsed = time.time() - start_time

    # Summary
    print("\n" + "=" * 60)
    print("ANALYSIS COMPLETE")
    print("=" * 60)

    successful = sum(1 for r in results.values() if r.success)
    failed = len(results) - successful

    print(f"Total analyzed: {len(results)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Time elapsed: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
    print(f"Time elapsed: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
    print(f"Average per extension: {elapsed/len(results):.2f} seconds")

    if failed > 0:
        print("\n" + "="*60)
        print("FAILURE REPORT")
        print("="*60)
        for ext_id, result in results.items():
            if not result.success:
                print(f"Extension {ext_id}: {result.error}")

    # Count findings
    total_critical = sum(len(r.security_risks.get('CRITICAL', [])) for r in results.values() if r.security_risks)
    total_high = sum(len(r.security_risks.get('HIGH', [])) for r in results.values() if r.security_risks)
    total_endpoints = sum(len(r.network_endpoints or []) for r in results.values())

    print(f"\nFindings:")
    print(f"  CRITICAL severity: {total_critical}")
    print(f"  HIGH severity: {total_high}")
    print(f"  Network endpoints: {total_endpoints}")

    # Update JSON files
    print("\nUpdating clones.json files...")
    update_clones_json_files(clones_files, results)

    print("\nDone!")


if __name__ == "__main__":
    main()
