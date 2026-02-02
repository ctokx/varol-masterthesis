

import json
import sys
import argparse
from collections import Counter
from datetime import datetime
from pathlib import Path


def load_ground_truth(filepath: str) -> dict:

    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def calculate_metrics(data: dict) -> dict:

    labels = data.get('labels', [])
    
    if not labels:
        return {"error": "No labels found in ground truth file"}
    
    # Filter out UNCERTAIN labels for metric calculation
    valid_labels = [l for l in labels if l.get('human_label') != 'UNCERTAIN']
    uncertain_count = len(labels) - len(valid_labels)
    
    # Count distributions
    human_dist = Counter(l['human_label'] for l in valid_labels)
    pred_dist = Counter(l['system_prediction'] for l in valid_labels)
    

    
    tp = fp = tn = fn = 0
    
    for l in valid_labels:
        human = l['human_label']
        pred = l['system_prediction']
        
        # Ground truth: is it actually a clone/malicious?
        is_actually_positive = human in ['MALICIOUS_CLONE', 'CLONE']
        # Prediction: did system flag it?
        is_predicted_positive = pred in ['MALICIOUS_CLONE', 'CLONE']
        
        if is_predicted_positive and is_actually_positive:
            tp += 1
        elif is_predicted_positive and not is_actually_positive:
            fp += 1
        elif not is_predicted_positive and not is_actually_positive:
            tn += 1
        else:  # not predicted but actually positive
            fn += 1
    
    # Binary metrics
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    accuracy = (tp + tn) / len(valid_labels) if valid_labels else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    
    # === MULTI-CLASS CONFUSION MATRIX ===
    classes = ['MALICIOUS_CLONE', 'CLONE', 'LEGITIMATE']
    confusion_matrix = {actual: {pred: 0 for pred in classes} for actual in classes}
    
    for l in valid_labels:
        human = l['human_label']
        pred = l['system_prediction']
        if human in classes and pred in classes:
            confusion_matrix[human][pred] += 1
    
    # === PER-CLASS METRICS ===
    per_class_metrics = {}
    for cls in classes:
        cls_tp = confusion_matrix[cls][cls]
        cls_fp = sum(confusion_matrix[other][cls] for other in classes if other != cls)
        cls_fn = sum(confusion_matrix[cls][other] for other in classes if other != cls)
        cls_tn = sum(confusion_matrix[a][p] for a in classes for p in classes 
                     if a != cls and p != cls)
        
        cls_precision = cls_tp / (cls_tp + cls_fp) if (cls_tp + cls_fp) > 0 else 0
        cls_recall = cls_tp / (cls_tp + cls_fn) if (cls_tp + cls_fn) > 0 else 0
        cls_f1 = 2 * cls_precision * cls_recall / (cls_precision + cls_recall) if (cls_precision + cls_recall) > 0 else 0
        
        per_class_metrics[cls] = {
            'precision': round(cls_precision, 4),
            'recall': round(cls_recall, 4),
            'f1': round(cls_f1, 4),
            'support': human_dist.get(cls, 0)
        }
    
   
    mal_tp = sum(1 for l in valid_labels 
                 if l['human_label'] == 'MALICIOUS_CLONE' and l['system_prediction'] == 'MALICIOUS_CLONE')
    mal_fn_as_clone = sum(1 for l in valid_labels 
                          if l['human_label'] == 'MALICIOUS_CLONE' and l['system_prediction'] == 'CLONE')
    mal_fn_as_legit = sum(1 for l in valid_labels 
                          if l['human_label'] == 'MALICIOUS_CLONE' and l['system_prediction'] == 'LEGITIMATE')
    
    total_malicious = human_dist.get('MALICIOUS_CLONE', 0)
    malicious_recall = mal_tp / total_malicious if total_malicious > 0 else 0
    malicious_detected_any = (mal_tp + mal_fn_as_clone) / total_malicious if total_malicious > 0 else 0
    
   
    errors = []
    for l in valid_labels:
        if l['human_label'] != l['system_prediction']:
            errors.append({
                'extension_id': l['extension_id'],
                'human_label': l['human_label'],
                'system_prediction': l['system_prediction'],
                'notes': l.get('notes', '')
            })
    
    error_types = Counter((e['human_label'], e['system_prediction']) for e in errors)
    
    return {
        'summary': {
            'keyword': data.get('keyword', 'unknown'),
            'total_extensions': data.get('total', 0),
            'labeled': len(labels),
            'valid_for_metrics': len(valid_labels),
            'uncertain_skipped': uncertain_count,
            'labeling_date': data.get('date', 'unknown'),
            'analysis_date': datetime.now().isoformat()
        },
        'distribution': {
            'ground_truth': dict(human_dist),
            'predictions': dict(pred_dist)
        },
        'binary_classification': {
            'description': 'Clone detection task: detecting CLONE or MALICIOUS_CLONE vs LEGITIMATE',
            'confusion_matrix': {
                'TP': tp,
                'FP': fp,
                'TN': tn,
                'FN': fn
            },
            'metrics': {
                'precision': round(precision, 4),
                'recall': round(recall, 4),
                'f1_score': round(f1, 4),
                'accuracy': round(accuracy, 4),
                'specificity': round(specificity, 4)
            }
        },
        'multiclass': {
            'confusion_matrix': confusion_matrix,
            'per_class_metrics': per_class_metrics
        },
        'malicious_detection': {
            'description': 'How well we detect specifically MALICIOUS clones',
            'total_malicious': total_malicious,
            'detected_as_malicious': mal_tp,
            'detected_as_clone': mal_fn_as_clone,
            'missed_entirely': mal_fn_as_legit,
            'exact_recall': round(malicious_recall, 4),
            'detection_rate_any_flag': round(malicious_detected_any, 4)
        },
        'error_analysis': {
            'total_errors': len(errors),
            'error_rate': round(len(errors) / len(valid_labels), 4) if valid_labels else 0,
            'error_types': {f"{h}->{p}": c for (h, p), c in error_types.most_common()},
            'errors': errors[:20]  # First 20 errors for review
        }
    }


def generate_html_report(metrics: dict, output_path: str):
    """Generate a beautiful HTML report from metrics."""
    m = metrics
    binary = m['binary_classification']['metrics']
    cm = m['binary_classification']['confusion_matrix']
    
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Evaluation Metrics - {m['summary']['keyword']}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #e0e0e0;
            min-height: 100vh;
            padding: 40px 20px;
        }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        h1 {{
            text-align: center;
            font-size: 2.5rem;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }}
        .subtitle {{ text-align: center; color: #888; margin-bottom: 40px; }}
        .card {{
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 25px;
        }}
        .card h2 {{
            color: #667eea;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(102, 126, 234, 0.3);
        }}
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
        }}
        .metric-box {{
            background: rgba(0,0,0,0.3);
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }}
        .metric-value {{
            font-size: 2.5rem;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .metric-value.good {{ background: linear-gradient(135deg, #2dce89, #26a69a); -webkit-background-clip: text; }}
        .metric-value.warn {{ background: linear-gradient(135deg, #fb6340, #ffd600); -webkit-background-clip: text; }}
        .metric-value.bad {{ background: linear-gradient(135deg, #f5365c, #f56036); -webkit-background-clip: text; }}
        .metric-label {{ color: #888; font-size: 0.9rem; margin-top: 5px; }}
        .confusion-matrix {{
            display: grid;
            grid-template-columns: auto repeat(2, 1fr);
            gap: 5px;
            max-width: 400px;
            margin: 20px auto;
        }}
        .cm-cell {{
            padding: 20px;
            text-align: center;
            border-radius: 8px;
            font-weight: bold;
        }}
        .cm-header {{ background: rgba(102, 126, 234, 0.2); color: #667eea; }}
        .cm-tp {{ background: rgba(45, 206, 137, 0.3); color: #2dce89; }}
        .cm-tn {{ background: rgba(45, 206, 137, 0.2); color: #2dce89; }}
        .cm-fp {{ background: rgba(245, 54, 92, 0.3); color: #f5365c; }}
        .cm-fn {{ background: rgba(251, 99, 64, 0.3); color: #fb6340; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }}
        th {{ color: #667eea; }}
        .error-row {{ background: rgba(245, 54, 92, 0.1); }}
        .badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: bold;
        }}
        .badge-mal {{ background: rgba(245, 54, 92, 0.3); color: #f5365c; }}
        .badge-clone {{ background: rgba(251, 99, 64, 0.3); color: #fb6340; }}
        .badge-legit {{ background: rgba(45, 206, 137, 0.3); color: #2dce89; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Evaluation Metrics</h1>
        <p class="subtitle">
            Keyword: <strong>{m['summary']['keyword']}</strong> |
            Labeled: {m['summary']['labeled']}/{m['summary']['total_extensions']} |
            Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
        </p>

        <div class="card">
            <h2>🎯 Binary Classification (Clone Detection)</h2>
            <div class="metrics-grid">
                <div class="metric-box">
                    <div class="metric-value {'good' if binary['precision'] >= 0.8 else 'warn' if binary['precision'] >= 0.6 else 'bad'}">{binary['precision']:.1%}</div>
                    <div class="metric-label">Precision</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value {'good' if binary['recall'] >= 0.8 else 'warn' if binary['recall'] >= 0.6 else 'bad'}">{binary['recall']:.1%}</div>
                    <div class="metric-label">Recall</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value {'good' if binary['f1_score'] >= 0.8 else 'warn' if binary['f1_score'] >= 0.6 else 'bad'}">{binary['f1_score']:.1%}</div>
                    <div class="metric-label">F1 Score</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value {'good' if binary['accuracy'] >= 0.8 else 'warn' if binary['accuracy'] >= 0.6 else 'bad'}">{binary['accuracy']:.1%}</div>
                    <div class="metric-label">Accuracy</div>
                </div>
            </div>

            <h3 style="margin-top: 30px; color: #888;">Confusion Matrix</h3>
            <div class="confusion-matrix">
                <div class="cm-cell"></div>
                <div class="cm-cell cm-header">Pred: Clone</div>
                <div class="cm-cell cm-header">Pred: Legit</div>
                <div class="cm-cell cm-header">Actual: Clone</div>
                <div class="cm-cell cm-tp">TP: {cm['TP']}</div>
                <div class="cm-cell cm-fn">FN: {cm['FN']}</div>
                <div class="cm-cell cm-header">Actual: Legit</div>
                <div class="cm-cell cm-fp">FP: {cm['FP']}</div>
                <div class="cm-cell cm-tn">TN: {cm['TN']}</div>
            </div>
        </div>

        <div class="card">
            <h2>📈 Per-Class Performance</h2>
            <table>
                <tr>
                    <th>Class</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1</th>
                    <th>Support</th>
                </tr>'''
    
    for cls, cm_metrics in m['multiclass']['per_class_metrics'].items():
        badge_class = 'badge-mal' if cls == 'MALICIOUS_CLONE' else ('badge-clone' if cls == 'CLONE' else 'badge-legit')
        html += f'''
                <tr>
                    <td><span class="badge {badge_class}">{cls}</span></td>
                    <td>{cm_metrics['precision']:.1%}</td>
                    <td>{cm_metrics['recall']:.1%}</td>
                    <td>{cm_metrics['f1']:.1%}</td>
                    <td>{cm_metrics['support']}</td>
                </tr>'''
    
    html += f'''
            </table>
        </div>

        <div class="card">
            <h2>🔴 Malicious Clone Detection</h2>
            <div class="metrics-grid">
                <div class="metric-box">
                    <div class="metric-value">{m['malicious_detection']['total_malicious']}</div>
                    <div class="metric-label">Total Malicious</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value good">{m['malicious_detection']['detected_as_malicious']}</div>
                    <div class="metric-label">Detected Correctly</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value warn">{m['malicious_detection']['detected_as_clone']}</div>
                    <div class="metric-label">Flagged as Clone</div>
                </div>
                <div class="metric-box">
                    <div class="metric-value bad">{m['malicious_detection']['missed_entirely']}</div>
                    <div class="metric-label">Missed Entirely</div>
                </div>
            </div>
            <p style="margin-top: 20px; color: #888;">
                Detection rate (any flag): <strong>{m['malicious_detection']['detection_rate_any_flag']:.1%}</strong>
            </p>
        </div>

        <div class="card">
            <h2>❌ Error Analysis ({m['error_analysis']['total_errors']} errors)</h2>
            <p style="color: #888; margin-bottom: 15px;">Error rate: {m['error_analysis']['error_rate']:.1%}</p>
            <h3 style="color: #888; margin-bottom: 10px;">Error Types</h3>
            <table>
                <tr><th>Mistake Type</th><th>Count</th></tr>'''
    
    for error_type, count in m['error_analysis']['error_types'].items():
        html += f'<tr class="error-row"><td>{error_type}</td><td>{count}</td></tr>'
    
    html += '''
            </table>
        </div>
    </div>
</body>
</html>'''
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"HTML report generated: {output_path}")


def print_summary(metrics: dict):
    """Print a concise summary to console."""
    m = metrics
    binary = m['binary_classification']['metrics']
    
    print("\n" + "="*60)
    print(f"  EVALUATION METRICS: {m['summary']['keyword'].upper()}")
    print("="*60)
    
    print(f"\n📊 Dataset Summary")
    print(f"   Total: {m['summary']['total_extensions']} | Labeled: {m['summary']['labeled']} | Valid: {m['summary']['valid_for_metrics']}")
    
    print(f"\n📈 Distribution (Ground Truth)")
    for label, count in m['distribution']['ground_truth'].items():
        print(f"   {label}: {count}")
    
    print(f"\n🎯 Binary Classification (Clone Detection)")
    print(f"   Precision: {binary['precision']:.2%}")
    print(f"   Recall:    {binary['recall']:.2%}")
    print(f"   F1 Score:  {binary['f1_score']:.2%}")
    print(f"   Accuracy:  {binary['accuracy']:.2%}")
    
    cm = m['binary_classification']['confusion_matrix']
    print(f"\n   Confusion Matrix:")
    print(f"   ┌─────────────┬─────────────┐")
    print(f"   │ TP: {cm['TP']:>6} │ FN: {cm['FN']:>6} │")
    print(f"   ├─────────────┼─────────────┤")
    print(f"   │ FP: {cm['FP']:>6} │ TN: {cm['TN']:>6} │")
    print(f"   └─────────────┴─────────────┘")
    
    print(f"\n🔴 Malicious Detection")
    mal = m['malicious_detection']
    print(f"   Total malicious: {mal['total_malicious']}")
    print(f"   Detected correctly: {mal['detected_as_malicious']}")
    print(f"   Flagged as clone: {mal['detected_as_clone']}")
    print(f"   Missed entirely: {mal['missed_entirely']}")
    print(f"   Detection rate (any flag): {mal['detection_rate_any_flag']:.2%}")
    
    print(f"\n❌ Errors: {m['error_analysis']['total_errors']} ({m['error_analysis']['error_rate']:.2%})")
    for error_type, count in list(m['error_analysis']['error_types'].items())[:5]:
        print(f"   {error_type}: {count}")
    
    print("\n" + "="*60)


def main():
    parser = argparse.ArgumentParser(description='Calculate evaluation metrics from ground truth JSON')
    parser.add_argument('ground_truth', help='Path to ground truth JSON file')
    parser.add_argument('--output', '-o', help='Output path for metrics JSON')
    parser.add_argument('--html', help='Generate HTML report at specified path')
    
    args = parser.parse_args()

    data = load_ground_truth(args.ground_truth)
    metrics = calculate_metrics(data)
    

    print_summary(metrics)
    

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(metrics, f, indent=2)
        print(f"\nMetrics saved to: {args.output}")
    else:
        
        default_output = Path(args.ground_truth).stem.replace('_ground_truth', '_metrics') + '.json'
        output_path = Path(args.ground_truth).parent / default_output
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(metrics, f, indent=2)
        print(f"\nMetrics saved to: {output_path}")

    if args.html:
        generate_html_report(metrics, args.html)
    else:
 
        default_html = Path(args.ground_truth).stem.replace('_ground_truth', '_metrics') + '.html'
        html_path = Path(args.ground_truth).parent / default_html
        generate_html_report(metrics, str(html_path))


if __name__ == "__main__":
    main()
