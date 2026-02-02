import json
from collections import Counter

with open('output/chatgpt_clones.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Check the extension with most findings (Kursor)
for ext in data.get('malicious_clones', []):
    if ext['id'] == 'ajoickdlofadbaooambnlnlbcpdnkkck':
        caps = ext.get('static_analysis', {}).get('capabilities', {})
        name = ext.get('name', 'Unknown')
        print(f'Extension: {name}')
        print()
        
        total_findings = sum(len(v) for v in caps.values())
        print(f'Total findings: {total_findings}')
        print()
        
        for cap_type, findings in caps.items():
            if not findings:
                continue
            print(f'{cap_type}: {len(findings)} findings')
            
            # Check for exact duplicates
            unique = set(findings)
            duplicates = len(findings) - len(unique)
            if duplicates:
                print(f'  WARNING: {duplicates} EXACT duplicates!')
            
            # Check for file concentration (spam from same file)
            file_counts = Counter()
            for f in findings:
                if '[EXT]' in f:
                    loc = f.split('[EXT]')[1].strip().split(':')[0]
                    file_counts[loc] += 1
            
            for file, count in file_counts.most_common(2):
                if count > 10:
                    print(f'  SPAM: {file} has {count} findings')
        break
