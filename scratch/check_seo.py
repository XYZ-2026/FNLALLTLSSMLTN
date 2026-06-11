import os
import re

workspace_dir = r"d:\Concept Simplified\new project final"
html_files = [f for f in os.listdir(workspace_dir) if f.endswith(".html")]

print(f"Found {len(html_files)} HTML files:")

for fname in sorted(html_files):
    fpath = os.path.join(workspace_dir, fname)
    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    
    # Check for duplicate comments
    comment_pattern = "<!-- SEO Optimization Meta Tags -->"
    count = content.count(comment_pattern)
    
    # Extract title
    title_match = re.search(r"<title>(.*?)</title>", content, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else "MISSING"
    
    # Extract description
    desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', content, re.IGNORECASE)
    if not desc_match:
        desc_match = re.search(r'<meta\s+content=["\'](.*?)["\']\s+name=["\']description["\']', content, re.IGNORECASE)
    desc = desc_match.group(1).strip() if desc_match else "MISSING"
    
    print(f"- {fname}: Title='{title}', Desc='{desc[:50]}...', SEO Comment Count={count}")
