

import os
import sys
import json
import re
import argparse
from pathlib import Path
from typing import Dict, Optional, List, Tuple, Set
from collections import defaultdict


sys.path.insert(0, str(Path(__file__).parent / 'staticanalysis'))

try:
    from run_analysis import analyze_extension
except ImportError:
    print("Error: Could not import staticanalysis module")
    print("Make sure you're running from the project root directory")
    sys.exit(1)


try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Warning: google-generativeai not installed. Gemini validation disabled.")

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
MODEL = 'gemini-2.5-flash'


def get_extension_name(ext_dir: Path) -> str:
    manifest_path = ext_dir / 'manifest.json'
    if manifest_path.exists():
        try:
            with open(manifest_path, encoding='utf-8') as f:
                manifest = json.load(f)
            name = manifest.get('name', '')
            if not name.startswith('__MSG_'):
                return name
        except:
            pass
    return ext_dir.name


def extract_flagged_files(static_results: Dict) -> Dict[str, Dict]:
    """
    Extract filenames, line numbers, and severity info from static analysis findings.

    Returns:
        Dict mapping filename -> {
            'lines': set of flagged line numbers,
            'severity_score': weighted severity score,
            'critical_count': number of CRITICAL findings,
            'high_count': number of HIGH findings,
            'medium_count': number of MEDIUM findings
        }
    """
    flagged_files = defaultdict(lambda: {
        'lines': set(),
        'severity_score': 0,
        'critical_count': 0,
        'high_count': 0,
        'medium_count': 0
    })


    pattern = r'\[(?:EXT|LIB)\]\s+([^\s:]+\.js):(\d+)'


    SEVERITY_WEIGHTS = {
        'CRITICAL': 100,  
        'HIGH': 25,       
        'MEDIUM': 5       
    }

    # Check all severity levels with proper weighting
    security_risks = static_results.get('security_risks', {})
    for severity in ['CRITICAL', 'HIGH', 'MEDIUM']:
        weight = SEVERITY_WEIGHTS.get(severity, 1)
        for finding in security_risks.get(severity, []):
            matches = re.findall(pattern, finding)
            for filename, line_num in matches:
                flagged_files[filename]['lines'].add(int(line_num))
                flagged_files[filename]['severity_score'] += weight
                if severity == 'CRITICAL':
                    flagged_files[filename]['critical_count'] += 1
                elif severity == 'HIGH':
                    flagged_files[filename]['high_count'] += 1
                elif severity == 'MEDIUM':
                    flagged_files[filename]['medium_count'] += 1

    # Also check specialized findings (treat as HIGH severity)
    for field in ['credential_theft', 'keylogger', 'form_hijacking', 'c2_communication',
                  'data_exfiltration', 'privacy_violation']:
        for finding in static_results.get(field, []):
            if isinstance(finding, str):
                matches = re.findall(pattern, finding)
                for filename, line_num in matches:
                    flagged_files[filename]['lines'].add(int(line_num))
                    flagged_files[filename]['severity_score'] += SEVERITY_WEIGHTS['HIGH']
                    flagged_files[filename]['high_count'] += 1

    return dict(flagged_files)


def find_file_in_extension(ext_dir: Path, filename: str) -> Optional[Path]:
    """Find a file in the extension directory (handles nested paths)."""
    # Try direct path first
    direct_path = ext_dir / filename
    if direct_path.exists():
        return direct_path

    # Search recursively
    matches = list(ext_dir.rglob(filename))
    if matches:
        return matches[0]

    # Try in common subdirectories
    for subdir in ['static/js', 'js', 'javascript', 'scripts', 'lib', 'dist']:
        path = ext_dir / subdir / filename
        if path.exists():
            return path

    return None


def extract_code_with_context(file_path: Path, line_numbers: Set[int], context_lines: int = 15) -> str:
    try:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        lines = content.split('\n')

        if len(lines) <= 200:
            return content[:30000]

 
        ranges_to_include = set()
        for line_num in line_numbers:
            start = max(1, line_num - context_lines)
            end = min(len(lines), line_num + context_lines)
            for i in range(start, end + 1):
                ranges_to_include.add(i)


        excerpt_parts = []
        last_included = 0
        sorted_lines = sorted(ranges_to_include)

        for line_num in sorted_lines:
            if line_num > last_included + 1 and last_included > 0:
                excerpt_parts.append(f"\n... [lines {last_included + 1}-{line_num - 1} omitted] ...\n")

            if 1 <= line_num <= len(lines):
                marker = ">>>" if line_num in line_numbers else "   "
                excerpt_parts.append(f"{marker} {line_num}: {lines[line_num - 1]}")

            last_included = line_num

        return '\n'.join(excerpt_parts)[:30000]

    except Exception as e:
        return f"[Error reading file: {e}]"


def get_suspicious_domains(static_results: Dict) -> List[str]:
    endpoints = static_results.get('network_endpoints', [])

    exclude_patterns = [
        'schemas.', 'w3.org', 'purl.', 'openxmlformats', 'microsoft.com/office',
        'adobe.com', 'xfa.org', 'googleapis.com', 'google.com/search',
        'github.com', 'chromewebstore.google.com', 'chrome.google.com',
        'mozilla.org', 'cloudflare.com', 'jsdelivr.net', 'unpkg.com',
        'fonts.googleapis.com', 'fonts.gstatic.com', 'jspdf'
    ]

    suspicious = []
    for endpoint in endpoints:
        if endpoint.startswith('[ENDPOINT]'):
            parts = endpoint.split(' [EXT] ')[0]
            url_part = parts.replace('[ENDPOINT] ', '')
        else:
            url_part = endpoint

        if any(pattern in url_part.lower() for pattern in exclude_patterns):
            continue
        if '://' in url_part:
            try:
                domain = url_part.split('://')[1].split('/')[0]
                if domain and '.' in domain and len(domain) > 4:
                    suspicious.append(domain)
            except:
                pass
    return list(set(suspicious))


def extract_files_from_endpoints(static_results: Dict, suspicious_domains: List[str]) -> Dict[str, List[str]]:
    endpoints = static_results.get('network_endpoints', [])
    result = {}

    for endpoint in endpoints:
        matching_domains = [d for d in suspicious_domains if d in endpoint]
        if not matching_domains:
            continue

        if ' [EXT] ' in endpoint:
            file_part = endpoint.split(' [EXT] ')[-1]
            filename = file_part.split(':')[0]
            if filename:
                if filename not in result:
                    result[filename] = []
                result[filename].extend(matching_domains)


    return {f: list(set(domains)) for f, domains in result.items()}


def find_files_containing_domains(ext_dir: Path, domains: List[str]) -> Dict[str, List[str]]:
    result = {}
    for js_file in ext_dir.rglob("*.js"):
        try:
            content = js_file.read_text(encoding='utf-8', errors='ignore')
            found = [d for d in domains if d in content]
            if found:
                result[js_file.name] = found
        except:
            pass
    return result


def collect_code_sample(ext_dir: Path, static_results: Dict, max_chars: int = 120000) -> Tuple[str, List[str]]:
    code_parts = []
    included_files = []
    current_chars = 0
    manifest_path = ext_dir / 'manifest.json'
    if manifest_path.exists():
        manifest_content = manifest_path.read_text(encoding='utf-8', errors='ignore')
        code_parts.append(f"=== manifest.json ===\n{manifest_content}")
        included_files.append("manifest.json")
        current_chars += len(manifest_content)


    flagged_files = extract_flagged_files(static_results)


    suspicious_domains = get_suspicious_domains(static_results)

  
    files_with_domains = extract_files_from_endpoints(static_results, suspicious_domains)


    if not files_with_domains and suspicious_domains:
        files_with_domains = find_files_containing_domains(ext_dir, suspicious_domains)

    # Boost severity score for files containing suspicious domains (+500 points)
    DOMAIN_BOOST = 500
    for filename, domains_found in files_with_domains.items():
        if filename not in flagged_files:
            # Create entry for file not in flagged_files
            flagged_files[filename] = {
                'lines': set(),
                'severity_score': DOMAIN_BOOST,
                'critical_count': 0,
                'high_count': 0,
                'medium_count': 0,
                'suspicious_domains': domains_found
            }
        else:
            flagged_files[filename]['severity_score'] += DOMAIN_BOOST
            flagged_files[filename]['suspicious_domains'] = domains_found

    code_parts.append("\n\n" + "="*60)
    code_parts.append("FILES FLAGGED BY STATIC ANALYSIS (sorted by severity score)")
    code_parts.append("="*60)

    if files_with_domains:
        code_parts.append(f"\n[NOTE: Files containing suspicious domains boosted +{DOMAIN_BOOST} points]")
        code_parts.append(f"[Suspicious domains found: {', '.join(suspicious_domains[:5])}]")

    
    sorted_files = sorted(flagged_files.items(),
                          key=lambda x: -x[1]['severity_score'])

    files_included = 0
    files_skipped = []

    for filename, file_info in sorted_files:
        line_numbers = file_info['lines']
        severity_score = file_info['severity_score']

        if current_chars >= max_chars * 0.8:  
            files_skipped.append((filename, severity_score, file_info['critical_count'], file_info['high_count']))
            continue

        file_path = find_file_in_extension(ext_dir, filename)
        if file_path and file_path.exists():
            try:
                excerpt = extract_code_with_context(file_path, line_numbers)
                severity_label = f"CRIT:{file_info['critical_count']} HIGH:{file_info['high_count']} MED:{file_info['medium_count']}"
                header = f"\n\n=== {filename} [SEVERITY_SCORE:{severity_score} {severity_label}] [lines {sorted(line_numbers)[:10]}{'...' if len(line_numbers) > 10 else ''}] ==="
                code_parts.append(header)
                code_parts.append(excerpt)
                included_files.append(f"{filename} (score:{severity_score})")
                current_chars += len(excerpt)
                files_included += 1
            except:
                pass

  
    if files_skipped:
        code_parts.append(f"\n\n[WARNING: {len(files_skipped)} flagged files could not be included due to size limits:]")
        for fname, score, crit, high in files_skipped[:5]:
            code_parts.append(f"  - {fname} (score:{score}, CRITICAL:{crit}, HIGH:{high})")

  
    code_parts.append("\n\n" + "="*60)
    code_parts.append("MANIFEST-REFERENCED FILES")
    code_parts.append("="*60)

    manifest_files = []
    if manifest_path.exists():
        try:
            with open(manifest_path, encoding='utf-8') as f:
                manifest = json.load(f)

      
            bg = manifest.get('background', {})
            if 'service_worker' in bg:
                manifest_files.append(bg['service_worker'])
            elif 'scripts' in bg:
                manifest_files.extend(bg['scripts'])

   
            for cs in manifest.get('content_scripts', []):
                manifest_files.extend(cs.get('js', []))
        except:
            pass

    for js_file in manifest_files:
        basename = Path(js_file).name
        if basename in flagged_files and any(basename in f for f in included_files): 
            continue
        if current_chars >= max_chars * 0.9:
            break

        js_path = ext_dir / js_file
        if js_path.exists() and js_path.stat().st_size < 200000:
            try:
                content = js_path.read_text(encoding='utf-8', errors='ignore')
                if len(content) > 25000:
                    content = content[:25000] + "\n... [TRUNCATED] ..."
                code_parts.append(f"\n\n=== {js_file} [from manifest] ===")
                code_parts.append(content)
                included_files.append(f"{js_file} (manifest)")
                current_chars += len(content)
            except:
                pass


    if current_chars < max_chars * 0.85:
        code_parts.append("\n\n" + "="*60)
        code_parts.append("OTHER JS FILES")
        code_parts.append("="*60)

        already_included = set(Path(f.split()[0]).name for f in included_files)

        for js_file in ext_dir.rglob("*.js"):
            if js_file.name in already_included:
                continue
            if current_chars >= max_chars:
                break
            if js_file.stat().st_size > 100000: 
                continue

            try:
                content = js_file.read_text(encoding='utf-8', errors='ignore')
                if len(content) > 15000:
                    content = content[:15000] + "\n... [TRUNCATED] ..."
                rel_path = js_file.relative_to(ext_dir)
                code_parts.append(f"\n\n=== {rel_path} ===")
                code_parts.append(content)
                included_files.append(str(rel_path))
                current_chars += len(content)
                already_included.add(js_file.name)
            except:
                pass

    return '\n'.join(code_parts)[:max_chars], included_files


def build_validation_prompt(ext_id: str, ext_name: str, static_results: Dict,
                            code_sample: str, included_files: List[str]) -> str:

    findings = []
    for severity in ['CRITICAL', 'HIGH']:
        for risk in static_results.get('security_risks', {}).get(severity, [])[:20]:
            findings.append(f"- [{severity}]: {risk}")

    findings_text = '\n'.join(findings[:30]) if findings else 'No specific findings'

    # Filter network endpoints (exclude XML schemas)
    endpoints = [e for e in static_results.get('network_endpoints', [])
                 if not any(x in e for x in ['schemas.', 'w3.org', 'purl.', 'openxmlformats'])][:15]
    endpoints_text = '\n'.join(f'- {e}' for e in endpoints) if endpoints else 'None detected'

    # CRITICAL: Extract suspicious/C2 domains that are NOT legitimate services
    suspicious_domains = get_suspicious_domains(static_results)
    if suspicious_domains:
        c2_domains_text = '\n'.join(f'- {d} (SUSPECTED C2/EXFIL SERVER)' for d in suspicious_domains[:10])
    else:
        c2_domains_text = 'None identified'

    # List included files
    files_text = '\n'.join(f'- {f}' for f in included_files)

    return f"""You are a security analyst validating Chrome extension security findings.

## Extension Information
- Name: {ext_name}
- ID: {ext_id}
- Risk Score: {static_results.get('risk_score', 0)}

## Static Analysis Findings
{findings_text}

## ⚠️ SUSPECTED C2/DATA EXFILTRATION DOMAINS
These domains were identified as suspicious third-party servers (NOT official APIs):
{c2_domains_text}

ANY data sent to these domains should be considered MALICIOUS data theft, not legitimate functionality.

## Other Network Endpoints
{endpoints_text}

## Files Included for Review
{files_text}

## Extension Code
IMPORTANT: The code below PRIORITIZES files that were flagged by static analysis.
Lines marked with ">>>" are the exact lines where security issues were detected.
Review these carefully to determine if the flagged patterns are malicious or benign.

```
{code_sample}
```

## Your Task
Based on the code provided (especially the flagged lines marked with >>>), classify this extension:

**MALICIOUS**: Definitive evidence of credential theft, session hijacking, keyloggers, or unauthorized data exfiltration to attacker servers.

**SUSPICIOUS**: User data is sent to third-party servers with unclear privacy policy, PII collection without consent, or deceptive behavior.

**SAFE**: No user data theft, or data only used for legitimate functionality. Flagged patterns are false positives (e.g., UI keyboard shortcuts, legitimate API calls).

**NEED_MORE_FILES**: Critical file mentioned in findings is NOT present in the code above.

Pay special attention to:
- The flagged lines (marked >>>) - are they actually malicious or false positives?
- Data being sent to external servers (especially the suspicious endpoints listed)
- Cookie access patterns - stealing cookies or legitimate functionality?
- Keyboard listeners - keyloggers or UI shortcuts?

Respond ONLY with valid JSON:
{{"verdict": "MALICIOUS|SUSPICIOUS|SAFE|NEED_MORE_FILES", "confidence": 0.0-1.0, "reasoning": "explanation referencing specific code patterns you observed", "recommendation": "BLOCK|REVIEW|ALLOW", "key_concerns": ["list of specific malicious behaviors found, citing file:line where possible"]}}"""


def run_gemini_validation_batch(ext_id: str, ext_name: str, static_results: Dict,
                                code_sample: str, included_files: List[str],
                                poll_interval: int = 10, max_wait: int = 600) -> Optional[Dict]:
    """
    Run Gemini LLM validation using the Batch API for reliability.

    Args:
        poll_interval: Seconds between status checks (default 10)
        max_wait: Maximum seconds to wait (default 600 = 10 minutes)

    Returns:
        Validation result dict or None on failure
    """
    if not GEMINI_AVAILABLE:
        return None

    import time
    client = genai.Client(api_key=GEMINI_API_KEY)

    prompt = build_validation_prompt(ext_id, ext_name, static_results, code_sample, included_files)

    # Create inline batch request
    inline_requests = [
        {
            'contents': [{
                'parts': [{'text': prompt}],
                'role': 'user'
            }],
            'config': {
                'response_mime_type': 'application/json'
            }
        }
    ]

    try:
        # Create batch job
        batch_job = client.batches.create(
            model=f"models/{MODEL}",
            src=inline_requests,
            config={
                'display_name': f"ext-validation-{ext_id[:8]}",
            },
        )
        job_name = batch_job.name
        print(f"  Created batch job: {job_name}")

        # Poll for completion
        completed_states = {'JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'}
        waited = 0

        while waited < max_wait:
            batch_job = client.batches.get(name=job_name)
            state = batch_job.state.name

            if state in completed_states:
                break

            print(f"  Job status: {state} (waited {waited}s)")
            time.sleep(poll_interval)
            waited += poll_interval

        # Check final state
        if batch_job.state.name == 'JOB_STATE_SUCCEEDED':
            if batch_job.dest and batch_job.dest.inlined_responses:
                response = batch_job.dest.inlined_responses[0]
                if response.response:
                    return json.loads(response.response.text)
                elif response.error:
                    print(f"  Batch response error: {response.error}")
                    return None
        else:
            print(f"  Batch job ended with state: {batch_job.state.name}")
            if batch_job.error:
                print(f"  Error: {batch_job.error}")
            return None

    except Exception as e:
        print(f"Gemini batch validation error: {e}")
        return None


def run_gemini_validation(ext_id: str, ext_name: str, static_results: Dict,
                          code_sample: str, included_files: List[str]) -> Optional[Dict]:
    """Run Gemini LLM validation on the extension (uses Batch API for reliability)."""
    return run_gemini_validation_batch(ext_id, ext_name, static_results, code_sample, included_files)


def analyze_single_extension(ext_path: str, name: Optional[str] = None,
                             output_dir: str = "output", skip_validation: bool = False,
                             verbose: bool = False) -> Dict:

    ext_dir = Path(ext_path)

    if not ext_dir.exists():
        print(f"Error: Extension folder not found: {ext_path}")
        sys.exit(1)

    ext_id = ext_dir.name
    ext_name = name or get_extension_name(ext_dir)

    print(f"\n{'='*60}")
    print(f"ANALYZING EXTENSION: {ext_name}")
    print(f"ID: {ext_id}")
    print(f"{'='*60}\n")

    # Stage 1: Static Analysis
    print("[1/2] Running Static Analysis...")
    static_results = analyze_extension(str(ext_dir))

    risk_score = static_results.get('risk_score', 0)
    critical_count = len(static_results.get('security_risks', {}).get('CRITICAL', []))
    high_count = len(static_results.get('security_risks', {}).get('HIGH', []))
    medium_count = len(static_results.get('security_risks', {}).get('MEDIUM', []))
    low_count = len(static_results.get('security_risks', {}).get('LOW', []))

    print(f"\n  Risk Score: {risk_score}")
    print(f"  CRITICAL: {critical_count}, HIGH: {high_count}, MEDIUM: {medium_count}, LOW: {low_count}")

    if risk_score >= 100:
        print(f"  Verdict: HIGH RISK - Likely malicious")
    elif risk_score >= 50:
        print(f"  Verdict: MEDIUM RISK - Suspicious")
    else:
        print(f"  Verdict: LOW RISK")

    # Extract flagged files info (now with severity scores)
    flagged_files = extract_flagged_files(static_results)
    if flagged_files:
        print(f"\n  Files with findings: {len(flagged_files)}")
        # Sort by severity score for display
        sorted_files = sorted(flagged_files.items(), key=lambda x: -x[1]['severity_score'])
        if verbose:
            print("  Top files by severity score:")
            for f, info in sorted_files[:5]:
                print(f"    - {f}: score={info['severity_score']} (CRIT:{info['critical_count']} HIGH:{info['high_count']} MED:{info['medium_count']})")

    if verbose:
        print("\n  Top findings:")
        for finding in static_results.get('security_risks', {}).get('CRITICAL', [])[:5]:
            print(f"    - {finding}")

    # Stage 2: Gemini Validation
    gemini_result = None
    included_files = []
    if not skip_validation and GEMINI_AVAILABLE:
        print("\n[2/2] Running Gemini LLM Validation...")
        print("  Collecting code from flagged files...")
        code_sample, included_files = collect_code_sample(ext_dir, static_results)
        print(f"  Included {len(included_files)} files ({len(code_sample)} chars)")

        if verbose:
            print("  Files sent to Gemini:")
            for f in included_files[:10]:
                print(f"    - {f}")
            if len(included_files) > 10:
                print(f"    ... and {len(included_files) - 10} more")

        gemini_result = run_gemini_validation(ext_id, ext_name, static_results, code_sample, included_files)

        if gemini_result:
            print(f"\n  Verdict: {gemini_result.get('verdict', 'UNKNOWN')}")
            print(f"  Confidence: {gemini_result.get('confidence', 0):.0%}")
            print(f"  Recommendation: {gemini_result.get('recommendation', 'N/A')}")

            if verbose and gemini_result.get('key_concerns'):
                print("\n  Key Concerns:")
                for concern in gemini_result['key_concerns']:
                    print(f"    - {concern}")
    else:
        print("\n[2/2] Skipping Gemini validation")

    # Save results
    output = {
        'extension_id': ext_id,
        'extension_name': ext_name,
        'extension_path': str(ext_dir.absolute()),
        'static_analysis': {
            'risk_score': risk_score,
            'success': static_results.get('success', False),
            'findings': {
                'critical': critical_count,
                'high': high_count,
                'medium': medium_count,
                'low': low_count
            },
            'flagged_files': {f: {
                'lines': sorted(list(info['lines'])),
                'severity_score': info['severity_score'],
                'critical_count': info['critical_count'],
                'high_count': info['high_count'],
                'medium_count': info['medium_count']
            } for f, info in flagged_files.items()},
            'security_risks': static_results.get('security_risks', {}),
            'network_endpoints': static_results.get('network_endpoints', [])[:50],
            'credential_theft': static_results.get('credential_theft', []),
            'keylogger': static_results.get('keylogger', []),
            'data_exfiltration': static_results.get('data_exfiltration', [])
        },
        'gemini_validation': gemini_result,
        'files_sent_to_gemini': included_files
    }

    # Save to file
    os.makedirs(output_dir, exist_ok=True)
    output_path = Path(output_dir) / f"{ext_id}_validated.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Results saved to: {output_path}")
    print(f"{'='*60}\n")

    return output


def main():
    parser = argparse.ArgumentParser(
        description='Analyze a single Chrome extension folder',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python analyze_single_extension.py kpilmncnoafddjpnbhepaiilgkdcieaf
    python analyze_single_extension.py ./my_extension --name "My Extension"
    python analyze_single_extension.py ext_folder --skip-validation --verbose
        """
    )
    parser.add_argument('extension_folder', help='Path to the extension folder')
    parser.add_argument('--name', '-n', help='Custom name for the extension')
    parser.add_argument('--output', '-o', default='output', help='Output directory (default: output/)')
    parser.add_argument('--skip-validation', '-s', action='store_true', help='Skip Gemini validation')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed output')

    args = parser.parse_args()

    result = analyze_single_extension(
        args.extension_folder,
        name=args.name,
        output_dir=args.output,
        skip_validation=args.skip_validation,
        verbose=args.verbose
    )

    # Exit with appropriate code
    gemini_result = result.get('gemini_validation') or {}
    if gemini_result.get('verdict') == 'MALICIOUS':
        sys.exit(2)  # Malicious
    elif gemini_result.get('verdict') == 'SUSPICIOUS':
        sys.exit(1)  # Suspicious
    else:
        sys.exit(0)  # Safe or unknown


if __name__ == '__main__':
    main()
