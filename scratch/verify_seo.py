import os
import re
import json
import sys

# Change working directory to project root (parent of scratch) to find HTML files
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from inject_seo import PAGES_CONFIG, BASE_KEYWORDS

# Files we expect to have been modified
EXPECTED_FILES = list(PAGES_CONFIG.keys())

errors = []
success_count = 0

for filename in EXPECTED_FILES:
    if not os.path.exists(filename):
        errors.append(f"Expected file {filename} does not exist.")
        continue
        
    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    print(f"Verifying {filename}...")
    
    # Check for duplicate comments
    for comment in ["<!-- SEO Optimization Meta Tags -->", "<!-- Open Graph / Facebook Meta Tags -->", "<!-- Structured Data (JSON-LD) for Search Engines -->"]:
        cnt = content.count(comment)
        if cnt > 1:
            errors.append(f"{filename}: Duplicate comment found: '{comment}' (Count: {cnt})")
        elif cnt == 0:
            errors.append(f"{filename}: Missing comment: '{comment}'")

    # 1. Title Verification
    title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE)
    expected_title = PAGES_CONFIG[filename]["title"]
    if not title_match:
        errors.append(f"{filename}: Missing title tag.")
    else:
        title = title_match.group(1).strip()
        if title != expected_title:
            errors.append(f"{filename}: Title does not match. Found: '{title}', Expected: '{expected_title}'")

    # 2. Keywords Verification
    kw_match = re.search(r'<meta\s+name=["\']keywords["\']\s+content=(["\'])(.*?)\1', content, re.IGNORECASE)
    if not kw_match:
        errors.append(f"{filename}: Missing keywords meta tag.")
    else:
        kws = kw_match.group(2).split(", ")
        # Check that base keywords exist
        for base_kw in BASE_KEYWORDS:
            if base_kw not in kws:
                errors.append(f"{filename}: Base keyword '{base_kw}' is missing in keywords meta tag.")
        # Check page specific extra keywords
        for extra_kw in PAGES_CONFIG[filename]["extra_kws"]:
            if extra_kw not in kws:
                errors.append(f"{filename}: Page-specific keyword '{extra_kw}' is missing.")

    # 3. Description Verification
    desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=(["\'])(.*?)\1', content, re.IGNORECASE)
    if not desc_match:
        errors.append(f"{filename}: Missing description meta tag.")
    else:
        desc = desc_match.group(2)
        expected_desc = PAGES_CONFIG[filename]["desc"]
        if desc != expected_desc:
            errors.append(f"{filename}: Description does not match. Found: '{desc}', Expected: '{expected_desc}'")

    # 3.5 Favicon Verification
    favicon_match = re.search(r'<link\s+rel=["\']icon["\']\s+type=["\']image/jpeg["\']\s+href=["\']favicon\.jpeg["\']\s*/?>', content, re.IGNORECASE)
    if not favicon_match:
        errors.append(f"{filename}: Missing expected favicon link tag.")

    # 4. Robots Verification (optional)
    robots_match = re.search(r'<meta\s+name=["\']robots["\']\s+content=(["\'])(.*?)\1', content, re.IGNORECASE)
    if "robots" in PAGES_CONFIG[filename]:
        expected_robots = PAGES_CONFIG[filename]["robots"]
        if not robots_match:
            errors.append(f"{filename}: Missing expected robots meta tag.")
        else:
            robots = robots_match.group(2)
            if robots != expected_robots:
                errors.append(f"{filename}: Robots tag does not match. Found: '{robots}', Expected: '{expected_robots}'")
    else:
        if robots_match:
            errors.append(f"{filename}: Unexpected robots tag found: '{robots_match.group(2)}'")

    # 5. Open Graph Tags Verification
    og_title_match = re.search(r'<meta\s+property=["\']og:title["\']\s+content=(["\'])(.*?)\1', content, re.IGNORECASE)
    if not og_title_match:
        errors.append(f"{filename}: Missing og:title meta tag.")
    else:
        og_title = og_title_match.group(2)
        if og_title != expected_title:
            errors.append(f"{filename}: og:title '{og_title}' does not match expected title '{expected_title}'")
            
    og_desc_match = re.search(r'<meta\s+property=["\']og:description["\']\s+content=(["\'])(.*?)\1', content, re.IGNORECASE)
    if not og_desc_match:
        errors.append(f"{filename}: Missing og:description meta tag.")
    else:
        og_desc = og_desc_match.group(2)
        if og_desc != PAGES_CONFIG[filename]["desc"]:
            errors.append(f"{filename}: og:description does not match.")
            
    og_type_match = re.search(r'<meta\s+property=["\']og:type["\']\s+content=(["\'])(.*?)\1', content, re.IGNORECASE)
    if not og_type_match or og_type_match.group(2) != "website":
        errors.append(f"{filename}: Missing or incorrect og:type tag.")
        
    og_url_match = re.search(r'<meta\s+property=["\']og:url["\']\s+content=(["\'])(.*?)\1', content, re.IGNORECASE)
    expected_url = f"https://counselling.collegesimplified.in/{filename}"
    if not og_url_match or og_url_match.group(2) != expected_url:
        errors.append(f"{filename}: Missing or incorrect og:url. Found: '{og_url_match.group(2) if og_url_match else None}', Expected: '{expected_url}'")
        
    og_site_name_match = re.search(r'<meta\s+property=["\']og:site_name["\']\s+content=(["\'])(.*?)\1', content, re.IGNORECASE)
    if not og_site_name_match or og_site_name_match.group(2) != "College Simplified":
        errors.append(f"{filename}: Missing or incorrect og:site_name.")

    # 6. JSON-LD Verification
    json_ld_match = re.search(r'<script\s+type=["\']application/ld\+json["\']\s*>(.*?)</script>', content, re.IGNORECASE | re.DOTALL)
    if not json_ld_match:
        errors.append(f"{filename}: Missing JSON-LD script block.")
    else:
        try:
            ld_data = json.loads(json_ld_match.group(1).strip())
            if ld_data.get("@context") != "https://schema.org":
                errors.append(f"{filename}: JSON-LD context is incorrect.")
            if ld_data.get("@type") != "WebSite":
                errors.append(f"{filename}: JSON-LD type is incorrect.")
            if ld_data.get("name") != "College Simplified":
                errors.append(f"{filename}: JSON-LD site name is incorrect.")
            if ld_data.get("url") != "https://counselling.collegesimplified.in/":
                errors.append(f"{filename}: JSON-LD site url is incorrect.")
            
            same_as = ld_data.get("sameAs", [])
            expected_same_as = [
                "https://play.google.com/store/apps/details?id=co.mark.vvzmn",
                "https://apps.apple.com/in/app/myinstitute/id1472483563",
                "https://www.instagram.com/college_simplified/",
                "https://youtube.com/@conceptsimplified"
            ]
            for url in expected_same_as:
                if url not in same_as:
                    errors.append(f"{filename}: JSON-LD sameAs link '{url}' is missing.")
        except Exception as e:
            errors.append(f"{filename}: Failed to parse JSON-LD block: {e}")
            
    success_count += 1

print("\n" + "="*40)
print(f"Verification completed. Checked {success_count} files.")
if errors:
    print(f"Found {len(errors)} errors:")
    for err in errors:
        print(f" - {err}")
    sys.exit(1)
else:
    print("All files passed SEO validation!")
    sys.exit(0)
