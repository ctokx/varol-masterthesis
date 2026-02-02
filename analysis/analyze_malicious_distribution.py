"""Analyze malicious extension distribution with fixed Grok IDs."""
import json
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_validated_verdicts(validated_data):
    """Extract verdicts from validated JSON."""
    verdicts = {}
    if 'results' in validated_data:
        for r in validated_data['results']:
            ext_id = r.get('extension_id')
            if ext_id and not ext_id.startswith('unknown-'):
                verdicts[ext_id] = r
    if 'validations' in validated_data:
        for ext_id, v in validated_data['validations'].items():
            if not ext_id.startswith('unknown-'):
                verdicts[ext_id] = v
    return verdicts

# Load clone data for extension info
chatgpt_clones = load_json('output/chatgpt_clones.json')
gemini_clones = load_json('output/gemini_clones.json')
claude_clones = load_json('output/claude_clones.json')
grok_clones = load_json('output/grok_clones.json')

# Build extension info lookup
def build_ext_info(clones_data):
    info = {}
    for ext in clones_data.get('malicious_clones', []) + clones_data.get('clones', []) + clones_data.get('legitimate', []):
        ext_id = ext.get('id')
        if ext_id:
            info[ext_id] = {
                'name': ext.get('name', 'Unknown'),
                'users': ext.get('user_count', 0)
            }
    return info

chatgpt_info = build_ext_info(chatgpt_clones)
gemini_info = build_ext_info(gemini_clones)
claude_info = build_ext_info(claude_clones)
grok_info = build_ext_info(grok_clones)

# Load validation results
chatgpt_val = load_json('output/finalverdicts/chatgpt_clones_validated.json')
gemini_val = load_json('output/finalverdicts/gemini_clones_validated.json')
claude_val = load_json('output/finalverdicts/claude_clones_validated.json')
grok_val = load_json('output/finalverdicts/grok_clones_validated.json')

chatgpt_verdicts = extract_validated_verdicts(chatgpt_val)
gemini_verdicts = extract_validated_verdicts(gemini_val)
claude_verdicts = extract_validated_verdicts(claude_val)
grok_verdicts = extract_validated_verdicts(grok_val)

# Find all MALICIOUS extensions
malicious = {
    'chatgpt': {ext_id for ext_id, v in chatgpt_verdicts.items() if v.get('verdict') == 'MALICIOUS'},
    'gemini': {ext_id for ext_id, v in gemini_verdicts.items() if v.get('verdict') == 'MALICIOUS'},
    'claude': {ext_id for ext_id, v in claude_verdicts.items() if v.get('verdict') == 'MALICIOUS'},
    'grok': {ext_id for ext_id, v in grok_verdicts.items() if v.get('verdict') == 'MALICIOUS'}
}

print("="*60)
print("MALICIOUS EXTENSION DISTRIBUTION")
print("="*60)

print(f"\nBy dataset:")
for dataset, ext_ids in malicious.items():
    print(f"  {dataset}: {len(ext_ids)} MALICIOUS")

# Check for overlaps
print("\n" + "="*60)
print("OVERLAP ANALYSIS")
print("="*60)

all_malicious = set()
for s in malicious.values():
    all_malicious |= s

print(f"\nTotal unique MALICIOUS extensions: {len(all_malicious)}")

# Find extensions that are malicious in multiple datasets
ext_to_datasets = defaultdict(list)
for dataset, ext_ids in malicious.items():
    for ext_id in ext_ids:
        ext_to_datasets[ext_id].append(dataset)

overlaps = {ext_id: datasets for ext_id, datasets in ext_to_datasets.items() if len(datasets) > 1}

if overlaps:
    print(f"\nExtensions MALICIOUS in multiple datasets: {len(overlaps)}")
    for ext_id, datasets in overlaps.items():
        info = chatgpt_info.get(ext_id) or gemini_info.get(ext_id) or claude_info.get(ext_id) or grok_info.get(ext_id)
        name = info['name'] if info else 'Unknown'
        users = info['users'] if info else 0
        print(f"  {ext_id}: {name}")
        print(f"    Users: {users:,}")
        print(f"    MALICIOUS in: {datasets}")
else:
    print("\nNo extensions are MALICIOUS in multiple datasets")

# Check if any malicious extension appears in another dataset with different verdict
print("\n" + "="*60)
print("MALICIOUS EXTENSIONS IN OTHER DATASETS")
print("="*60)

for ext_id in all_malicious:
    verdicts_in = {}
    if ext_id in chatgpt_verdicts: verdicts_in['chatgpt'] = chatgpt_verdicts[ext_id].get('verdict')
    if ext_id in gemini_verdicts: verdicts_in['gemini'] = gemini_verdicts[ext_id].get('verdict')
    if ext_id in claude_verdicts: verdicts_in['claude'] = claude_verdicts[ext_id].get('verdict')
    if ext_id in grok_verdicts: verdicts_in['grok'] = grok_verdicts[ext_id].get('verdict')

    if len(verdicts_in) > 1:
        info = chatgpt_info.get(ext_id) or gemini_info.get(ext_id) or claude_info.get(ext_id) or grok_info.get(ext_id)
        name = info['name'] if info else 'Unknown'
        print(f"\n  {ext_id}: {name}")
        print(f"    Verdicts: {verdicts_in}")

# Final summary with user counts
print("\n" + "="*60)
print("ALL MALICIOUS EXTENSIONS WITH USER COUNTS")
print("="*60)

malicious_list = []
for dataset, ext_ids in malicious.items():
    for ext_id in ext_ids:
        info = chatgpt_info.get(ext_id) or gemini_info.get(ext_id) or claude_info.get(ext_id) or grok_info.get(ext_id)
        if info:
            malicious_list.append({
                'ext_id': ext_id,
                'name': info['name'],
                'users': info['users'],
                'dataset': dataset
            })

# Sort by users descending
malicious_list.sort(key=lambda x: x['users'], reverse=True)

total_users = 0
print(f"\n{'Users':>12} | {'Dataset':<10} | Extension")
print("-" * 80)
for item in malicious_list:
    print(f"{item['users']:>12,} | {item['dataset']:<10} | {item['name'][:50]}")
    total_users += item['users']

print("-" * 80)
print(f"\nTotal MALICIOUS extensions: {len(malicious_list)}")
print(f"Total affected users: {total_users:,}")
