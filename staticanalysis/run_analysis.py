"""
CodeQL Static Analysis Runner for Chrome Extension Clone Detection

This module provides functionality to analyze Chrome extension JavaScript code
using CodeQL to detect API endpoints, network requests, and obfuscated URLs.
"""

import subprocess
import json
import os
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Optional
import re

# Path to CodeQL CLI - auto-detect platform
import platform
if platform.system() == "Windows":
    CODEQL_PATH = r"C:\codeql-home\codeql\codeql.cmd"
else:
    # Linux/Mac - check common locations
    _home = os.path.expanduser("~")
    _possible_paths = [
        # Binary inside codeql directory (common extraction)
        os.path.join(_home, "codeql", "codeql"), 
        os.path.join(_home, "codeql-home", "codeql", "codeql"),
        "/usr/local/bin/codeql",
        "/opt/codeql/codeql",
        # Fallback to just "codeql" in PATH
        "codeql" 
    ]
    
    # helper to check if valid file
    def _is_valid_codeql(p):
        if p == "codeql": return shutil.which("codeql") is not None
        return os.path.isfile(p) and os.access(p, os.X_OK)

    CODEQL_PATH = next((p for p in _possible_paths if _is_valid_codeql(p)), "codeql")

# Path to queries
QUERIES_DIR = Path(__file__).parent


def check_codeql_installed() -> bool:
    """Check if CodeQL CLI is available."""
    try:
        result = subprocess.run(
            [CODEQL_PATH, "--version"],
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.returncode == 0
    except Exception:
        return False


def create_database(source_dir: str, db_path: str) -> bool:
    """
    Create a CodeQL database from JavaScript source code.
    
    Args:
        source_dir: Path to the source directory containing JS files
        db_path: Path where the database should be created
        
    Returns:
        True if database creation succeeded
    """
    # Remove existing database if it exists
    if os.path.exists(db_path):
        shutil.rmtree(db_path)
    
    cmd = [
        CODEQL_PATH,
        "database", "create",
        db_path,
        "--language=javascript",
        f"--source-root={source_dir}",
        "--overwrite"
    ]
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout
        )
        if result.returncode != 0:
            print(f"Database creation failed: {result.stderr}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print("Database creation timed out")
        return False
    except Exception as e:
        print(f"Database creation error: {e}")
        return False


def run_query(db_path: str, query_path: str, output_format: str = "sarif-latest") -> Optional[Dict]:
    """
    Run a CodeQL query against a database.
    
    Args:
        db_path: Path to the CodeQL database
        query_path: Path to the .ql query file
        output_format: Output format (sarif-latest, csv, json)
        
    Returns:
        Parsed results or None if query failed
    """
    with tempfile.NamedTemporaryFile(suffix=".sarif", delete=False) as f:
        output_path = f.name
    
    try:
        cmd = [
            CODEQL_PATH,
            "database", "analyze",
            db_path,
            query_path,
            f"--format={output_format}",
            f"--output={output_path}",
            "--rerun"
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode != 0:
            print(f"Query failed: {result.stderr}")
            return None
        
        # Parse output
        with open(output_path, 'r', encoding='utf-8') as f:
            return json.load(f)
            
    except Exception as e:
        print(f"Query error: {e}")
        return None
    finally:
        if os.path.exists(output_path):
            os.unlink(output_path)


def extract_urls_from_sarif(sarif_data: Dict, include_location: bool = False) -> List[str]:
    """
    Extract URL strings from SARIF output.

    Args:
        sarif_data: SARIF output from CodeQL
        include_location: If True, include file:line info like "[ENDPOINT] url [EXT] file.js:123"
    """
    urls = []

    if not sarif_data or 'runs' not in sarif_data:
        return urls

    for run in sarif_data.get('runs', []):
        for result in run.get('results', []):
            message = result.get('message', {}).get('text', '')

            # Extract URLs from message
            url_patterns = re.findall(r'https?://[^\s\'"]+', message)

            # Get file location if available
            file_location = ""
            if include_location:
                for location in result.get('locations', []):
                    phys = location.get('physicalLocation', {})
                    artifact = phys.get('artifactLocation', {}).get('uri', '')
                    region = phys.get('region', {})
                    line = region.get('startLine', 0)
                    if artifact and line:
                        # Extract just filename from path
                        filename = artifact.split('/')[-1]
                        file_location = f" [EXT] {filename}:{line}"
                        break

            for url in url_patterns:
                if include_location and file_location:
                    urls.append(f"[ENDPOINT] {url}{file_location}")
                else:
                    urls.append(url)

            # Also check the actual code location for URLs in snippets
            for location in result.get('locations', []):
                snippet = location.get('physicalLocation', {}).get('region', {}).get('snippet', {}).get('text', '')
                snippet_urls = re.findall(r'https?://[^\s\'"]+', snippet)

                if include_location:
                    phys = location.get('physicalLocation', {})
                    artifact = phys.get('artifactLocation', {}).get('uri', '')
                    region = phys.get('region', {})
                    line = region.get('startLine', 0)
                    if artifact and line:
                        filename = artifact.split('/')[-1]
                        for url in snippet_urls:
                            urls.append(f"[ENDPOINT] {url} [EXT] {filename}:{line}")
                    else:
                        urls.extend(snippet_urls)
                else:
                    urls.extend(snippet_urls)

    return list(set(urls))  # Deduplicate


def extract_findings_from_sarif(sarif_data: Dict) -> List[str]:
    """Extract finding messages from SARIF output."""
    findings = []

    if not sarif_data or 'runs' not in sarif_data:
        return findings

    for run in sarif_data.get('runs', []):
        for result in run.get('results', []):
            message = result.get('message', {}).get('text', '')
            if message:
                findings.append(message)

    return findings


def parse_manifest(source_dir: str) -> Dict[str, List[str]]:
    """
    Parse manifest.json for permissions and endpoints.
    CodeQL doesn't parse JSON manifests well, so we handle this separately.

    NOTE: Pattern-based detection (keyloggers, eval, cookies, etc.) is now
    handled entirely by CodeQL's find_security_risks.ql for consistency
    and to avoid duplicates.
    """
    results = {
        'manifest_info': [],
        'manifest_endpoints': []
    }

    manifest_path = os.path.join(source_dir, 'manifest.json')
    if not os.path.exists(manifest_path):
        return results

    try:
        with open(manifest_path, 'r', encoding='utf-8', errors='ignore') as f:
            manifest = json.load(f)

        # Extract search provider URL (search hijacking indicator)
        search_url = manifest.get('chrome_settings_overrides', {}).get('search_provider', {}).get('search_url')
        if search_url:
            results['manifest_info'].append(f"SEARCH_HIJACK: search_provider - {search_url}")
            clean_url = search_url.split('?')[0]
            results['manifest_endpoints'].append(clean_url)

        # Check permissions - focus on dangerous ones
        permissions = manifest.get('permissions', []) + manifest.get('host_permissions', [])
        dangerous_perms = []
        for perm in permissions:
            if perm == '<all_urls>':
                dangerous_perms.append('ALL_URLS: <all_urls> permission')
            elif '://*' in perm or perm.endswith('/*'):
                dangerous_perms.append(f'BROAD_HOST: {perm}')
                if '://' in perm:
                    clean_perm = perm.replace('*', '').replace('://.', '://')
                    results['manifest_endpoints'].append(clean_perm)

        if dangerous_perms:
            results['manifest_info'].extend(dangerous_perms)

        # Check content scripts matches
        for script in manifest.get('content_scripts', []):
            for match in script.get('matches', []):
                if '://' in match:
                    results['manifest_endpoints'].append(match.replace('*', ''))

    except Exception:
        pass

    return results


def analyze_extension(extension_path: str, cleanup: bool = True) -> Dict:
    """
    Analyze Chrome extension code with CodeQL.
    
    Args:
        extension_path: Path to the extension source directory
        cleanup: Whether to cleanup the database after analysis
        
    Returns:
        Dictionary containing:
        - network_endpoints: List of detected network URLs
        - string_urls: List of URL string literals found
        - obfuscated_patterns: List of obfuscation patterns detected
        - raw_results: Raw SARIF output from each query
        - success: Whether analysis completed successfully
    """
    results = {
        'network_endpoints': [],
        'string_urls': [],
        'obfuscated_patterns': [],
        # Manifest-specific findings (permissions, search hijacking)
        'manifest_info': [],
        # Capabilities (context-first approach - no severity labels)
        'capabilities': {
            'INTERCEPTION': [],
            'CREDENTIAL_ACCESS': [],
            'KEYBOARD': [],
            'NETWORK': [],
            'DOM': [],
            'STORAGE': []
        },
        # Legacy security_risks kept for backwards compatibility
        'security_risks': {
            'CRITICAL': [],
            'HIGH': [],
            'MEDIUM': [],
            'LOW': []
        },
        'risk_score': 0,
        'raw_results': {},
        'success': False,
        'errors': []
    }
    
    # Check CodeQL installation
    codeql_available = check_codeql_installed()
    if not codeql_available:
        results['errors'].append("CodeQL CLI not found - using grep fallback only")

    # Create temporary database path (unique per extension to support parallel execution)
    import uuid
    db_path = os.path.join(tempfile.gettempdir(), f"codeql_db_{uuid.uuid4().hex[:8]}")
    codeql_success = False

    try:
        if codeql_available:
            # Create database
            print(f"Creating CodeQL database for {extension_path}...")
            if not create_database(extension_path, db_path):
                results['errors'].append("Failed to create CodeQL database - using grep fallback")
            else:
                codeql_success = True

        if codeql_success:
            # Run each query
            # NOTE: extract_capabilities.ql is the main query (context-first, no severity labels)
            # We also run legacy find_security_risks.ql for backwards compatibility
            queries = [
                # URL/endpoint detection
                ('find_string_urls.ql', 'string_urls'),
                ('find_network_endpoints.ql', 'network_endpoints'),
                ('find_obfuscated_urls.ql', 'obfuscated_patterns'),
                # Context-first capability extraction (PRIMARY)
                ('extract_capabilities.ql', 'capabilities'),
                # Legacy tiered risks (for backwards compatibility)
                ('find_security_risks.ql', 'security_risks'),
            ]

            # Queries that extract URLs vs queries that extract findings
            url_queries = {'find_string_urls.ql', 'find_network_endpoints.ql'}
            # Capability-based queries (new context-first approach)
            capability_queries = {'extract_capabilities.ql'}
            # Legacy tiered queries (backwards compatibility)
            tiered_queries = {'find_security_risks.ql'}

            for query_file, result_key in queries:
                query_path = QUERIES_DIR / query_file
                if not query_path.exists():
                    # Skip silently for optional new queries
                    continue

                print(f"Running query: {query_file}...")
                sarif_result = run_query(db_path, str(query_path))

                if sarif_result:
                    results['raw_results'][query_file] = sarif_result
                    if query_file in url_queries:
                        # Extract URLs for endpoint detection WITH file:line location
                        urls = extract_urls_from_sarif(sarif_result, include_location=True)
                        results[result_key].extend(urls)
                    elif query_file in capability_queries:
                        # Parse capability findings (context-first approach)
                        findings = extract_findings_from_sarif(sarif_result)
                        for finding in findings:
                            clean_finding = finding.replace('\\[', '[').replace('\\]', ']')
                            # Parse capability type from [CAPABILITY] prefix
                            for cap in ['INTERCEPTION', 'CREDENTIAL_ACCESS', 'KEYBOARD', 'NETWORK', 'DOM', 'STORAGE']:
                                if clean_finding.startswith(f'[{cap}]'):
                                    results['capabilities'][cap].append(clean_finding)
                                    break
                    elif query_file in tiered_queries:
                        # Parse legacy tiered security findings (backwards compatibility)
                        findings = extract_findings_from_sarif(sarif_result)
                        for finding in findings:
                            clean_finding = finding.replace('\\[', '[').replace('\\]', ']')
                            if clean_finding.startswith('[CRITICAL]'):
                                results['security_risks']['CRITICAL'].append(clean_finding)
                            elif clean_finding.startswith('[HIGH]'):
                                results['security_risks']['HIGH'].append(clean_finding)
                            elif clean_finding.startswith('[MEDIUM]'):
                                results['security_risks']['MEDIUM'].append(clean_finding)
                            elif clean_finding.startswith('[LOW]'):
                                results['security_risks']['LOW'].append(clean_finding)
                        # Calculate risk score from legacy risks
                        results['risk_score'] = (
                            len(results['security_risks']['CRITICAL']) * 100 +
                            len(results['security_risks']['HIGH']) * 25 +
                            len(results['security_risks']['MEDIUM']) * 5 +
                            len(results['security_risks']['LOW']) * 1
                        )
                    else:
                        # Extract finding messages for security analysis
                        findings = extract_findings_from_sarif(sarif_result)
                        results[result_key].extend(findings)

            # Combine all network endpoints
            results['network_endpoints'] = list(set(
                results['string_urls'] +
                results.get('network_endpoints', [])
            ))

        # Parse manifest.json for permissions and endpoints
        # (CodeQL doesn't handle JSON manifest parsing well)
        print("Parsing manifest.json...")
        manifest_results = parse_manifest(extension_path)

        # Add manifest info (permissions, search hijacking indicators)
        results['manifest_info'] = manifest_results.get('manifest_info', [])

        # Add manifest endpoints to network_endpoints
        if manifest_results.get('manifest_endpoints'):
            results['network_endpoints'].extend(manifest_results['manifest_endpoints'])
            # Deduplicate
            results['network_endpoints'] = list(set(results['network_endpoints']))
        
        results['success'] = True
        
    finally:
        # Cleanup
        if cleanup and os.path.exists(db_path):
            try:
                shutil.rmtree(db_path)
            except Exception:
                pass
    
    return results


def analyze_extension_simple(extension_path: str) -> List[str]:
    """
    Simple analysis that just returns a list of detected URLs.
    
    Args:
        extension_path: Path to the extension source directory
        
    Returns:
        List of detected URL strings
    """
    results = analyze_extension(extension_path)
    return results.get('network_endpoints', [])


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python run_analysis.py <path_to_js_source>")
        print("\nExample:")
        print("  python run_analysis.py ../testjs")
        sys.exit(1)
    
    source_path = sys.argv[1]
    
    if not os.path.exists(source_path):
        print(f"Error: Path does not exist: {source_path}")
        sys.exit(1)
    
    print(f"Analyzing: {source_path}")
    print("=" * 50)
    
    results = analyze_extension(source_path)
    
    if not results['success']:
        print("\nAnalysis failed!")
        for error in results['errors']:
            print(f"  - {error}")
        sys.exit(1)
    
    print("\n" + "=" * 50)
    print("ANALYSIS RESULTS")
    print("=" * 50)

    # Show risk score prominently
    risk_score = results.get('risk_score', 0)
    print(f"\n{'='*50}")
    print(f"RISK SCORE: {risk_score}")
    if risk_score >= 100:
        print("VERDICT: HIGH RISK - Likely malicious")
    elif risk_score >= 50:
        print("VERDICT: MEDIUM RISK - Suspicious, needs review")
    elif risk_score >= 10:
        print("VERDICT: LOW RISK - Some concerns")
    else:
        print("VERDICT: MINIMAL RISK - Appears benign")
    print(f"{'='*50}")

    # Show tiered security findings
    security_risks = results.get('security_risks', {})

    if security_risks.get('CRITICAL'):
        print(f"\n[!!!] CRITICAL FINDINGS ({len(security_risks['CRITICAL'])}):")
        for finding in security_risks['CRITICAL']:
            print(f"  {finding}")

    if security_risks.get('HIGH'):
        print(f"\n[!!] HIGH SEVERITY ({len(security_risks['HIGH'])}):")
        for finding in security_risks['HIGH']:
            print(f"  {finding}")

    if security_risks.get('MEDIUM'):
        print(f"\n[!] MEDIUM SEVERITY ({len(security_risks['MEDIUM'])}):")
        for finding in security_risks['MEDIUM'][:20]:  # Limit to first 20
            print(f"  {finding}")
        if len(security_risks['MEDIUM']) > 20:
            print(f"  ... and {len(security_risks['MEDIUM']) - 20} more")

    if security_risks.get('LOW'):
        print(f"\n[i] LOW SEVERITY ({len(security_risks['LOW'])}):")
        for finding in security_risks['LOW'][:10]:  # Limit to first 10
            print(f"  {finding}")
        if len(security_risks['LOW']) > 10:
            print(f"  ... and {len(security_risks['LOW']) - 10} more")

    # Show manifest findings
    if results.get('manifest_info'):
        print(f"\n[MANIFEST] Manifest Analysis ({len(results['manifest_info'])}):")
        for info in results['manifest_info']:
            print(f"  {info}")

    print(f"\nString URLs found: {len(results['string_urls'])}")
    for url in sorted(results['string_urls']):
        print(f"  - {url}")

    print(f"\nObfuscated patterns detected: {len(results['obfuscated_patterns'])}")
    for pattern in results['obfuscated_patterns'][:20]:
        print(f"  - {pattern}")
    if len(results['obfuscated_patterns']) > 20:
        print(f"  ... and {len(results['obfuscated_patterns']) - 20} more")

    print(f"\nTotal unique network endpoints: {len(results['network_endpoints'])}")
    for url in sorted(results['network_endpoints']):
        print(f"  - {url}")
