#!/usr/bin/env python3
"""
Baseline Comparison with Optimal Threshold Selection.

Uses grid search to find optimal thresholds that maximize F1 score on ground truth.
This provides scientifically defensible threshold selection for thesis defense.

Usage:
    python baseline_comparison_optimal.py output/claude_clones.json output/claude_ground_truth.json
"""

import json
import io
import argparse
from datetime import datetime
import requests
from PIL import Image
import imagehash
import Levenshtein
import torch
import open_clip
from sentence_transformers import SentenceTransformer
import numpy as np

BRAND_KEYWORDS = {
    'claude': ['claude', 'anthropic', 'sonnet', 'opus', 'haiku'],
    'chatgpt': ['chatgpt', 'openai', 'gpt-4', 'gpt4', 'gpt-3', 'gpt3', 'dall-e', 'dalle'],
    'gemini': ['gemini', 'bard', 'google ai'],
    'grok': ['grok', 'xai', 'x.ai'],

}


class BaselineDetector:
    def __init__(self, keyword: str, device: str = None):
        self.keyword = keyword.lower()
        self.keywords = BRAND_KEYWORDS.get(self.keyword, [self.keyword])
        
        if device:
            self.device = device
        elif torch.cuda.is_available():
            self.device = 'cuda'
        else:
            self.device = 'cpu'
        print(f"Using device: {self.device}")
        
        self._text_model = None
        self._clip_model = None
        self._clip_preprocess = None
        
        self._icon_cache = {}
        self._text_embed_cache = {}
        self._clip_embed_cache = {}
    
    @property
    def text_model(self):
        if self._text_model is None:
            print("Loading sentence-transformers model...")
            self._text_model = SentenceTransformer('all-MiniLM-L6-v2', device=self.device)
        return self._text_model
    
    @property
    def clip_model(self):
        if self._clip_model is None:
            print("Loading CLIP model (laion/CLIP-ViT-B-16-laion2B-s34B-b88K)...")
            self._clip_model, _, self._clip_preprocess = open_clip.create_model_and_transforms(
                'ViT-B-16', pretrained='laion2b_s34b_b88k'
            )
            self._clip_model = self._clip_model.to(self.device).eval()
        return self._clip_model
    
    def download_icon(self, url: str) -> Image.Image:
        if url in self._icon_cache:
            return self._icon_cache[url]
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            img = Image.open(io.BytesIO(resp.content)).convert('RGB')
            self._icon_cache[url] = img
            return img
        except Exception:
            return None
    
    def levenshtein_score(self, name: str, anchor_name: str) -> float:
        name_lower = name.lower().strip()
        anchor_lower = anchor_name.lower().strip()
        distance = Levenshtein.distance(name_lower, anchor_lower)
        max_len = max(len(name_lower), len(anchor_lower))
        return 1 - (distance / max_len) if max_len > 0 else 0
    
    def text_embedding_score(self, text: str, anchor_text: str) -> float:
        if text not in self._text_embed_cache:
            self._text_embed_cache[text] = self.text_model.encode(text, convert_to_tensor=True)
        if anchor_text not in self._text_embed_cache:
            self._text_embed_cache[anchor_text] = self.text_model.encode(anchor_text, convert_to_tensor=True)
        
        emb1 = self._text_embed_cache[text]
        emb2 = self._text_embed_cache[anchor_text]
        return torch.nn.functional.cosine_similarity(emb1.unsqueeze(0), emb2.unsqueeze(0)).item()
    
    def phash_score(self, icon_url: str, anchor_icon_url: str) -> float:
        img1 = self.download_icon(icon_url)
        img2 = self.download_icon(anchor_icon_url)
        
        if img1 is None or img2 is None:
            return 0.0
        
        hash1 = imagehash.phash(img1)
        hash2 = imagehash.phash(img2)
        distance = hash1 - hash2
        return 1 - (distance / 64)
    
    def clip_score(self, icon_url: str, anchor_icon_url: str) -> float:
        emb1 = self._get_clip_embedding(icon_url)
        emb2 = self._get_clip_embedding(anchor_icon_url)
        
        if emb1 is None or emb2 is None:
            return 0.0
        
        return torch.nn.functional.cosine_similarity(emb1, emb2, dim=0).item()
    
    def _get_clip_embedding(self, icon_url: str):
        if icon_url in self._clip_embed_cache:
            return self._clip_embed_cache[icon_url]
        
        img = self.download_icon(icon_url)
        if img is None:
            return None
        
        model = self.clip_model
        
        with torch.no_grad():
            img_tensor = self._clip_preprocess(img).unsqueeze(0).to(self.device)
            embedding = model.encode_image(img_tensor).squeeze()
            embedding = embedding / embedding.norm()
        
        self._clip_embed_cache[icon_url] = embedding
        return embedding
    
    def keyword_match(self, name: str, specific_keywords: list = None) -> float:
        text = name.lower()
        keywords = specific_keywords if specific_keywords else self.keywords
        for keyword in keywords:
            if keyword.lower() in text:
                return 1.0
        return 0.0


def compute_all_scores(clones_data: dict, ground_truth: list, detector: BaselineDetector) -> dict:
    """Compute raw similarity scores for all extensions."""
    anchors = clones_data.get('anchors', [])
    if not anchors:
        return {}
    
    # Map sources to anchors and keywords (for combined dataset)
    source_map = {}
    if clones_data.get('keyword') == 'combined':
        # Assuming order: [Claude, ChatGPT] based on combine_datasets.py
        # Fallback to name checking if needed, but index is reliable given generation script
        if len(anchors) >= 1: source_map['claude'] = {'anchor': anchors[0], 'keywords': BRAND_KEYWORDS['claude']}
        if len(anchors) >= 2: source_map['chatgpt'] = {'anchor': anchors[1], 'keywords': BRAND_KEYWORDS['chatgpt']}
    else:
        # Single dataset mode
        default_anchor = anchors[0]
        default_keywords = detector.keywords
        # Create map that returns default for any source or None
        source_map = {'default': {'anchor': default_anchor, 'keywords': default_keywords}}

    ext_map = {}
    for ext in clones_data.get('malicious_clones', []) + clones_data.get('clones', []) + clones_data.get('legitimate', []):
        ext_map[ext['id']] = ext
    
    scores = {
        'levenshtein': {},
        'text_embedding': {},
        'phash': {},
        'clip': {},
        'keyword': {}
    }
    

    valid_labels = [l for l in ground_truth if l.get('human_label') != 'UNCERTAIN']
    total = len(valid_labels)
    
    print(f"\nComputing similarity scores for {total} extensions...")
    
    anchor_by_id = {a['id']: a for a in anchors}

    for i, label in enumerate(valid_labels):
        ext_id = label['extension_id']

        ext = ext_map.get(ext_id, {})
        if not ext:
            continue

        cloned_from_id = ext.get('cloned_from_id')

        if cloned_from_id and cloned_from_id in anchor_by_id:
            anchor = anchor_by_id[cloned_from_id]
            # Determine keywords based on anchor name
            anchor_name_lower = anchor.get('name', '').lower()
            if 'claude' in anchor_name_lower:
                keywords = BRAND_KEYWORDS.get('claude', ['claude'])
            elif 'chatgpt' in anchor_name_lower or 'openai' in anchor_name_lower:
                keywords = BRAND_KEYWORDS.get('chatgpt', ['chatgpt'])
            else:
                keywords = detector.keywords
        elif 'default' in source_map:
            config = source_map['default']
            anchor = config['anchor']
            keywords = config['keywords']
        else:
      
            anchor = anchors[0] if anchors else {}
            keywords = detector.keywords

        anchor_name = anchor.get('name', '')
        anchor_icon = anchor.get('icon_url', '')
        
        name = ext.get('name', '')
        icon_url = ext.get('icon_url', '')
        
        if (i + 1) % 50 == 0:
            print(f"  Progress: {i+1}/{total}")
        
        scores['levenshtein'][ext_id] = detector.levenshtein_score(name, anchor_name)
        scores['text_embedding'][ext_id] = detector.text_embedding_score(name, anchor_name)
        scores['keyword'][ext_id] = detector.keyword_match(name, specific_keywords=keywords)
        
        if icon_url and anchor_icon:
            scores['phash'][ext_id] = detector.phash_score(icon_url, anchor_icon)
            scores['clip'][ext_id] = detector.clip_score(icon_url, anchor_icon)
        else:
            scores['phash'][ext_id] = 0.0
            scores['clip'][ext_id] = 0.0
    
    return scores


def evaluate_at_threshold(scores: dict, ground_truth: list, threshold: float) -> dict:
    """Evaluate metrics at a specific threshold."""
    tp = fp = tn = fn = 0
    
    for label in ground_truth:
        if label.get('human_label') == 'UNCERTAIN':
            continue
        
        ext_id = label['extension_id']
        is_clone = label['human_label'] in ['MALICIOUS_CLONE', 'CLONE']
        score = scores.get(ext_id, 0.0)
        pred_clone = score >= threshold
        
        if pred_clone and is_clone:
            tp += 1
        elif pred_clone and not is_clone:
            fp += 1
        elif not pred_clone and not is_clone:
            tn += 1
        else:
            fn += 1
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    
    return {
        'tp': tp, 'fp': fp, 'tn': tn, 'fn': fn,
        'precision': precision, 'recall': recall, 'f1': f1,
        'accuracy': (tp + tn) / (tp + fp + tn + fn) if (tp + fp + tn + fn) > 0 else 0
    }


def find_optimal_threshold(scores: dict, ground_truth: list, thresholds: list = None) -> tuple:
    """Grid search to find optimal threshold that maximizes F1."""
    if thresholds is None:
        thresholds = [i/20 for i in range(1, 20)]  # 0.05, 0.10, ... 0.95
    
    best_threshold = 0.5
    best_f1 = 0.0
    best_metrics = None
    all_results = []
    
    for threshold in thresholds:
        metrics = evaluate_at_threshold(scores, ground_truth, threshold)
        all_results.append({'threshold': threshold, **metrics})
        
        if metrics['f1'] > best_f1:
            best_f1 = metrics['f1']
            best_threshold = threshold
            best_metrics = metrics
    
    return best_threshold, best_metrics, all_results


def evaluate_vlm(ground_truth: list) -> dict:
    """Evaluate VLM predictions."""
    tp = fp = tn = fn = 0
    
    for label in ground_truth:
        if label.get('human_label') == 'UNCERTAIN':
            continue
        
        is_clone = label['human_label'] in ['MALICIOUS_CLONE', 'CLONE']
        pred_clone = label['system_prediction'] in ['MALICIOUS_CLONE', 'CLONE']
        
        if pred_clone and is_clone:
            tp += 1
        elif pred_clone and not is_clone:
            fp += 1
        elif not pred_clone and not is_clone:
            tn += 1
        else:
            fn += 1
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    
    return {
        'tp': tp, 'fp': fp, 'tn': tn, 'fn': fn,
        'precision': round(precision, 4), 'recall': round(recall, 4),
        'f1': round(f1, 4), 'accuracy': round((tp + tn) / (tp + fp + tn + fn), 4)
    }


def run_optimal_baselines(clones_data: dict, ground_truth: list, device: str = None) -> dict:
    """Run baselines with optimal threshold selection."""
    keyword = clones_data.get('keyword', 'unknown')
    detector = BaselineDetector(keyword, device=device)
    
    # Compute all scores first
    all_scores = compute_all_scores(clones_data, ground_truth, detector)
    
    print("\nFinding optimal thresholds via grid search...")
    
    results = {}
    
    for method in ['levenshtein', 'text_embedding', 'phash', 'clip']:
        optimal_thresh, best_metrics, grid_results = find_optimal_threshold(
            all_scores[method], ground_truth
        )
        results[method] = {
            'optimal_threshold': optimal_thresh,
            'metrics': {k: round(v, 4) if isinstance(v, float) else v for k, v in best_metrics.items()},
            'grid_search': grid_results
        }
        print(f"  {method}: optimal threshold = {optimal_thresh:.2f}, F1 = {best_metrics['f1']:.1%}")
    
    # Keyword is binary (no threshold optimization needed)
    keyword_metrics = evaluate_at_threshold(all_scores['keyword'], ground_truth, 0.5)
    results['keyword'] = {
        'optimal_threshold': 0.5,
        'metrics': {k: round(v, 4) if isinstance(v, float) else v for k, v in keyword_metrics.items()}
    }
    
    # VLM evaluation
    results['vlm_gemini'] = {
        'optimal_threshold': 'N/A',
        'metrics': evaluate_vlm(ground_truth)
    }
    
    return results


def generate_html_report(results: dict, keyword: str, output_path: str):
    """Generate comparison report with threshold justification."""
    
    # Extract metrics for sorting
    method_metrics = [(m, r['metrics']['f1'], r.get('optimal_threshold', 'N/A')) 
                      for m, r in results.items()]
    sorted_methods = sorted(method_metrics, key=lambda x: x[1], reverse=True)
    
    html = f'''<!DOCTYPE html>
<html>
<head>
    <title>Baseline Comparison (Optimal Thresholds) - {keyword}</title>
    <style>
        body {{ font-family: -apple-system, sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 40px; }}
        h1 {{ color: #667eea; text-align: center; }}
        .subtitle {{ text-align: center; color: #888; margin-bottom: 40px; }}
        table {{ width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; margin-bottom: 30px; }}
        th {{ background: rgba(102, 126, 234, 0.2); color: #667eea; padding: 15px; text-align: left; }}
        td {{ padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); }}
        tr:last-child td {{ border-bottom: none; }}
        .best {{ background: rgba(45, 206, 137, 0.1); }}
        .metric {{ font-weight: bold; font-size: 1.1em; }}
        .metric.good {{ color: #2dce89; }}
        .metric.medium {{ color: #fb6340; }}
        .metric.low {{ color: #f5365c; }}
        .method-name {{ font-weight: bold; }}
        .method-name.vlm {{ color: #2dce89; }}
        .note {{ background: rgba(102, 126, 234, 0.1); padding: 20px; border-radius: 8px; margin-top: 20px; }}
    </style>
</head>
<body>
    <h1>📊 Baseline Comparison (Optimal Thresholds)</h1>
    <p class="subtitle">Dataset: {keyword.upper()} | Thresholds selected via grid search (maximize F1)</p>
    
    <table>
        <tr>
            <th>Method</th>
            <th>Optimal Threshold</th>
            <th>Precision</th>
            <th>Recall</th>
            <th>F1 Score</th>
            <th>TP/FP/TN/FN</th>
        </tr>
'''
    
    for method, f1, threshold in sorted_methods:
        m = results[method]['metrics']
        is_best = method == sorted_methods[0][0]
        is_vlm = 'vlm' in method.lower()
        
        def metric_class(val):
            if val >= 0.8: return 'good'
            if val >= 0.5: return 'medium'
            return 'low'
        
        thresh_str = f"{threshold:.2f}" if isinstance(threshold, float) else threshold
        
        html += f'''
        <tr class="{'best' if is_best else ''}">
            <td class="method-name {'vlm' if is_vlm else ''}">{method.replace('_', ' ').title()}</td>
            <td>{thresh_str}</td>
            <td><span class="metric {metric_class(m['precision'])}">{m['precision']:.1%}</span></td>
            <td><span class="metric {metric_class(m['recall'])}">{m['recall']:.1%}</span></td>
            <td><span class="metric {metric_class(m['f1'])}">{m['f1']:.1%}</span></td>
            <td>{m['tp']}/{m['fp']}/{m['tn']}/{m['fn']}</td>
        </tr>
'''
    
    html += '''
    </table>
    
    <div class="note">
        <strong>Threshold Selection Methodology:</strong><br>
        Thresholds were selected via grid search over [0.05, 0.10, ..., 0.95] to maximize F1 score on the ground truth dataset.
        This ensures fair comparison where each baseline operates at its optimal operating point.
    </div>
</body>
</html>
'''
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"HTML report: {output_path}")


def main():
    parser = argparse.ArgumentParser(description='Baseline comparison with optimal thresholds')
    parser.add_argument('clones', help='Path to clones JSON')
    parser.add_argument('ground_truth', help='Path to ground truth JSON')
    parser.add_argument('--output', '-o', help='Output JSON path')
    parser.add_argument('--device', choices=['cuda', 'cpu'], help='Device for models')
    
    args = parser.parse_args()
    
    with open(args.clones, 'r', encoding='utf-8') as f:
        clones_data = json.load(f)
    with open(args.ground_truth, 'r', encoding='utf-8') as f:
        gt_data = json.load(f)
    
    keyword = clones_data.get('keyword', 'unknown')
    
    print(f"Keyword: {keyword}")
    print(f"Extensions to evaluate: {len(gt_data.get('labels', []))}")
    
    results = run_optimal_baselines(clones_data, gt_data.get('labels', []), device=args.device)
    
    print("\n" + "="*80)
    print(f"  BASELINE COMPARISON (OPTIMAL THRESHOLDS): {keyword.upper()}")
    print("="*80)
    print(f"\n{'Method':<20} {'Threshold':>10} {'Precision':>10} {'Recall':>10} {'F1':>10}")
    print("-"*80)
    
    sorted_results = sorted(results.items(), key=lambda x: x[1]['metrics']['f1'], reverse=True)
    for method, r in sorted_results:
        m = r['metrics']
        thresh = r['optimal_threshold']
        thresh_str = f"{thresh:.2f}" if isinstance(thresh, float) else thresh
        print(f"{method:<20} {thresh_str:>10} {m['precision']:>10.1%} {m['recall']:>10.1%} {m['f1']:>10.1%}")
    
    print("="*80)
    
    output_path = args.output or f"output/{keyword}_baseline_optimal.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        # Remove grid_search data for cleaner output
        clean_results = {}
        for method, r in results.items():
            clean_results[method] = {
                'optimal_threshold': r['optimal_threshold'],
                'metrics': r['metrics']
            }
        json.dump({
            'keyword': keyword,
            'timestamp': datetime.now().isoformat(),
            'methodology': 'Grid search over thresholds [0.05, 0.10, ..., 0.95] to maximize F1',
            'results': clean_results
        }, f, indent=2)
    print(f"\nMetrics saved: {output_path}")
    
    html_path = output_path.replace('.json', '.html')
    generate_html_report(results, keyword, html_path)


if __name__ == "__main__":
    main()
