
import json
from pathlib import Path
from gemini_clone_detector import find_anchors_batch, process_cluster, save_results, Extension

def load_extensions(path: str, limit: int = None) -> list:
    """Load extensions from JSON file with robust None handling."""
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    extensions = []
    for item in data:
        if limit and len(extensions) >= limit:
            break
        try:
            cleaned = {
                'id': item.get('id', ''),
                'name': item.get('name') or 'Unknown',
                'developer': item.get('developer') or 'Unknown',
                'developer_address': item.get('developer_address') or '',
                'description': item.get('description') or '',
                'icon_url': item.get('icon_url') or '',
                'user_count': item.get('user_count') or 0,
                'rating': item.get('rating') or 0.0,
                'version': item.get('version') or '',
                'size': item.get('size') or '',
                'last_updated': item.get('last_updated') or '',
            }
            if not cleaned['id']: continue
            ext = Extension(**cleaned)
            extensions.append(ext)
        except Exception:
            pass
    return extensions

def main():
    keyword = "chatgpt"
    input_file = f"data/{keyword}_metadata_1k.json"
    output_file = "seereasoninganchordetection.json"
    
    print(f"Loading extensions from {input_file}...")
    extensions = load_extensions(input_file, limit=None) # Use all or limit if too slow? Limit to 20 to be fast for checking reasoning.
    # Actually, to find anchors correctly, we should pass all of them to find_anchors_batch, but maybe limit analysis to save time/cost.
    # But find_anchors_batch summarizes anyway.
    
    # Let's limit total extensions loaded to 100 for speed, assuming anchors are popular and will be at top.
    # But load_extensions doesn't sort by popularity.
    # Let's load ALL for anchor detection, but only analyze a few for the cluster processing part if needed.
    # The user wants to SEE REASONING.
    
    with open(input_file, 'r', encoding='utf-8') as f:
        raw_json = f.read()

    print("Running batch anchor detection...")
    anchor_result = find_anchors_batch(raw_json, keyword=keyword)
    
    print(f"Refined Reasoning: {anchor_result.reasoning}")
    
    official_anchor_ids = anchor_result.official_extension_ids
    reasoning = anchor_result.reasoning
    
    print("Running process_cluster to verify reasoning is passed...")
    # We can limit extensions here to just the anchors + a few others to save time
    extensions_to_process = [e for e in extensions if e.id in official_anchor_ids]
    # Add 5 more random ones
    count = 0
    for e in extensions:
        if e.id not in official_anchor_ids and count < 5:
            extensions_to_process.append(e)
            count += 1
            
    result = process_cluster(
        extensions_to_process,
        keyword=keyword,
        max_workers=5,
        official_anchor_ids=official_anchor_ids,
        official_anchor_reasoning=reasoning
    )
    
    save_results(result, output_file)
    print(f"Done! Check {output_file}")

if __name__ == "__main__":
    main()
