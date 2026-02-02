

from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Tuple
from enum import Enum
import os
import json
import time
from functools import wraps
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import requests
from dataclasses import dataclass, field
from datetime import datetime, timedelta



GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY, http_options={'api_version': 'v1alpha'})




def retry_on_errors(max_retries=5, delay=60):
    """Decorator to retry on rate limit AND model overload errors"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    error_str = str(e).lower()
                    # Retry on rate limit (429) AND model overload (503)
                    is_retryable = any(x in error_str for x in [
                        "429", "resource_exhausted", "quota",
                        "503", "unavailable", "overloaded"
                    ])

                    if is_retryable and attempt < max_retries - 1:
                        wait_time = delay * (attempt + 1)  # Exponential backoff
                        print(f"  ⏳ API error (attempt {attempt+1}/{max_retries}), waiting {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    raise e
            return func(*args, **kwargs)
        return wrapper
    return decorator


retry_on_429 = retry_on_errors


class RateLimiter:
    """Thread-safe rate limiter"""
    def __init__(self, max_requests_per_second: float = 14.0):
        self.min_interval = 1.0 / max_requests_per_second
        self.last_request_time = 0
        self.lock = threading.Lock()

    def wait_if_needed(self):
        with self.lock:
            elapsed = time.time() - self.last_request_time
            if elapsed < self.min_interval:
                time.sleep(self.min_interval - elapsed)
            self.last_request_time = time.time()



rate_limiter = RateLimiter(max_requests_per_second=14.0)  


class TokenTracker:
    """Thread-safe token usage tracker"""
    def __init__(self):
        self.stats = {
            'prompt_tokens': 0,
            'candidate_tokens': 0,
            'total_tokens': 0,
            'cost_estimate': 0.0  
        }
        self.lock = threading.Lock()

    def add(self, response):
        """Add usage from a Gemini API response"""
        if hasattr(response, 'usage_metadata'):
            usage = response.usage_metadata
            with self.lock:
                self.stats['prompt_tokens'] += usage.prompt_token_count
                self.stats['candidate_tokens'] += usage.candidates_token_count
                self.stats['total_tokens'] += usage.total_token_count
    
    def get_summary(self):
        with self.lock:
            return self.stats.copy()

token_tracker = TokenTracker()





class ClusterType(str, Enum):
    """Type of keyword cluster"""
    BRAND = "brand"           # Single brand owner (ChatGPT -> OpenAI)
    CATEGORY = "category"     # Multiple legitimate products (adblocker)
    GENERIC = "generic"       # No brand, generic utility (screen recorder)


class Relationship(str, Enum):
    """Extension relationship classification"""
    OFFICIAL = "OFFICIAL"
    CLONE = "CLONE"
    MALICIOUS_CLONE = "MALICIOUS_CLONE"
    LEGITIMATE = "LEGITIMATE"
    UNKNOWN = "UNKNOWN"


class Extension(BaseModel):
    """Extension metadata - handles None values from scraped data"""
    id: str
    name: str = "Unknown"
    developer: str = "Unknown"  # Made optional with default
    developer_address: str = ""
    description: str = ""
    icon_url: str = ""
    user_count: int = 0
    rating: float = 0.0
    version: str = ""
    size: str = ""
    last_updated: str = ""
    
    @classmethod
    def model_validate(cls, obj, **kwargs):
        # Handle None values from JSON
        if isinstance(obj, dict):
            for key in ['developer', 'developer_address', 'name', 'description', 'icon_url', 'version', 'size', 'last_updated']:
                if obj.get(key) is None:
                    obj[key] = '' if key != 'developer' else 'Unknown'
        return super().model_validate(obj, **kwargs)


@dataclass
class VerifiedAnchor:
    """A verified legitimate extension to use as reference"""
    extension: Extension
    icon_data: Optional[bytes] = None
    verification_evidence: str = ""
    is_brand_owner: bool = False


@dataclass
class CloneDetectionResult:
    """Result of clone detection for a suspect extension"""
    suspect: Extension
    relationship: Relationship
    confidence: float
    cloned_from: Optional[Extension] = None
    evidence: str = ""
    icon_similarity: float = 0.0
    similarity_type: str = ""  # IDENTICAL, RECOLORED, IMITATIVE, CONVENTION, DIFFERENT
    is_imitative: bool = False  # True if deliberately designed to look like the original
    red_flags: List[str] = field(default_factory=list)


@dataclass
class ClusterAnalysisResult:
    """Complete result of analyzing a keyword cluster"""
    keyword: str
    cluster_type: ClusterType
    anchors: List[VerifiedAnchor]
    results: List[CloneDetectionResult]
    stats: Dict = field(default_factory=dict)


# ============================================================================
# Pydantic Models for Gemini Structured Output
# ============================================================================

class ClusterTypeResponse(BaseModel):
    """Response for cluster type detection"""
    cluster_type: str = Field(description="One of: BRAND, CATEGORY, GENERIC")
    brand_owner: Optional[str] = Field(description="Official brand owner company if BRAND type, else null")
    legitimate_products: List[str] = Field(description="List of well-known legitimate products in this category")
    reasoning: str = Field(description="Brief explanation")


class AnchorVerificationResponse(BaseModel):
    """Response for anchor verification"""
    is_verified_official: bool = Field(description="True if this is the verified official extension")
    developer_matches_brand: bool = Field(description="True if developer name matches the brand owner")
    confidence: float = Field(description="Confidence 0.0-1.0")
    evidence: str = Field(description="Evidence from search")
    known_official_developer: str = Field(description="The known official developer for this brand")


class BatchAnchorResponse(BaseModel):
    """Response for batch anchor detection - finds official extensions from a list"""
    official_extension_ids: List[str] = Field(description="List of extension IDs that are verified official")
    brand_owner: str = Field(description="The verified brand owner company")
    reasoning: str = Field(description="Brief explanation of how each was verified")
    confidence: float = Field(description="Overall confidence 0.0-1.0")




class BrandImpersonationResponse(BaseModel):
    """
    Response for analyzing extensions when NO official anchor exists.
    Uses Google Search grounding to compare against brand's official web presence.

    CALIBRATION: Same as anchor mode
    - MALICIOUS_CLONE: Uses brand imagery + deception
    - CLONE: Uses brand imagery WITHOUT deception
    - LEGITIMATE: Does NOT use brand imagery
    """
    is_impersonating_brand: bool = Field(description="True if extension uses the target brand's visual identity (>60% similarity or deliberate imitation)")
    brand_name: str = Field(description="The target brand name being checked")
    brand_owner: str = Field(description="Official owner of the brand (from search)")
    official_extension_exists: bool = Field(description="True if brand has an official Chrome extension")

    # Visual similarity to brand (PRIMARY indicator - same as anchor mode icon comparison)
    uses_brand_imagery: bool = Field(description="True if icon uses brand's official colors, logo style, or imagery (>60% visual similarity or deliberate imitation)")
    brand_imagery_evidence: str = Field(description="Description of visual similarity to brand's official imagery with similarity percentage estimate")

    # Deception indicators (distinguish MALICIOUS_CLONE from CLONE)
    relationship: str = Field(description="MALICIOUS_CLONE (uses brand imagery + deception), CLONE (uses brand imagery no deception), LEGITIMATE (no brand imagery), or UNKNOWN")
    confidence: float = Field(description="0.0-1.0")
    has_typosquatting: bool = Field(description="True if name typosquats the brand (e.g., Gr0k with zero)")
    claims_official: bool = Field(description="True if claims to be official without authorization")
    impersonates_brand_owner: bool = Field(description="True if developer name imitates brand owner (e.g., xAl vs xAI)")

    red_flags: List[str] = Field(description="List of suspicious indicators found")
    evidence: str = Field(description="Detailed reasoning with visual similarity assessment")


class CombinedCloneAnalysisResponse(BaseModel):
    """
    Combined response for icon analysis AND clone classification in ONE API call.
    This reduces API calls by 50% compared to separate icon + clone analysis calls.
    """
    # === ICON ANALYSIS (Phase 1) ===
    icon_similarity_score: float = Field(description="Calibrated similarity 0.0-1.0 (0.95+ identical, 0.80-0.94 recolored, 0.70-0.89 imitative)")
    icon_similarity_type: str = Field(description="IDENTICAL, RECOLORED, IMITATIVE, CONVENTION, or DIFFERENT")
    
    # Embedded logo detection (critical for brand clusters)
    contains_embedded_brand_logo: bool = Field(description="True if suspect icon contains a small embedded version of the anchor's brand logo (e.g., OpenAI logo inside a hexagon). This is HIGHLY suspicious for brand impersonation.")
    embedded_logo_description: str = Field(description="If embedded brand logo found, describe it (e.g., 'Small OpenAI flower logo visible in corner')")
    
    # Imitation detection
    is_deliberate_imitation: bool = Field(description="True if suspect icon is DESIGNED to look like anchor - same colors, similar concept, similar feel")
    uses_category_convention: bool = Field(description="True if BOTH icons use common category patterns (shields for security). LESS concerning than deliberate imitation.")
    
    # Icon conclusion
    is_icon_copy: bool = Field(description="True if same artwork (IDENTICAL/RECOLORED)")
    icons_share_design_intent: bool = Field(description="True if copied OR deliberately imitative")
    icon_analysis_details: str = Field(description="Visual evidence for icon assessment")
    
    # === CLONE CLASSIFICATION (Phase 2) ===
    relationship: str = Field(description="OFFICIAL, CLONE, MALICIOUS_CLONE, LEGITIMATE, UNKNOWN")
    confidence: float = Field(description="Classification confidence 0.0-1.0")
    
    # Deception indicators
    has_typosquatting: bool = Field(description="True if name typosquats the anchor (ChatGTP, 0penAI)")
    claims_official: bool = Field(description="True if explicitly claims to be 'Official' in name/description")
    impersonates_developer: bool = Field(description="True if developer name imitates anchor's developer")
    is_deceptive: bool = Field(description="True if any deception detected")
    
    # Final output
    red_flags: List[str] = Field(description="List of all suspicious indicators found")
    evidence: str = Field(description="Detailed reasoning for the classification")



def download_icon(url: str, timeout: int = 10) -> Optional[bytes]:
    """Download icon image from URL"""
    if not url:
        return None
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        return response.content
    except Exception as e:
        return None


@retry_on_429()
def detect_cluster_type(keyword: str) -> Tuple[ClusterType, ClusterTypeResponse]:
    """
    Determine what type of cluster this keyword represents.
    Two-step process: Google Search first, then structured output.
    """
    # Step 1: Search with Google for information
    search_prompt = f"""Search for information about "{keyword}" to determine:
1. Is "{keyword}" a product/brand owned by a single company? If so, who owns it?
2. Or is "{keyword}" a category with multiple competing products (like "adblocker" has uBlock, AdBlock Plus, etc.)?
3. What are the well-known legitimate products/extensions for "{keyword}"?

Provide the search findings."""

    rate_limiter.wait_if_needed()
    search_response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=search_prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            thinking_config=types.ThinkingConfig(thinking_budget=2048),
            temperature=1.0,
        )
    )
    token_tracker.add(search_response)

    search_findings = search_response.text

    # Step 2: Structure the findings into JSON
    structure_prompt = f"""Based on these search findings about "{keyword}":

{search_findings}

Classify the cluster type:
- BRAND: Single company owns this (e.g., "chatgpt" -> OpenAI)
- CATEGORY: Multiple legitimate competing products (e.g., "adblocker" -> uBlock, AdBlock, AdGuard)
- GENERIC: No brand ownership, generic utility (e.g., "screen recorder")

Return JSON with:
- cluster_type: "BRAND", "CATEGORY", or "GENERIC"
- brand_owner: Company name if BRAND type, otherwise null
- legitimate_products: List of well-known legitimate products
- reasoning: Brief explanation
"""

    rate_limiter.wait_if_needed()
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=structure_prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ClusterTypeResponse.model_json_schema(),
            thinking_config=types.ThinkingConfig(thinking_budget=2048),
            temperature=1.0,
        )
    )
    token_tracker.add(response)

    result = ClusterTypeResponse.model_validate_json(response.text)

    # Map string to enum
    type_map = {
        "BRAND": ClusterType.BRAND,
        "CATEGORY": ClusterType.CATEGORY,
        "GENERIC": ClusterType.GENERIC
    }
    cluster_type = type_map.get(result.cluster_type.upper(), ClusterType.GENERIC)

    return cluster_type, result


@retry_on_429()
def verify_anchor(extension: Extension, expected_brand_owner: Optional[str] = None) -> Tuple[bool, AnchorVerificationResponse]:
    """
    Verify if an extension is a legitimate anchor (official or well-known product).
    Two-step process: Google Search first, then structured output.

    Args:
        extension: The extension to verify
        expected_brand_owner: For BRAND clusters, the expected owner (e.g., "OpenAI")
    """
    # Step 1: Search for developer verification
    search_prompt = f"""Search to verify if this Chrome extension is the OFFICIAL extension from the brand owner:

- Extension Name: {extension.name}
- Developer: {extension.developer}
- Developer Address: {extension.developer_address}
{"- Expected Brand Owner: " + expected_brand_owner if expected_brand_owner else ""}

Search for:
1. Does "{expected_brand_owner if expected_brand_owner else 'the brand'}" have an OFFICIAL Chrome extension?
2. Is "{extension.developer}" the same company as {expected_brand_owner if expected_brand_owner else 'the brand owner'}?
3. Is this extension PUBLISHED BY the brand owner, or is it a third-party tool?

IMPORTANT: Third-party tools that USE or INTEGRATE a brand's service (like HARPA AI, Monica AI, etc.) are NOT official brand extensions.

Provide the search findings."""

    rate_limiter.wait_if_needed()
    search_response = client.models.generate_content(
        model="gemini-3-pro-preview",
        contents=search_prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            thinking_config=types.ThinkingConfig(thinking_budget=4096),
            temperature=1.0,
        )
    )
    token_tracker.add(search_response)

    search_findings = search_response.text

    # Step 2: Structure the verification result
    structure_prompt = f"""Based on these search findings about the extension developer:

{search_findings}

Extension Details:
- Name: {extension.name}
- Developer: {extension.developer}
- Users: {extension.user_count:,}
{"- Expected Brand Owner: " + expected_brand_owner if expected_brand_owner else ""}

Determine if this is the OFFICIAL extension published by the brand owner ({expected_brand_owner if expected_brand_owner else "the brand"}).

CRITICAL RULES:
1. The extension must be PUBLISHED BY the brand owner (e.g., "Google", "OpenAI", "Anthropic")
2. Third-party tools that USE or INTEGRATE the brand's service are NOT official (e.g., HARPA AI uses ChatGPT/Gemini but is NOT official)
3. High user count does NOT mean official
4. The developer name must be the actual brand owner, not a third-party company
5. If the brand has NO official extension in Chrome Web Store, mark is_verified_official as FALSE

For example:
- "ChatGPT" by "OpenAI" = OFFICIAL (OpenAI owns ChatGPT)
- "HARPA AI" by "HARPA AI TECHNOLOGIES" = NOT OFFICIAL (third-party tool using AI services)
- "Gemini for Chrome" by "SomeCompany" = NOT OFFICIAL (not published by Google)

Return JSON with your verification assessment."""

    rate_limiter.wait_if_needed()
    response = client.models.generate_content(
        model="gemini-3-pro-preview",
        contents=structure_prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=AnchorVerificationResponse.model_json_schema(),
            thinking_config=types.ThinkingConfig(thinking_budget=4096),
            temperature=1.0,
        )
    )
    token_tracker.add(response)

    result = AnchorVerificationResponse.model_validate_json(response.text)
    is_verified = result.is_verified_official and result.confidence >= 0.7

    return is_verified, result


@retry_on_429()
def find_anchors_batch(extensions_json: str, keyword: str, brand_owner: str = None) -> BatchAnchorResponse:
    """
    Find official/legitimate anchor extensions by sending the full JSON to Gemini.
    Uses Google Search grounding to verify which extensions are truly official.
    
    Args:
        extensions_json: Full JSON string of all extensions (or summarized version)
        keyword: The category/brand keyword (e.g., "claude", "chatgpt")
        brand_owner: Optional known brand owner (e.g., "Anthropic", "OpenAI")
    
    Returns:
        BatchAnchorResponse with list of verified official extension IDs
    """
    # Create a summarized version to fit context window better
    import json
    extensions = json.loads(extensions_json)
    
    # Summarize: only key fields needed for verification
    summary = []
    for ext in extensions:
        summary.append({
            "id": ext.get("id"),
            "name": ext.get("name"),
            "developer": ext.get("developer"),
            "user_count": ext.get("user_count", 0),
            "description": (ext.get("description") or "")[:200]  # Truncate
        })
    
    summary_json = json.dumps(summary, indent=2, ensure_ascii=False)
    
    prompt = f"""You have access to Google Search. Your task is to find the OFFICIAL extension(s) for the brand "{keyword}".

CONTEXT:
- Category/Brand: {keyword}
{f"- Known Brand Owner: {brand_owner}" if brand_owner else "- Brand Owner: Use Google Search to find the official owner"}

INSTRUCTIONS:
1. Use Google Search to find who officially owns/makes "{keyword}"
2. Look through the extension list below and find which one(s) are from the VERIFIED official developer
3. Check developer names carefully - the official one should match the real company name
4. Be STRICT - high user count does NOT mean official. Only return extensions from the verified brand owner.

EXTENSION LIST:
{summary_json}

Return the IDs of verified OFFICIAL extensions only. If none are found, return an empty list.
Use your Google Search to verify the official developer before deciding."""

    rate_limiter.wait_if_needed()
    response = client.models.generate_content(
        model="gemini-3-pro-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            response_mime_type="application/json",
            response_schema=BatchAnchorResponse.model_json_schema(),
            thinking_config=types.ThinkingConfig(thinking_budget=4096),
            temperature=1.0,
        )
    )
    token_tracker.add(response)

    return BatchAnchorResponse.model_validate_json(response.text)


@retry_on_429()
def analyze_brand_impersonation(
    extension: Extension,
    extension_icon: Optional[bytes],
    keyword: str,
    brand_owner: str = None
) -> BrandImpersonationResponse:
    """
    Analyze if an extension is impersonating a brand that has NO official Chrome extension.

    Uses Google Search grounding to:
    1. Verify the brand exists and who owns it
    2. Find the brand's official visual identity (colors, logo)
    3. Compare the extension against the brand's web presence

    This is for cases like "gemini" where Google doesn't have an official extension.
    """
    prompt = f"""You have access to Google Search. Analyze if this Chrome extension is IMPERSONATING the brand "{keyword}".

=== CRITICAL CONTEXT ===
The brand "{keyword}" may NOT have an official Chrome extension.
You are ONLY checking if this extension impersonates "{keyword}" - NOT any other brand.

=== EXTENSION TO ANALYZE ===
- Name: {extension.name}
- Developer: {extension.developer}
- Description: {extension.description[:300] if extension.description else 'N/A'}
- Users: {extension.user_count:,}

=== YOUR TASKS ===

**Step 1: Use Google Search to find:**
1. Who officially owns/created the brand "{keyword}"? (e.g., Grok is owned by xAI/X)
2. Does "{keyword}" have an OFFICIAL Chrome extension? (Search for it)
3. What are "{keyword}"'s official colors, logo style, and visual identity?

**Step 2: Analyze if extension uses "{keyword}"'s brand imagery:**
1. Does the icon use "{keyword}"'s official colors, logo, or visual style?
2. Rate visual similarity to "{keyword}"'s brand imagery (0-100%)
3. Is this DELIBERATELY designed to look like "{keyword}"?

**Step 3: Check for deception indicators:**
1. Typosquatting "{keyword}" name? (e.g., "Grok AI" vs "Gr0k AI" with zero)
2. Claims to be "Official {keyword}" when it's not?
3. Developer name impersonates "{keyword}"'s owner? (e.g., "xAl" with lowercase L instead of "xAI")

**Step 4: Classify using SAME logic as anchor mode:**

- **MALICIOUS_CLONE**: Uses "{keyword}"'s visual identity (>60% similarity OR deliberate imitation) AND has deception:
  * Typosquatting the brand name
  * OR claims "Official" without authorization
  * OR developer name impersonates brand owner
  * OR uses brand name in title with imitative icon (visual deception + keyword stuffing)

- **CLONE**: Uses "{keyword}"'s visual identity (>60% similarity OR deliberate imitation) BUT:
  * NO typosquatting
  * NO "Official" claim
  * NO developer impersonation
  * Visual copying without deceptive intent (still policy violation but not malicious)

- **LEGITIMATE**: Does NOT use "{keyword}"'s visual identity (<60% similarity AND not deliberately imitative)
  * May mention "{keyword}" descriptively (e.g., "PDF tool for Grok")
  * Has DISTINCT original branding
  * OR is actually a different brand entirely (e.g., n8n extension is NOT impersonating Grok)

- **UNKNOWN**: Cannot determine (50-60% visual similarity with unclear intent)

=== CRITICAL RULES ===
1. ONLY check impersonation of "{keyword}" - if this is clearly a different brand (e.g., n8n, ChatGPT), mark as LEGITIMATE relative to "{keyword}"
2. Visual copying of "{keyword}"'s imagery is the PRIMARY indicator - same logic as comparing to anchor icon
3. Deception indicators (typosquatting, fake official claims) distinguish MALICIOUS_CLONE from CLONE
4. "Unofficial" disclaimer does NOT make visual copying acceptable - still violates policy (CLONE or MALICIOUS_CLONE)
5. Using "{keyword}" descriptively with DISTINCT branding = LEGITIMATE (e.g., "Helper for {keyword}")

{f"Known brand owner: {brand_owner}" if brand_owner else f"Use Google Search to determine who officially owns {keyword}."}

Analyze this extension now. Remember: We're checking if it impersonates "{keyword}" specifically, not other brands."""

    # Build multimodal request with icon if available
    parts = [types.Part(text=prompt)]

    if extension_icon:
        parts.append(types.Part(text="=== EXTENSION ICON (Analyze for brand imagery) ==="))
        parts.append(types.Part(inline_data=types.Blob(mime_type="image/png", data=extension_icon)))

    rate_limiter.wait_if_needed()
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=[types.Content(parts=parts)],
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            response_mime_type="application/json",
            response_schema=BrandImpersonationResponse.model_json_schema(),
            thinking_config=types.ThinkingConfig(thinking_budget=4096),
            temperature=1.0,
        )
    )
    token_tracker.add(response)

    return BrandImpersonationResponse.model_validate_json(response.text)




@retry_on_429()
def analyze_suspect_combined(
    anchor: VerifiedAnchor,
    suspect: Extension,
    suspect_icon: Optional[bytes],
    cluster_type: ClusterType,
    keyword: str = ""
) -> CombinedCloneAnalysisResponse:
    """
    OPTIMIZED: Combined icon analysis AND clone classification in ONE API call.
    
    This reduces API calls by 50% compared to the previous approach of:
    - Call 1: compare_icons_with_reference()
    - Call 2: analyze_clone_relationship()
    
    Now both are done in a single multimodal request.
    
    Special handling for BRAND clusters:
    - Detects embedded brand logos (e.g., OpenAI logo inside a hexagon)
    - This is HIGHLY suspicious for brand impersonation
    
    For CATEGORY clusters (like adblockers):
    - Common design patterns (shields) are LESS concerning
    - Focus on deliberate imitation vs category convention
    """
    
    # Category conventions - common design patterns that don't indicate copying
    category_conventions = {
        "adblock": "shields, stop signs, hands, checkmarks, octagonal shapes",
        "vpn": "shields, locks, globes, keys, tunnel icons",
        "password": "keys, locks, shields, vault icons",
        "security": "shields, locks, checkmarks",
        "download": "arrows, clouds, folder icons",
        "chatgpt": "chat bubbles, AI symbols, brain icons",
        "openai": "abstract swirls, flower/pinwheel shapes, AI symbols",
    }
    convention_hint = category_conventions.get(keyword.lower(), "")
    
    # Determine if this is a brand cluster (need stricter logo detection)
    is_brand_cluster = cluster_type == ClusterType.BRAND
    brand_logo_warning = ""
    if is_brand_cluster:
        brand_logo_warning = f"""
=== CRITICAL: EMBEDDED BRAND LOGO DETECTION (BRAND CLUSTER) ===

For BRAND clusters like "{keyword}", detecting EMBEDDED BRAND LOGOS is critical:

**What to look for:**
- Small version of the anchor's distinctive logo placed INSIDE another shape
- Example: OpenAI flower logo inside a hexagon, chat bubble, or other container
- Example: ChatGPT logo watermarked or embedded in a different design
- This is HIGHLY SUSPICIOUS even if the overall icon looks different

**Why this matters:**
- Brand impersonators often embed the real logo to appear legitimate
- Users may not notice the difference at a glance
- This is a strong indicator of MALICIOUS_CLONE

Set contains_embedded_brand_logo=True if you detect this pattern.
"""

    prompt = f"""You are performing COMBINED icon analysis AND clone classification in ONE step.

=== TASK ===
Analyze if the SUSPECT extension is a clone of the VERIFIED ANCHOR.
Compare both the ICONS (visual analysis) and METADATA to make a classification.

=== VERIFIED ANCHOR (Official/Legitimate) ===
- Name: {anchor.extension.name}
- Developer: {anchor.extension.developer}
- Users: {anchor.extension.user_count:,}

=== SUSPECT (Being Analyzed) ===
- Name: {suspect.name}
- Developer: {suspect.developer}
- Users: {suspect.user_count:,}
- Description: {suspect.description[:300]}

{brand_logo_warning}

=== PHASE 1: ICON ANALYSIS ===

Look at BOTH images and analyze:

1. **Similarity Score** (0.0-1.0):
   - 0.95-1.0: IDENTICAL (pixel-perfect)
   - 0.80-0.94: RECOLORED (same artwork, different colors)
   - 0.60-0.79: IMITATIVE (designed to look alike, different artwork)
   - 0.40-0.59: CONVENTION (common category patterns, coincidental)
   - 0.00-0.39: DIFFERENT (unrelated designs)

2. **Embedded Brand Logo Check**:
   - Does the suspect icon contain a SMALL VERSION of the anchor's brand logo?
   - Look for: logo in corner, watermark, logo inside another shape
   - This is HIGHLY SUSPICIOUS for brand impersonation

3. **Deliberate Imitation vs Convention**:
   - IMITATIVE: Same color scheme + similar concept = DESIGNED to cause confusion
   - CONVENTION: Both use common patterns (shields for security apps)
   {f"- For '{keyword}' category, these are common conventions: {convention_hint}" if convention_hint else ""}

=== PHASE 2: CLONE CLASSIFICATION ===

Based on your icon analysis AND metadata, classify:

**MALICIOUS_CLONE** = (icon_similarity >60% OR embedded_brand_logo OR deliberate_imitation) AND:
- Typosquatting in name (ChatGTP, 0penAI with zero)
- OR explicit "Official" claim
- OR developer name impersonation (OpenAl with lowercase L)
- OR use of Brand Name in title paired with an IMITATIVE icon (Visual Deception + Keyword Stuffing). "Unofficial" is NOT a defense.

**CLONE** = icon_similarity >60% OR deliberate_imitation, BUT:
- NO typosquatting
- NO "Official" claim
- NO developer impersonation
- BUT visual identity is clearly copied/derived from anchor

**LEGITIMATE** = icon_similarity <50% AND NOT deliberate_imitation

**UNKNOWN** = 50-60% similarity with unclear determination

=== RULES ===
1. VISUALS TRUMP TEXT: If the icon is IMITATIVE, adding "Unofficial" or "Guide" to the title does NOT make it legitimate. It is still a policy violation.
2. "Unknown" developer + Imitative Icon + Brand Name = HIGHLY SUSPICIOUS.
3. Embedded brand logos are HIGHLY suspicious even with different overall design.
4. For category clusters (adblock), shields are NORMAL - focus on deliberate imitation.

Analyze the two icons now and provide your combined assessment."""

    # Build multimodal request with BOTH images
    parts = [types.Part(text=prompt)]
    
    if anchor.icon_data:
        parts.append(types.Part(text="=== ANCHOR ICON (Reference) ==="))
        parts.append(types.Part(inline_data=types.Blob(mime_type="image/png", data=anchor.icon_data)))
    
    if suspect_icon:
        parts.append(types.Part(text="=== SUSPECT ICON (Being Analyzed) ==="))
        parts.append(types.Part(inline_data=types.Blob(mime_type="image/png", data=suspect_icon)))

    rate_limiter.wait_if_needed()
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=[types.Content(parts=parts)],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=CombinedCloneAnalysisResponse.model_json_schema(),
            thinking_config=types.ThinkingConfig(thinking_budget=2048),
            temperature=1.0,
        )
    )
    token_tracker.add(response)

    return CombinedCloneAnalysisResponse.model_validate_json(response.text)


# ============================================================================
# Pipeline Orchestration
# ============================================================================


def identify_anchors(
    extensions: List[Extension],
    cluster_type: ClusterType,
    cluster_info: ClusterTypeResponse,
    max_anchors: int = 10
) -> List[VerifiedAnchor]:
    """
    Identify and verify anchor extensions for the cluster.

    For BRAND clusters: Find the official brand extension
    For CATEGORY clusters: Find the well-known legitimate products
    For GENERIC clusters: Use top extensions by reputation score
    """
    print(f"  Identifying anchors for {cluster_type.value} cluster...")

    anchors = []

    # Calculate reputation score: users * rating (simple but effective)
    def reputation_score(ext: Extension) -> float:
        return ext.user_count * max(ext.rating, 1.0)

    sorted_extensions = sorted(extensions, key=reputation_score, reverse=True)

    if cluster_type == ClusterType.BRAND:
        # For brand clusters, find the official extension
        brand_owner = cluster_info.brand_owner
        print(f"  Looking for official extension from: {brand_owner}")

        # First, try to find by matching developer name
        candidates = []
        for ext in sorted_extensions[:50]:  # Check top 50 by reputation
            # Check if developer name contains brand owner
            if brand_owner and brand_owner.lower() in ext.developer.lower():
                candidates.append(ext)

        # Verify candidates
        for ext in candidates[:5]:  # Verify top 5 candidates
            is_verified, verification = verify_anchor(ext, brand_owner)
            if is_verified:
                icon_data = download_icon(ext.icon_url)
                anchors.append(VerifiedAnchor(
                    extension=ext,
                    icon_data=icon_data,
                    verification_evidence=verification.evidence,
                    is_brand_owner=True
                ))
                print(f"    VERIFIED OFFICIAL: {ext.name} by {ext.developer}")
                break

        # If no verified official found, take top by reputation and verify
        if not anchors:
            print(f"  No direct developer match, verifying top extensions...")
            for ext in sorted_extensions[:10]:
                is_verified, verification = verify_anchor(ext, brand_owner)
                if is_verified:
                    icon_data = download_icon(ext.icon_url)
                    anchors.append(VerifiedAnchor(
                        extension=ext,
                        icon_data=icon_data,
                        verification_evidence=verification.evidence,
                        is_brand_owner=True
                    ))
                    print(f"    VERIFIED: {ext.name} by {ext.developer}")
                    break

    elif cluster_type == ClusterType.CATEGORY:
        # For category clusters, find multiple legitimate products
        legitimate_names = [p.lower() for p in cluster_info.legitimate_products]
        print(f"  Looking for legitimate products: {cluster_info.legitimate_products}")

        for ext in sorted_extensions:
            if len(anchors) >= max_anchors:
                break

            # Check if extension name matches known legitimate products
            ext_name_lower = ext.name.lower()
            is_known = any(legit in ext_name_lower for legit in legitimate_names)

            if is_known or reputation_score(ext) > 1_000_000:  # High reputation
                is_verified, verification = verify_anchor(ext)
                if is_verified:
                    icon_data = download_icon(ext.icon_url)
                    anchors.append(VerifiedAnchor(
                        extension=ext,
                        icon_data=icon_data,
                        verification_evidence=verification.evidence,
                        is_brand_owner=False
                    ))
                    print(f"    VERIFIED LEGITIMATE: {ext.name} by {ext.developer}")

    else:  # GENERIC
        # For generic clusters, use top extensions by reputation
        print(f"  Generic cluster: using top extensions by reputation")

        for ext in sorted_extensions[:max_anchors * 2]:  # Check more, take top verified
            if len(anchors) >= max_anchors:
                break

            # Basic verification for generic clusters
            is_verified, verification = verify_anchor(ext)
            if is_verified or (ext.user_count > 100_000 and ext.rating >= 4.0):
                icon_data = download_icon(ext.icon_url)
                anchors.append(VerifiedAnchor(
                    extension=ext,
                    icon_data=icon_data,
                    verification_evidence=verification.evidence if is_verified else "High reputation",
                    is_brand_owner=False
                ))
                print(f"    ANCHOR: {ext.name} ({ext.user_count:,} users)")

    if not anchors:
        if cluster_type == ClusterType.BRAND:
            # For BRAND clusters with no anchor, return empty list
            # This triggers "no anchor" brand impersonation mode
            print(f"  INFO: No official anchor found for brand '{cluster_info.brand_owner}'. Will use brand impersonation detection mode.")
            return []  # Empty list signals no-anchor mode
        else:
            # For CATEGORY/GENERIC clusters, fallback to highest reputation
            print(f"  WARNING: No verified anchors found! Using top extension by reputation.")
            ext = sorted_extensions[0]
            icon_data = download_icon(ext.icon_url)
            anchors.append(VerifiedAnchor(
                extension=ext,
                icon_data=icon_data,
                verification_evidence="Fallback: highest reputation",
                is_brand_owner=False
            ))

    return anchors


def analyze_suspect(
    suspect: Extension,
    anchors: List[VerifiedAnchor],
    cluster_type: ClusterType,
    keyword: str = ""
) -> CloneDetectionResult:
    """
    Analyze a single suspect extension against all anchors.
    Returns the most concerning result.
    
    OPTIMIZED: Now uses analyze_suspect_combined() which performs
    icon analysis AND clone classification in ONE API call per anchor,
    reducing total API calls by 50%.
    """
    # Skip if suspect is one of the anchors
    anchor_ids = {a.extension.id for a in anchors}
    if suspect.id in anchor_ids:
        return CloneDetectionResult(
            suspect=suspect,
            relationship=Relationship.OFFICIAL,
            confidence=1.0,
            evidence="This is a verified anchor extension"
        )

    # Download suspect icon once (reused for all anchor comparisons)
    suspect_icon = download_icon(suspect.icon_url)

    worst_result = None
    worst_severity = -1

    severity_order = {
        Relationship.MALICIOUS_CLONE: 4,
        Relationship.CLONE: 3,
        Relationship.UNKNOWN: 2,
        Relationship.LEGITIMATE: 1,
        Relationship.OFFICIAL: 0,
    }

    for anchor in anchors:
        try:
            # OPTIMIZED: Single API call for both icon analysis AND clone classification
            analysis = analyze_suspect_combined(
                anchor=anchor,
                suspect=suspect,
                suspect_icon=suspect_icon,
                cluster_type=cluster_type,
                keyword=keyword
            )

            # Map to relationship enum
            rel_map = {
                "OFFICIAL": Relationship.OFFICIAL,
                "CLONE": Relationship.CLONE,
                "MALICIOUS_CLONE": Relationship.MALICIOUS_CLONE,
                "LEGITIMATE": Relationship.LEGITIMATE,
            }
            relationship = rel_map.get(analysis.relationship.upper(), Relationship.UNKNOWN)

            severity = severity_order.get(relationship, 0)

            if severity > worst_severity:
                worst_severity = severity
                
                # Normalize similarity score (handle model returning percentages)
                sim_score = analysis.icon_similarity_score
                if sim_score > 1.0:  # Model returned percentage (e.g., 85 instead of 0.85)
                    sim_score = sim_score / 100.0
                sim_score = max(0.0, min(1.0, sim_score))  # Clamp to 0-1
                
                # Build red flags list including embedded logo detection
                red_flags = list(analysis.red_flags)
                if analysis.contains_embedded_brand_logo:
                    red_flags.insert(0, f"EMBEDDED BRAND LOGO: {analysis.embedded_logo_description}")
                
                worst_result = CloneDetectionResult(
                    suspect=suspect,
                    relationship=relationship,
                    confidence=analysis.confidence,
                    cloned_from=anchor.extension if relationship in [Relationship.CLONE, Relationship.MALICIOUS_CLONE] else None,
                    evidence=analysis.evidence,
                    icon_similarity=sim_score,
                    similarity_type=analysis.icon_similarity_type,
                    is_imitative=analysis.is_deliberate_imitation,
                    red_flags=red_flags
                )

        except Exception as e:
            # Return UNKNOWN on error, not LEGITIMATE
            print(f"    Analysis error for {suspect.name}: {e}")
            if worst_result is None:
                worst_result = CloneDetectionResult(
                    suspect=suspect,
                    relationship=Relationship.UNKNOWN,
                    confidence=0.0,
                    evidence=f"Error during analysis: {e}",
                    red_flags=["ANALYSIS_ERROR"]
                )

    return worst_result or CloneDetectionResult(
        suspect=suspect,
        relationship=Relationship.UNKNOWN,
        confidence=0.0,
        evidence="No comparison performed"
    )


def process_cluster(
    extensions: List[Extension],
    keyword: str,
    max_workers: int = 10,
    official_anchor_ids: Optional[List[str]] = None,
    official_anchor_reasoning: Optional[str] = None
) -> ClusterAnalysisResult:
    """
    Process a complete keyword cluster.

    This is the main entry point for clone detection.
    
    Args:
        extensions: List of Extension objects to analyze
        keyword: The category/brand keyword
        max_workers: Number of parallel workers for analysis
        official_anchor_ids: Pre-found official anchor IDs (skips anchor detection if provided)
    """
    print(f"\n{'='*70}")
    print(f"CLONE DETECTION PIPELINE")
    print(f"Keyword: '{keyword}' | Extensions: {len(extensions)}")
    print(f"{'='*70}\n")

    start_time = time.time()

    # Step 1: Detect cluster type
    print("Step 1: Detecting cluster type...")
    cluster_type, cluster_info = detect_cluster_type(keyword)
    print(f"  Type: {cluster_type.value}")
    print(f"  Reasoning: {cluster_info.reasoning}")
    if cluster_info.brand_owner:
        print(f"  Brand Owner: {cluster_info.brand_owner}")
    if cluster_info.legitimate_products:
        print(f"  Known Products: {', '.join(cluster_info.legitimate_products[:5])}")

    # Step 2: Identify and verify anchors
    print(f"\nStep 2: Identifying verified anchors...")
    
    if official_anchor_ids:
        # Use pre-found anchor IDs (skip internal detection)
        print(f"  Using pre-found anchors: {official_anchor_ids}")
        anchors = []
        for anchor_id in official_anchor_ids:
            ext = next((e for e in extensions if e.id == anchor_id), None)
            if ext:
                icon_data = download_icon(ext.icon_url) if ext.icon_url else None
                anchors.append(VerifiedAnchor(
                    extension=ext,
                    icon_data=icon_data,
                    verification_evidence=official_anchor_reasoning or "Pre-verified via batch anchor detection",
                    is_brand_owner=True
                ))
                print(f"  ✅ Anchor: {ext.name} (by {ext.developer})")
    else:
        # Run normal anchor detection
        anchors = identify_anchors(extensions, cluster_type, cluster_info)
    
    print(f"  Found {len(anchors)} verified anchor(s)")

    # Check for NO ANCHOR mode (brand impersonation detection)
    no_anchor_mode = len(anchors) == 0 and cluster_type == ClusterType.BRAND

    if no_anchor_mode:
        print(f"\n  [!] NO OFFICIAL ANCHOR MODE")
        print(f"  Brand '{cluster_info.brand_owner}' has no official Chrome extension.")
        print(f"  Switching to brand impersonation detection using Google Search grounding.")

    # Step 3: Filter suspects (extensions that are not anchors)
    anchor_ids = {a.extension.id for a in anchors}
    suspects = [e for e in extensions if e.id not in anchor_ids]

    # Prioritize new/suspicious extensions
    def priority_score(ext: Extension) -> float:
        score = 0
        # Low user count but exists = potentially new clone
        if ext.user_count < 1000:
            score += 10
        if ext.user_count < 100:
            score += 20
        # Low rating = suspicious
        if ext.rating < 3.0:
            score += 5
        # Check for suspicious patterns in name
        suspicious_patterns = ['pro', 'plus', 'premium', 'official', 'free', 'best']
        if any(p in ext.name.lower() for p in suspicious_patterns):
            score += 3
        return score

    suspects = sorted(suspects, key=priority_score, reverse=True)

    # In no-anchor mode, ALL extensions are suspects
    if no_anchor_mode:
        suspects = extensions  # Analyze all extensions
        suspects = sorted(suspects, key=priority_score, reverse=True)

    print(f"\nStep 3: Analyzing {len(suspects)} suspects...")
    print(f"  (Prioritized by risk score)")
    if no_anchor_mode:
        print(f"  Mode: Brand impersonation detection (no anchor)")

    # Step 4: Analyze suspects in parallel
    results = []

    def analyze_suspect_wrapper(suspect):
        """Wrapper to handle both anchor-based and no-anchor analysis."""
        if no_anchor_mode:
            # Use brand impersonation analysis
            suspect_icon = download_icon(suspect.icon_url)
            try:
                analysis = analyze_brand_impersonation(
                    extension=suspect,
                    extension_icon=suspect_icon,
                    keyword=keyword,
                    brand_owner=cluster_info.brand_owner
                )

                # Map to relationship enum
                rel_map = {
                    "UNAUTHORIZED_CLONE": Relationship.MALICIOUS_CLONE,  # Backwards compatibility
                    "MALICIOUS_CLONE": Relationship.MALICIOUS_CLONE,
                    "CLONE": Relationship.CLONE,
                    "LEGITIMATE": Relationship.LEGITIMATE,
                }
                relationship = rel_map.get(analysis.relationship.upper(), Relationship.UNKNOWN)

                return CloneDetectionResult(
                    suspect=suspect,
                    relationship=relationship,
                    confidence=analysis.confidence,
                    cloned_from=None,  # No anchor to reference
                    evidence=analysis.evidence,
                    icon_similarity=0.0,  # N/A in no-anchor mode
                    similarity_type="BRAND_IMPERSONATION",
                    is_imitative=analysis.uses_brand_imagery,
                    red_flags=analysis.red_flags
                )
            except Exception as e:
                print(f"    Analysis error for {suspect.name}: {e}")
                return CloneDetectionResult(
                    suspect=suspect,
                    relationship=Relationship.UNKNOWN,
                    confidence=0.0,
                    evidence=f"Error during analysis: {e}",
                    red_flags=["ANALYSIS_ERROR"]
                )
        else:
            # Use normal anchor-based analysis
            return analyze_suspect(suspect, anchors, cluster_type, keyword)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_suspect = {
            executor.submit(analyze_suspect_wrapper, suspect): suspect
            for suspect in suspects
        }

        completed = 0
        for future in as_completed(future_to_suspect):
            completed += 1
            if completed % 20 == 0:
                print(f"  Progress: {completed}/{len(suspects)}")

            try:
                result = future.result()
                results.append(result)

                # Print ALL findings with appropriate symbols
                if result.relationship == Relationship.MALICIOUS_CLONE:
                    print(f"  🔴 MALICIOUS_CLONE: {result.suspect.name}")
                    print(f"     Icon similarity: {result.icon_similarity:.0%} | Confidence: {result.confidence:.0%}")
                    if result.cloned_from:
                        print(f"     Copies: {result.cloned_from.name}")
                    if result.red_flags:
                        print(f"     Red flags: {', '.join(result.red_flags[:2])}...")
                elif result.relationship == Relationship.CLONE:
                    print(f"  🟠 CLONE: {result.suspect.name}")
                    print(f"     Icon similarity: {result.icon_similarity:.0%} | Confidence: {result.confidence:.0%}")
                elif result.relationship == Relationship.LEGITIMATE:
                    print(f"  🟢 LEGITIMATE: {result.suspect.name} (by {result.suspect.developer})")
                    print(f"     Icon similarity: {result.icon_similarity:.0%} | Confidence: {result.confidence:.0%}")
                    # Show brief reasoning
                    if result.evidence:
                        # Truncate evidence to first 150 chars for console
                        brief = result.evidence[:150].replace('\n', ' ')
                        print(f"     Reason: {brief}...")
                elif result.relationship == Relationship.UNKNOWN:
                    print(f"  ⚪ UNKNOWN: {result.suspect.name}")
            except Exception as e:
                print(f"  Error analyzing: {e}")

    # Calculate stats
    elapsed = time.time() - start_time
    stats = {
        "total_extensions": len(extensions),
        "anchors": len(anchors),
        "suspects_analyzed": len(suspects),
        "clones_found": sum(1 for r in results if r.relationship == Relationship.CLONE),
        "malicious_clones_found": sum(1 for r in results if r.relationship == Relationship.MALICIOUS_CLONE),
        "legitimate": sum(1 for r in results if r.relationship == Relationship.LEGITIMATE),
        "unknown": sum(1 for r in results if r.relationship == Relationship.UNKNOWN),
        "elapsed_seconds": elapsed,
        "no_anchor_mode": no_anchor_mode,
        "brand_owner": cluster_info.brand_owner if cluster_info else None,
    }

    # Print summary
    print(f"\n{'='*70}")
    print(f"SUMMARY")
    print(f"{'='*70}")
    print(f"  Cluster Type: {cluster_type.value}")
    if no_anchor_mode:
        print(f"  Mode: NO ANCHOR (Brand Impersonation Detection)")
        print(f"  Brand Owner: {cluster_info.brand_owner}")
    print(f"  Anchors: {len(anchors)}")
    print(f"  Suspects Analyzed: {len(suspects)}")
    print(f"  CLONES Found: {stats['clones_found']}")
    print(f"  MALICIOUS CLONES Found: {stats['malicious_clones_found']}")
    print(f"  Legitimate: {stats['legitimate']}")
    print(f"  Unknown: {stats['unknown']}")
    print(f"  Time: {elapsed:.1f}s")
    print(f"  Time: {elapsed:.1f}s")
    
    # Print token usage
    token_stats = token_tracker.get_summary()
    print(f"  Token Usage: {token_stats['total_tokens']:,} total "
          f"({token_stats['prompt_tokens']:,} prompt, {token_stats['candidate_tokens']:,} output)")

    print(f"{'='*70}\n")
    
    # Include token stats in result
    stats['token_usage'] = token_stats

    return ClusterAnalysisResult(
        keyword=keyword,
        cluster_type=cluster_type,
        anchors=anchors,
        results=results,
        stats=stats
    )


def save_results(result: ClusterAnalysisResult, output_path: str):
    """Save results to JSON file - includes ALL extensions with their classifications"""

    # Separate results by category
    clones = []
    legitimate = []
    unknown = []

    for r in result.results:
        entry = {
            "id": r.suspect.id,
            "name": r.suspect.name,
            "developer": r.suspect.developer,
            "user_count": r.suspect.user_count,
            "relationship": r.relationship.value,
            "confidence": r.confidence,
            "icon_similarity": r.icon_similarity,
            "similarity_type": r.similarity_type,  # IDENTICAL, RECOLORED, IMITATIVE, etc.
            "is_imitative": r.is_imitative,  # True if deliberately designed to look like original
            "evidence": r.evidence,
            "icon_url": r.suspect.icon_url,
        }

        if r.relationship in [Relationship.CLONE, Relationship.MALICIOUS_CLONE]:
            entry["cloned_from"] = r.cloned_from.name if r.cloned_from else None
            entry["cloned_from_id"] = r.cloned_from.id if r.cloned_from else None
            entry["cloned_from_icon_url"] = r.cloned_from.icon_url if r.cloned_from else None
            entry["red_flags"] = r.red_flags
            clones.append(entry)
        elif r.relationship == Relationship.LEGITIMATE:
            # For BRAND clusters, LEGITIMATE = brand rider (uses name but original)
            entry["note"] = "Uses brand name but original implementation, not deceptive"
            legitimate.append(entry)
        else:
            unknown.append(entry)

    output = {
        "keyword": result.keyword,
        "cluster_type": result.cluster_type.value,
        "anchors": [
            {
                "id": a.extension.id,
                "name": a.extension.name,
                "developer": a.extension.developer,
                "user_count": a.extension.user_count,
                "is_brand_owner": a.is_brand_owner,
                "evidence": a.verification_evidence,
                "icon_url": a.extension.icon_url,  # Added for HTML
            }
            for a in result.anchors
        ],
        "malicious_clones": [c for c in clones if c["relationship"] == "MALICIOUS_CLONE"],
        "clones": [c for c in clones if c["relationship"] == "CLONE"],
        "legitimate": legitimate,
        "unknown": unknown,
        "stats": result.stats
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nResults saved to: {output_path}")
    print(f"  - Malicious clones: {len(output['malicious_clones'])}")
    print(f"  - Clones: {len(output['clones'])}")
    print(f"  - Legitimate (brand riders): {len(output['legitimate'])}")
    print(f"  - Unknown: {len(output['unknown'])}")




if __name__ == "__main__":
    print("Gemini Clone Detection Pipeline v2")
    print("Usage: from gemini_clone_detector import process_cluster")
    print("")
    print("Example:")
    print("  extensions = load_extensions('data/chatgpt_metadata.json')")
    print("  result = process_cluster(extensions, keyword='chatgpt')")
    print("  save_results(result, 'output/chatgpt_clones.json')")
