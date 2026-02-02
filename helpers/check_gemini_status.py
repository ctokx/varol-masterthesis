#!/usr/bin/env python3
"""Check Gemini batch status and test model availability."""

import os
import google.genai as genai

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

print("=" * 60)
print("GEMINI BATCH STATUS CHECK")
print("=" * 60)

# 1. List existing batch jobs
print("\n1. Existing Batch Jobs:")
print("-" * 40)
try:
    batches = list(client.batches.list())
    if batches:
        for batch in batches:
            print(f"  ID: {batch.name}")
            print(f"    State: {batch.state}")
            print(f"    Model: {getattr(batch, 'model', 'N/A')}")
            print()
    else:
        print("  No batch jobs found")
except Exception as e:
    print(f"  Error listing batches: {e}")

# 2. Test Gemini 3 Pro Preview
print("\n2. Testing Gemini 3 Pro Preview:")
print("-" * 40)
try:
    response = client.models.generate_content(
        model="models/gemini-3-pro-preview",
        contents="Say 'Hello, I am Gemini 3 Pro Preview' in exactly those words."
    )
    print(f"  Response: {response.text[:100]}")
    print("  [OK] Model is working!")
except Exception as e:
    print(f"  [FAIL] Error: {e}")

# 3. Check available models
print("\n3. Available Models (batch-capable):")
print("-" * 40)
try:
    models = client.models.list()
    for model in models:
        if 'gemini' in model.name.lower():
            print(f"  {model.name}")
except Exception as e:
    print(f"  Error: {e}")
