# Detecting Brand Impersonation Attacks on Chrome Web Store

A multi-stage brand impersonation detection system for Chrome Web Store extensions using **Multimodal LLM-based visual analysis**, **CodeQL static analysis**, and **LLM behavioral validation**.

## Key Findings

**Real-World Impact:**
- **13 malicious brand impersonation extensions detected** affecting **2,093,177 users**
- **10 extensions remain live** on Chrome Web Store, currently exposing **1,183,177 users** to active threats
- **2 extensions were removed and republished** under the same IDs with sanitized code, retaining **~700,000 users** from malicious versions (potential "sleeper agents" that could be re-weaponized)
- **1 extension permanently removed** by Google

**Detection Performance:**
- Evaluated on **1,214 extensions** focusing on LLM brands (ChatGPT, Claude, Gemini, Grok)
- MLLM-based analysis identified **313 brand impersonating extensions** using visual and text deception
- **93.7% reduction in manual review workload** through LLM-based false positive filtering (269 out of 287 extensions classified as SAFE)

**Case Study Validation:**
- Successfully detected all malicious behaviors documented in OX Security's December 2025 research on ChatGPT/DeepSeek conversation theft extensions
- Independent validation confirmed pipeline can reliably identify real-world malware campaigns

---

## Detection Pipeline Architecture

The pipeline implements a **Context-First approach** where CodeQL detects capabilities and the LLM determines intent:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Clone Detection Pipeline                      │
├─────────────────────────────────────────────────────────────────┤
│  Stage 1: Data Collection                                       │
│    • Chrome Web Store scraping (Playwright automation)          │
│    • Metadata extraction (name, icon, developer, users)         │
├─────────────────────────────────────────────────────────────────┤
│  Stage 2: Visual Analysis (MLLM)                                │
│    • Anchor identification & verification (Google Search)       │
│    • Dual-test analysis:                                        │
│      - Test 1: Visual similarity (calibration scale)            │
│      - Test 2: Semantic correlation (deception detection)       │
│    • Classification: MALICIOUS_CLONE / CLONE / LEGITIMATE       │
├─────────────────────────────────────────────────────────────────┤
│  Stage 3: Static Analysis (CodeQL)                              │
│    • JavaScript beautification (jsbeautifier)                   │
│    • CodeQL database creation                                   │
│    • Behavioral capability detection (NO severity labels)       │
│    • Targeted file identification                               │
├─────────────────────────────────────────────────────────────────┤
│  Stage 4: LLM Validation (Gemini Batch API)                     │
│    • Context-aware finding analysis                             │
│    • Domain whitelisting (Google APIs, CDNs)                    │
│    • Intent determination from code context                     │
│    • Verdict: MALICIOUS / SUSPICIOUS / SAFE / NEED_MORE_FILES  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Context-First Analysis**: CodeQL detects *what* patterns exist (capabilities); LLM determines *whether* they're malicious (intent)
2. **No Severity Bias**: Severity labels are stripped before validation to prevent confirmation bias
3. **Semantic Code Analysis**: Uses CodeQL's data flow analysis instead of regex pattern matching
4. **Targeted File Selection**: Only files with findings are sent to LLM (efficiency + cost optimization)
5. **Beautification-First**: JavaScript is beautified *before* CodeQL analysis to ensure line number alignment

---

## Baseline Comparison Results

**Evaluated on 378 manually labeled extensions:**

| Method | F1 Score | Precision | Recall |
|--------|----------|-----------|--------|
| **MLLM (Gemini)** | **96.8%** | 95.8% | 97.9% |
| CLIP | 74.9% | 86.1% | 66.3% |
| Text Embedding | 69.5% | 56.1% | 91.4% |
| Keyword | 68.5% | 53.6% | 94.7% |
| Levenshtein | 68.2% | 56.2% | 86.6% |
| pHash | 66.2% | 49.5% | 100.0% |

**Key Finding:** MLLM approach outperforms all baselines by **22 percentage points** in F1 score.

---

## Experiments Folder Structure

Each dataset folder contains the complete pipeline progression:

```
experiments/
├── chatgpt/                         # ChatGPT dataset
│   ├── input.json                   # Raw scraped metadata from CWS
│   ├── candidates.json              # MLLM analysis results with static analysis
│   ├── batches/                     # Gemini Batch API job metadata
│   │   ├── batch_job_*.json         # Individual batch job info
│   │   └── validation_part_*.json   # Batch input files (JSONL format)
│   ├── results/                     # Batch API responses
│   │   └── result_batches_*.json    # Raw batch results from API
│   └── combined.json                # Merged validation results
│
├── claude/                          # Claude dataset (same structure)
├── gemini/                          # Gemini dataset (same structure)
├── grok/                            # Grok dataset (same structure)
│
├── baseline_comparison/             # Baseline evaluation
│   ├── combined_candidates.json     # All datasets merged
│   ├── baseline_results.json        # Metrics for all methods
│   ├── baseline_results.html        # Visual comparison report
│   ├── baseline_comparison_optimal.py # Comparison script
│   └── README.md                    # Documentation
│
└── ground_truth_labeled.json       # 378 manually labeled extensions
```

### File Descriptions

**Input Files:**
- `input.json` - Raw metadata scraped from Chrome Web Store using Playwright

**Stage 2 Output (Visual Analysis):**
- `candidates.json` - Extensions classified as CLONE/MALICIOUS_CLONE/LEGITIMATE with icon similarity scores

**Stage 3 Output (Static Analysis):**
- `candidates.json` (updated in-place) - Adds `static_analysis` field with CodeQL findings

**Stage 4 Output (LLM Validation):**
- `batches/batch_job_*.json` - Gemini Batch API job metadata (job name, creation time, status)
- `batches/validation_part_*.json` - JSONL input files sent to batch API (5 extensions per batch)
- `results/result_batches_*.json` - Raw responses from completed batch jobs
- `combined.json` - Merged validation results with final verdicts (MALICIOUS/SUSPICIOUS/SAFE)

---

## Pipeline Usage Guide

### Stage 1: Data Collection

Scrape Chrome Web Store using Playwright automation:

```bash
python scrapers/scrape_chatgpt_extensions.py \
  --keyword "chatgpt" \
  --output data/chatgpt_metadata.json
```

---

### Stage 2: Visual Analysis

Identify brand clones using MLLM visual analysis:

```bash
python pipeline/gemini_clone_detector.py \
  --input data/chatgpt_metadata.json \
  --output experiments/chatgpt/candidates.json \
  [OPTIONS]
```

**Options:**
- `--limit <N>` - Process only first N extensions (testing)
- `--skip-existing` - Skip already processed (default)
- `--force` - Re-process all extensions

**What it does:**
1. **Cluster Type Detection**: Classifies keyword as BRAND/CATEGORY/GENERIC
2. **Anchor Identification**: Uses Google Search to find official extension
3. **Anchor Verification**: Distinguishes official vs third-party integrations
4. **Dual-Test Analysis**:
   - **Test 1 (Visual)**: Icon similarity using calibration scale (IDENTICAL/RECOLORED/IMITATIVE/CONVENTION/DIFFERENT)
   - **Test 2 (Semantic)**: Deception detection (typosquatting, false official claims, developer impersonation)
5. **Classification**: MALICIOUS_CLONE / CLONE / LEGITIMATE

**Output:** `candidates.json` with visual similarity scores and classifications

---

### Stage 3: Static Analysis

Run CodeQL security analysis on detected clones:

```bash
python pipeline/run_static_analysis_parallel.py \
  --input experiments/chatgpt/candidates.json \
  --workers 72 \
  --clones-only \
  [OPTIONS]
```

**Options:**
- `--workers <N>` - Parallel workers (default: 48, recommended: 72)
- `--clones-only` - Skip ANCHOR and LEGITIMATE extensions
- `--force` - Re-analyze all, overwrite existing
- `--limit <N>` - Process first N extensions
- `--skip-existing` - Skip extensions with existing analysis (default)

**What it does:**
1. **Download & Extract**: Downloads .crx files from Chrome Web Store
2. **Beautification**: Reformats JavaScript using jsbeautifier (before CodeQL)
3. **CodeQL Database**: Creates semantic code database
4. **Capability Detection**: Finds behavioral patterns:
   - Interception (API hijacking, prototype tampering)
   - Credential access (cookies, passwords, OAuth)
   - Dynamic code execution (eval, new Function)
   - Input monitoring (keyboard, forms, clipboard)
   - Network communication (endpoints, WebSockets)
   - Chrome API usage (debugger, history, tabs)
5. **Library Filtering**: Excludes findings from third-party libraries
6. **Targeted Selection**: Identifies which files need LLM review

**Output:** Adds `static_analysis` field to `candidates.json` (in-place update)

**Note:** Severity labels (CRITICAL/HIGH/MEDIUM/LOW) are retained in code but **stripped before validation** to prevent bias.

---

### Stage 4: LLM Validation

Validate security findings using Gemini Batch API for context-aware intent determination:

#### 4a. Create Batch Jobs

```bash
python pipeline/validate_batch_gemini.py create \
  --input experiments/chatgpt/candidates.json \
  --batch-size 5 \
  [OPTIONS]
```

**Options:**
- `--batch-size <N>` - Extensions per batch (default: 5)
- `--limit <N>` - Process first N extensions
- `--force` - Re-validate already validated
- `--debug` - Save prompts to debug directory
- `--ext-ids <ID1> <ID2>` - Process specific extension IDs

**What it does:**
1. **File Selection**: Extracts file names from CodeQL findings
2. **Code Context**: Downloads only files with findings (cost optimization)
3. **Prompt Construction**:
   - Raw CodeQL findings (NO severity labels)
   - Beautified source code with line numbers
   - Domain whitelisting guidance (Google APIs, CDNs)
   - Contextual analysis questions
4. **Batch Creation**: Groups extensions into batches
5. **API Submission**: Submits to Gemini Batch API with model fallback:
   - Primary: Gemini 3.0 Flash
   - Fallback 1: Gemini 2.5 Pro
   - Fallback 2: Gemini 3.0 Pro
6. **Job Metadata**: Saves batch job info to `batches/batch_job_*.json`

**Output:**
- `batches/batch_job_*.json` - Job metadata (job name, timestamp)
- `batches/validation_part_*.json` - JSONL input files sent to API

**Cost Savings:** Batch API is **50% cheaper** than synchronous calls

#### 4b. Check Batch Status

Monitor batch processing progress:

```bash
python pipeline/validate_batch_gemini.py status --job <job_name>
```

**Status indicators:**
- `JOB_STATE_PENDING` - Queued, not started
- `JOB_STATE_RUNNING` - Processing
- `JOB_STATE_SUCCEEDED` - Complete, ready to retrieve
- `JOB_STATE_FAILED` - Error occurred

**Typical processing time:** 10-30 minutes per batch

#### 4c. Retrieve Results

Download completed batch results:

```bash
python pipeline/validate_batch_gemini.py results \
  --job <job_name> \
  --output experiments/chatgpt/results/result_*.json
```

**Response structure:**
```json
{
  "extension_id": "abc123...",
  "verdict": "MALICIOUS",
  "confidence": 0.95,
  "reasoning": "Extension intercepts credentials...",
  "domains": {
    "suspicious": ["example.io"],
    "legitimate": ["googleapis.com"]
  },
  "pattern_assessment": [
    {
      "finding": "COOKIE_ACCESS",
      "file": "background.js",
      "line": 42,
      "assessment": "MALICIOUS",
      "reasoning": "Sends cookies to unknown domain"
    }
  ]
}
```

**Verdict Categories:**
- `MALICIOUS` - Confirmed malicious behavior (data exfiltration, credential theft)
- `SUSPICIOUS` - Concerning patterns requiring manual review
- `SAFE` - False positives from static analysis (legitimate functionality)
- `NEED_MORE_FILES` - Insufficient code context, requires additional files

#### 4d. Merge Multiple Batches

Combine all batch results into single file:

```bash
python merge_gemini_batches.py --dataset chatgpt
```

**Output:** `experiments/chatgpt/combined.json` with:
- All validation results merged
- Token usage statistics
- Verdict summary (counts per verdict type)

---

### Stage 5: Generate Labeling Interface

Create HTML interface for manual ground truth validation:

#### Option A: Blank Interface (New Labeling)

```bash
python report_generators/generate_labeling_report.py \
  experiments/chatgpt/candidates.json
```

#### Option B: Pre-filled Interface (Edit Existing Labels)

```bash
cd experiments
python ../report_generators/regenerate_labeling_interface.py
```

Creates `edit_labels.html` with:
- Side-by-side icon comparison (ANCHOR vs SUSPECT)
- System prediction displayed
- Evidence shown below each pair
- All existing labels pre-filled
- Download updated JSON

**Usage:**
1. Open HTML in browser
2. Review/edit labels
3. Click "Download Updated Labels"
4. Save as `ground_truth_labeled.json`

---

### Stage 6: Baseline Comparison

Evaluate MLLM system against traditional baselines:

```bash
baseline_venv\Scripts\python.exe \
  experiments\baseline_comparison\baseline_comparison_optimal.py \
  experiments\baseline_comparison\combined_candidates.json \
  experiments\ground_truth_labeled.json \
  --output experiments\baseline_comparison\baseline_results.json \
  --device cuda
```

**Options:**
- `--output <file>` - Output JSON path
- `--device <cuda|cpu>` - Device for models (auto-detects GPU)

**Methods Evaluated:**
1. **MLLM (Gemini)** - Your multimodal system (from ground truth labels)
2. **CLIP** - Vision-language model (ViT-B-16 on LAION-2B)
3. **Text Embedding** - Sentence-BERT (all-MiniLM-L6-v2)
4. **Levenshtein** - Normalized string edit distance
5. **pHash** - 64-bit perceptual hash (DCT-based)
6. **Keyword** - Simple substring matching

**Threshold Selection:**
- Grid search over [0.05, 0.10, ..., 0.95]
- Maximizes F1 score for each method
- Each baseline operates at its optimal point

**Output:**
- `baseline_results.json` - Complete metrics with optimal thresholds
- `baseline_results.html` - Visual comparison report

---

## Complete End-to-End Example

```bash
# 1. Scrape Chrome Web Store
python scrapers/scrape_chatgpt_extensions.py \
  --keyword "chatgpt" \
  --output data/chatgpt_metadata.json

# 2. Visual Analysis (clone detection)
python pipeline/gemini_clone_detector.py \
  --input data/chatgpt_metadata.json \
  --output experiments/chatgpt/candidates.json

# 3. Static Analysis (72-core server)
python pipeline/run_static_analysis_parallel.py \
  --input experiments/chatgpt/candidates.json \
  --workers 72 \
  --clones-only

# 4. Create Validation Batches
python pipeline/validate_batch_gemini.py create \
  --input experiments/chatgpt/candidates.json \
  --batch-size 5

# 5. Check status (wait for completion)
python pipeline/validate_batch_gemini.py status --job <job_id>

# 6. Retrieve & merge results
python pipeline/validate_batch_gemini.py results \
  --job <job_id> \
  --output experiments/chatgpt/results/result_1.json

python merge_gemini_batches.py --dataset chatgpt

# 7. Generate labeling interface
cd experiments
python ../report_generators/regenerate_labeling_interface.py

# 8. Open edit_labels.html, label extensions, download JSON

# 9. Run baseline comparison
baseline_venv\Scripts\python.exe \
  experiments\baseline_comparison\baseline_comparison_optimal.py \
  experiments\baseline_comparison\combined_candidates.json \
  experiments\ground_truth_labeled.json \
  --device cuda
```

---

## Static Analysis: Behavioral Capability Detection

CodeQL detects **capabilities** (what code *can* do), not intent (whether it's malicious).

### Detection Categories

**Interception Capabilities:**
- Native API hijacking (`XMLHttpRequest.prototype`, `window.fetch`, `JSON.parse`)
- Prototype tampering
- `Object.defineProperty` attacks

**Credential & Data Access:**
- Password field selectors (`type="password"`)
- `document.cookie`, `chrome.cookies`
- `chrome.identity` (OAuth token access)
- localStorage/sessionStorage access

**Dynamic Code Execution:**
- `eval()`, `new Function()`
- `setTimeout`/`setInterval` with string arguments
- Base64 decoding (`atob`)

**Input Monitoring:**
- Document-level keyboard listeners
- Clipboard event handlers
- Form field value extraction

**Network Communication:**
- All endpoints extracted (fetch, XMLHttpRequest, WebSocket)
- File:line location tracked for LLM analysis

**Chrome API Usage:**
- `chrome.debugger`, `chrome.proxy`
- `chrome.webRequest` (request interception)
- `chrome.scripting.executeScript`

**Library Filtering:**
- Excludes `*.min.js`, `vendor/`, known frameworks
- Skips files > 5000 lines (bundled code)
- Findings labeled `[LIB]` or `[EXT]`

---

## Evaluation Metrics

**Baseline Comparison Metrics:**
- **Precision** - % of flagged extensions that are actual clones
- **Recall** - % of actual clones detected
- **F1 Score** - Harmonic mean of precision and recall
- **Confusion Matrix** - TP, FP, TN, FN breakdown

**Optimal Threshold Selection:**
- Grid search maximizes F1 score
- Each method operates at optimal point
- No arbitrary thresholds

---

## Requirements

### System Requirements
- Python 3.9+
- CodeQL CLI (v2.16.0+)
- Google Gemini API key
- NVIDIA GPU (optional, for baseline comparison)

### Python Dependencies

**Main environment:**
```bash
pip install -r requirements_gemini.txt
```

**Baseline comparison environment:**
```bash
python -m venv baseline_venv
baseline_venv\Scripts\activate  # Windows
pip install torch torchvision sentence-transformers open_clip_torch imagehash python-Levenshtein pillow numpy
```

### CodeQL Setup

1. Download from https://github.com/github/codeql-cli-binaries
2. Auto-detects paths:
   - Windows: `C:\codeql-home\codeql\codeql.cmd`
   - Linux: `~/codeql/codeql`

---

## Key Design Decisions

### 1. Context-First Approach
CodeQL detects *capabilities* → LLM determines *intent* based on code context.

**Why:** Static analysis bias causes validators to over-weight "CRITICAL" labels and dismiss "LOW" patterns, even when context contradicts the label.

### 2. No Severity Labels in Validation
Severity tiers exist in code but are **stripped before LLM validation**.

**Why:** Prevents confirmation bias. LLM independently reasons about maliciousness from code context.

### 3. Semantic Analysis over Regex
Uses CodeQL's data flow graphs instead of regex pattern matching.

**Why:** Regex can't detect `eval` when aliased, assigned to variable, or called indirectly. CodeQL tracks data flow paths.

### 4. Targeted File Selection
Only files with CodeQL findings are sent to LLM.

**Why:** Reduces API costs, improves focus, handles rate limits, maintains context quality.

### 5. Beautification-First
JavaScript beautified *before* CodeQL analysis (not after).

**Why:** Ensures line numbers in findings match code shown to LLM.

---

## Security Research References

Detection patterns based on documented real-world attacks:

- **December 2024 Supply Chain Attack** - 35+ extensions compromised, 3.7M+ users affected
- **ShadyPanda Campaign** - 145 malicious extensions, 4.3M users over 7 years
- **Credential Stealing Extensions** - Proxy MitM and auth interception techniques

---

## License

Developed for academic research purposes.

## Author

Varol Cagdas Tok

Master's Thesis - Ludwig-Maximilians-Universität München
