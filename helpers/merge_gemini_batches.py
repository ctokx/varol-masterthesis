import json
import subprocess
import sys
import argparse
from pathlib import Path
from datetime import datetime

def main():
    parser = argparse.ArgumentParser(description='Merge batch validation results')
    parser.add_argument('--dataset', default='gemini', help='Dataset name (gemini, claude, chatgpt, grok)')
    args = parser.parse_args()
    
    dataset = args.dataset
    BATCHES_DIR = Path(f"experiments/{dataset}/batches")
    OUTPUT_FILE = Path(f"experiments/{dataset}/validation_results.json")
    
    if not BATCHES_DIR.exists():
        print(f"Batches directory not found: {BATCHES_DIR}")
        return

    batch_files = list(BATCHES_DIR.glob("batch_job_*.json"))
    if not batch_files:
        print("No batch files found.")
        return
        
    print(f"Found {len(batch_files)} batch files for {dataset}.")
    print(f"{'='*60}")

    all_validations = []
    summary_stats = {'MALICIOUS': 0, 'SUSPICIOUS': 0, 'SAFE': 0, 'NEED_MORE_FILES': 0, 'ERROR': 0}
    total_prompt_tokens = 0
    total_candidate_tokens = 0
    total_tokens = 0

    for i, batch_file in enumerate(batch_files, 1):
        with open(batch_file, encoding='utf-8') as f:
            meta = json.load(f)
            job_name = meta.get('job_name')
            
        if not job_name:
            print(f"[{i}/{len(batch_files)}] Skipping {batch_file.name} (no job_name)")
            continue

        # Use temporary output file for each batch
        temp_output = Path(f"temp_batch_{i}.json")
        
        print(f"[{i}/{len(batch_files)}] Retrieving {job_name}...")
        
        # Call the official validate_batch_gemini.py results command
        cmd = [
            sys.executable, 
            "pipeline/validate_batch_gemini.py", 
            "results", 
            "--job", job_name, 
            "--output", str(temp_output)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode != 0:
            print(f"  ERROR: {result.stderr}")
            continue
        
        # Load and merge the results
        if temp_output.exists():
            with open(temp_output, encoding='utf-8') as f:
                batch_result = json.load(f)
            
            # Extract validations
            validations = batch_result.get('validations', [])
            all_validations.extend(validations)
            
            # Aggregate summary
            batch_summary = batch_result.get('summary', {})
            for verdict, count in batch_summary.items():
                if verdict in summary_stats:
                    summary_stats[verdict] += count
            
            # Aggregate token usage
            token_usage = batch_result.get('token_usage', {})
            total_prompt_tokens += token_usage.get('prompt_tokens', 0)
            total_candidate_tokens += token_usage.get('candidate_tokens', 0)
            total_tokens += token_usage.get('total_tokens', 0)
            
            # Clean up temp file
            temp_output.unlink()
            
            print(f"  ✓ Retrieved {len(validations)} extensions")

    print(f"{'='*60}")
    print(f"Total validations: {len(all_validations)}")
    print(f"\nVerdict Summary:")
    for verdict, count in sorted(summary_stats.items()):
        if count > 0:
            pct = count / len(all_validations) * 100 if all_validations else 0
            print(f"  {verdict}: {count} ({pct:.1f}%)")

    # Build final output
    final_data = {
        'dataset': f'{dataset}_clones',
        'retrieved_at': datetime.now().isoformat(),
        'total_extensions': len(all_validations),
        'summary': summary_stats,
        'token_usage': {
            'prompt_tokens': total_prompt_tokens,
            'candidate_tokens': total_candidate_tokens,
            'total_tokens': total_tokens
        },
        'validations': all_validations
    }
    
    # Save merged results
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
