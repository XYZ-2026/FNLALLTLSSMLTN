import os
import urllib.parse
import xml.sax.saxutils as saxutils

base_sitemap_content = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Home Page / Counselling Hub -->
  <url>
    <loc>https://counselling.collegesimplified.in/</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.00</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/index.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.90</priority>
  </url>
  
  <!-- MHT-CET Counselling Pages -->
  <url>
    <loc>https://counselling.collegesimplified.in/cet-landing.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.90</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/mht_cet_college_predictor.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/percentile_vs_college_predictor.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/cet_rank.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/cet_marks.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/cet_colleges.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/preference-builder.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/non-cap-admissions.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/document_checklist.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.70</priority>
  </url>

  <!-- JoSAA & CSAB Counselling Pages -->
  <url>
    <loc>https://counselling.collegesimplified.in/josaa-landing.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.90</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/josaa.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/josaa_iit.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/josaa-preference-builder.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/josaa_cutoff.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/josaa_rank.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/josaa_marks.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/csab-landing.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/csab.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  
  <!-- COMEDK Counselling Pages -->
  <url>
    <loc>https://counselling.collegesimplified.in/comedk-landing.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.90</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/comedk_predictor.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/comedk_cutoff.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>

  <!-- Manipal MET Counselling Pages -->
  <url>
    <loc>https://counselling.collegesimplified.in/manipal_cutoff.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  
  <!-- General Tools & Utilities -->
  <url>
    <loc>https://counselling.collegesimplified.in/air.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/calendar.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.70</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/cutoff_checker.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/auth.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.50</priority>
  </url>
  <url>
    <loc>https://counselling.collegesimplified.in/results.html</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.60</priority>
  </url>"""

def build_sitemap():
    colleges = []
    seo_file = "college_seo.txt"
    if not os.path.exists(seo_file):
        print(f"Error: {seo_file} does not exist!")
        return
        
    with open(seo_file, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            # Ignore empty lines and headers
            if not line or line.lower().startswith("mhtcet colleges"):
                continue
            colleges.append(line)
            
    print(f"Found {len(colleges)} colleges in {seo_file}.")
    
    xml_urls = []
    for col in colleges:
        # URL encode the college name
        encoded_name = urllib.parse.quote(col)
        # Construct the sitemap URL
        url = f"https://counselling.collegesimplified.in/cutoff_checker.html?search={encoded_name}"
        # XML escape the URL
        escaped_url = saxutils.escape(url)
        
        xml_url = f"""  <url>
    <loc>{escaped_url}</loc>
    <lastmod>2026-06-06</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>"""
        xml_urls.append(xml_url)
        
    # Combine content
    full_sitemap = base_sitemap_content + "\n\n  <!-- Dynamic College Cutoff Pages -->\n" + "\n".join(xml_urls) + "\n</urlset>"
    
    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write(full_sitemap)
        
    print("Successfully generated sitemap.xml with college pages!")

if __name__ == "__main__":
    build_sitemap()
