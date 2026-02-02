from playwright.sync_api import sync_playwright
import json
import time
import re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed


def load_existing_ids(file_path: str) -> set:
    """Load existing extension IDs to avoid re-scraping."""
    if not Path(file_path).exists():
        return set()
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {ext.get("id") for ext in data if ext.get("id")}
    except Exception as e:
        print(f"Warning: Could not load existing data: {e}")
        return set()


def extract_extension_details(page, ext_id):
    """Extracts details from the extension page."""
    details = {
        "id": ext_id,
        "name": None,
        "developer": None,
        "developer_address": None,
        "rating": 0.0,
        "rating_count": 0,
        "user_count": 0,
        "description": None,
        "icon_url": None,
        "email": None,
        "website": None,
        "size": None,
        "version": None,
        "updated": None
    }

    try:
        # Name
        details["name"] = page.locator("h1").first.text_content().strip()
    except:
        pass

    try:
        # Developer
        # The developer info is often in a div with class 'mdSapd' or similar
        dev_locator = page.locator(".mdSapd").first
        if dev_locator.count() > 0:
            dev_text = dev_locator.text_content().strip()
            # Try to separate name from address if possible, but often it's just one block
            # If there are newlines, the first line is usually the name
            parts = dev_text.split('\n')
            details["developer"] = parts[0]
            if len(parts) > 1:
                details["developer_address"] = "\n".join(parts[1:])
    except:
        pass

    try:
        # Rating
        rating_text = page.locator(".Vq0ZA").first.text_content() # Class for rating score
        if rating_text:
             match = re.search(r"([\d\.]+)", rating_text)
             if match:
                 details["rating"] = float(match.group(1))
    except:
        # Fallback for rating
        try:
             rating_elm = page.locator("span.Cw1rxd").first 
             if rating_elm.count() > 0:
                 val = rating_elm.get_attribute("title")
                 if val:
                     details["rating"] = float(val.split(" ")[0])
        except:
            pass

    try:
        # Rating Count
        # Look for text like "3,941 ratings"
        rating_count_text = page.get_by_text(re.compile(r"[\d,]+\s+ratings")).first.text_content()
        if rating_count_text:
            count_match = re.search(r"([\d,]+)", rating_count_text)
            if count_match:
                details["rating_count"] = int(count_match.group(1).replace(",", ""))
    except:
        pass

    try:
        # User Count
        # Look for text like "2,000,000 users"
        user_text = page.get_by_text(re.compile(r"[\d,]+\s+users")).first.text_content()
        if user_text:
            count_match = re.search(r"([\d,]+)", user_text)
            if count_match:
                details["user_count"] = int(count_match.group(1).replace(",", ""))
    except:
        pass

    try:
        # Description
        # Try meta tag first
        desc = page.locator('meta[property="og:description"]').get_attribute("content")
        if desc:
            details["description"] = desc
        else:
            # Fallback to div
            details["description"] = page.locator(".NMaD2e").first.text_content().strip() 
    except:
        pass

    try:
        # Icon URL
        img = page.locator("img.img-loaded").first 
        if img.count() > 0:
             details["icon_url"] = img.get_attribute("src")
        else:
             # Try finding the largest icon
             details["icon_url"] = page.locator("img[src*='googleusercontent.com']").first.get_attribute("src")
    except:
        pass

    # Metadata list items (Version, Updated, Size, Website, Email)
    try:
        meta_items = page.locator("ul.TKAMQe > li.MqICNe").all()
        for item in meta_items:
            text = item.text_content()
            
            if "Version" in text:
                details["version"] = text.replace("Version", "").strip()
            
            elif "Updated" in text:
                details["updated"] = text.replace("Updated", "").strip()
            
            elif "Size" in text:
                details["size"] = text.replace("Size", "").strip()
            
            elif "Website" in text:
                link = item.locator("a").first
                if link.count() > 0:
                    details["website"] = link.get_attribute("href")
            
            elif "Email" in text or "@" in text:
                 link = item.locator("a[href^='mailto:']").first
                 if link.count() > 0:
                     details["email"] = link.get_attribute("href").replace("mailto:", "")
                 else:
                     email_match = re.search(r"[\w\.-]+@[\w\.-]+", text)
                     if email_match:
                         details["email"] = email_match.group(0)
    except:
        pass

    return details

def scrape_extensions(search_query: str = "chatgpt", target_count: int = 200, output_file: str = "data/chatgpt_metadata_new.json"):
    """
    Scrape Chrome Web Store extensions.

    Args:
        search_query: Search term (e.g., "chatgpt", "gpt", "adblocker")
        target_count: Number of NEW extensions to scrape (excluding duplicates)
        output_file: Path to save results (will merge with existing data)
    """
    url = f"https://chromewebstore.google.com/search/{search_query}?hl=en"

    # Load existing IDs to skip duplicates
    existing_ids = load_existing_ids(output_file)
    print(f"Found {len(existing_ids)} existing extensions in {output_file}")

    # Load existing data to merge later
    existing_data = []
    if Path(output_file).exists():
        try:
            with open(output_file, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
        except:
            pass

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        print(f"Navigating to search: {url}")
        page.goto(url)
        page.wait_for_load_state("networkidle")
        
        ids = set()
        new_ids = set()  # IDs not in existing data

        while len(new_ids) < target_count:
            # Extract IDs
            links = page.locator('a[href*="/detail/"]').all()
            current_count = len(ids)
            
            for link in links:
                href = link.get_attribute('href')
                if href:
                    parts = href.split('/')
                    if len(parts) >= 4:
                        id_part = parts[-1].split('?')[0]
                        if len(id_part) == 32:
                            ids.add(id_part)
                            if id_part not in existing_ids:
                                new_ids.add(id_part)

            print(f"Found {len(ids)} total IDs ({len(new_ids)} new, {len(ids) - len(new_ids)} duplicates)...")

            if len(new_ids) >= target_count:
                break
                
            # Scroll logic - optimized wait times
            for _ in range(3):
                page.keyboard.press("End")
                time.sleep(0.5)

            try:
                more_btn = page.get_by_text("More extensions", exact=False).first
                if more_btn.is_visible():
                    print("Clicking 'More extensions'...")
                    more_btn.click()
                    time.sleep(1.5)
                else:
                    # Generic button fallback
                    buttons = page.get_by_role("button")
                    clicked = False
                    for i in range(buttons.count()):
                        btn = buttons.nth(i)
                        if btn.is_visible():
                            txt = btn.inner_text().lower()
                            if "more" in txt or "load" in txt:
                                btn.click()
                                time.sleep(1.5)
                                clicked = True
                                break
                    if not clicked:
                        page.mouse.wheel(0, -500)
                        time.sleep(0.3)
                        page.mouse.wheel(0, 1000)
                        time.sleep(0.5)
            except Exception as e:
                print(f"Error interacting with page: {e}")
            
            if len(ids) == current_count:
                time.sleep(1)
                links = page.locator('a[href*="/detail/"]').all()
                found_new = False
                for link in links:
                    href = link.get_attribute('href')
                    if href and href.split('/')[-1].split('?')[0] not in ids:
                        found_new = True
                        break

                if not found_new:
                    print("Reached end of results.")
                    break

        print(f"Total IDs collected: {len(ids)} ({len(new_ids)} new to scrape)")

        # Only scrape NEW extensions (not already in data)
        ids_to_scrape = list(new_ids)
        for idx, ext_id in enumerate(ids_to_scrape, 1):
            print(f"[{idx}/{len(ids_to_scrape)}] Scraping {ext_id}...")
            detail_url = f"https://chromewebstore.google.com/detail/{ext_id}?hl=en"

            try:
                page.goto(detail_url, wait_until="domcontentloaded")
                # Short wait for dynamic content
                time.sleep(0.3)

                data = extract_extension_details(page, ext_id)
                results.append(data)

            except Exception as e:
                print(f"  Failed to scrape {ext_id}: {e}")

        browser.close()

    # Merge with existing data (new extensions first for visibility)
    merged_data = results + existing_data

    # Remove any duplicates (by ID) - keep first occurrence
    seen_ids = set()
    deduplicated = []
    for ext in merged_data:
        if ext.get("id") not in seen_ids:
            seen_ids.add(ext.get("id"))
            deduplicated.append(ext)

    # Ensure output directory exists
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(deduplicated, f, indent=2)
    print(f"Saved {len(deduplicated)} total extensions ({len(results)} new) to {output_file}")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Scrape Chrome Web Store extensions")
    parser.add_argument("--query", default="chatgpt", help="Search query (default: chatgpt)")
    parser.add_argument("--count", type=int, default=200, help="Number of NEW extensions to scrape (default: 200)")
    parser.add_argument("--output", default="data/chatgpt_metadata_new.json", help="Output file path")

    args = parser.parse_args()

    scrape_extensions(
        search_query=args.query,
        target_count=args.count,
        output_file=args.output
    )
