#!/usr/bin/env python3
"""
Gemini Batch API Validation - Context-First Classification

Uses Gemini Batch API to classify Chrome extension security findings.
50% cheaper than standard API, processes all extensions asynchronously.

CONTEXT-FIRST APPROACH:
- Static analysis extracts patterns WITHOUT pre-assigning severity
- Patterns are grouped by category (network, code execution, data access, etc.)
- Gemini receives full context and classifies based on:
  - Domain legitimacy (is it a known service or C2 server?)
  - Behavioral intent (legitimate functionality or data exfiltration?)
  - Combined pattern analysis

This approach is more academically defensible as it relies on LLM contextual
reasoning rather than arbitrary severity weights.

Usage:
    # Create and submit batch job
    python validate_batch_gemini.py create --input output/chatgpt_clones.json

    # Check job status
    python validate_batch_gemini.py status --job batches/123456

    # Retrieve results when done
    python validate_batch_gemini.py results --job batches/123456 --output output/chatgpt_batch_validated.json
"""

import os
import sys
import json
import time
import argparse
import tempfile
import zipfile
import requests
import re
from pathlib import Path
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Set, Tuple, Optional
import jsbeautifier

from google import genai
from google.genai import types


MODEL_FALLBACK_ORDER = [
    "models/gemini-3-flash-preview",      # Gemini 3 Flash Preview - first choice (fast, cheap)
    "models/gemini-3-pro-preview",        # Gemini 3 Pro Preview - second choice
    "models/gemini-2.5-pro",              # Gemini 2.5 Pro - fallback (most accurate)
]
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
CRX_URL_TEMPLATE = "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0&acceptformat=crx2,crx3&x=id%3D{extension_id}%26uc"

# Severity weights for file prioritization
SEVERITY_WEIGHTS = {
    'CRITICAL': 100,
    'HIGH': 25,
    'MEDIUM': 5
}

# Domain boost for files containing suspicious domains
DOMAIN_BOOST = 500

# Logging directory
LOG_DIR = Path(__file__).parent.parent / "output" / "validation_logs"


def get_client():
    """Get Gemini client."""
    return genai.Client(api_key=GEMINI_API_KEY)


# ============================================================================
# Logging & Stats
# ============================================================================

class ValidationLogger:
    """Logger for tracking validation stats for thesis."""

    def __init__(self, dataset_name: str):
        self.dataset_name = dataset_name
        self.start_time = datetime.now()
        self.stats = {
            'dataset': dataset_name,
            'total_extensions': 0,
            'extensions_processed': 0,
            'extensions_skipped': 0,
            'download_failures': 0,

            # Static analysis stats
            'static_analysis_stats': {
                'total_critical_findings': 0,
                'total_high_findings': 0,
                'total_medium_findings': 0,
                'total_low_findings': 0,
                'extensions_with_critical': 0,
                'extensions_with_high': 0,
                'avg_risk_score': 0,
                'max_risk_score': 0,
            },

            # File selection stats
            'file_selection_stats': {
                'total_files_flagged': 0,
                'total_files_sent': 0,
                'files_boosted_by_domain': 0,
                'avg_files_per_extension': 0,
            },

            # C2/suspicious domain stats
            'domain_stats': {
                'extensions_with_suspicious_domains': 0,
                'unique_suspicious_domains': set(),
                'domain_occurrences': defaultdict(int),
            },

            # Validation results (filled after batch completes)
            'validation_results': {
                'MALICIOUS': 0,
                'SUSPICIOUS': 0,
                'SAFE': 0,
                'NEED_MORE_FILES': 0,
                'ERROR': 0,
            },

            # False positive analysis
            'false_positive_analysis': {
                'high_risk_but_safe': [],  # Extensions with high static risk but SAFE verdict
                'low_risk_but_malicious': [],  # Extensions with low static risk but MALICIOUS
            },

            'processing_log': [],
        }
        self.risk_scores = []

    def log_extension(self, ext_id: str, ext_name: str, static_analysis: dict,
                      files_sent: List[str], suspicious_domains: List[str],
                      files_boosted: int, status: str):
        """Log processing of a single extension."""
        risk_score = static_analysis.get('risk_score', 0)
        security_risks = static_analysis.get('security_risks', {})

        critical = len(security_risks.get('CRITICAL', []))
        high = len(security_risks.get('HIGH', []))
        medium = len(security_risks.get('MEDIUM', []))
        low = len(security_risks.get('LOW', []))

        self.stats['static_analysis_stats']['total_critical_findings'] += critical
        self.stats['static_analysis_stats']['total_high_findings'] += high
        self.stats['static_analysis_stats']['total_medium_findings'] += medium
        self.stats['static_analysis_stats']['total_low_findings'] += low

        if critical > 0:
            self.stats['static_analysis_stats']['extensions_with_critical'] += 1
        if high > 0:
            self.stats['static_analysis_stats']['extensions_with_high'] += 1

        self.risk_scores.append(risk_score)
        if risk_score > self.stats['static_analysis_stats']['max_risk_score']:
            self.stats['static_analysis_stats']['max_risk_score'] = risk_score

        self.stats['file_selection_stats']['total_files_sent'] += len(files_sent)
        self.stats['file_selection_stats']['files_boosted_by_domain'] += files_boosted

        if suspicious_domains:
            self.stats['domain_stats']['extensions_with_suspicious_domains'] += 1
            for domain in suspicious_domains:
                self.stats['domain_stats']['unique_suspicious_domains'].add(domain)
                self.stats['domain_stats']['domain_occurrences'][domain] += 1

        self.stats['processing_log'].append({
            'extension_id': ext_id,
            'name': ext_name[:50],
            'risk_score': risk_score,
            'critical': critical,
            'high': high,
            'files_sent': len(files_sent),
            'suspicious_domains': suspicious_domains,
            'status': status,
        })

        if status == 'processed':
            self.stats['extensions_processed'] += 1
        elif status == 'skipped':
            self.stats['extensions_skipped'] += 1
        elif status == 'download_failed':
            self.stats['download_failures'] += 1

    def finalize(self):
        """Finalize stats calculations."""
        if self.risk_scores:
            self.stats['static_analysis_stats']['avg_risk_score'] = sum(self.risk_scores) / len(self.risk_scores)

        if self.stats['extensions_processed'] > 0:
            self.stats['file_selection_stats']['avg_files_per_extension'] = (
                self.stats['file_selection_stats']['total_files_sent'] / self.stats['extensions_processed']
            )

        # Convert set to list for JSON serialization
        self.stats['domain_stats']['unique_suspicious_domains'] = list(
            self.stats['domain_stats']['unique_suspicious_domains']
        )
        self.stats['domain_stats']['domain_occurrences'] = dict(
            self.stats['domain_stats']['domain_occurrences']
        )

        self.stats['processing_time_seconds'] = (datetime.now() - self.start_time).total_seconds()

    def save(self, output_path: Path = None):
        """Save stats to JSON file."""
        self.finalize()

        if output_path is None:
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            output_path = LOG_DIR / f"{self.dataset_name}_validation_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.stats, f, indent=2, ensure_ascii=False)

        return output_path

# ============================================================================
# Raw Static Analysis Extraction (No Severity Labels - Just What & Where)
# ============================================================================

def extract_raw_findings(static_analysis: Dict) -> Tuple[List[Dict], Set[str]]:
    """
    Extract raw findings from static analysis WITHOUT any severity labels.
    Returns just what was found and where (file:line).

    Returns:
        Tuple of (list of findings, set of files referenced)
    """
    findings = []
    files_referenced = set()

    # Regex to extract file:line from findings
    file_line_pattern = r'\[(?:EXT|LIB)\]\s+([^:\s]+):(\d+)'

    def parse_finding(finding_str: str, category: str) -> Optional[Dict]:
        """Parse a finding string into structured format."""
        match = re.search(file_line_pattern, finding_str)
        if match:
            filename = match.group(1)
            line = int(match.group(2))
            files_referenced.add(filename)

            # User Filtering Logic:
            # 1. Skip if LEGITIMATE and NO security risks
            # 2. Process if MALICIOUS_CLONE / CLONE
            # 3. Process if security_risks > 0
            
            # NOTE: The variables 'ext', 'ext_id', 'ext_name', 'logger' are not available in this scope.
            # This filtering logic appears to be intended for a higher-level function (e.g., create_batch_job)
            # that iterates through extensions, not for a helper function parsing individual findings.
            # Inserting as requested, but this block will cause a NameError if executed as is.
            # relationship = ext.get('relationship', 'UNKNOWN')
            # security_risks = static_analysis.get('security_risks', {}) # static_analysis is available here
            
            # has_risks = False
            # for severity in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
            #     if security_risks.get(severity, []):
            #         has_risks = True
            #         break
            
            # # If legitimate and no risks, skip
            # if relationship == 'LEGITIMATE' and not has_risks:
            #     print(f"Skipping {ext_id} (LEGITIMATE + No Risks)")
            #     logger.log_extension(ext_id, ext_name, static_analysis, [], [], 0, 'skipped_legitimate')
            #     continue

            # # If purely unknown relationship and no risks, deciding to skip or not? 
            # # User said: "only send the ones with clone or malicious clone ones... so dont send the legitimate ones"
            # # I'll stick to: if not (Cloned OR Malicious OR Has Risks) -> Skip
            
            # is_clone_related = relationship in ['CLONE', 'MALICIOUS_CLONE', 'Brand Impersonation']
            
            # if not is_clone_related and not has_risks:
            #      print(f"Skipping {ext_id} ({relationship} + No Risks)")
            #      logger.log_extension(ext_id, ext_name, static_analysis, [], [], 0, 'skipped_no_risk')
            #      continue

            # Extract the pattern type (e.g., "EVAL", "FETCH", etc.)
            # Remove severity prefix if present
            clean_finding = re.sub(r'^\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*', '', finding_str)
            pattern_match = re.match(r'([A-Z_]+):', clean_finding)
            pattern_type = pattern_match.group(1) if pattern_match else category

            return {
                'what': pattern_type,
                'file': filename,
                'line': line,
                'raw': finding_str
            }
        return None

    # Process capabilities (preferred format)
    capabilities = static_analysis.get('capabilities', {})
    for cap_type, cap_findings in capabilities.items():
        for finding in cap_findings:
            parsed = parse_finding(finding, cap_type)
            if parsed:
                findings.append(parsed)

    # Process security_risks (legacy format) - strip severity labels
    security_risks = static_analysis.get('security_risks', {})
    for severity in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
        for finding in security_risks.get(severity, []):
            parsed = parse_finding(finding, 'SECURITY_RISK')
            if parsed:
                findings.append(parsed)

    # Process network_endpoints - these are important!
    endpoints = static_analysis.get('network_endpoints', [])
    for endpoint in endpoints:
        if '[ENDPOINT]' in endpoint and '[EXT]' in endpoint:
            parts = endpoint.split(' [EXT] ')
            url_part = parts[0].replace('[ENDPOINT] ', '').strip()

            if len(parts) > 1:
                file_match = re.match(r'([^:\s]+):(\d+)', parts[1])
                if file_match:
                    filename = file_match.group(1)
                    line = int(file_match.group(2))
                    files_referenced.add(filename)
                    findings.append({
                        'what': 'NETWORK_ENDPOINT',
                        'url': url_part,
                        'file': filename,
                        'line': line,
                        'raw': endpoint
                    })

    return findings, files_referenced


def format_raw_findings_for_prompt(findings: List[Dict]) -> str:
    """
    Format raw findings into a simple list for Gemini.
    NO severity labels - just what was found and where.
    """
    if not findings:
        return "No findings from static analysis."

    # Group by file for readability
    by_file = defaultdict(list)
    for f in findings:
        by_file[f['file']].append(f)

    lines = ["## Static Analysis Findings (Raw - No Severity Labels)", ""]
    lines.append("CodeQL found the following patterns. YOU determine if they are malicious or benign:")
    lines.append("")

    for filename, file_findings in sorted(by_file.items()):
        lines.append(f"### {filename}")
        for f in sorted(file_findings, key=lambda x: x['line']):
            if f['what'] == 'NETWORK_ENDPOINT':
                lines.append(f"  - Line {f['line']}: NETWORK_ENDPOINT → {f.get('url', 'unknown')[:80]}")
            else:
                lines.append(f"  - Line {f['line']}: {f['what']}")
        lines.append("")

    return '\n'.join(lines)



def extract_flagged_files(static_analysis: Dict) -> Set[str]:
    """Extract ALL filenames referenced in static analysis findings."""
    flagged_files = set()
    pattern = r'\[(?:EXT|LIB)\]\s+([^\s:]+\.js):(\d+)'

    # 1. Check ALL capabilities (Context-First)
    capabilities = static_analysis.get('capabilities', {})
    for cap_type, findings in capabilities.items():
        for finding in findings:
            matches = re.findall(pattern, finding)
            for filename, _ in matches:
                flagged_files.add(filename)

    # 2. Check security_risks (Legacy)
    security_risks = static_analysis.get('security_risks', {})
    for severity, findings in security_risks.items():
        for finding in findings:
            matches = re.findall(pattern, finding)
            for filename, _ in matches:
                flagged_files.add(filename)

    # 3. Check specialized fields
    for field in ['credential_theft', 'keylogger', 'form_hijacking', 'c2_communication',
                  'data_exfiltration', 'privacy_violation']:
        for finding in static_analysis.get(field, []):
            if isinstance(finding, str):
                matches = re.findall(pattern, finding)
                for filename, _ in matches:
                    flagged_files.add(filename)
    
    # 4. Check network endpoints
    endpoints = static_analysis.get('network_endpoints', [])
    for endpoint in endpoints:
        if ' [EXT] ' in endpoint:
            parts = endpoint.split(' [EXT] ')
            if len(parts) > 1:
                file_part = parts[-1]
                if ':' in file_part:
                    filename = file_part.split(':')[0]
                    flagged_files.add(filename)

    return flagged_files


def get_suspicious_domains(static_analysis: Dict) -> List[str]:
    """Extract suspicious domains from network_endpoints."""
    endpoints = static_analysis.get('network_endpoints', [])

    exclude_patterns = [
        'schemas.', 'w3.org', 'purl.', 'openxmlformats', 'microsoft.com/office',
        'adobe.com', 'xfa.org', 'googleapis.com', 'google.com/search',
        'github.com', 'chromewebstore.google.com', 'chrome.google.com',
        'mozilla.org', 'cloudflare.com', 'jsdelivr.net', 'unpkg.com',
        'fonts.googleapis.com', 'fonts.gstatic.com', 'jspdf', 'reactjs.org',
        'facebook.com/react', 'localhost', '127.0.0.1',
        '.svg', '.png', '.jpg', '.jpeg', '.ico', '.gif', '.css', '.woff', '.woff2',
        'sentry.io', 'google-analytics.com', 'googletagmanager.com'
    ]

    suspicious = []
    for endpoint in endpoints:
        # Handle new format: [ENDPOINT] url [EXT] file:line
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


def extract_files_from_endpoints(static_analysis: Dict, suspicious_domains: List[str]) -> Dict[str, List[str]]:
    """Extract file info from network_endpoints containing suspicious domains."""
    endpoints = static_analysis.get('network_endpoints', [])
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


def beautify_extension_js(extract_dir: Path) -> int:
    """
    Beautify all JavaScript files in an extracted extension.
    IMPORTANT: CodeQL analysis runs on beautified code, so we MUST beautify
    to match line numbers in the prompt.
    """
    beautified_count = 0
    try:
        opts = jsbeautifier.default_options()
        opts.indent_size = 2
        opts.max_preserve_newlines = 2
    except:
        return 0
    
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
            continue
    
    return beautified_count


# ============================================================================
# Code Collection - Based on Static Analysis Findings
# ============================================================================

def download_extension_code(ext_id: str, static_analysis: Dict, cache_dir: Path,
                            max_chars: int = 800000) -> Tuple[Optional[str], List[str], List[Dict], Set[str]]:
    """
    Download and extract extension, return beautified code for files referenced by static analysis.

    This follows the design:
    1. CodeQL static analysis identifies patterns with file:line
    2. We download & beautify THOSE specific files
    3. Gemini gets: beautified code + raw static analysis findings
    4. Gemini makes judgment (no pre-assigned severity)

    Returns:
        Tuple of (code_sample, files_sent, raw_findings, files_from_analysis)
    """
    extract_dir = cache_dir / ext_id
    files_sent = []

    # Download if not cached
    if not extract_dir.exists():
        extract_dir.mkdir(parents=True, exist_ok=True)

        url = CRX_URL_TEMPLATE.format(extension_id=ext_id)
        try:
            response = requests.get(url, allow_redirects=True, timeout=60)
            if response.status_code != 200 or len(response.content) < 1000:
                return None, [], [], set()

            crx_data = response.content
            zip_start = crx_data.find(b'PK\x03\x04')
            if zip_start == -1:
                return None, [], [], set()

            zip_path = cache_dir / f"{ext_id}.zip"
            with open(zip_path, 'wb') as f:
                f.write(crx_data[zip_start:])

            with zipfile.ZipFile(zip_path, 'r') as z:
                z.extractall(extract_dir)

            os.unlink(zip_path)

            # Beautify ALL JS files so line numbers match CodeQL findings
            beautify_extension_js(extract_dir)
        except Exception:
            return None, [], [], set()

    # 1. Extract raw findings and get files referenced by static analysis
    raw_findings, files_from_analysis = extract_raw_findings(static_analysis)

    code_parts = []
    current_chars = 0

    # 2. Manifest first (always include)
    manifest_path = extract_dir / "manifest.json"
    if manifest_path.exists():
        manifest_content = manifest_path.read_text(encoding='utf-8', errors='ignore')
        code_parts.append(f"=== manifest.json ===\n{manifest_content}")
        files_sent.append("manifest.json")
        current_chars += len(manifest_content)

    # 3. Include files referenced by static analysis (these are the important ones!)
    # Sort by file size (smallest first) so we can include more files
    code_parts.append("\n\n" + "="*60)
    code_parts.append("BEAUTIFIED CODE FOR FILES WITH STATIC ANALYSIS FINDINGS")
    code_parts.append("="*60)

    # Get file sizes and sort by size ascending
    files_with_sizes = []
    for filename in files_from_analysis:
        for candidate in extract_dir.rglob(filename):
            try:
                size = candidate.stat().st_size
                files_with_sizes.append((filename, candidate, size))
            except:
                pass
            break

    # Sort by size (smallest first to include more files)
    files_with_sizes.sort(key=lambda x: x[2])

    files_included = set()
    for filename, file_path, size in files_with_sizes:
        if current_chars >= max_chars:
            break

        # Skip very large files (>500KB) - likely bundled libraries
        if size > 500_000:
            code_parts.append(f"\n\n=== {filename} [SKIPPED - {size:,} bytes, likely library] ===")
            continue

        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')

            # Truncate if too large
            if len(content) > 150000:
                content = content[:150000] + "\n... [TRUNCATED] ..."

            code_parts.append(f"\n\n=== {filename} ({size:,} bytes) ===")
            code_parts.append(content)
            files_sent.append(filename)
            files_included.add(filename)
            current_chars += len(content)
        except:
            pass

    # 4. Also include manifest-referenced files (background, content scripts)
    # These might not have been flagged but are core extension code
    if manifest_path.exists() and current_chars < max_chars * 0.8:
        try:
            manifest = json.load(open(manifest_path, encoding='utf-8'))

            manifest_files = []
            bg = manifest.get('background', {})
            if 'service_worker' in bg:
                manifest_files.append(bg['service_worker'])
            elif 'scripts' in bg:
                manifest_files.extend(bg['scripts'])

            for cs in manifest.get('content_scripts', []):
                manifest_files.extend(cs.get('js', []))

            for js_file in manifest_files:
                js_name = Path(js_file).name
                if js_name in files_included:
                    continue
                if current_chars >= max_chars:
                    break

                js_path = extract_dir / js_file
                if js_path.exists():
                    try:
                        size = js_path.stat().st_size
                        if size > 500_000:
                            continue

                        content = js_path.read_text(encoding='utf-8', errors='ignore')
                        if len(content) > 100000:
                            content = content[:100000] + "\n... [TRUNCATED] ..."

                        code_parts.append(f"\n\n=== {js_file} [from manifest] ({size:,} bytes) ===")
                        code_parts.append(content)
                        files_sent.append(f"{js_file} (manifest)")
                        files_included.add(js_name)
                        current_chars += len(content)
                    except:
                        pass
        except:
            pass

    return '\n'.join(code_parts)[:max_chars], files_sent, raw_findings, files_from_analysis


# ============================================================================
# Prompt Building
# ============================================================================

def build_validation_prompt(ext_name: str, ext_id: str,
                            raw_findings: List[Dict],
                            code_sample: str, files_sent: List[str],
                            clone_context: dict = None) -> str:
    """
    Build validation prompt with raw static analysis findings + beautified code.
    v3.0: Added emphasis on avoiding false positives from static analysis labels.
    """

    # Format raw findings
    findings_text = format_raw_findings_for_prompt(raw_findings)

    # Files included
    files_text = "\n".join(f"- {f}" for f in files_sent[:30])

    # Build clone context section
    clone_context = clone_context or {}
    category = clone_context.get('category', 'unknown')

    # Determine extension type for context
    ext_type = "AI/ChatGPT assistant" if any(x in ext_name.lower() for x in ['chatgpt', 'ai', 'gpt', 'claude', 'gemini', 'deepseek']) else "browser extension"

    prompt = f"""# Chrome Extension Security Analysis

You are a security analyst reviewing a Chrome extension. Static analysis has flagged potential patterns.
Your task: Determine if this extension is genuinely malicious based on CONCRETE EVIDENCE, not pattern labels alone.

## Extension: {ext_name} ({ext_id})
## Extension Type: {ext_type}

---

{findings_text}

---

## Files Included ({len(files_sent)} files)
{files_text}

---

## Source Code

```javascript
{code_sample}
```

---

## ANALYSIS METHODOLOGY

> **IMPORTANT: DO NOT BE BIASED BY STATIC ANALYSIS RESULTS**
>
> Static analysis provides pattern LABELS, not verdicts. These labels may be:
> - False positives from framework/library code
> - Legitimate functionality mislabeled as suspicious  
> - Patterns that exist but are never executed
>
> **You must independently validate EACH finding by examining the actual code.**
> Treat static analysis as hints to investigate, NOT as evidence of malicious behavior.
> Your verdict should be based on what the CODE actually does, not what labels suggest.

### Step 1: Understand Static Analysis Limitations

Static analysis generates pattern labels (e.g., `KEYBOARD_LISTENER`, `CREDENTIAL_ACCESS`, `COOKIE_ACCESS`).

**CRITICAL: Pattern labels are NOT proof of malicious behavior.**

These patterns have legitimate uses:
- `KEYBOARD_LISTENER` → UI frameworks use this for accessibility, navigation, shortcuts
- `PASSWORD_SELECTOR` → Form libraries detect input types for styling/validation
- `COOKIE_ACCESS` → Authentication flows require cookie handling
- `DYNAMIC_SCRIPT` → Build tools (webpack, vite, rollup) generate dynamic imports
- `FETCH/XHR` → Extensions need network access for their core functionality

**Your job: Determine if these patterns are used MALICIOUSLY or LEGITIMATELY.**

### Step 2: Identify Production Build Artifacts vs. Malicious Code

Modern extensions use bundlers that produce:
- Minified code (short variable names like `a`, `b`, `t`)
- Large single-file bundles combining multiple libraries
- Dynamic imports and code splitting

**This is NOT obfuscation.** Obfuscation specifically hides malicious intent through:
- String encoding (btoa/atob of URLs or data)
- Character code assembly (`String.fromCharCode(...)` for URLs)
- Hex/unicode escaping of domain names
- Runtime code generation hiding the actual payload

### Step 3: Verify Malicious Behavior with Concrete Evidence

For a **MALICIOUS** verdict, you MUST identify:

**A. Data Exfiltration Chain (all required):**
1. **WHAT data** is collected (specific user data, not just metadata)
2. **HOW it's processed** (encoding, aggregation)
3. **WHERE it's sent** (specific domain, not partial patterns like "beta_")
4. **Show the actual code** connecting these steps

**B. OR Dual-Purpose Functionality:**

> **CRITICAL: Do not rationalize unrelated functionality as legitimate.**
> 
> If an extension's stated purpose is X but contains significant code for unrelated purpose Y, 
> this IS malicious dual-purpose behavior—regardless of explanations like "developer framework,"
> "context-aware," or "legacy code."

**Dual-purpose is MALICIOUS when extension contains undisclosed:**
- E-commerce/affiliate functionality (shopping APIs, marketplace tracking, price monitoring)
- Cryptocurrency operations (wallet detection, mining, transaction monitoring)
- Advertising injection (ad networks, click tracking, banner insertion)
- Social media scraping (profile extraction, connection harvesting)
- Browsing surveillance (history collection, tab monitoring beyond stated purpose)

**How to detect:**
1. Compare extension's stated purpose (from manifest/description) to actual code
2. Identify domains/APIs that don't relate to the extension's core function
3. Look for monetization, tracking, or data collection not disclosed to users
4. Find code that benefits the developer at user's expense without transparency

**Do NOT accept rationalizations such as:**
- "Part of developer's framework" → Unrelated code is still dual-purpose
- "Context-aware features" → Hidden functionality is still hidden
- "Legacy/unused code" → If present and executable, it's active

**C. OR Credential Theft:**
1. **Code that captures** passwords/tokens (not just detects password fields)
2. **Code that transmits** captured credentials externally
3. **The destination** of the stolen data

### Step 4: Domain Analysis

**Legitimate domains (IGNORE):**
- Schema URIs: w3.org, schemas.*, openxmlformats, purl.oclc.org
- CDNs: googleapis.com, gstatic.com, unpkg.com, jsdelivr.net, cdnjs.com
- Development: localhost, 127.0.0.1
- Extension stores: chrome.google.com, chromewebstore.google.com

**Evaluate unknown domains:**
- Is there an ACTUAL fetch/XHR call to this domain with user data?
- Or is it just referenced in comments, links, or documentation?
- Partial URL patterns (e.g., "https://api_", "https://beta_") are NOT valid domains

### Step 5: Classification

**MALICIOUS** - You found concrete evidence:
- Complete exfiltration chain with specific code and destination
- Hidden functionality unrelated to extension purpose
- Active credential theft mechanism
- Actual C2 communication (not just domain references)

**SUSPICIOUS** - Concerning but incomplete evidence:
- Unknown domains without confirmed data transmission
- Excessive permissions without clear abuse
- Patterns that could be malicious but lack destination/exfiltration code

**SAFE** - Extension appears legitimate:
- Patterns are used for legitimate purposes (UI, auth, etc.)
- Network calls match extension's stated purpose
- No hidden functionality

---

## AVOIDING FALSE POSITIVES

**DO NOT mark as MALICIOUS if:**
- Pattern labels exist without evidence of malicious USE
- Code is minified/bundled (normal production build)
- Unknown domain appears only in links, comments, or privacy policy
- Framework code handles keyboard/form events for UI purposes
- Partial URL patterns appear in regex or string templates

**Pattern presence ≠ Malicious intent**

You must trace the complete path from data collection to exfiltration with actual code.

---

## RESPONSE FORMAT

```json
{{{{
    "extension_id": "{ext_id}",
    "verdict": "MALICIOUS|SUSPICIOUS|SAFE|NEED_MORE_FILES",
    "confidence": 0.0-1.0,
    
    "evidence": {{{{
        "exfiltration_chain": {{{{
            "data_collected": "specific data type or null",
            "processing_method": "how data is processed or null", 
            "destination_domain": "specific domain or null",
            "code_evidence": "actual code snippet showing the chain or null"
        }}}},
        "dual_purpose": {{{{
            "stated_purpose": "extension's claimed functionality",
            "hidden_functionality": "unrelated functionality found or null",
            "code_evidence": "code snippet or null"
        }}}},
        "credential_theft": {{{{
            "capture_mechanism": "how credentials are captured or null",
            "transmission_target": "where they are sent or null",
            "code_evidence": "code snippet or null"
        }}}}
    }}}},
    
    "domains": {{{{
        "legitimate": ["expected/safe domains"],
        "requires_investigation": ["unknown domains with actual data transmission"],
        "informational_only": ["domains in links/comments/docs, not actively called"]
    }}}},
    
    "pattern_assessment": [
        {{{{
            "pattern": "pattern label from static analysis",
            "usage": "LEGITIMATE|SUSPICIOUS|MALICIOUS",
            "justification": "why you classified it this way based on actual code"
        }}}}
    ],
    
    "reasoning": "Your analysis connecting evidence to verdict. If MALICIOUS, show the specific code. If SAFE, explain why patterns are benign.",
    "recommendation": "BLOCK|REVIEW|ALLOW",
    "key_concerns": ["only populated for MALICIOUS or SUSPICIOUS verdicts"]
}}}}
```
"""
    return prompt


# ============================================================================
# Batch Job Management
# ============================================================================

def collect_extensions_for_validation(clones_json_path: Path,
                                      skip_already_validated: bool = True,
                                      categories: List[str] = None) -> List[Dict]:
    """Collect extensions from specified categories, skipping only those with completely empty security_risks."""
    with open(clones_json_path, encoding='utf-8') as f:
        data = json.load(f)

    extensions = []

    # Default to malicious_clones and clones only
    if categories is None:
        categories = ['malicious_clones', 'clones']
    
    for category in categories:
        for ext in data.get(category, []):
            static = ext.get('static_analysis', {})
            if not static.get('success'):
                continue

            # Skip if already validated (optional)
            if skip_already_validated and ext.get('gemini_validation'):
                continue

            # NEW LOGIC: Only skip if ALL security_risks are empty
            security_risks = static.get('security_risks', {})
            all_empty = (
                not security_risks.get('CRITICAL', []) and
                not security_risks.get('HIGH', []) and
                not security_risks.get('MEDIUM', []) and
                not security_risks.get('LOW', [])
            )
            
            if all_empty:
                # Skip this extension - no security findings at all
                continue

            extensions.append({
                'id': ext['id'],
                'name': ext.get('name', 'Unknown'),
                'static_analysis': static,
                'category': category,
                # Clone context for pipeline awareness
                'cloned_from': ext.get('cloned_from', ''),
                'cloned_from_id': ext.get('cloned_from_id', ''),
                'relationship': ext.get('relationship', ''),
                'red_flags': ext.get('red_flags', []),
                'icon_similarity': ext.get('icon_similarity', 0),
                'developer': ext.get('developer', 'Unknown'),
                'user_count': ext.get('user_count', 0),
            })

    return extensions


def create_batch_job(args):
    """Create and submit a batch job with detailed logging."""
    client = get_client()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: {input_path} does not exist")
        sys.exit(1)

    dataset_name = input_path.stem  # e.g., "chatgpt_clones"
    logger = ValidationLogger(dataset_name)

    print(f"{'='*60}")
    print(f"GEMINI BATCH VALIDATION - {dataset_name.upper()}")
    print(f"{'='*60}")
    print(f"Input: {input_path}")
    print(f"Models: {' -> '.join(MODEL_FALLBACK_ORDER)}")
    print()

    print("Loading extensions...")
    extensions = collect_extensions_for_validation(input_path, skip_already_validated=not args.force)
    logger.stats['total_extensions'] = len(extensions)
    print(f"Found {len(extensions)} extensions with security findings")

    if not extensions:
        print("No extensions to process")
        return

    # Filter by specific extension IDs if specified
    if hasattr(args, 'ext_ids') and args.ext_ids:
        ext_id_set = set(args.ext_ids)
        extensions = [e for e in extensions if e['id'] in ext_id_set]
        print(f"Filtered to {len(extensions)} extension(s) by --ext-ids: {args.ext_ids}")
        if not extensions:
            print(f"Warning: No extensions matching IDs {args.ext_ids} found in dataset!")
            return

    # Limit batch size if specified
    if args.limit:
        extensions = extensions[:args.limit]
        print(f"Processing first {len(extensions)} extensions (--limit)")

    # Category breakdown
    by_category = defaultdict(int)
    for ext in extensions:
        by_category[ext['category']] += 1
    print("\nBy category:")
    for cat, count in sorted(by_category.items()):
        print(f"  {cat}: {count}")

    # Download code and build requests
    cache_dir = Path(tempfile.gettempdir()) / "gemini_batch_cache"
    cache_dir.mkdir(exist_ok=True)

    print(f"\nDownloading and processing extensions...")
    print("-" * 60)

    batch_requests = []
    extension_order = []  # Track order for results mapping

    for i, ext in enumerate(extensions, 1):
        ext_id = ext['id']
        ext_name = ext['name'][:40]
        # Sanitize name for console output (remove non-ASCII chars)
        safe_name = ext_name.encode('ascii', 'ignore').decode('ascii')
        print(f"[{i}/{len(extensions)}] {safe_name}... ", end="", flush=True)

        # User Filtering Logic:
        # 1. Skip if LEGITIMATE and NO security risks
        # 2. Process if MALICIOUS_CLONE / CLONE
        # 3. Process if security_risks > 0
        
        relationship = ext.get('relationship', 'UNKNOWN')
        security_risks = ext.get('static_analysis', {}).get('security_risks', {})
        
        has_risks = False
        for severity in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
            if security_risks.get(severity, []):
                has_risks = True
                break
        
        is_clone_related = relationship in ['CLONE', 'MALICIOUS_CLONE', 'Brand Impersonation']
        
        # STRICT RULE: If legitimate, SKIP (even if it has risks)
        if relationship == 'LEGITIMATE':
             print(f"SKIP (Legitimate)")
             logger.log_extension(ext_id, ext_name, ext.get('static_analysis', {}), [], [], 0, 'skipped_legitimate')
             continue

        # If not clone related AND no risks -> SKIP 
        # (This covers UNKNOWN or other categories that have no findings)
        if not is_clone_related and not has_risks:
             print(f"SKIP (No Risks & Not Clone)")
             logger.log_extension(ext_id, ext_name, ext.get('static_analysis', {}), [], [], 0, 'skipped_no_risk')
             continue

        code_sample, files_sent, raw_findings, files_from_analysis = download_extension_code(
            ext_id, ext['static_analysis'], cache_dir
        )

        if not code_sample:
            print("SKIP (download failed)")
            logger.log_extension(ext_id, ext_name, ext['static_analysis'],
                               [], [], 0, 'download_failed')
            continue

        prompt = build_validation_prompt(
            ext['name'],
            ext_id,
            raw_findings,
            code_sample,
            files_sent,
            clone_context={
                'category': ext.get('category', ''),
                'cloned_from': ext.get('cloned_from', ''),
                'relationship': ext.get('relationship', ''),
                'red_flags': ext.get('red_flags', []),
                'icon_similarity': ext.get('icon_similarity', 0),
                'developer': ext.get('developer', 'Unknown'),
                'user_count': ext.get('user_count', 0),
            }
        )

        # Debug: Save prompts and data for inspection
        if getattr(args, 'debug', False):
            debug_dir = Path("output") / "debug_prompts" / dataset_name
            debug_dir.mkdir(parents=True, exist_ok=True)
            debug_file = debug_dir / f"{ext_id}_prompt.md"
            with open(debug_file, 'w', encoding='utf-8') as dbg:
                dbg.write(f"# Debug Info for {ext_id}\n\n")
                dbg.write(f"## Extension Info\n")
                dbg.write(f"- **Name**: {ext['name']}\n")
                dbg.write(f"- **ID**: {ext_id}\n")
                dbg.write(f"- **Category**: {ext.get('category', 'unknown')}\n")
                dbg.write(f"- **Files Sent**: {len(files_sent)}\n")
                dbg.write(f"- **Raw Findings**: {len(raw_findings)}\n")
                dbg.write(f"- **Code Sample Length**: {len(code_sample)} chars\n\n")
                dbg.write(f"## Files Included\n")
                for f in files_sent:
                    dbg.write(f"- {f}\n")
                dbg.write(f"\n## Raw Findings\n")
                dbg.write(f"```json\n{json.dumps(raw_findings, indent=2)}\n```\n\n")
                dbg.write(f"## Full Prompt\n")
                dbg.write(f"```\n{prompt}\n```\n")
            print(f"[DEBUG saved to {debug_file}]... ", end="")

        batch_requests.append({
            'contents': [{
                'parts': [{'text': prompt}],
                'role': 'user'
            }],
            'config': {
                'response_mime_type': 'application/json',
            }
        })
        extension_order.append(ext_id)

        # Extract domains from raw findings for logging
        endpoint_findings = [f for f in raw_findings if f.get('what') == 'NETWORK_ENDPOINT']
        logger.log_extension(ext_id, ext_name, ext['static_analysis'],
                           files_sent, [f.get('url', '')[:50] for f in endpoint_findings[:5]], 0, 'processed')

        print(f"OK ({len(files_sent)} files, {len(raw_findings)} findings)")

    print("-" * 60)
    print(f"\nProcessed: {len(batch_requests)}/{len(extensions)} extensions")
    print(f"Skipped: {logger.stats['download_failures']} (download failures)")

    if not batch_requests:
        print("No valid requests to submit!")
        return

    # Save log before submitting
    log_path = logger.save()
    print(f"\nPre-validation log saved: {log_path}")

    print(f"\nCreating batch job with {len(batch_requests)} requests...")

    # Split into chunks if batch_size specified
    batch_size = getattr(args, 'batch_size', None)
    if batch_size and len(batch_requests) > batch_size:
        # Split into multiple batches
        num_batches = (len(batch_requests) + batch_size - 1) // batch_size
        print(f"Splitting into {num_batches} batches of ~{batch_size} each...")
        print(f"Model fallback order: {' -> '.join(MODEL_FALLBACK_ORDER)}")

        created_jobs = []
        current_model_idx = 0  # Start with first model in fallback order

        for i in range(0, len(batch_requests), batch_size):
            chunk = batch_requests[i:i + batch_size]
            chunk_ids = extension_order[i:i + batch_size]  # Get corresponding extension IDs
            chunk_num = i // batch_size + 1

            batch_job = None

            # Try each model in fallback order starting from current_model_idx
            for model_idx in range(current_model_idx, len(MODEL_FALLBACK_ORDER)):
                current_model = MODEL_FALLBACK_ORDER[model_idx]
                print(f"  Creating batch {chunk_num}/{num_batches} ({len(chunk)} requests) with {current_model}...")

                try:
                    batch_job = client.batches.create(
                        model=current_model,
                        src=chunk,
                        config={
                            'display_name': f"validation-{dataset_name}-part{chunk_num}-{datetime.now().strftime('%Y%m%d_%H%M')}",
                        },
                    )
                    created_jobs.append((batch_job.name, current_model))
                    current_model_idx = model_idx  # Remember working model for next batch
                    print(f"    [OK] Created: {batch_job.name}")
                    break  # Success, exit model fallback loop

                except Exception as e:
                    error_str = str(e)
                    if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
                        print(f"    [RATE LIMITED] {current_model} quota exhausted")
                        if model_idx < len(MODEL_FALLBACK_ORDER) - 1:
                            print(f"    Trying next model: {MODEL_FALLBACK_ORDER[model_idx + 1]}")
                            continue  # Try next model
                        else:
                            print(f"    [FAIL] All models exhausted!")
                    else:
                        print(f"    [FAIL] Error: {e}")

                    # If we're on the last model and it failed, stop everything
                    # If we're on the last model and it failed, check for fallback options
                    if model_idx == len(MODEL_FALLBACK_ORDER) - 1:
                        
                        # FALLBACK: If batch size > 5, try splitting into halves
                        fallback_success = False
                        if len(chunk) > 5:
                            print(f"\n    [FALLBACK] Attempting to split failed batch of {len(chunk)} into smaller chunks...")
                            mid = len(chunk) // 2
                            sub_chunks = [chunk[:mid], chunk[mid:]]
                            all_subs_ok = True
                            
                            for i, sub in enumerate(sub_chunks):
                                # Try to create each sub-batch with all models
                                sub_created = False
                                for m_name in MODEL_FALLBACK_ORDER:
                                    try:
                                        print(f"      > Sub-batch {i+1}/2 ({len(sub)} reqs) using {m_name}...")
                                        sub_job = client.batches.create(
                                            model=m_name,
                                            src=sub,
                                            config={'display_name': f"val-{dataset_name}-p{chunk_num}s{i}-{datetime.now().strftime('%M%S')}"}
                                        )
                                        print(f"      [OK] Created sub-batch: {sub_job.name}")
                                        created_jobs.append((sub_job.name, m_name))
                                        sub_created = True
                                        break
                                    except Exception as sub_e:
                                        print(f"      [FAIL] {m_name}: {sub_e}")
                                
                                if not sub_created:
                                    all_subs_ok = False
                                    print(f"      [CRITICAL] Could not create sub-batch {i+1} even after splitting.")
                            
                            if all_subs_ok:
                                fallback_success = True
                                break # Exit model loop as we handled this chunk via fallback

                        if not fallback_success:
                            print(f"\n{'='*60}")
                            print("STOPPING: All models exhausted or failed.")
                            print(f"Successfully created {len(created_jobs)} batch(es) before failure.")
                            print(f"{'='*60}")
                            if created_jobs:
                                print("\nAlready created batches:")
                                for job, model in created_jobs:
                                    print(f"  {job} ({model})")
                            return

            # Save metadata for this batch chunk (so we can map extension IDs when retrieving)
            if batch_job:
                used_model = MODEL_FALLBACK_ORDER[current_model_idx]
                job_meta = {
                    'job_name': batch_job.name,
                    'dataset': dataset_name,
                    'input_file': str(input_path),
                    'extension_ids': chunk_ids,
                    'extension_count': len(chunk_ids),
                    'batch_part': chunk_num,
                    'total_batches': num_batches,
                    'created_at': datetime.now().isoformat(),
                    'log_file': str(log_path),
                    'model': used_model,
                }
                
                # Save to experiments/chatgpt/batches/
                batches_dir = input_path.parent / "batches"
                batches_dir.mkdir(parents=True, exist_ok=True)
                meta_path = batches_dir / f"batch_job_{batch_job.name.replace('/', '_')}.json"
                
                with open(meta_path, 'w') as f:
                    json.dump(job_meta, f, indent=2)
                print(f"    Metadata saved: {meta_path}")
        
        print(f"\n{'='*60}")
        print(f"CREATED {len(created_jobs)} BATCH JOBS")
        print(f"{'='*60}")
        for job, model in created_jobs:
            print(f"  {job} ({model})")
        print(f"\nTo check status of all:")
        for job, model in created_jobs:
            print(f"  python validate_batch_gemini.py status --job {job}")
        return

  
    batch_job = None
    used_model = None
    for model in MODEL_FALLBACK_ORDER:
        try:
            batch_job = client.batches.create(
                model=model,
                src=batch_requests,
                config={
                    'display_name': f"validation-{dataset_name}-{datetime.now().strftime('%Y%m%d_%H%M')}",
                },
            )
            used_model = model
            break
        except Exception as e:
            if '429' in str(e) or 'RESOURCE_EXHAUSTED' in str(e):
                print(f"[RATE LIMITED] {model} - trying next...")
                continue
            raise

    if not batch_job:
        print("ERROR: All models exhausted!")
        return

    print(f"\n{'='*60}")
    print(f"BATCH JOB CREATED: {batch_job.name}")
    print(f"{'='*60}")
    print(f"\nTo check status:")
    print(f"  python validate_batch_gemini.py status --job {batch_job.name}")
    print(f"\nTo retrieve results:")
    print(f"  python validate_batch_gemini.py results --job {batch_job.name} --output output/{dataset_name}_batch_validated.json")

    # Save job metadata
    job_meta = {
        'job_name': batch_job.name,
        'dataset': dataset_name,
        'input_file': str(input_path),
        'extension_ids': extension_order,
        'extension_count': len(extension_order),
        'created_at': datetime.now().isoformat(),
        'log_file': str(log_path),
        'model': used_model,
    }

    # Save to experiments/chatgpt/batches/
    batches_dir = input_path.parent / "batches"
    batches_dir.mkdir(parents=True, exist_ok=True)
    meta_path = batches_dir / f"batch_job_{batch_job.name.replace('/', '_')}.json"

    with open(meta_path, 'w') as f:
        json.dump(job_meta, f, indent=2)
    print(f"\nJob metadata saved: {meta_path}")

    # Print stats summary
    print(f"\n{'='*60}")
    print("STATS SUMMARY (for thesis)")
    print(f"{'='*60}")
    print(f"Total extensions with findings: {logger.stats['total_extensions']}")
    print(f"Extensions processed: {logger.stats['extensions_processed']}")
    print(f"Total CRITICAL findings: {logger.stats['static_analysis_stats']['total_critical_findings']}")
    print(f"Total HIGH findings: {logger.stats['static_analysis_stats']['total_high_findings']}")
    print(f"Extensions with suspicious domains: {logger.stats['domain_stats']['extensions_with_suspicious_domains']}")
    print(f"Unique suspicious domains: {len(logger.stats['domain_stats']['unique_suspicious_domains'])}")
    print(f"Files boosted by domain presence: {logger.stats['file_selection_stats']['files_boosted_by_domain']}")


def check_status(args):
    """Check batch job status."""
    client = get_client()

    batch_job = client.batches.get(name=args.job)

    print(f"{'='*60}")
    print(f"BATCH JOB STATUS")
    print(f"{'='*60}")
    print(f"Job: {batch_job.name}")
    print(f"Display Name: {batch_job.display_name}")
    print(f"State: {batch_job.state.name}")

    if hasattr(batch_job, 'batch_stats') and batch_job.batch_stats:
        stats = batch_job.batch_stats
        print(f"\nProgress:")
        print(f"  Total requests: {getattr(stats, 'total_request_count', 'N/A')}")
        print(f"  Succeeded: {getattr(stats, 'succeeded_request_count', 'N/A')}")
        print(f"  Failed: {getattr(stats, 'failed_request_count', 'N/A')}")

    if batch_job.state.name == 'JOB_STATE_SUCCEEDED':
        print("\n[OK] Job completed! Run 'results' command to retrieve.")
    elif batch_job.state.name == 'JOB_STATE_FAILED':
        print(f"\n[FAILED] Job failed: {batch_job.error}")
    elif batch_job.state.name in ['JOB_STATE_PENDING', 'JOB_STATE_RUNNING']:
        print("\n[...] Job still processing...")


def retrieve_results(args):
    """Retrieve and process batch results with detailed stats."""
    client = get_client()

    batch_job = client.batches.get(name=args.job)

    if batch_job.state.name != 'JOB_STATE_SUCCEEDED':
        print(f"Job not complete. Current state: {batch_job.state.name}")
        return

    print(f"{'='*60}")
    print(f"RETRIEVING BATCH RESULTS")
    print(f"{'='*60}")
    print(f"Job: {batch_job.name}")

    # Load job metadata
    meta_filename = f"batch_job_{args.job.replace('/', '_')}.json"
    potential_paths = [
        Path(meta_filename),
        Path("output/batch_validation") / meta_filename,
        Path("experiments/chatgpt/batches") / meta_filename,
    ]
    meta_path = None
    for p in potential_paths:
        if p.exists():
            meta_path = p
            break

    if meta_path and meta_path.exists():
        with open(meta_path, encoding='utf-8') as f:
            job_meta = json.load(f)
        extension_ids = job_meta.get('extension_ids', [])
        dataset_name = job_meta.get('dataset', 'unknown')
        log_file = job_meta.get('log_file')
    else:
        extension_ids = []
        dataset_name = 'unknown'
        log_file = None
        print("Warning: Job metadata not found")

    # Load pre-validation log for stats comparison
    pre_stats = {}
    if log_file and Path(log_file).exists():
        with open(log_file, encoding='utf-8') as f:
            pre_stats = json.load(f)

    results = {
        'job_name': args.job,
        'dataset': dataset_name,
        'retrieved_at': datetime.now().isoformat(),
        'validations': [],
        'summary': {
            'MALICIOUS': 0,
            'SUSPICIOUS': 0,
            'SAFE': 0,
            'NEED_MORE_FILES': 0,
            'ERROR': 0
        },
        'detailed_stats': {
            'high_risk_validated_malicious': 0,
            'high_risk_validated_suspicious': 0,
            'high_risk_validated_safe': 0,  # False positives from static analysis!
            'need_more_files_extensions': [],
        }
    }

    # Initialize token stats
    token_stats = {
        'prompt_tokens': 0,
        'candidate_tokens': 0,
        'total_tokens': 0
    }

    # Process responses
    if batch_job.dest and batch_job.dest.inlined_responses:
        for i, inline_response in enumerate(batch_job.dest.inlined_responses):
            # Default fallback ID (will be overwritten if response contains extension_id)
            fallback_ext_id = extension_ids[i] if i < len(extension_ids) else f"unknown-{i}"

            if inline_response.response:
                try:
                    verdict_data = json.loads(inline_response.response.text)
                    
                    # Handle if model returned a list [ { ... } ]
                    if isinstance(verdict_data, list):
                        if len(verdict_data) > 0:
                            verdict_data = verdict_data[0]
                        else:
                            verdict_data = {}

                    verdict = verdict_data.get('verdict', 'UNKNOWN')
                    
                    # CRITICAL FIX: Get extension_id from response (not index)
                    # The model includes extension_id in its JSON response
                    ext_id = verdict_data.get('extension_id') or fallback_ext_id

                    entry = {
                        'extension_id': ext_id,
                        'verdict': verdict,
                        'confidence': verdict_data.get('confidence', 0),
                        'reasoning': verdict_data.get('reasoning', ''),
                        'recommendation': verdict_data.get('recommendation', ''),
                        'key_concerns': verdict_data.get('key_concerns', []),
                        # v3 fields
                        'evidence': verdict_data.get('evidence', {}),
                        'domains': verdict_data.get('domains', verdict_data.get('domains_analysis', {})),
                        'pattern_assessment': verdict_data.get('pattern_assessment', verdict_data.get('findings_analysis', [])),
                    }
                
                    # Track token usage
                    if hasattr(inline_response.response, 'usage_metadata'):
                        usage = inline_response.response.usage_metadata
                        token_stats['prompt_tokens'] += usage.prompt_token_count
                        token_stats['candidate_tokens'] += usage.candidates_token_count
                        token_stats['total_tokens'] += usage.total_token_count
                        # Add per-extension token usage
                        entry['token_usage'] = {
                            'prompt': usage.prompt_token_count,
                            'candidates': usage.candidates_token_count,
                            'total': usage.total_token_count
                        }

                    if verdict == 'NEED_MORE_FILES':
                        entry['missing_files'] = verdict_data.get('missing_files', [])
                        results['detailed_stats']['need_more_files_extensions'].append({
                            'id': ext_id,
                            'missing': verdict_data.get('missing_files', [])
                        })

                    results['validations'].append(entry)

                    if verdict in results['summary']:
                        results['summary'][verdict] += 1

                    # Track for false positive analysis
                    if verdict == 'SAFE':
                        results['detailed_stats']['high_risk_validated_safe'] += 1
                    elif verdict == 'MALICIOUS':
                        results['detailed_stats']['high_risk_validated_malicious'] += 1
                    elif verdict == 'SUSPICIOUS':
                        results['detailed_stats']['high_risk_validated_suspicious'] += 1

                except Exception as e:
                    results['validations'].append({
                        'extension_id': fallback_ext_id,
                        'verdict': 'ERROR',
                        'error': str(e)
                    })
                    results['summary']['ERROR'] += 1

            elif inline_response.error:
                results['validations'].append({
                    'extension_id': fallback_ext_id,
                    'verdict': 'ERROR',
                    'error': str(inline_response.error)
                })
                results['summary']['ERROR'] += 1

    # Add pre-validation stats for comparison
    if pre_stats:
        results['pre_validation_stats'] = {
            'total_critical_findings': pre_stats.get('static_analysis_stats', {}).get('total_critical_findings', 0),
            'total_high_findings': pre_stats.get('static_analysis_stats', {}).get('total_high_findings', 0),
            'extensions_with_suspicious_domains': pre_stats.get('domain_stats', {}).get('extensions_with_suspicious_domains', 0),
        }

    # Calculate thesis-relevant stats
    total_validated = results['summary']['MALICIOUS'] + results['summary']['SUSPICIOUS'] + results['summary']['SAFE']
    if total_validated > 0:
        results['thesis_stats'] = {
            'false_positive_rate': results['detailed_stats']['high_risk_validated_safe'] / total_validated,
            'true_positive_rate': (results['summary']['MALICIOUS'] + results['summary']['SUSPICIOUS']) / total_validated,
            'malicious_detection_rate': results['summary']['MALICIOUS'] / total_validated,
        }

    # Add token usage metrics
    results['token_usage'] = token_stats


    # Save results
    output_path = Path(args.output)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    # Print summary
    print(f"\n{'='*60}")
    print("VALIDATION RESULTS SUMMARY")
    print(f"{'='*60}")
    print(f"\nVerdicts:")
    print(f"  MALICIOUS:       {results['summary']['MALICIOUS']}")
    print(f"  SUSPICIOUS:      {results['summary']['SUSPICIOUS']}")
    print(f"  SAFE:            {results['summary']['SAFE']}")
    print(f"  NEED_MORE_FILES: {results['summary']['NEED_MORE_FILES']}")
    print(f"  Errors:          {results['summary']['ERROR']}")

    print(f"\n{'='*60}")
    print("THESIS STATISTICS")
    print(f"{'='*60}")
    print(f"Extensions with HIGH static analysis risk: {total_validated}")
    print(f"Validated as truly MALICIOUS: {results['summary']['MALICIOUS']}")
    print(f"Validated as SUSPICIOUS: {results['summary']['SUSPICIOUS']}")
    print(f"FALSE POSITIVES (high risk but SAFE): {results['detailed_stats']['high_risk_validated_safe']}")

    if 'thesis_stats' in results:
        print(f"\nRates:")
        print(f"  False Positive Rate: {results['thesis_stats']['false_positive_rate']:.1%}")
        print(f"  True Positive Rate: {results['thesis_stats']['true_positive_rate']:.1%}")
        print(f"  Malicious Detection Rate: {results['thesis_stats']['malicious_detection_rate']:.1%}")

    print(f"\nResults saved: {output_path}")

    if results['detailed_stats']['need_more_files_extensions']:
        print(f"\n{len(results['detailed_stats']['need_more_files_extensions'])} extensions need rescan:")
        for item in results['detailed_stats']['need_more_files_extensions'][:5]:
            print(f"  - {item['id']}: {', '.join(item['missing'][:3])}")


def main():
    parser = argparse.ArgumentParser(
        description="Gemini Batch API validation with C2 warnings and detailed logging"
    )
    subparsers = parser.add_subparsers(dest='command', required=True)

    # Create command
    create_parser = subparsers.add_parser('create', help='Create a new batch job')
    create_parser.add_argument('--input', '-i', required=True, help='Path to *_clones.json file')
    create_parser.add_argument('--limit', '-l', type=int, help='Limit number of extensions')
    create_parser.add_argument('--force', '-f', action='store_true', help='Revalidate even if already done')
    create_parser.add_argument('--batch-size', '-b', type=int, default=5,
                               help='Max extensions per batch job (default: 5, to stay within token limits)')
    create_parser.add_argument('--debug', '-d', action='store_true',
                               help='Save prompts to debug directory for inspection')
    create_parser.add_argument('--ext-ids', '-e', nargs='+',
                               help='Only process specific extension IDs (space-separated)')

    # Status command
    status_parser = subparsers.add_parser('status', help='Check batch job status')
    status_parser.add_argument('--job', '-j', required=True, help='Batch job name')

    # Results command
    results_parser = subparsers.add_parser('results', help='Retrieve batch results')
    results_parser.add_argument('--job', '-j', required=True, help='Batch job name')
    results_parser.add_argument('--output', '-o', required=True, help='Output JSON file')

    args = parser.parse_args()

    if args.command == 'create':
        create_batch_job(args)
    elif args.command == 'status':
        check_status(args)
    elif args.command == 'results':
        retrieve_results(args)


if __name__ == "__main__":
    main()
