
import os
import json
import sys
from pathlib import Path


sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from staticanalysis.run_analysis import analyze_extension

CASE_STUDIES_DIR = Path("case_studies")
OUTPUT_FILE = CASE_STUDIES_DIR / "case_study_candidates.json"

EXTENSIONS = [
    {
        "id": "fnmihdojmnkclgjpcoonokmkhjpjechg",
        "name": "Extension 1 (Old)",
        "path": CASE_STUDIES_DIR / "fnmihdojmnkclgjpcoonokmkhjpjechg",
        "category": "case_study_old"
    },
    {
        "id": "fnmihdojmnkclgjpcoonokmkhjpjechg_new", 
        "name": "Extension 1 (New)",
        "path": CASE_STUDIES_DIR / "fnmihdojmnkclgjpcoonokmkhjpjechg(new)",
        "category": "case_study_new"
    },
    {
        "id": "inhcgfpbfdjbjogdfjbclgolkmhnooop",
        "name": "Extension 2 (Old)",
        "path": CASE_STUDIES_DIR / "inhcgfpbfdjbjogdfjbclgolkmhnooop",
        "category": "case_study_old"
    },
    {
        "id": "inhcgfpbfdjbjogdfjbclgolkmhnooop_new",
        "name": "Extension 2 (New)",
        "path": CASE_STUDIES_DIR / "inhcgfpbfdjbjogdfjbclgolkmhnooop(new)",
        "category": "case_study_new"
    }
]

def main():
    results = {
        "case_studies": []
    }

    print("Starting Case Study Static Analysis...")
    
    for ext in EXTENSIONS:
        print(f"\nAnalyzing {ext['name']} ({ext['path']})...")
        if not ext['path'].exists():
            print(f"Error: Path {ext['path']} does not exist")
            continue
            
        analysis = analyze_extension(str(ext['path']))
        
        entry = {
            "id": ext['id'],
            "name": ext['name'],
            "category": ext['category'],
            "static_analysis": analysis,
            "user_count": 0,
            "developer": "Unknown",
            "relationship": "self",
            "cloned_from": "None",
            "cloned_from_id": "None",
            "icon_similarity": 0,
            "red_flags": []
        }
        
        results["case_studies"].append(entry)
        
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
        
    print(f"\nSaved candidates to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
