#!/usr/bin/env python
"""Test the new capabilities format - output to JSON for clean comparison."""
import sys
sys.path.insert(0, 'staticanalysis')

from run_analysis import analyze_extension
import json
import requests
import zipfile
import io
import tempfile
from pathlib import Path
import os

# Suppress stdout during CodeQL
class SuppressOutput:
    def __enter__(self):
        self._original_stdout = sys.stdout
        sys.stdout = open(os.devnull, 'w')
        return self
    def __exit__(self, *args):
        sys.stdout.close()
        sys.stdout = self._original_stdout

ext_id = "ighcgnijpnfppnggmjcpgbphjmlomcpo"

print(f"Downloading {ext_id}...", file=sys.stderr)
url = f"https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0&acceptformat=crx2,crx3&x=id%3D{ext_id}%26uc"
response = requests.get(url)

print("Extracting...", file=sys.stderr)
content = response.content
zip_start = content.find(b'PK\x03\x04')
temp_dir = Path(tempfile.mkdtemp()) / ext_id
temp_dir.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(io.BytesIO(content[zip_start:])) as z:
    z.extractall(temp_dir)

print("Running CodeQL (this takes ~30s)...", file=sys.stderr)
with SuppressOutput():
    results = analyze_extension(str(temp_dir), cleanup=True)

# Save results to JSON
output = {
    "extension_id": ext_id,
    "capabilities": results.get('capabilities', {}),
    "security_risks": results.get('security_risks', {})
}

with open('test_output.json', 'w') as f:
    json.dump(output, f, indent=2)

print("Done! Results saved to test_output.json", file=sys.stderr)
