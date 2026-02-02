
import os
from google import genai
from google.genai import types

def test_token_counting():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})
    
    model = "gemini-3-flash-preview"
    prompt = "Explain quantum computing in one sentence."
    
    print(f"Testing token counting with model: {model}")
    print("-" * 40)
    
    try:
        # Standard generation
        response = client.models.generate_content(
            model=model,
            contents=prompt
        )
        
        print(f"Prompt: {prompt}")
        print(f"Response: {response.text}")
        print("-" * 40)
        
        if hasattr(response, 'usage_metadata'):
            usage = response.usage_metadata
            print("SUCCESS: usage_metadata found!")
            print(f"Prompt tokens: {usage.prompt_token_count}")
            print(f"Output tokens: {usage.candidates_token_count}")
            print(f"Total tokens: {usage.total_token_count}")
        else:
            print("FAIL: usage_metadata NOT found in response.")
            print(dir(response))
            
    except Exception as e:
        print(f"Error during test: {e}")

if __name__ == "__main__":
    test_token_counting()
