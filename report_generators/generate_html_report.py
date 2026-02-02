#!/usr/bin/env python3
"""
Generate an interactive HTML report for reviewing detected clone pairs.
Shows side-by-side icon comparisons for easy manual verification.
"""

import json
import os
from datetime import datetime


def generate_html_report(json_path: str, output_path: str = None) -> str:
    """
    Generate an HTML report from clone detection JSON results.
    
    Args:
        json_path: Path to the clone detection JSON results
        output_path: Output HTML path (default: same directory as JSON)
    
    Returns:
        Path to the generated HTML file
    """
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if output_path is None:
        output_path = json_path.replace('.json', '_review.html')
    
    keyword = data.get('keyword', 'unknown')
    anchors = data.get('anchors', [])
    clones = data.get('clones', [])
    malicious = data.get('malicious_clones', [])
    legitimate = data.get('legitimate', [])
    stats = data.get('stats', {})
    
    # Create anchor lookup for icon URLs
    anchor_lookup = {a['id']: a for a in anchors}
    
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clone Detection Review - {keyword}</title>
    <style>
        :root {{
            --primary: #5e72e4;
            --secondary: #825ee4;
            --success: #2dce89;
            --danger: #f5365c;
            --warning: #fb6340;
            --info: #11cdef;
            --light: #f8f9fe;
            --dark: #172b4d;
            --text: #32325d;
            --text-muted: #8898aa;
            --border: #e9ecef;
        }}
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fe;
            color: var(--text);
            line-height: 1.5;
            padding: 40px 20px;
        }}
        .container {{
            max-width: 1600px;
            margin: 0 auto;
        }}
        header {{
            text-align: center;
            margin-bottom: 50px;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08);
        }}
        h1 {{
            font-size: 2.2rem;
            color: var(--dark);
            margin-bottom: 10px;
            font-weight: 700;
        }}
        .stats {{
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 30px;
            flex-wrap: wrap;
        }}
        .stat-box {{
            background: var(--light);
            padding: 15px 30px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid var(--border);
            min-width: 140px;
        }}
        .stat-number {{
            font-size: 2rem;
            font-weight: 700;
            line-height: 1.2;
            color: var(--primary);
        }}
        .stat-label {{
            font-size: 0.875rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
        }}
        
        /* Grid Layout for Cards */
        #pairs-container {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
            gap: 30px;
            width: 100%;
        }}
        
        .section-title {{
            font-size: 1.5rem;
            margin: 40px 0 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid var(--border);
            color: var(--dark);
            grid-column: 1 / -1;
        }}
        
        .pair-card {{
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
            transition: all 0.2s ease;
            border: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }}
        .pair-card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(50,50,93,0.1), 0 5px 15px rgba(0,0,0,0.07);
        }}
        
        /* Compact Grid Card Header */
        .pair-header {{
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border);
            background: #fafbff;
        }}
        .verdict {{
            font-size: 0.75rem;
            font-weight: 800;
            text-transform: uppercase;
            padding: 4px 10px;
            border-radius: 4px;
            letter-spacing: 0.5px;
        }}
        .verdict-malicious {{ background: #ffd6e0; color: var(--danger); }}
        .verdict-clone {{ background: #fff0e6; color: var(--warning); }}
        .verdict-legitimate {{ background: #e0fcea; color: var(--success); }}
        
        .similarity-badge {{
            font-size: 0.85rem;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 20px;
        }}
        .sim-high {{ background: #fdd1da; color: var(--danger); }}
        .sim-medium {{ background: #ffe6cc; color: var(--warning); }}
        .sim-low {{ background: #ccf5e3; color: var(--success); }}
        
        .pair-content {{
            padding: 20px;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }}
        
        /* Layout for comparison: Anchor | VS | Suspect */
        .comparison-row {{
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 15px;
            align-items: center;
        }}
        
        .extension-box {{
            text-align: center;
        }}
        .extension-box img {{
            width: 80px;
            height: 80px;
            border-radius: 12px;
            margin-bottom: 10px;
            border: 1px solid var(--border);
            padding: 5px;
            background: white;
        }}
        .ext-role {{
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 8px;
            display: block;
        }}
        .ext-name {{
            font-size: 0.95rem;
            font-weight: 600;
            line-height: 1.3;
            margin-bottom: 5px;
            height: 2.6em; /* Limit to 2 lines */
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }}
        .ext-meta {{
            font-size: 0.75rem;
            color: var(--text-muted);
        }}
        
        .vs-badge {{
            font-weight: 900;
            color: var(--text-muted);
            font-size: 0.9rem;
            background: var(--light);
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        
        .evidence-section {{
            background: #f6f9fc;
            border-radius: 6px;
            padding: 12px;
            font-size: 0.85rem;
            color: #525f7f;
            margin-top: 10px;
        }}
        .evidence-title {{
            font-weight: 600;
            margin-bottom: 5px;
            display: block;
            color: var(--dark);
        }}
        
        .static-analysis-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 10px;
            margin-top: 15px;
            width: 100%;
        }}
        .sa-metric {{
            background: white;
            padding: 10px;
            border-radius: 6px;
            border: 1px solid var(--border);
            text-align: center;
            min-width: 0;
            word-wrap: break-word;
        }}
        .sa-value {{ font-weight: 700; color: var(--dark); }}
        .sa-label {{ font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; }}
        .risk-high {{ color: var(--danger); }}
        
        .red-flag {{
            display: inline-block;
            padding: 2px 8px;
            background: #fff5f5;
            color: var(--danger);
            border: 1px solid #fed7d7;
            border-radius: 4px;
            font-size: 0.75rem;
            margin: 2px;
        }}
        
        /* Filter Bar */
        .filter-bar {{
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 30px;
            position: sticky;
            top: 20px;
            z-index: 100;
        }}
        .filter-btn {{
            background: white;
            border: 1px solid var(--border);
            color: var(--text);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }}
        .filter-btn:hover {{ background: var(--light); border-color: #cbd5e0; }}
        .filter-btn.active {{ background: var(--dark); color: white; border-color: var(--dark); }}
        
        .anchors-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .anchor-card {{
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        }}
        .anchor-card img {{
            width: 64px;
            height: 64px;
            border-radius: 8px;
            margin-bottom: 10px;
            background: white;
            padding: 5px;
        }}
        .hidden {{ display: none !important; }}
        @media (max-width: 768px) {{
            .pair-content {{
                grid-template-columns: 1fr;
            }}
            .vs-badge {{
                margin: 10px auto;
            }}
        }}

        .cws-btn {{
            display: inline-block;
            margin-top: 5px;
            font-size: 0.75rem;
            color: var(--primary);
            text-decoration: none;
            font-weight: 600;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔍 Clone Detection Review</h1>
            <p>Keyword: <strong>{keyword}</strong> | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
            <div class="stats">
                <div class="stat-box">
                    <div class="stat-number">{stats.get('total_extensions', len(anchors) + len(clones) + len(legitimate))}</div>
                    <div class="stat-label">Total Extensions</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number" style="color: var(--danger);">{len(malicious)}</div>
                    <div class="stat-label">Malicious Clones</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number" style="color: var(--warning);">{len(clones)}</div>
                    <div class="stat-label">Clones</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number" style="color: var(--success);">{len(legitimate)}</div>
                    <div class="stat-label">Legitimate</div>
                </div>
            </div>
        </header>
        
        <div class="section">
            <h2 class="section-title">✅ Verified Anchors ({len(anchors)})</h2>
            <div class="anchors-grid">
'''
    
    # Get anchor analysis for display
    anchor_analysis = data.get('anchor_static_analysis', {})
    anchor_endpoints = anchor_analysis.get('endpoints', [])

    for anchor in anchors:
        icon_url = anchor.get('icon_url', '')
        
        # Format endpoints list
        endpoints_html = ''
        if anchor_endpoints:
            endpoints_html = f'''
                <details style="margin-top: 15px; text-align: left; border-top: 1px solid var(--border); padding-top: 10px;">
                    <summary style="cursor: pointer; color: var(--success); font-size: 0.9rem; font-weight: bold;">
                        ✓ Verified Endpoints ({len(anchor_endpoints)})
                    </summary>
                    <div style="background: var(--light); padding: 10px; border-radius: 6px; margin-top: 10px; max-height: 200px; overflow-y: auto; font-size: 0.75rem; color: var(--text-muted); border: 1px solid var(--border);">
                        {'<br>'.join([f'<div style="margin-bottom:4px; word-break:break-all;">{ep}</div>' for ep in anchor_endpoints])}
                    </div>
                </details>
            '''
        
        html += f'''
                <div class="anchor-card" style="background: white; border: 1px solid var(--border);">
                    <img src="{icon_url}" alt="Icon" onerror="this.style.display='none'">
                    <div class="ext-name">{anchor['name'][:40]}...</div>
                    <div class="ext-developer">{anchor['developer'][:30]}...</div>
                    <div class="ext-users">{anchor['user_count']:,} users</div>
                    {endpoints_html}
                </div>
'''
    
    html += '''
            </div>
        </div>
        
        <div class="filter-bar">
            <button class="filter-btn active" onclick="filterCards('all')">All Results</button>
            <button class="filter-btn" onclick="filterCards('malicious')">🔴 Malicious Only</button>
            <button class="filter-btn" onclick="filterCards('clone')">🟠 Clones Only</button>
            <button class="filter-btn" onclick="filterCards('legitimate')">🟢 Legitimate Only</button>
            <button class="filter-btn" onclick="filterCards('high')">High Similarity (≥70%)</button>
        </div>
        
        <div class="section" id="pairs-container">
            <h2 class="section-title">📊 All Analyzed Extensions</h2>
'''
    
    # Combine malicious clones and clones for display
    all_suspicious = malicious + clones
    all_suspicious.sort(key=lambda x: x.get('icon_similarity', 0), reverse=True)
    
    for item in all_suspicious:
        is_malicious = item['relationship'] == 'MALICIOUS_CLONE'
        sim_score = item.get('icon_similarity', 0)
        sim_class = 'sim-high' if sim_score >= 0.7 else ('sim-medium' if sim_score >= 0.5 else 'sim-low')
        verdict_class = 'verdict-malicious' if is_malicious else 'verdict-clone'
        
        # Get anchor info
        cloned_from_icon = item.get('cloned_from_icon_url', '')
        if not cloned_from_icon and item.get('cloned_from_id'):
            anchor_data = anchor_lookup.get(item['cloned_from_id'], {})
            cloned_from_icon = anchor_data.get('icon_url', '')
        
        suspect_icon = item.get('icon_url', '')
        
        html += f'''
            <div class="pair-card" data-type="{'malicious' if is_malicious else 'clone'}" data-sim="{sim_score}">
                <div class="pair-header">
                    <div>
                        <span class="verdict {verdict_class}">{'MALICIOUS CLONE' if is_malicious else 'CLONE'}</span>
                        <span style="margin-left: 10px; color: var(--text-muted); font-size: 0.8rem;">Conf: {item['confidence']:.0%}</span>
                    </div>
                    <span class="similarity-badge {sim_class}">{sim_score:.0%} Similar</span>
                </div>
                <div class="pair-content">
                    <div class="comparison-row">
                        <div class="extension-box">
                            <span class="ext-role" style="color: var(--success);">ANCHOR</span>
                            <img src="{cloned_from_icon}" alt="Original Icon" onerror="this.style.opacity='0.3'">
                            <div class="ext-name">{item.get('cloned_from', 'Unknown')}</div>
                        </div>
                        
                        <div class="vs-badge">VS</div>
                        
                        <div class="extension-box">
                            <span class="ext-role" style="color: var(--danger);">SUSPECT</span>
                            <img src="{suspect_icon}" alt="Suspect Icon" onerror="this.style.opacity='0.3'">
                            <div class="ext-name">{item['name']}</div>
                            <div class="ext-meta">by {item['developer'][:30]}</div>
                        </div>
                    </div>
                    
                    <div class="evidence-section">
                        <span class="evidence-title">📋 Evidence</span>
                        {item.get('evidence', 'No evidence provided')[:300]}...
                        
                        <div class="red-flags">
'''
        
        for flag in item.get('red_flags', [])[:3]:
            html += f'<span class="red-flag">⚠️ {flag}</span>'
        
        html += '</div></div>'
        
    # Helper to clean static analysis strings
    def clean_url(s):
        if not s: return ""
        # Remove [ENDPOINT] prefix
        s = s.replace("[ENDPOINT] ", "").replace("[EXT] ", "")
        # Remove trailing file info
        if " " in s:  # Split by space to check for file info at end
            parts = s.split(" ")
            # If the part looks like a source file (has extension or line number), drop it
            if "." in parts[-1] or ":" in parts[-1]:
                s = parts[0]
        return s.strip()

    for item in all_suspicious:
        # ... (rest of loop setup) ...
        
        # Add static analysis results if present
        static = item.get('static_analysis', {})
        if static.get('success'):
            raw_endpoints = static.get('network_endpoints', [])
            endpoints = [clean_url(e) for e in raw_endpoints]
            
            api_abuse = static.get('chrome_api_abuse', [])
            
            # Use security risks for patterns if malicious_patterns is empty
            malicious_patterns = static.get('malicious_patterns', [])
            risks = static.get('security_risks', {})
            all_risks = risks.get('CRITICAL', []) + risks.get('HIGH', []) + risks.get('MEDIUM', [])
            risk_count = len(malicious_patterns) + len(all_risks)
            
            endpoint_diff = static.get('endpoint_diff', {})
            new_endpoints = endpoint_diff.get('new_endpoints', [])
            new_count = endpoint_diff.get('new_count', 0)
            
            # Calculate endpoint diff if not present in JSON
            if not new_endpoints and endpoints:
                 anchor_id = item.get('cloned_from_id')
                 if anchor_id and anchor_id in anchor_lookup:
                     anchor_data = anchor_lookup[anchor_id]
                     anchor_static = anchor_data.get('static_analysis', {})
                     anchor_eps = set([clean_url(e) for e in anchor_static.get('network_endpoints', [])])
                     
                     # Filter out endpoints that match anchor (relaxed matching)
                     suspicious_eps = []
                     for ep in endpoints:
                         # Skip if exact match
                         if ep in anchor_eps: continue
                         
                         # Skip if domain match (e.g. if anchor checks chatgpt.com, ignore subdomains/paths)
                         # This handles the chat.openai.com vs chatgpt.com case if specific logic added,
                         # but for now we just rely on the set difference.
                         # Note: Anchor has 'chatgpt.com', clone has 'chat.openai.com'. 
                         # Technically they ARE different.
                         suspicious_eps.append(ep)
                         
                     new_endpoints = suspicious_eps
                     new_count = len(new_endpoints)
            
            html += f'''
                        <div class="static-analysis-grid">
                            <div class="sa-metric">
                                <div class="sa-value {"risk-high" if new_count > 0 else ""}">{new_count}</div>
                                <div class="sa-label">New Endpoints</div>
                            </div>
                            <div class="sa-metric">
                                <div class="sa-value">{len(endpoints)}</div>
                                <div class="sa-label">Total URLs</div>
                            </div>
                            <div class="sa-metric">
                                <div class="sa-value">{len(api_abuse)}</div>
                                <div class="sa-label">Chrome APIs</div>
                            </div>
                            <div class="sa-metric">
                                <div class="sa-value {"risk-high" if risk_count > 0 else ""}">{risk_count}</div>
                                <div class="sa-label">Risk Patterns</div>
                            </div>
                        </div>
'''
            # Show NEW endpoints
            if new_endpoints:
                html += f'''
                <div style="margin-top: 10px; font-size: 0.75rem;">
                    <strong style="color: var(--danger);">🚨 {len(new_endpoints)} Suspicious Destinations:</strong><br>
                    <div style="background: #fff5f5; padding: 5px; border-radius: 4px; margin-top: 5px; overflow-x: hidden;">
                        {"<br>".join([u[:50] + "..." for u in new_endpoints[:3]])}
                    </div>
                </div>
                '''
            
        html += '''
                    <a href="https://chromewebstore.google.com/detail/{}" target="_blank" class="cws-btn">View in Store →</a>
                </div>
            </div>
'''.format(item['id'])
    
    # Add legitimate extensions
    for item in legitimate:
        suspect_icon = item.get('icon_url', '')
        
        html += f'''
            <div class="pair-card" data-type="legitimate" data-sim="0">
                <div class="pair-header">
                    <div>
                        <span class="verdict verdict-legitimate">LEGITIMATE</span>
                    </div>
                    <span class="similarity-badge sim-low">No Clone</span>
                </div>
                <div class="pair-content">
                    <div class="extension-box" style="display: flex; gap: 15px; align-items: center; text-align: left;">
                        <img src="{suspect_icon}" alt="Icon" onerror="this.style.opacity='0.3'" style="width: 64px; height: 64px;">
                        <div>
                            <div class="ext-name">{item.get('name', 'Unknown')}</div>
                            <div class="ext-meta">by {item.get('developer', 'Unknown')[:30]}</div>
                        </div>
                    </div>
                    
                    <div class="evidence-section">
                        <span class="evidence-title">✓ Verified</span>
                        {item.get('evidence', 'Verified as legitimate.')[:150]}
                    </div>
                    
                     <a href="https://chromewebstore.google.com/detail/{item.get('id', '')}" target="_blank" class="cws-btn">View in Store →</a>
                </div>
            </div>
'''

    html += '''
        </div>
        
    </div>
    
    <script>
        function filterCards(type) {
            const cards = document.querySelectorAll('.pair-card');
            const buttons = document.querySelectorAll('.filter-btn');
            
            buttons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            cards.forEach(card => {
                const cardType = card.dataset.type;
                const sim = parseFloat(card.dataset.sim);
                
                if (type === 'all') {
                    card.classList.remove('hidden');
                } else if (type === 'malicious') {
                    card.classList.toggle('hidden', cardType !== 'malicious');
                } else if (type === 'clone') {
                    card.classList.toggle('hidden', cardType !== 'clone');
                } else if (type === 'legitimate') {
                    card.classList.toggle('hidden', cardType !== 'legitimate');
                } else if (type === 'high') {
                    card.classList.toggle('hidden', sim < 0.7);
                }
            });
        }
    </script>
</body>
</html>
'''
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"HTML report generated: {output_path}")
    print(f"   Open in browser to review {len(all_suspicious)} suspicious pairs")
    
    return output_path


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python generate_html_report.py <results.json>")
        print("Example: python generate_html_report.py output/adblock_clones.json")
        sys.exit(1)
    
    json_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    generate_html_report(json_path, output_path)
