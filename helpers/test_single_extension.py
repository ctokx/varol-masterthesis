#!/usr/bin/env python3
"""
Test validation on a single extension - sends ALL JS files to Gemini.

This fixes the issue where malicious code (like captaina.co exfiltration)
was missed because the file wasn't flagged by static analysis.

Usage:
    python test_single_extension.py becfinhbfclcgokjlobojlnldbfillpf
"""

import os
import sys
import json
import tempfile
import zipfile
import requests
from pathlib import Path
from datetime import datetime
import jsbeautifier

from google import genai
from google.genai import types


MODEL = "gemini-2.5-flash"  
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
CRX_URL_TEMPLATE = "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0&acceptformat=crx2,crx3&x=id%3D{extension_id}%26uc"


def get_client():
    """Get Gemini client."""
    return genai.Client(api_key=GEMINI_API_KEY)


def beautify_js(content: str) -> str:
    """Beautify JavaScript code for readability."""
    try:
        opts = jsbeautifier.default_options()
        opts.indent_size = 2
        opts.max_preserve_newlines = 2
        return jsbeautifier.beautify(content, opts)
    except:
        return content


def download_extension(ext_id: str, cache_dir: Path) -> Path:
    """Download and extract extension."""
    extract_dir = cache_dir / ext_id

    if extract_dir.exists():
        print(f"Using cached extension: {extract_dir}")
        return extract_dir

    print(f"Downloading extension {ext_id}...")
    extract_dir.mkdir(parents=True, exist_ok=True)

    url = CRX_URL_TEMPLATE.format(extension_id=ext_id)
    response = requests.get(url, allow_redirects=True, timeout=60)

    if response.status_code != 200 or len(response.content) < 1000:
        raise Exception(f"Failed to download extension: {response.status_code}")

    crx_data = response.content
    zip_start = crx_data.find(b'PK\x03\x04')
    if zip_start == -1:
        raise Exception("Invalid CRX format")

    zip_path = cache_dir / f"{ext_id}.zip"
    with open(zip_path, 'wb') as f:
        f.write(crx_data[zip_start:])

    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(extract_dir)

    os.unlink(zip_path)
    print(f"Extracted to: {extract_dir}")
    return extract_dir


def collect_all_js_files(extract_dir: Path, max_total_chars: int = 500000) -> tuple[str, list[str]]:
    """
    Collect ALL JS files from extension, not just flagged ones.
    Returns (combined_code, list_of_files).
    """
    code_parts = []
    files_included = []
    current_chars = 0

    # 1. Always include manifest first
    manifest_path = extract_dir / "manifest.json"
    if manifest_path.exists():
        content = manifest_path.read_text(encoding='utf-8', errors='ignore')
        code_parts.append(f"=== manifest.json ===\n{content}")
        files_included.append("manifest.json")
        current_chars += len(content)

    # 2. Collect all JS files with their sizes
    js_files = []
    for js_file in extract_dir.rglob("*.js"):
        try:
            size = js_file.stat().st_size
            rel_path = js_file.relative_to(extract_dir)
            js_files.append((js_file, str(rel_path), size))
        except:
            continue

    # Sort by size (larger files often contain more functionality)
    js_files.sort(key=lambda x: x[2], reverse=True)

    print(f"\nFound {len(js_files)} JS files")

    # 3. Include files prioritizing larger ones
    for js_file, rel_path, size in js_files:
        if current_chars >= max_total_chars:
            break

        # Skip very large library files
        if size > 1_000_000:  # Skip files > 1MB
            print(f"  Skipping large file: {rel_path} ({size:,} bytes)")
            continue

        try:
            content = js_file.read_text(encoding='utf-8', errors='ignore')

            # Beautify for readability
            if len(content) < 100_000:  # Only beautify smaller files
                content = beautify_js(content)

            # Truncate if still too large
            if len(content) > 50_000:
                content = content[:50_000] + "\n... [TRUNCATED] ..."

            code_parts.append(f"\n\n=== {rel_path} ({size:,} bytes) ===\n{content}")
            files_included.append(rel_path)
            current_chars += len(content)

        except Exception as e:
            print(f"  Error reading {rel_path}: {e}")
            continue

    print(f"Included {len(files_included)} files ({current_chars:,} chars)")
    return '\n'.join(code_parts), files_included


def build_comprehensive_prompt(ext_name: str, ext_id: str, code_sample: str, files_included: list[str]) -> str:
    """
    Build a comprehensive prompt that doesn't rely on static analysis pre-classification.
    """
    files_list = '\n'.join(f"- {f}" for f in files_included[:30])

    prompt = f"""# CRITICAL: Chrome Extension Deep Security Analysis

You are analyzing a Chrome extension that claims to be a ChatGPT/AI assistant.
**YOUR TASK:** Find ANY evidence of malicious behavior, data exfiltration, or undisclosed functionality.

## Extension: {ext_name} ({ext_id})

## Files Included for Review
{files_list}
{"..." if len(files_included) > 30 else ""}

---

## WHAT TO LOOK FOR (Critical Detection Requirements)

### 1. UNDISCLOSED THIRD-PARTY SERVERS (Highest Priority)
- Look for ANY domains/URLs that are NOT directly related to the extension's stated purpose
- A ChatGPT extension should ONLY connect to: openai.com, anthropic.com, google.com (for Gemini), etc.
- **RED FLAGS:**
  - Unknown domains (e.g., captaina.co, random vercel apps, tracking services)
  - Crawling/scraping APIs
  - Data collection endpoints
  - Analytics beyond standard Google Analytics

### 2. DATA EXFILTRATION PATTERNS
- `sendBeacon()` or `fetch()` to suspicious endpoints
- Screen capture (`captureVisibleTab`, canvas capture)
- Cookie access + sending to remote servers
- Form data collection from other websites
- Clipboard monitoring

### 3. E-COMMERCE/AFFILIATE TRACKING
- Amazon marketplace IDs or tracking codes
- Shopping site monitoring
- Price tracking to unknown servers
- Affiliate link injection

### 4. HIDDEN FUNCTIONALITY
- Code that doesn't match the extension's stated purpose
- Obfuscated function names with data collection
- Undocumented API endpoints
- Persistent unique identifiers (UUID tracking)

---

## EXTENSION SOURCE CODE

```javascript
{code_sample}
```

---

## YOUR ANALYSIS TASK

1. **Search the entire code** for:
   - All URLs and domains (look for strings containing "http", ".com", ".co", ".io")
   - All fetch/XHR/beacon calls
   - Any data collection patterns
   - Screen/tab capture functionality

2. **For EACH domain/URL found, classify:**
   - Is it LEGITIMATE (known service related to stated purpose)?
   - Is it SUSPICIOUS (tracking, analytics, unknown)?
   - Is it MALICIOUS (undisclosed data collection, exfiltration)?

3. **Look for Amazon/e-commerce tracking:**
   - Search for "amazon", "marketplace", "affiliate"
   - This would be SUSPICIOUS in a ChatGPT extension

4. **Verdict based on findings:**
   - **MALICIOUS:** Evidence of undisclosed data exfiltration or deceptive behavior
   - **SUSPICIOUS:** Concerning patterns that need review (unknown domains, tracking)
   - **SAFE:** Only connects to expected services, no hidden functionality

---

## RESPONSE FORMAT

```json
{{
    "verdict": "MALICIOUS|SUSPICIOUS|SAFE",
    "confidence": 0.0-1.0,

    "all_domains_found": [
        {{"domain": "example.com", "purpose": "what it's used for", "verdict": "LEGITIMATE|SUSPICIOUS|MALICIOUS"}}
    ],

    "critical_findings": [
        {{"finding": "description", "file": "filename.js", "severity": "CRITICAL|HIGH|MEDIUM", "evidence": "code snippet"}}
    ],

    "data_collection_detected": {{
        "screen_capture": true/false,
        "cookie_access": true/false,
        "form_monitoring": true/false,
        "keyboard_logging": true/false,
        "shopping_tracking": true/false,
        "uuid_tracking": true/false
    }},

    "reasoning": "Detailed explanation of your verdict with specific code references",
    "recommendation": "BLOCK|REVIEW|ALLOW"
}}
```

**IMPORTANT:** Be thorough. If you find ANY undisclosed domain or data collection that doesn't match the extension's stated purpose (AI chat assistant), it should be flagged as SUSPICIOUS or MALICIOUS.
"""
    return prompt


def validate_extension(ext_id: str, ext_name: str = "Unknown"):
    """Validate a single extension by sending all its code to Gemini."""

    # Use existing cache if available
    cache_dirs = [
        Path("C:/Users/varol/cws_clone_detector/output/crx_cache_revalidation"),
        Path(tempfile.gettempdir()) / "gemini_batch_cache"
    ]

    extract_dir = None
    for cache_dir in cache_dirs:
        potential_dir = cache_dir / ext_id
        if potential_dir.exists():
            extract_dir = potential_dir
            print(f"Found cached extension: {extract_dir}")
            break

    if not extract_dir:
        cache_dir = cache_dirs[0]
        cache_dir.mkdir(parents=True, exist_ok=True)
        extract_dir = download_extension(ext_id, cache_dir)

    # Collect ALL JS files
    code_sample, files_included = collect_all_js_files(extract_dir)

    # Build prompt
    prompt = build_comprehensive_prompt(ext_name, ext_id, code_sample, files_included)

    print(f"\nPrompt size: {len(prompt):,} characters")
    print(f"Sending to Gemini ({MODEL})...")

    # Call Gemini
    client = get_client()

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.1,  # Low temperature for consistent analysis
        )
    )

    # Parse response
    try:
        result = json.loads(response.text)
    except:
        result = {"raw_response": response.text, "parse_error": True}

    # Save result
    output_path = Path(f"C:/Users/varol/cws_clone_detector/output/{ext_id}_validated.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            "extension_id": ext_id,
            "extension_name": ext_name,
            "validated_at": datetime.now().isoformat(),
            "model": MODEL,
            "files_analyzed": len(files_included),
            "prompt_size": len(prompt),
            "result": result
        }, f, indent=2, ensure_ascii=False)

    print(f"\nResult saved to: {output_path}")

    # Print summary
    print("\n" + "="*60)
    print("VALIDATION RESULT")
    print("="*60)

    if isinstance(result, dict) and 'verdict' in result:
        print(f"Verdict: {result.get('verdict', 'UNKNOWN')}")
        print(f"Confidence: {result.get('confidence', 0)}")
        print(f"Recommendation: {result.get('recommendation', 'UNKNOWN')}")

        if result.get('critical_findings'):
            print("\nCritical Findings:")
            for finding in result['critical_findings'][:5]:
                print(f"  - {finding.get('finding', 'N/A')} [{finding.get('severity', 'N/A')}]")

        if result.get('all_domains_found'):
            print("\nDomains Found:")
            for domain in result['all_domains_found'][:10]:
                verdict = domain.get('verdict', 'UNKNOWN')
                marker = "🔴" if verdict == "MALICIOUS" else "🟡" if verdict == "SUSPICIOUS" else "🟢"
                print(f"  {marker} {domain.get('domain', 'N/A')} - {domain.get('purpose', 'N/A')}")

        if result.get('reasoning'):
            print(f"\nReasoning: {result['reasoning'][:500]}...")
    else:
        print("Could not parse response. Check output file for raw response.")

    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_single_extension.py <extension_id> [extension_name]")
        print("\nExample:")
        print("  python test_single_extension.py becfinhbfclcgokjlobojlnldbfillpf 'AITOPIA'")
        sys.exit(1)

    ext_id = sys.argv[1]
    ext_name = sys.argv[2] if len(sys.argv) > 2 else "Unknown Extension"

    print(f"Testing extension: {ext_id}")
    print(f"Name: {ext_name}")
    print("="*60)

    result = validate_extension(ext_id, ext_name)

    # Return exit code based on verdict
    if isinstance(result, dict):
        verdict = result.get('verdict', '').upper()
        if verdict == 'MALICIOUS':
            sys.exit(1)
        elif verdict == 'SUSPICIOUS':
            sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
