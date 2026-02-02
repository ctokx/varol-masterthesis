#!/usr/bin/env python3
"""
Generate an interactive HTML report with labeling functionality.
For creating ground truth validation data for the clone detection system.
"""

import json
import sys
from datetime import datetime


def generate_labeling_report(json_path: str, output_path: str = None) -> str:
    """Generate HTML report with labeling UI for ground truth creation."""

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if output_path is None:
        output_path = json_path.replace('.json', '_labeling.html')

    keyword = data.get('keyword', 'unknown')
    anchors = data.get('anchors', [])
    clones = data.get('clones', [])
    malicious = data.get('malicious_clones', [])
    legitimate = data.get('legitimate', [])
    stats = data.get('stats', {})

    anchor_lookup = {a['id']: a for a in anchors}
    total_extensions = len(malicious) + len(clones) + len(legitimate)

    # Generate labeling section HTML
    def labeling_section(ext_id, system_prediction):
        return f'''
        <div class="labeling-section">
            <div class="labeling-title">
                <span>Your Label:</span>
                <span class="labeled-badge hidden">Labeled</span>
            </div>
            <div class="label-options">
                <label class="label-option opt-malicious">
                    <input type="radio" name="label_{ext_id}" value="MALICIOUS_CLONE"
                           onchange="saveLabel('{ext_id}', this.value, '{system_prediction}')">
                    <span>MALICIOUS CLONE</span>
                </label>
                <label class="label-option opt-clone">
                    <input type="radio" name="label_{ext_id}" value="CLONE"
                           onchange="saveLabel('{ext_id}', this.value, '{system_prediction}')">
                    <span>CLONE</span>
                </label>
                <label class="label-option opt-legitimate">
                    <input type="radio" name="label_{ext_id}" value="LEGITIMATE"
                           onchange="saveLabel('{ext_id}', this.value, '{system_prediction}')">
                    <span>LEGITIMATE</span>
                </label>
                <label class="label-option opt-uncertain">
                    <input type="radio" name="label_{ext_id}" value="UNCERTAIN"
                           onchange="saveLabel('{ext_id}', this.value, '{system_prediction}')">
                    <span>UNCERTAIN</span>
                </label>
            </div>
            <div class="label-notes">
                <input type="text" placeholder="Optional notes..."
                       onchange="saveNotes('{ext_id}', this.value)" id="notes_{ext_id}">
            </div>
        </div>'''

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clone Detection Labeling - {keyword}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #ffffff;
            color: #333333;
            min-height: 100vh;
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
        h1 {{
            font-size: 2.5rem;
            color: #2c3e50;
            margin-bottom: 10px;
        }}
        .stats {{
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-top: 20px;
            flex-wrap: wrap;
        }}
        .stat-box {{
            background: #ffffff;
            padding: 15px 25px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid #e9ecef;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }}
        .stat-number {{ font-size: 2rem; font-weight: bold; color: #2c3e50; }}
        .stat-label {{ font-size: 0.9rem; color: #666; }}
        .section {{ margin-bottom: 40px; }}
        .section-title {{
            font-size: 1.5rem;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e9ecef;
            color: #2c3e50;
        }}
        .pair-card {{
            background: #ffffff;
            border: 1px solid #e9ecef;
            border-radius: 16px;
            margin-bottom: 20px;
            overflow: hidden;
            transition: transform 0.2s;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }}
        .pair-card:hover {{ transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }}
        .pair-card.labeled {{ border: 2px solid #2dce89; }}
        .pair-card.labeled .pair-header {{ background: rgba(45, 206, 137, 0.1); }}
        .pair-header {{
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e9ecef;
            background: #f8f9fa;
        }}
        .similarity-badge {{ padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 0.9rem; }}
        .sim-high {{ background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }}
        .sim-medium {{ background: #fef3c7; color: #d97706; border: 1px solid #fcd34d; }}
        .sim-low {{ background: #d1fae5; color: #059669; border: 1px solid #6ee7b7; }}
        .pair-content {{
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 20px;
            padding: 25px;
            align-items: start;
        }}
        .extension-box {{ text-align: center; }}
        .extension-box img {{
            width: 128px;
            height: 128px;
            border-radius: 16px;
            margin-bottom: 15px;
            background: white;
            padding: 10px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            border: 1px solid #e9ecef;
        }}
        .ext-name {{ font-size: 1.1rem; font-weight: 600; margin-bottom: 5px; word-break: break-word; color: #2c3e50; }}
        .ext-developer {{ color: #666; font-size: 0.85rem; margin-bottom: 8px; }}
        .ext-users {{ display: inline-block; background: #e9ecef; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; color: #495057; }}
        .vs-badge {{
            display: flex;
            align-items: center;
            justify-content: center;
            width: 50px;
            height: 50px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 50%;
            font-weight: bold;
            align-self: center;
            color: #6c757d;
        }}
        .evidence-box {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
            font-size: 0.85rem;
            line-height: 1.5;
            grid-column: 1 / -1;
            border: 1px solid #e9ecef;
            color: #2c3e50;
        }}
        .red-flag {{
            display: inline-block;
            background: #fee2e2;
            color: #dc2626;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 0.8rem;
            margin: 3px;
            border: 1px solid #fca5a5;
        }}
        .verdict {{ display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }}
        .verdict-clone {{ background: #fff7ed; color: #ea580c; border: 1px solid #fdba74; }}
        .verdict-malicious {{ background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }}
        .verdict-legitimate {{ background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }}
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
        .filter-bar {{ display: flex; gap: 10px; margin-bottom: 30px; flex-wrap: wrap; }}
        .filter-btn {{
            padding: 10px 20px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            background: #ffffff;
            color: #495057;
            cursor: pointer;
        }}
        .filter-btn:hover, .filter-btn.active {{ background: #e9ecef; border-color: #ced4da; color: #212529; }}
        .filter-btn.unlabeled-filter {{ background: #fff7ed; border: 1px solid #fdba74; color: #ea580c; }}
        .filter-btn.unlabeled-filter:hover, .filter-btn.unlabeled-filter.active {{ background: #ffedd5; }}
        .hidden {{ display: none !important; }}

        /* Labeling styles */
        .labeling-section {{
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 12px;
            padding: 15px 20px;
            margin-top: 15px;
            grid-column: 1 / -1;
        }}
        .labeling-title {{ font-weight: bold; color: #2c3e50; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; }}
        .labeled-badge {{ background: #2dce89; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }}
        .label-options {{ display: flex; gap: 12px; flex-wrap: wrap; }}
        .label-option {{
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            background: #ffffff;
            border-radius: 8px;
            cursor: pointer;
            border: 1px solid #e9ecef;
        }}
        .label-option:hover {{ background: #f8f9fa; }}
        .label-option.selected {{ border-color: #667eea; background: #eef2ff; }}
        .label-option input {{ width: 18px; height: 18px; cursor: pointer; accent-color: #667eea; }}
        .label-option.opt-malicious {{ border-left: 4px solid #f5365c; }}
        .label-option.opt-clone {{ border-left: 4px solid #fb6340; }}
        .label-option.opt-legitimate {{ border-left: 4px solid #2dce89; }}
        .label-option.opt-uncertain {{ border-left: 4px solid #ffd600; }}
        .label-notes {{ margin-top: 12px; }}
        .label-notes input {{
            width: 100%;
            padding: 10px 15px;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            background: #ffffff;
            color: #333;
        }}
        .label-notes input:focus {{ outline: none; border-color: #667eea; }}

        /* Floating bar */
        .floating-bar {{
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #ffffff;
            padding: 15px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #e9ecef;
            z-index: 1000;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.05);
        }}
        .progress-info {{ display: flex; align-items: center; gap: 20px; }}
        .progress-bar-container {{ width: 200px; height: 10px; background: #e9ecef; border-radius: 5px; overflow: hidden; }}
        .progress-bar {{ height: 100%; background: #667eea; transition: width 0.3s; }}
        .progress-text {{ color: #666; }}
        .progress-text strong {{ color: #2dce89; }}
        .action-buttons {{ display: flex; gap: 12px; }}
        .action-btn {{ padding: 12px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }}
        .btn-save {{ background: #667eea; color: white; }}
        .btn-export {{ background: #f0fdf4; color: #16a34a; border: 1px solid #86efac; }}
        .btn-clear {{ background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }}
        .toast {{ position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: bold; z-index: 2000; animation: slideIn 0.3s; }}
        .toast.success {{ background: #2dce89; }}
        .toast.info {{ background: #667eea; }}
        @keyframes slideIn {{ from {{ transform: translateX(100%); opacity: 0; }} to {{ transform: translateX(0); opacity: 1; }} }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Clone Detection Labeling</h1>
            <p>Keyword: <strong>{keyword}</strong> | {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
            <div class="stats">
                <div class="stat-box">
                    <div class="stat-number">{total_extensions}</div>
                    <div class="stat-label">Total Extensions</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number" style="color: #f5365c;">{len(malicious)}</div>
                    <div class="stat-label">Malicious</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number" style="color: #fb6340;">{len(clones)}</div>
                    <div class="stat-label">Clones</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number" style="color: #2dce89;">{len(legitimate)}</div>
                    <div class="stat-label">Legitimate</div>
                </div>
            </div>
        </header>

        <div class="filter-bar">
            <button class="filter-btn active" onclick="filterCards('all')">All</button>
            <button class="filter-btn" onclick="filterCards('malicious')">Malicious</button>
            <button class="filter-btn" onclick="filterCards('clone')">Clones</button>
            <button class="filter-btn" onclick="filterCards('legitimate')">Legitimate</button>
            <button class="filter-btn unlabeled-filter" onclick="filterCards('unlabeled')">Unlabeled</button>
        </div>

        <div class="section" id="pairs-container">
'''

    # Process suspicious extensions
    all_suspicious = malicious + clones
    all_suspicious.sort(key=lambda x: x.get('icon_similarity', 0), reverse=True)

    for item in all_suspicious:
        is_malicious = item['relationship'] == 'MALICIOUS_CLONE'
        sim_score = item.get('icon_similarity', 0)
        sim_class = 'sim-high' if sim_score >= 0.7 else ('sim-medium' if sim_score >= 0.5 else 'sim-low')
        verdict_class = 'verdict-malicious' if is_malicious else 'verdict-clone'
        system_pred = 'MALICIOUS_CLONE' if is_malicious else 'CLONE'

        cloned_from_icon = item.get('cloned_from_icon_url', '')
        if not cloned_from_icon and item.get('cloned_from_id'):
            anchor_data = anchor_lookup.get(item['cloned_from_id'], {})
            cloned_from_icon = anchor_data.get('icon_url', '')

        suspect_icon = item.get('icon_url', '')
        ext_id = item['id']

        html += f'''
            <div class="pair-card" data-type="{'malicious' if is_malicious else 'clone'}" data-sim="{sim_score}" data-ext-id="{ext_id}">
                <div class="pair-header">
                    <div>
                        <span class="verdict {verdict_class}">{'MALICIOUS' if is_malicious else 'CLONE'}</span>
                        <span style="margin-left: 10px; color: #888;">Conf: {item['confidence']:.0%}</span>
                    </div>
                    <span class="similarity-badge {sim_class}">{sim_score:.0%} Similar</span>
                </div>
                <div class="pair-content">
                    <div class="extension-box">
                        <strong style="color: #2dce89;">ANCHOR</strong><br><br>
                        <img src="{cloned_from_icon}" alt="Anchor" onerror="this.style.opacity='0.3'">
                        <div class="ext-name">{item.get('cloned_from', 'Unknown')}</div>
                        <a href="https://chromewebstore.google.com/detail/{item.get('cloned_from_id', '')}" target="_blank" class="cws-link">View</a>
                    </div>
                    <div class="vs-badge">VS</div>
                    <div class="extension-box">
                        <strong style="color: #f5365c;">SUSPECT</strong><br><br>
                        <img src="{suspect_icon}" alt="Suspect" onerror="this.style.opacity='0.3'">
                        <div class="ext-name">{item['name']}</div>
                        <div class="ext-developer">by {item['developer'][:30]}</div>
                        <div class="ext-users">{item['user_count']:,} users</div>
                        <a href="https://chromewebstore.google.com/detail/{item['id']}" target="_blank" class="cws-link">View</a>
                    </div>
                    <div class="evidence-box">
                        <strong>Evidence:</strong> {item.get('evidence', 'N/A')[:400]}...
                        <div style="margin-top: 10px;">
'''
        for flag in item.get('red_flags', [])[:3]:
            html += f'<span class="red-flag">{flag[:50]}</span>'

        html += f'''
                        </div>
                    </div>
                    {labeling_section(ext_id, system_pred)}
                </div>
            </div>
'''

    # Process legitimate extensions
    for item in legitimate:
        ext_id = item.get('id', '')
        suspect_icon = item.get('icon_url', '')

        html += f'''
            <div class="pair-card" data-type="legitimate" data-sim="0" data-ext-id="{ext_id}">
                <div class="pair-header">
                    <span class="verdict verdict-legitimate">LEGITIMATE</span>
                </div>
                <div class="pair-content" style="grid-template-columns: 1fr;">
                    <div class="extension-box" style="display: flex; gap: 20px; text-align: left; align-items: center;">
                        <img src="{suspect_icon}" alt="Icon" style="width: 64px; height: 64px;" onerror="this.style.opacity='0.3'">
                        <div>
                            <div class="ext-name">{item.get('name', 'Unknown')}</div>
                            <div class="ext-developer">by {item.get('developer', 'Unknown')[:40]}</div>
                            <div class="ext-users">{item.get('user_count', 0):,} users</div>
                        </div>
                    </div>
                    {labeling_section(ext_id, 'LEGITIMATE')}
                </div>
            </div>
'''

    # JavaScript for labeling functionality
    html += f'''
        </div>
    </div>

    <div class="floating-bar">
        <div class="progress-info">
            <div class="progress-bar-container">
                <div class="progress-bar" id="progress-bar" style="width: 0%"></div>
            </div>
            <div class="progress-text"><strong id="labeled-count">0</strong> / {total_extensions} labeled</div>
        </div>
        <div class="action-buttons">
            <button class="action-btn btn-clear" onclick="clearAllLabels()">Clear</button>
            <button class="action-btn btn-export" onclick="exportLabels()">Export</button>
            <button class="action-btn btn-save" onclick="downloadLabels()">Download</button>
        </div>
    </div>

    <script>
        const STORAGE_KEY = 'labels_{keyword}';
        const TOTAL = {total_extensions};
        let labels = {{}};

        function loadLabels() {{
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {{
                labels = JSON.parse(stored);
                Object.keys(labels).forEach(id => {{
                    const l = labels[id];
                    const r = document.querySelector(`input[name="label_${{id}}"][value="${{l.human_label}}"]`);
                    if (r) {{
                        r.checked = true;
                        r.closest('.label-option').classList.add('selected');
                        const c = document.querySelector(`.pair-card[data-ext-id="${{id}}"]`);
                        if (c) c.classList.add('labeled');
                        c?.querySelector('.labeled-badge')?.classList.remove('hidden');
                    }}
                    const n = document.getElementById(`notes_${{id}}`);
                    if (n && l.notes) n.value = l.notes;
                }});
                updateProgress();
            }}
        }}

        function saveLabel(id, human, system) {{
            labels[id] = {{
                extension_id: id,
                human_label: human,
                system_prediction: system,
                is_correct: human === system,
                notes: labels[id]?.notes || '',
                timestamp: new Date().toISOString()
            }};
            const c = document.querySelector(`.pair-card[data-ext-id="${{id}}"]`);
            if (c) {{
                c.classList.add('labeled');
                c.querySelector('.labeled-badge')?.classList.remove('hidden');
            }}
            document.querySelectorAll(`input[name="label_${{id}}"]`).forEach(r => {{
                r.closest('.label-option').classList.toggle('selected', r.checked);
            }});
            localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
            updateProgress();
            showToast('Saved!', 'success');
        }}

        function saveNotes(id, notes) {{
            if (labels[id]) {{
                labels[id].notes = notes;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
            }}
        }}

        function updateProgress() {{
            const count = Object.keys(labels).length;
            document.getElementById('labeled-count').textContent = count;
            document.getElementById('progress-bar').style.width = (count / TOTAL * 100) + '%';
        }}

        function showToast(msg, type) {{
            const t = document.createElement('div');
            t.className = `toast ${{type}}`;
            t.textContent = msg;
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 2000);
        }}

        function calcMetrics() {{
            const vals = Object.values(labels);
            if (!vals.length) return null;
            let tp=0, fp=0, tn=0, fn=0;
            vals.forEach(l => {{
                const pred = l.system_prediction !== 'LEGITIMATE';
                const actual = l.human_label !== 'LEGITIMATE' && l.human_label !== 'UNCERTAIN';
                if (pred && actual) tp++;
                else if (pred && !actual) fp++;
                else if (!pred && !actual) tn++;
                else fn++;
            }});
            const prec = tp+fp > 0 ? tp/(tp+fp) : 0;
            const rec = tp+fn > 0 ? tp/(tp+fn) : 0;
            const f1 = prec+rec > 0 ? 2*prec*rec/(prec+rec) : 0;
            return {{ total: vals.length, tp, fp, tn, fn, precision: prec.toFixed(3), recall: rec.toFixed(3), f1: f1.toFixed(3) }};
        }}

        function downloadLabels() {{
            const data = {{
                keyword: '{keyword}',
                total: TOTAL,
                labeled: Object.keys(labels).length,
                date: new Date().toISOString(),
                labels: Object.values(labels),
                metrics: calcMetrics()
            }};
            const blob = new Blob([JSON.stringify(data, null, 2)], {{type: 'application/json'}});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = '{keyword}_ground_truth.json';
            a.click();
            showToast('Downloaded!', 'success');
        }}

        function exportLabels() {{
            console.log(JSON.stringify({{
                keyword: '{keyword}',
                labels: Object.values(labels),
                metrics: calcMetrics()
            }}, null, 2));
            showToast('Exported to console (F12)', 'info');
        }}

        function clearAllLabels() {{
            if (confirm('Clear all labels?')) {{
                labels = {{}};
                localStorage.removeItem(STORAGE_KEY);
                document.querySelectorAll('.pair-card').forEach(c => {{
                    c.classList.remove('labeled');
                    c.querySelector('.labeled-badge')?.classList.add('hidden');
                }});
                document.querySelectorAll('input[type="radio"]').forEach(r => {{
                    r.checked = false;
                    r.closest('.label-option').classList.remove('selected');
                }});
                document.querySelectorAll('.label-notes input').forEach(i => i.value = '');
                updateProgress();
            }}
        }}

        function filterCards(type) {{
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            event.target.classList.add('active');
            document.querySelectorAll('.pair-card').forEach(c => {{
                const t = c.dataset.type;
                const labeled = c.classList.contains('labeled');
                if (type === 'all') c.classList.remove('hidden');
                else if (type === 'unlabeled') c.classList.toggle('hidden', labeled);
                else c.classList.toggle('hidden', t !== type);
            }});
        }}

        document.addEventListener('DOMContentLoaded', loadLabels);
    </script>
</body>
</html>
'''

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"Labeling report generated: {output_path}")
    print(f"Total extensions to label: {total_extensions}")

    return output_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_labeling_report.py <results.json> [output.html]")
        sys.exit(1)

    json_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    generate_labeling_report(json_path, output_path)
