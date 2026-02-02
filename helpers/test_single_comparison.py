
import json
import base64
from gemini_clone_detector import (
    analyze_suspect_combined, 
    VerifiedAnchor, 
    Extension, 
    download_icon, 
    ClusterType
)

def load_extension_by_id(path: str, ext_id: str) -> Extension:
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    for item in data:
        if item.get('id') == ext_id:
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
            return Extension(**cleaned)
    return None

def main():
    metadata_file = "data/chatgpt_metadata_1k.json"
    anchor_id = "ejcfepkfckglbgocfkanmcdngdijcgld"  # Official ChatGPT
    suspect_id = "becfinhbfclcgokjlobojlnldbfillpf"  # Suspect extension
    
    print(f"Loading extensions from {metadata_file}...")
    anchor_ext = load_extension_by_id(metadata_file, anchor_id)
    suspect_ext = load_extension_by_id(metadata_file, suspect_id)
    
    if not anchor_ext or not suspect_ext:
        print("Error: Could not find one of the extensions.")
        return

    print("Downloading icons...")
    anchor_icon = download_icon(anchor_ext.icon_url)
    suspect_icon = download_icon(suspect_ext.icon_url)
    
    print("-" * 50)
    print(f"ANCHOR: {anchor_ext.name} ({anchor_ext.id})")
    print(f"SUSPECT: {suspect_ext.name} ({suspect_ext.id})")
    print("-" * 50)
    
    # Create VerifiedAnchor object
    anchor_obj = VerifiedAnchor(
        extension=anchor_ext,
        icon_data=anchor_icon,
        verification_evidence="Official Anchor",
        is_brand_owner=True
    )
    
    print("Running combined analysis (Icon + Metadata)...")
    result = analyze_suspect_combined(
        anchor=anchor_obj,
        suspect=suspect_ext,
        suspect_icon=suspect_icon,
        cluster_type=ClusterType.BRAND,
        keyword="chatgpt"
    )
    
    print("\n" + "="*50)
    print("FULL ANALYSIS RESULT")
    print("="*50)
    print(f"Relationship: {result.relationship}")
    print(f"Confidence: {result.confidence:.0%}")
    print(f"\n--- Icon Analysis ---")
    print(f"Similarity Score: {result.icon_similarity_score:.0%}")
    print(f"Similarity Type: {result.icon_similarity_type}")
    print(f"Embedded Brand Logo: {result.contains_embedded_brand_logo}")
    if result.contains_embedded_brand_logo:
        print(f"Logo Description: {result.embedded_logo_description}")
    print(f"Is Imitative: {result.is_deliberate_imitation}")
    print(f"Icon Details: {result.icon_analysis_details}")
    
    print(f"\n--- Decision Evidence ---")
    print(result.evidence)
    
    # Save to JSON for inspection
    output_file = "single_comparison_result.json"
    output = result.model_dump(mode='json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
    print(f"\nFull debug output saved to {output_file}")

if __name__ == "__main__":
    main()
