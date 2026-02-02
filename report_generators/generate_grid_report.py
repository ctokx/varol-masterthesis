
import json
import os
from datetime import datetime


def generate_grid_report(json_path: str, output_path: str = None) -> str:

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if output_path is None:
        output_path = json_path.replace('.json', '_grid.html')
    
    keyword = data.get('keyword', 'unknown')
    anchors = data.get('anchors', [])
    clones = data.get('clones', [])
    malicious = data.get('malicious_clones', [])
    legitimate = data.get('legitimate', [])
    unknown = data.get('unknown', [])
    
    # Combine all extensions with their categories
    all_extensions = []
    
    for ext in malicious:
        ext['_category'] = 'MALICIOUS_CLONE'
        ext['_sim_type'] = ext.get('similarity_type', 'UNKNOWN')
        all_extensions.append(ext)
    
    for ext in clones:
        ext['_category'] = 'CLONE'
        ext['_sim_type'] = ext.get('similarity_type', 'UNKNOWN')
        all_extensions.append(ext)
    
    for ext in legitimate:
        ext['_category'] = 'LEGITIMATE'
        ext['_sim_type'] = ext.get('similarity_type', 'DIFFERENT')
        all_extensions.append(ext)
    
    for ext in unknown:
        ext['_category'] = 'UNKNOWN'
        ext['_sim_type'] = ext.get('similarity_type', 'UNKNOWN')
        all_extensions.append(ext)
    
    # Get unique similarity types for filters
    sim_types = sorted(set(e['_sim_type'] for e in all_extensions))
    
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clone Grid - {keyword}</title>
    <style>
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        body {{
            font-family: Arial, sans-serif;
            background: #ffffff;
            color: #333;
            padding: 20px;
        }}
        .header {{
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #ddd;
        }}
        h1 {{
            font-size: 1.5rem;
            color: #333;
            margin-bottom: 5px;
        }}
        .filter-bar {{
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            justify-content: center;
        }}
        .filter-group {{
            display: flex;
            gap: 5px;
            align-items: center;
            padding: 5px 10px;
            background: #f5f5f5;
            border-radius: 6px;
        }}
        .filter-group label {{
            font-size: 0.75rem;
            font-weight: bold;
            color: #666;
            margin-right: 5px;
        }}
        .filter-btn {{
            padding: 6px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fff;
            color: #333;
            cursor: pointer;
            font-size: 0.75rem;
            transition: all 0.2s;
        }}
        .filter-btn:hover {{
            background: #f0f0f0;
        }}
        .filter-btn.active {{
            background: #333;
            color: #fff;
            border-color: #333;
        }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 15px;
        }}
        .card {{
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
            background: #fff;
        }}
        .card.hidden {{
            display: none;
        }}
        /* Icon-only mode */
        body.icon-only .card {{
            padding: 8px;
        }}
        body.icon-only .status,
        body.icon-only .name,
        body.icon-only .developer,
        body.icon-only .users,
        body.icon-only .cws-link,
        body.icon-only .sim-type {{
            display: none;
        }}
        body.icon-only .icon-wrapper {{
            width: 60px;
            height: 60px;
            margin: 0;
        }}
        body.icon-only .icon-wrapper img {{
            width: 50px;
            height: 50px;
        }}
        body.icon-only .grid {{
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 8px;
        }}
        .status {{
            font-size: 0.7rem;
            font-weight: bold;
            padding: 3px 8px;
            border-radius: 3px;
            margin-bottom: 10px;
            display: inline-block;
        }}
        .status.malicious {{
            background: #ffe0e0;
            color: #cc0000;
        }}
        .status.clone {{
            background: #fff3e0;
            color: #cc6600;
        }}
        .status.legitimate {{
            background: #e0ffe0;
            color: #006600;
        }}
        .status.unknown {{
            background: #f0f0f0;
            color: #666;
        }}
        .icon-wrapper {{
            width: 80px;
            height: 80px;
            margin: 0 auto 10px;
            background: #f8f8f8;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #eee;
        }}
        .icon-wrapper img {{
            width: 64px;
            height: 64px;
            border-radius: 8px;
        }}
        .name {{
            font-size: 0.8rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 4px;
            line-height: 1.2;
            max-height: 2.4em;
            overflow: hidden;
        }}
        .developer {{
            font-size: 0.7rem;
            color: #888;
            margin-bottom: 6px;
            max-height: 1.2em;
            overflow: hidden;
        }}
        .users {{
            display: inline-block;
            background: #e8f4fd;
            color: #0066cc;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.7rem;
            font-weight: 500;
            margin-bottom: 6px;
        }}
        .cws-link {{
            display: inline-block;
            background: #f5f5f5;
            color: #666;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.65rem;
            text-decoration: none;
        }}
        .cws-link:hover {{
            background: #e0e0e0;
        }}
        .sim-type {{
            font-size: 0.6rem;
            color: #999;
            margin-top: 4px;
        }}
        .count {{
            font-size: 0.8rem;
            color: #666;
            margin-top: 10px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Clone Detection: {keyword.upper()}</h1>
        <p style="font-size: 0.8rem; color: #666;">Generated: {datetime.now().strftime('%Y-%m-%d')}</p>
    </div>
    
    <div class="filter-bar">
        <div class="filter-group">
            <label>Category:</label>
            <button class="filter-btn active" data-cat="all" onclick="filterByCategory('all', this)">All</button>
            <button class="filter-btn" data-cat="MALICIOUS_CLONE" onclick="filterByCategory('MALICIOUS_CLONE', this)">Malicious ({len(malicious)})</button>
            <button class="filter-btn" data-cat="CLONE" onclick="filterByCategory('CLONE', this)">Clone ({len(clones)})</button>
            <button class="filter-btn" data-cat="LEGITIMATE" onclick="filterByCategory('LEGITIMATE', this)">Legitimate ({len(legitimate)})</button>
        </div>
        <div class="filter-group">
            <label>Icon Similarity:</label>
            <button class="filter-btn active" data-sim="all" onclick="filterBySim('all', this)">All</button>
'''
    
    # Add filter buttons for each similarity type
    for sim_type in sim_types:
        count = sum(1 for e in all_extensions if e['_sim_type'] == sim_type)
        html += f'            <button class="filter-btn" data-sim="{sim_type}" onclick="filterBySim(\'{sim_type}\', this)">{sim_type} ({count})</button>\n'
    
    html += '''        </div>
        <div class="filter-group">
            <label>View:</label>
            <button class="filter-btn active" onclick="toggleIconOnly(false)">Full</button>
            <button class="filter-btn" onclick="toggleIconOnly(true)">Icons Only</button>
        </div>
    </div>
    
    <p class="count" id="count-display">Showing <span id="visible-count">0</span> extensions</p>
    
    <div class="grid" id="grid">
'''
    
    # Generate cards for all extensions
    for ext in all_extensions:
        category = ext['_category']
        sim_type = ext['_sim_type']
        
        if category == 'MALICIOUS_CLONE':
            status_class = 'malicious'
            status_text = 'SUSPECT (Potential Clone)'
        elif category == 'CLONE':
            status_class = 'clone'
            status_text = 'SUSPECT (Potential Clone)'
        elif category == 'LEGITIMATE':
            status_class = 'legitimate'
            status_text = 'LEGITIMATE'
        else:
            status_class = 'unknown'
            status_text = 'UNKNOWN'
        
        icon_url = ext.get('icon_url', '')
        name = ext.get('name', 'Unknown')[:50]
        developer = ext.get('developer', 'Unknown')[:30]
        user_count = ext.get('user_count', 0)
        ext_id = ext.get('id', '')
        
        html += f'''        <div class="card" data-category="{category}" data-sim="{sim_type}">
            <div class="status {status_class}">{status_text}</div>
            <div class="icon-wrapper">
                <img src="{icon_url}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22><rect fill=%22%23ddd%22 width=%2264%22 height=%2264%22/></svg>'">
            </div>
            <div class="name">{name}</div>
            <div class="developer">by {developer}</div>
            <div class="users">{user_count:,} users</div>
            <a href="https://chromewebstore.google.com/detail/{ext_id}" target="_blank" class="cws-link">View in Chrome Store →</a>
            <div class="sim-type">{sim_type}</div>
        </div>
'''
    
    html += '''    </div>
    
    <script>
        let selectedCategories = new Set();
        let selectedSims = new Set();
        
        function updateVisibility() {
            const cards = document.querySelectorAll('.card');
            let visible = 0;
            
            cards.forEach(card => {
                const cat = card.dataset.category;
                const sim = card.dataset.sim;
                
                const catMatch = selectedCategories.size === 0 || selectedCategories.has(cat);
                const simMatch = selectedSims.size === 0 || selectedSims.has(sim);
                
                if (catMatch && simMatch) {
                    card.classList.remove('hidden');
                    visible++;
                } else {
                    card.classList.add('hidden');
                }
            });

            
            document.getElementById('visible-count').textContent = visible;
        }
        
        function filterByCategory(category, btn) {
            if (category === 'all') {
                selectedCategories.clear();
            } else {
                if (selectedCategories.has(category)) {
                    selectedCategories.delete(category);
                } else {
                    selectedCategories.add(category);
                }
            }
            
            // Update button states
            document.querySelectorAll('.filter-group:first-child .filter-btn').forEach(b => {
                const isAll = b.textContent.startsWith('All');
                const cat = b.getAttribute('data-cat');
                if (isAll) {
                    b.classList.toggle('active', selectedCategories.size === 0);
                } else {
                    b.classList.toggle('active', selectedCategories.has(cat));
                }
            });
            
            updateVisibility();
        }
        
        function filterBySim(sim, btn) {
            if (sim === 'all') {
                selectedSims.clear();
            } else {
                if (selectedSims.has(sim)) {
                    selectedSims.delete(sim);
                } else {
                    selectedSims.add(sim);
                }
            }
            
            // Update button states
            document.querySelectorAll('.filter-group:nth-child(2) .filter-btn').forEach(b => {
                const isAll = b.textContent.startsWith('All');
                const s = b.getAttribute('data-sim');
                if (isAll) {
                    b.classList.toggle('active', selectedSims.size === 0);
                } else {
                    b.classList.toggle('active', selectedSims.has(s));
                }
            });
            
            updateVisibility();
        }
        
        function toggleIconOnly(enable) {
            if (enable) {
                document.body.classList.add('icon-only');
            } else {
                document.body.classList.remove('icon-only');
            }
            
            // Update button states
            const buttons = document.querySelectorAll('.filter-group:nth-child(3) .filter-btn');
            buttons.forEach((btn, i) => {
                btn.classList.toggle('active', (enable && i === 1) || (!enable && i === 0));
            });
        }
        
        // Initial count
        updateVisibility();
    </script>
</body>
</html>
'''
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"Grid report generated: {output_path}")
    print(f"   Total extensions: {len(all_extensions)}")
    
    return output_path


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python generate_grid_report.py <results.json>")
        print("Example: python generate_grid_report.py output/chatgpt_clones.json")
        sys.exit(1)
    
    json_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    generate_grid_report(json_path, output_path)
