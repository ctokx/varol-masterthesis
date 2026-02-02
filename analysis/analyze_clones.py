"""Download and analyze Chrome extension CRX files for security issues."""

import os
import json
import requests
import zipfile
import shutil
import tempfile
from pathlib import Path
from typing import Dict, List, Set

import sys
sys.path.insert(0, str(Path(__file__).parent / 'staticanalysis'))
from run_analysis import analyze_extension, check_codeql_installed


CRX_URL_TEMPLATE = "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0&acceptformat=crx2,crx3&x=id%3D{extension_id}%26uc"


def download_crx(extension_id: str, output_dir: str) -> str:
    """Download CRX file for an extension."""
    url = CRX_URL_TEMPLATE.format(extension_id=extension_id)
    crx_path = os.path.join(output_dir, f"{extension_id}.crx")
    
    try:
        response = requests.get(url, allow_redirects=True, timeout=30)
        if response.status_code == 200 and len(response.content) > 1000:
            with open(crx_path, 'wb') as f:
                f.write(response.content)
            return crx_path
        else:
            print(f"  Failed to download {extension_id}: HTTP {response.status_code}")
            return None
    except Exception as e:
        print(f"  Error downloading {extension_id}: {e}")
        return None


def extract_crx(crx_path: str, extract_dir: str) -> bool:
    """Extract CRX file (ZIP files with header)."""
    try:
        with open(crx_path, 'rb') as f:
            data = f.read()

        zip_start = data.find(b'PK\x03\x04')
        if zip_start == -1:
            print(f"  No ZIP header found in {crx_path}")
            return False

        zip_path = crx_path + '.zip'
        with open(zip_path, 'wb') as f:
            f.write(data[zip_start:])

        with zipfile.ZipFile(zip_path, 'r') as z:
            z.extractall(extract_dir)
        
        os.unlink(zip_path)
        return True
        
    except Exception as e:
        print(f"  Error extracting {crx_path}: {e}")
        return False


def analyze_clones(clones_json_path: str, output_dir: str = None) -> Dict:
    """Analyze all malicious clones from a clones JSON file."""
    with open(clones_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    extensions_to_analyze = []
    
    for clone in data.get('malicious_clones', []):
        extensions_to_analyze.append({
            'id': clone['id'],
            'name': clone['name'],
            'type': 'MALICIOUS_CLONE'
        })
    
    for clone in data.get('clones', []):
        extensions_to_analyze.append({
            'id': clone['id'],
            'name': clone['name'],
            'type': 'CLONE'
        })

    seen_ids: Set[str] = set()
    unique_extensions = []
    for ext in extensions_to_analyze:
        if ext['id'] not in seen_ids:
            seen_ids.add(ext['id'])
            unique_extensions.append(ext)
    
    print(f"Found {len(unique_extensions)} unique extensions to analyze")
    
    if not unique_extensions:
        print("No extensions to analyze (all have Unknown developer)")
        return {}

    if not check_codeql_installed():
        print("ERROR: CodeQL not installed")
        return {}

    if output_dir is None:
        output_dir = tempfile.mkdtemp(prefix="codeql_analysis_")
    
    crx_dir = os.path.join(output_dir, "crx_files")
    extract_dir = os.path.join(output_dir, "extracted")
    os.makedirs(crx_dir, exist_ok=True)
    os.makedirs(extract_dir, exist_ok=True)
    
    results = {}
    
    for i, ext in enumerate(unique_extensions):
        ext_id = ext['id']
        ext_name = ext['name']
        print(f"\n[{i+1}/{len(unique_extensions)}] Analyzing: {ext_name}")
        print(f"  ID: {ext_id}")

        print(f"  Downloading CRX...")
        crx_path = download_crx(ext_id, crx_dir)
        if not crx_path:
            results[ext_id] = {'success': False, 'error': 'Download failed'}
            continue
        
        # Extract
        ext_extract_dir = os.path.join(extract_dir, ext_id)
        os.makedirs(ext_extract_dir, exist_ok=True)
        
        print(f"  Extracting...")
        if not extract_crx(crx_path, ext_extract_dir):
            results[ext_id] = {'success': False, 'error': 'Extraction failed'}
            continue
        
        # Run CodeQL analysis
        print(f"  Running CodeQL analysis...")
        try:
            analysis = analyze_extension(ext_extract_dir, cleanup=True)
            results[ext_id] = {
                'success': analysis.get('success', False),
                'network_endpoints': analysis.get('network_endpoints', []),
                'chrome_api_abuse': analysis.get('chrome_api_abuse', []),
                'malicious_patterns': analysis.get('malicious_patterns', []),
                'data_exfiltration': analysis.get('data_exfiltration', []),
                'string_urls': analysis.get('string_urls', []),
                # New advanced security findings
                'credential_theft': analysis.get('credential_theft', []),
                'keylogger': analysis.get('keylogger', []),
                'form_hijacking': analysis.get('form_hijacking', []),
                'c2_communication': analysis.get('c2_communication', []),
                'privacy_violation': analysis.get('privacy_violation', []),
                'errors': analysis.get('errors', [])
            }
            print(f"  Found {len(analysis.get('network_endpoints', []))} endpoints")
            # Report advanced findings
            if analysis.get('credential_theft'):
                print(f"  [!] Credential theft: {len(analysis['credential_theft'])} findings")
            if analysis.get('keylogger'):
                print(f"  [!] Keylogger: {len(analysis['keylogger'])} findings")
        except Exception as e:
            print(f"  Analysis error: {e}")
            results[ext_id] = {'success': False, 'error': str(e)}
    
    return results


def update_clones_json(clones_json_path: str, analysis_results: Dict, in_place: bool = True) -> str:
    """
    Update clones JSON with static analysis results.

    Args:
        clones_json_path: Path to clones JSON
        analysis_results: Dict mapping extension_id -> analysis
        in_place: If True, update original file; if False, create new file

    Returns path to updated JSON file.
    """
    with open(clones_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Add analysis results to each clone
    for clone_list in ['malicious_clones', 'clones']:
        for clone in data.get(clone_list, []):
            ext_id = clone['id']
            if ext_id in analysis_results:
                clone['static_analysis'] = analysis_results[ext_id]

    # Save updated JSON
    if in_place:
        output_path = clones_json_path
    else:
        output_path = clones_json_path.replace('.json', '_with_analysis.json')

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nUpdated JSON saved to: {output_path}")
    return output_path


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python analyze_clones.py <path_to_clones.json>")
        print("\nExample:")
        print("  python analyze_clones.py output/openai_clones.json")
        sys.exit(1)
    
    clones_path = sys.argv[1]
    
    if not os.path.exists(clones_path):
        print(f"Error: File not found: {clones_path}")
        sys.exit(1)
    
    print(f"Analyzing clones from: {clones_path}")
    print("=" * 60)
    
    results = analyze_clones(clones_path)
    
    if results:
        update_clones_json(clones_path, results)
        
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        
        successful = sum(1 for r in results.values() if r.get('success'))
        print(f"Successfully analyzed: {successful}/{len(results)}")
        
        # Count findings
        total_endpoints = sum(len(r.get('network_endpoints', [])) for r in results.values())
        total_api_abuse = sum(len(r.get('chrome_api_abuse', [])) for r in results.values())
        total_malicious = sum(len(r.get('malicious_patterns', [])) for r in results.values())
        
        print(f"Total network endpoints found: {total_endpoints}")
        print(f"Chrome API abuse patterns: {total_api_abuse}")
        print(f"Malicious patterns: {total_malicious}")
