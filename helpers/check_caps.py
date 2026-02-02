import json

with open('output/chatgpt_clones.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

count = 0
examples = []

for cat in ['anchors', 'malicious_clones', 'clones']:
    for ext in data.get(cat, []):
        static = ext.get('static_analysis', {})
        caps = static.get('capabilities', {})
        if caps and any(caps.get(k) for k in caps):
            count += 1
            cap_counts = {k: len(v) for k, v in caps.items() if v}
            examples.append({
                'name': ext.get('name', 'Unknown'),
                'category': cat,
                'caps': cap_counts
            })

print(f"Extensions with new capabilities format: {count}")
print()
print("Breakdown:")
for ex in examples[:10]:
    print(f"  [{ex['category']}] {ex['name'][:40]}")
    print(f"    {ex['caps']}")
