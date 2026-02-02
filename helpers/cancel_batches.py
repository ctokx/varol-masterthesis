

import os
import google.genai as genai

# Configure
api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

print("Listing active batches...")
try:
    # list_batch_jobs returns an iterable
    batches = list(client.batches.list())
    for job in batches:
        # Check explicit states
        # Note: job.state is likely an enum, we convert to string
        state_str = str(job.state)
        
        if 'ACTIVE' in state_str or 'CREATING' in state_str or 'RUNNING' in state_str or 'PARTIALLY' in state_str:
            print(f"Cancelling job {job.name} ({state_str})...")
            try:
                client.batches.cancel(name=job.name)
                print("  [OK] Cancelled.")
            except Exception as e:
                print(f"  [FAIL] Could not cancel: {e}")
        else:
            # print(f"Skipping {job.name} ({state_str})")
            pass
            
    # Try cancelling the specific one I saw just in case
    specific_id = "batches/ev72mvuxyyes27sitado49dsb70zvydktbxn"
    print(f"\nChecking specific job {specific_id}...")
    try:
        job = client.batches.get(name=specific_id)
        state_str = str(job.state)
        if 'SUCCEEDED' not in state_str and 'FAILED' not in state_str and 'CANCELLED' not in state_str:
             print(f"Cancelling specific job {job.name} ({state_str})...")
             client.batches.cancel(name=specific_id)
             print("  [OK] Cancelled.")
        else:
             print(f"  Job is already {state_str}")
    except Exception as e:
        print(f"  Could not find/cancel specific job: {e}")

except Exception as e:
    print(f"Error listing jobs: {e}")
