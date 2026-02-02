#!/usr/bin/env python3
"""
Check Gemini Batch API job status and retrieve results.

Usage:
    python check_batch_status.py                    # List recent jobs
    python check_batch_status.py <job_name>         # Check specific job
    python check_batch_status.py batches/abc123     # Check and get results
"""

import os
import sys
import json

try:
    from google import genai
except ImportError:
    print("Error: google-generativeai not installed")
    sys.exit(1)

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')


def list_jobs(limit: int = 10):
    """List recent batch jobs."""
    client = genai.Client(api_key=GEMINI_API_KEY)
    jobs = client.batches.list(config={'page_size': limit})

    print(f"\n{'='*70}")
    print("RECENT BATCH JOBS")
    print(f"{'='*70}")

    for job in jobs:
        print(f"\nJob: {job.name}")
        print(f"  Display Name: {job.display_name}")
        print(f"  State: {job.state.name}")
        if hasattr(job, 'create_time'):
            print(f"  Created: {job.create_time}")


def check_job(job_name: str):
    """Check status of a specific batch job and retrieve results if complete."""
    client = genai.Client(api_key=GEMINI_API_KEY)

    try:
        batch_job = client.batches.get(name=job_name)
    except Exception as e:
        print(f"Error getting job: {e}")
        return

    print(f"\n{'='*70}")
    print(f"BATCH JOB: {job_name}")
    print(f"{'='*70}")
    print(f"State: {batch_job.state.name}")

    if batch_job.state.name == 'JOB_STATE_SUCCEEDED':
        print("\nJob completed successfully!")

        if batch_job.dest and batch_job.dest.inlined_responses:
            for i, response in enumerate(batch_job.dest.inlined_responses):
                print(f"\n--- Response {i+1} ---")
                if response.response:
                    try:
                        result = json.loads(response.response.text)
                        print(json.dumps(result, indent=2))
                    except:
                        print(response.response.text)
                elif response.error:
                    print(f"Error: {response.error}")

        elif batch_job.dest and batch_job.dest.file_name:
            print(f"Results in file: {batch_job.dest.file_name}")
            file_content = client.files.download(file=batch_job.dest.file_name)
            print(file_content.decode('utf-8'))

    elif batch_job.state.name == 'JOB_STATE_FAILED':
        print(f"Job failed!")
        if batch_job.error:
            print(f"Error: {batch_job.error}")

    elif batch_job.state.name == 'JOB_STATE_PENDING':
        print("Job is still pending (waiting in queue)")

    elif batch_job.state.name == 'JOB_STATE_RUNNING':
        print("Job is currently running")

    elif batch_job.state.name == 'JOB_STATE_CANCELLED':
        print("Job was cancelled")

    elif batch_job.state.name == 'JOB_STATE_EXPIRED':
        print("Job expired (was pending/running >48 hours)")


def main():
    if len(sys.argv) < 2:
        list_jobs()
    else:
        job_name = sys.argv[1]
        if not job_name.startswith('batches/'):
            job_name = f'batches/{job_name}'
        check_job(job_name)


if __name__ == '__main__':
    main()
