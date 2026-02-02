# Baseline Comparison Results

This folder contains the baseline comparison experiments for the thesis.

## 📊 Latest Results (Final)

**Date:** 2026-02-01
**Dataset:** ChatGPT + Claude combined
**Ground Truth:** 378 manually labeled extensions

### Performance Summary

| Method | Precision | Recall | F1 Score |
|--------|-----------|--------|----------|
| **VLM Gemini (Our System)** | 95.8% | 97.9% | **96.8%** |
| CLIP | 86.1% | 66.3% | 74.9% |
| Text Embedding | 56.1% | 91.4% | 69.5% |
| Keyword | 53.6% | 94.7% | 68.5% |
| Levenshtein | 56.2% | 86.6% | 68.2% |
| pHash | 49.5% | 100.0% | 66.2% |

**Key Finding:** VLM Gemini outperforms all baselines by **22 percentage points** (F1 score).

## 📁 Files

- `baseline_results.json` - Complete metrics and threshold data
- `baseline_results.html` - Visual comparison report
- `combined_candidates.json` - Full dataset (clones + legitimate extensions)
- `baseline_comparison_optimal.py` - Comparison script with optimal threshold selection
- `README.md` - This file

## 🔧 How to Re-run

If you update the ground truth labels:

```bash
cd C:\Users\varol\cws_clone_detector
baseline_venv\Scripts\python.exe experiments\baseline_comparison\baseline_comparison_optimal.py ^
    experiments\baseline_comparison\combined_candidates.json ^
    experiments\ground_truth_labeled.json ^
    --output experiments\baseline_comparison\baseline_results.json ^
    --device cuda
```

## 📝 Methodology

- **Threshold Selection:** Grid search over [0.05, 0.10, ..., 0.95] to maximize F1 score
- **Evaluation:** Precision, Recall, F1 on 378 manually labeled extensions
- **Baselines:**
  - **Levenshtein:** Normalized string edit distance
  - **Text Embedding:** Sentence-BERT (all-MiniLM-L6-v2) with cosine similarity
  - **pHash:** 64-bit perceptual hash with Hamming distance
  - **CLIP:** Vision-language model (ViT-B-16 on LAION-2B)
  - **Keyword:** Simple substring matching
  - **VLM Gemini:** Our multimodal approach (icon + name + metadata)

## 🎓 Thesis Impact

These results demonstrate that:
1. VLM-based detection significantly outperforms traditional methods
2. Simple baselines (string/hash) have high recall but low precision (too many false positives)
3. Advanced vision models (CLIP) perform better but still lag behind VLM reasoning
4. Our approach achieves near-perfect recall (97.9%) while maintaining high precision (95.8%)
