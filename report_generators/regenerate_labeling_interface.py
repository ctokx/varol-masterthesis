

import json
import sys

def generate_prefilled_labeling_report(candidates_path: str, labels_path: str, output_path: str):


    # Load candidates and existing labels
    with open(candidates_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    with open(labels_path, 'r', encoding='utf-8') as f:
        labeled_data = json.load(f)

    # Create label lookup
    label_lookup = {l['extension_id']: l for l in labeled_data['labels']}
    anchor_lookup = {a['id']: a for a in data.get('anchors', [])}

    keyword = data.get('keyword', 'unknown')
    anchors = data.get('anchors', [])

    # Combine all extensions
    all_extensions = []
    for ext in data.get('malicious_clones', []):
        ext['_system_prediction'] = 'MALICIOUS_CLONE'
        all_extensions.append(ext)
    for ext in data.get('clones', []):
        ext['_system_prediction'] = 'CLONE'
        all_extensions.append(ext)
    for ext in data.get('legitimate', []):
        ext['_system_prediction'] = 'LEGITIMATE'
        all_extensions.append(ext)

    # Filter to only labeled extensions
    labeled_extensions = [ext for ext in all_extensions if ext['id'] in label_lookup]

    print(f"Found {len(labeled_extensions)} labeled extensions")

    # Generate HTML
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edit Labels - {keyword}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #ffffff;
            color: #333;
            padding: 20px 20px 120px 20px;
        }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        header {{
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 16px;
            border: 1px solid #e9ecef;
        }}
        h1 {{ font-size: 2.5rem; color: #2c3e50; margin-bottom: 10px; }}
        .subtitle {{ color: #666; font-size: 1.1rem; margin-top: 10px; }}

        .pair-card {{
            background: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border: 1px solid #e9ecef;
        }}
        .pair-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e9ecef;
        }}
        .verdict {{
            display: inline-block;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: bold;
            text-transform: uppercase;
        }}
        .verdict-clone {{ background: #fff7ed; color: #ea580c; border: 1px solid #fdba74; }}
        .verdict-malicious {{ background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }}
        .verdict-legitimate {{ background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }}

        .pair-content {{
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 20px;
            align-items: start;
            margin-bottom: 20px;
        }}
        .pair-content.legitimate-only {{
            grid-template-columns: 1fr;
        }}

        .extension-box {{
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }}
        .extension-box strong {{
            display: block;
            margin-bottom: 15px;
            font-size: 0.75rem;
            letter-spacing: 0.5px;
        }}
        .extension-box img {{
            width: 96px;
            height: 96px;
            border-radius: 12px;
            object-fit: cover;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            margin-bottom: 12px;
        }}
        .ext-name {{
            font-size: 1.1rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 5px;
            line-height: 1.3;
        }}
        .ext-developer {{
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 3px;
        }}
        .ext-users {{
            color: #999;
            font-size: 0.85rem;
        }}
        .vs-badge {{
            font-size: 1.8rem;
            font-weight: 900;
            color: #667eea;
            padding: 20px;
            background: #eef2ff;
            border-radius: 8px;
            text-align: center;
            align-self: center;
        }}
        .cws-link {{
            display: inline-block;
            margin-top: 8px;
            padding: 6px 12px;
            background: #e9ecef;
            color: #495057;
            text-decoration: none;
            border-radius: 6px;
            font-size: 0.8rem;
        }}
        .cws-link:hover {{ background: #dee2e6; }}

        .system-prediction {{
            font-size: 0.8rem;
            color: #666;
        }}

        .labeling-section {{
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 12px;
            padding: 20px;
            margin-top: 20px;
        }}
        .labeling-title {{
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 15px;
            font-size: 1.1rem;
        }}
        .label-options {{
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 15px;
        }}
        .label-option {{
            flex: 1;
            min-width: 140px;
            padding: 12px 16px;
            background: white;
            border: 2px solid #dee2e6;
            border-radius: 8px;
            cursor: pointer;
            text-align: center;
            font-weight: 600;
            transition: all 0.2s;
        }}
        .label-option:hover {{
            border-color: #667eea;
            transform: translateY(-2px);
        }}
        .label-option input[type="radio"] {{
            display: none;
        }}
        .label-option input[type="radio"]:checked + span {{
            color: white;
        }}
        .opt-malicious input:checked ~ span,
        .opt-malicious:has(input:checked) {{
            background: #dc3545;
            border-color: #dc3545;
            color: white;
        }}
        .opt-clone input:checked ~ span,
        .opt-clone:has(input:checked) {{
            background: #ffc107;
            border-color: #ffc107;
            color: white;
        }}
        .opt-legitimate input:checked ~ span,
        .opt-legitimate:has(input:checked) {{
            background: #28a745;
            border-color: #28a745;
            color: white;
        }}
        .opt-uncertain input:checked ~ span,
        .opt-uncertain:has(input:checked) {{
            background: #6c757d;
            border-color: #6c757d;
            color: white;
        }}

        .label-notes input {{
            width: 100%;
            padding: 10px;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            font-size: 0.9rem;
        }}

        .evidence-box {{
            background: #fff7ed;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #fdba74;
            margin-top: 15px;
            grid-column: 1 / -1;
        }}
        .evidence-box strong {{
            color: #ea580c;
            display: block;
            margin-bottom: 8px;
        }}

        .progress {{
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            padding: 20px;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            border-top: 2px solid #e9ecef;
        }}
        .progress-bar-wrapper {{
            height: 30px;
            background: #e9ecef;
            border-radius: 15px;
            overflow: hidden;
            margin-bottom: 10px;
        }}
        .progress-fill {{
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }}
        .progress-actions {{
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .btn {{
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }}
        .btn-primary {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }}
        .btn-primary:hover {{
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102,126,234,0.4);
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📝 Edit Your Labels</h1>
            <p class="subtitle">Review and modify your {len(labeled_extensions)} labeled extensions</p>
        </header>
'''

    # Generate extension cards
    for i, ext in enumerate(labeled_extensions):
        ext_id = ext['id']
        label_data = label_lookup[ext_id]
        human_label = label_data.get('human_label', '')
        notes = label_data.get('notes', '')
        system_pred = ext['_system_prediction']

        # Get anchor info
        anchor_id = ext.get('cloned_from_id')
        anchor = None
        for a in anchors:
            if a['id'] == anchor_id:
                anchor = a
                break
        if not anchor and anchors:
            anchor = anchors[0]

        is_legitimate = system_pred == 'LEGITIMATE'
        verdict_class = {
            'MALICIOUS_CLONE': 'verdict-malicious',
            'CLONE': 'verdict-clone',
            'LEGITIMATE': 'verdict-legitimate'
        }.get(system_pred, '')

        # Radio button checked states
        checked = {
            'MALICIOUS_CLONE': 'checked' if human_label == 'MALICIOUS_CLONE' else '',
            'CLONE': 'checked' if human_label == 'CLONE' else '',
            'LEGITIMATE': 'checked' if human_label == 'LEGITIMATE' else '',
            'UNCERTAIN': 'checked' if human_label == 'UNCERTAIN' else ''
        }

        evidence_html = ''
        if 'evidence' in ext and ext['evidence']:
            evidence_text = ext['evidence'] if isinstance(ext['evidence'], str) else ', '.join(ext['evidence'][:3])
            evidence_html = f'''
            <div class="evidence-box">
                <strong>Detection Evidence:</strong>
                {evidence_text[:300]}
            </div>
            '''

        html += f'''
        <div class="pair-card">
            <div class="pair-header">
                <div>
                    <span class="verdict {verdict_class}">{system_pred.replace('_', ' ')}</span>
                    <span class="system-prediction">System Prediction</span>
                </div>
            </div>
'''

        if is_legitimate:
            # Legitimate: show single box
            html += f'''
            <div class="pair-content legitimate-only">
                <div class="extension-box" style="display: flex; gap: 20px; text-align: left; align-items: center;">
                    <img src="{ext.get('icon_url', '')}" alt="{ext.get('name', 'Unknown')}"
                         onerror="this.style.opacity='0.3'">
                    <div>
                        <div class="ext-name">{ext.get('name', 'Unknown Extension')}</div>
                        <div class="ext-developer">by {ext.get('developer', 'Unknown')[:40]}</div>
                        <div class="ext-users">{ext.get('user_count', 0):,} users</div>
                        <a href="https://chromewebstore.google.com/detail/{ext_id}" target="_blank" class="cws-link">View on CWS</a>
                    </div>
                </div>
            </div>
'''
        else:
            # Suspicious: show anchor vs suspect
            anchor_icon = anchor.get('icon_url', '') if anchor else ''
            anchor_name = anchor.get('name', 'Unknown') if anchor else 'Unknown'
            anchor_id_val = anchor.get('id', '') if anchor else ''

            html += f'''
            <div class="pair-content">
                <div class="extension-box">
                    <strong style="color: #2dce89;">ANCHOR</strong>
                    <img src="{anchor_icon}" alt="Anchor" onerror="this.style.opacity='0.3'">
                    <div class="ext-name">{anchor_name}</div>
                    <a href="https://chromewebstore.google.com/detail/{anchor_id_val}" target="_blank" class="cws-link">View on CWS</a>
                </div>
                <div class="vs-badge">VS</div>
                <div class="extension-box">
                    <strong style="color: #f5365c;">SUSPECT</strong>
                    <img src="{ext.get('icon_url', '')}" alt="Suspect" onerror="this.style.opacity='0.3'">
                    <div class="ext-name">{ext.get('name', 'Unknown Extension')}</div>
                    <div class="ext-developer">by {ext.get('developer', 'Unknown')[:30]}</div>
                    <div class="ext-users">{ext.get('user_count', 0):,} users</div>
                    <a href="https://chromewebstore.google.com/detail/{ext_id}" target="_blank" class="cws-link">View on CWS</a>
                </div>
                {evidence_html}
            </div>
'''

        html += f'''
            <div class="labeling-section">
                <div class="labeling-title">Your Label:</div>
                <div class="label-options">
                    <label class="label-option opt-malicious">
                        <input type="radio" name="label_{ext_id}" value="MALICIOUS_CLONE" {checked['MALICIOUS_CLONE']}
                               onchange="saveLabel('{ext_id}', this.value, '{system_pred}')">
                        <span>MALICIOUS CLONE</span>
                    </label>
                    <label class="label-option opt-clone">
                        <input type="radio" name="label_{ext_id}" value="CLONE" {checked['CLONE']}
                               onchange="saveLabel('{ext_id}', this.value, '{system_pred}')">
                        <span>CLONE</span>
                    </label>
                    <label class="label-option opt-legitimate">
                        <input type="radio" name="label_{ext_id}" value="LEGITIMATE" {checked['LEGITIMATE']}
                               onchange="saveLabel('{ext_id}', this.value, '{system_pred}')">
                        <span>LEGITIMATE</span>
                    </label>
                    <label class="label-option opt-uncertain">
                        <input type="radio" name="label_{ext_id}" value="UNCERTAIN" {checked['UNCERTAIN']}
                               onchange="saveLabel('{ext_id}', this.value, '{system_pred}')">
                        <span>UNCERTAIN</span>
                    </label>
                </div>
                <div class="label-notes">
                    <input type="text" placeholder="Optional notes..." value="{notes}"
                           onchange="saveNotes('{ext_id}', this.value)" id="notes_{ext_id}">
                </div>
            </div>
        </div>
'''

    html += f'''
    </div>

    <div class="progress">
        <div class="progress-bar-wrapper">
            <div class="progress-fill" id="progressFill">0 / {len(labeled_extensions)}</div>
        </div>
        <div class="progress-actions">
            <div id="progressText">Make changes and download updated labels</div>
            <button class="btn btn-primary" onclick="downloadLabels()">
                💾 Download Updated Labels
            </button>
        </div>
    </div>

    <script>
        let labels = {{}};
        let notes = {{}};

        // Pre-load existing labels
        const existingLabels = {json.dumps({l['extension_id']: {'human_label': l.get('human_label', ''), 'notes': l.get('notes', ''), 'system_prediction': l.get('system_prediction', '')} for l in labeled_data['labels']})};

        for (const [extId, data] of Object.entries(existingLabels)) {{
            labels[extId] = {{
                human_label: data.human_label,
                system_prediction: data.system_prediction,
                is_correct: data.human_label === data.system_prediction,
                notes: data.notes || '',
                timestamp: new Date().toISOString()
            }};
            notes[extId] = data.notes || '';
        }}

        updateProgress();

        function saveLabel(extId, humanLabel, systemPred) {{
            labels[extId] = {{
                human_label: humanLabel,
                system_prediction: systemPred,
                is_correct: humanLabel === systemPred,
                notes: notes[extId] || '',
                timestamp: new Date().toISOString()
            }};
            updateProgress();
        }}

        function saveNotes(extId, noteText) {{
            notes[extId] = noteText;
            if (labels[extId]) {{
                labels[extId].notes = noteText;
            }}
        }}

        function updateProgress() {{
            const total = {len(labeled_extensions)};
            const labeled = Object.keys(labels).length;
            const percent = (labeled / total) * 100;

            document.getElementById('progressFill').style.width = percent + '%';
            document.getElementById('progressFill').textContent = labeled + ' / ' + total;
            document.getElementById('progressText').textContent =
                labeled === total ? '✅ All extensions labeled!' : `${{total - labeled}} remaining`;
        }}

        function downloadLabels() {{
            const labelsList = [];
            for (const [extId, label] of Object.entries(labels)) {{
                labelsList.push({{
                    extension_id: extId,
                    ...label
                }});
            }}

            const correct = labelsList.filter(l => l.is_correct).length;
            const total = labelsList.length;
            const tp = labelsList.filter(l => l.human_label !== 'LEGITIMATE' && l.is_correct).length;
            const fp = labelsList.filter(l => l.human_label === 'LEGITIMATE' && l.system_prediction !== 'LEGITIMATE').length;
            const tn = labelsList.filter(l => l.human_label === 'LEGITIMATE' && l.system_prediction === 'LEGITIMATE').length;
            const fn = labelsList.filter(l => l.human_label !== 'LEGITIMATE' && l.system_prediction === 'LEGITIMATE').length;

            const precision = tp / (tp + fp) || 0;
            const recall = tp / (tp + fn) || 0;
            const f1 = 2 * precision * recall / (precision + recall) || 0;

            const output = {{
                labeled: total,
                timestamp: new Date().toISOString(),
                labels: labelsList,
                metrics: {{
                    total: total,
                    tp: tp,
                    fp: fp,
                    tn: tn,
                    fn: fn,
                    precision: precision.toFixed(3),
                    recall: recall.toFixed(3),
                    f1: f1.toFixed(3)
                }}
            }};

            const blob = new Blob([JSON.stringify(output, null, 2)], {{ type: 'application/json' }});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'combined_groundtruth.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert(`Downloaded ${{total}} labels!\\n\\nMetrics:\\nPrecision: ${{(precision * 100).toFixed(1)}}%\\nRecall: ${{(recall * 100).toFixed(1)}}%\\nF1: ${{(f1 * 100).toFixed(1)}}%`);
        }}
    </script>
</body>
</html>
'''

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"Generated labeling interface: {output_path}")
    print(f"Total extensions: {len(labeled_extensions)}")

if __name__ == '__main__':
    generate_prefilled_labeling_report(
        'combined_candidates.json',
        'ground_truth_labeled.json',
        'edit_labels.html'
    )
