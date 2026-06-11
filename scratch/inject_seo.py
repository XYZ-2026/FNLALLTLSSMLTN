import os
import re

# Base keywords requested by the user, including common variations, typos, and college predictor keywords
BASE_KEYWORDS = [
    "Counselling",
    "mhtcet",
    "josaa counselling",
    "college simplified",
    "mhtcet counselling",
    "concept simplified",
    "mhtcet counseling",
    "josaa counseling",
    "counseling",
    "college predictor",
    "college predictors",
    "engineering college predictor",
    "college admission predictor"
]

# Page specific configuration
PAGES_CONFIG = {
    "index.html": {
        "title": "Best College Predictor — MHT-CET, JoSAA, CSAB & COMEDK | College Simplified",
        "desc": "College Simplified is the best engineering college predictor hub. Predict your college admission chances for MHT-CET, JoSAA, CSAB, and COMEDK based on your rank and percentile.",
        "extra_kws": ["best college predictor", "college predictor", "mhtcet college predictor", "josaa college predictor", "engineering college predictor", "csab college predictor", "comedk college predictor", "marks to percentile", "percentile to rank"]
    },
    "admin.html": {
        "title": "Admin Dashboard — College Simplified",
        "desc": "College Simplified Admin Panel. Manage notifications, update college cutoff datasets, and configure portal settings.",
        "extra_kws": ["admin portal", "data management", "counselling administration"],
        "robots": "noindex, nofollow"
    },
    "air.html": {
        "title": "JEE Main All India Rank (AIR) College Predictor — College Simplified",
        "desc": "Calculate your All India Rank options with the College Simplified Predictor. Compare admission cutoffs across leading engineering colleges.",
        "extra_kws": ["all india rank predictor", "jee main rank admissions", "air cutoff"]
    },
    "auth.html": {
        "title": "Sign In / Register — College Simplified",
        "desc": "Sign in or register for a free account on College Simplified to access advanced engineering college predictors and preference builders.",
        "extra_kws": ["user login", "account registration", "counselling portal signin"]
    },
    "calendar.html": {
        "title": "Engineering Counselling Events Calendar — College Simplified",
        "desc": "Track all important engineering counselling event dates, registration deadlines, and seat allocation rounds for MHT-CET, JoSAA, and COMEDK.",
        "extra_kws": ["counselling calendar", "important dates", "admission deadlines", "schedule"]
    },
    "cet-landing.html": {
        "title": "MHT-CET Counselling Hub & Tools — College Simplified",
        "desc": "Access the comprehensive MHT-CET Counselling Dashboard. Predict college options, calculate percentile-to-rank, and build preference lists.",
        "extra_kws": ["mhtcet dashboard", "maharashtra engineering admissions", "cap rounds", "dte maharashtra"]
    },
    "cet_colleges.html": {
        "title": "MHT-CET Top Engineering Colleges & Placements — College Simplified",
        "desc": "Explore top engineering colleges in Maharashtra under MHT-CET. Check verified average placement packages, tiers, and college codes.",
        "extra_kws": ["mhtcet placement statistics", "maharashtra top colleges", "engineering packages", "dte codes"]
    },
    "cet_marks.html": {
        "title": "MHT-CET Marks vs Percentile Predictor — College Simplified",
        "desc": "Estimate your MHT-CET percentile based on shift difficulty and raw marks using our high-precision Marks vs Percentile tool.",
        "extra_kws": ["mhtcet marks vs percentile", "shift difficulty", "score estimator", "percentile calculation"]
    },
    "cet_rank.html": {
        "title": "MHT-CET Percentile vs Rank Predictor — College Simplified",
        "desc": "Convert your MHT-CET percentile into an estimated state rank using official CAP round data trends for precise seat planning.",
        "extra_kws": ["mhtcet percentile vs rank", "state rank predictor", "cap round planning", "general merit rank"]
    },
    "comedk-landing.html": {
        "title": "COMEDK UGET Counselling Dashboard — College Simplified",
        "desc": "Explore the COMEDK UGET Counselling Dashboard. Access college predictors, check cutoff ranks, and plan admissions across Karnataka colleges.",
        "extra_kws": ["comedk dashboard", "karnataka engineering admissions", "comedk uget", "karnataka counselling"]
    },
    "comedk_cutoff.html": {
        "title": "COMEDK UGET College Cutoff Checker — College Simplified",
        "desc": "Check official COMEDK cutoff ranks from rounds 1 to 4. Search by college, branch, and category (GM and KKR seat types).",
        "extra_kws": ["comedk cutoff checker", "karnataka cutoff ranks", "gm kkr categories", "comedk rounds"]
    },
    "comedk_predictor.html": {
        "title": "COMEDK College Predictor & Rank Analyzer — College Simplified",
        "desc": "Predict your best matching Karnataka engineering colleges using the COMEDK College Predictor tool based on your rank.",
        "extra_kws": ["comedk college predictor", "comedk seat allocation", "admission estimator"]
    },
    "coming-soon.html": {
        "title": "Coming Soon — College Simplified",
        "desc": "Exciting new engineering counselling tools and preference list builders are arriving shortly. Stay tuned to College Simplified.",
        "extra_kws": ["upcoming features", "preference builder release", "college simplified updates"],
        "robots": "noindex, follow"
    },
    "csab-landing.html": {
        "title": "CSAB Special Round Counselling Dashboard — College Simplified",
        "desc": "Explore CSAB Special Round admission opportunities. Track vacant seat predictors and strategic counselling round guidelines.",
        "extra_kws": ["csab dashboard", "csab special round", "vacant seats", "spot round admissions"]
    },
    "csab.html": {
        "title": "CSAB Special Round College Predictor — College Simplified",
        "desc": "Find vacant seats and predict your admissions at NITs, IIITs, and GFTIs using the CSAB Special Round College Predictor.",
        "extra_kws": ["csab college predictor", "special round seat allocation", "nit vacant seats"]
    },
    "cutoff_checker.html": {
        "title": "MHT-CET College Cutoff Search Tool — College Simplified",
        "desc": "Search and compare college cutoffs across MHT-CET, JEE Mains, and All India quota seats for Maharashtra engineering institutions.",
        "extra_kws": ["mhtcet cutoff checker", "jee mains cutoff", "cap round cutoffs", "all india seat cutoff"]
    },
    "document_checklist.html": {
        "title": "Engineering Counselling Document Checklist — College Simplified",
        "desc": "Track and organize all required documents for engineering admission CAP rounds based on your category (Open, OBC, SC, ST, EWS).",
        "extra_kws": ["admission document checklist", "cap round documents", "verification prep", "counselling documents"]
    },
    "josaa-landing.html": {
        "title": "JoSAA Counselling Explorer (IIT, NIT, IIIT) — College Simplified",
        "desc": "Access the national-level JoSAA Counselling Dashboard. Optimize your choices for admission to IITs, NITs, IIITs, and GFTIs.",
        "extra_kws": ["josaa dashboard", "nit iiit gfti admissions", "jee advanced", "jee main"]
    },
    "josaa-preference-builder.html": {
        "title": "JoSAA Choice filling Preference Builder — College Simplified",
        "desc": "Build, reorder, and export your optimal JoSAA preferences list using our smart step-by-step guidance system.",
        "extra_kws": ["josaa preference builder", "choice filling helper", "nit choice filling", "jee preferences"]
    },
    "josaa.html": {
        "title": "JoSAA College Predictor for NITs, IIITs & GFTIs — College Simplified",
        "desc": "Predict your admission choices at NITs, IIITs, and GFTIs using the JoSAA College Predictor based on your JEE Main rank.",
        "extra_kws": ["josaa college predictor", "jee mains rank advisor", "nit seat allocation"]
    },
    "josaa_cutoff.html": {
        "title": "JoSAA Opening & Closing Cutoff Checker — College Simplified",
        "desc": "View official JoSAA opening and closing ranks for IITs, NITs, IIITs, and GFTIs across all rounds (1 to 6).",
        "extra_kws": ["josaa cutoff ranks", "jee cutoff checker", "nit iiit cutoffs"]
    },
    "josaa_iit.html": {
        "title": "JoSAA IIT College Predictor & Ranker — College Simplified",
        "desc": "Predict your admission possibilities at Indian Institutes of Technology (IITs) based on your JEE Advanced rank.",
        "extra_kws": ["iit college predictor", "jee advanced cutoff", "iit seat allotment", "jee advanced rank"]
    },
    "josaa_marks.html": {
        "title": "JEE Main Marks vs Percentile Predictor — College Simplified",
        "desc": "Convert your JEE Main marks into estimated percentile scores based on session difficulty metrics.",
        "extra_kws": ["jee mains marks vs percentile", "shift analysis", "score calculator", "jee difficulty"]
    },
    "josaa_rank.html": {
        "title": "JEE Main Percentile vs Rank Predictor — College Simplified",
        "desc": "Convert your JEE Main percentile into estimated ranks to prepare for JoSAA and CSAB counselling rounds.",
        "extra_kws": ["jee mains percentile vs rank", "jee rank estimator", "jee mains rank calculation"]
    },
    "manipal_cutoff.html": {
        "title": "Manipal MIT (MET) Cutoffs Checker — College Simplified",
        "desc": "View MET 2025 cutoff ranks for MIT Manipal, MIT Bengaluru, MUJ Jaipur, and SMIT Sikkim across all four rounds.",
        "extra_kws": ["manipal mit cutoffs", "met ranks", "manipal engineering cutoff", "met 2025"]
    },
    "mht_cet_college_predictor.html": {
        "title": "MHT-CET College Predictor & Rank Analyzer — College Simplified",
        "desc": "Find your best college and branch matches in Maharashtra based on your MHT-CET percentile, rank, and seat category.",
        "extra_kws": ["mhtcet college predictor", "college match", "maharashtra admission predictor"]
    },
    "non-cap-admissions.html": {
        "title": "Non-CAP Admissions & Vacancy Guide — College Simplified",
        "desc": "Get guidelines and seat vacancy updates for institutional level and vacancy round non-CAP admissions in Maharashtra.",
        "extra_kws": ["non cap admissions", "institutional seats", "vacancy rounds", "spot round admissions"]
    },
    "percentile_vs_college_predictor.html": {
        "title": "MHT-CET Percentile vs College Predictor — College Simplified",
        "desc": "Use AI-powered algorithms to predict your admission probabilities for engineering seats in Maharashtra using JEE Main ranks.",
        "extra_kws": ["jee main maharashtra predictor", "all india seat predictor", "jee cap rounds"]
    },
    "preference-builder.html": {
        "title": "MHT-CET Option Form Preference Builder — College Simplified",
        "desc": "Design and export a smart MHT-CET preference list with drag-and-drop ordering and matching analysis.",
        "extra_kws": ["mhtcet preference builder", "option form helper", "drag drop ordering", "cap round options"]
    },
    "results.html": {
        "title": "Prediction Results — College Simplified",
        "desc": "View your personalized college admission predictions and analysis from College Simplified's predictive engine.",
        "extra_kws": ["admission prediction results", "matching colleges list", "predictor output"]
    },
    "seed.html": {
        "title": "Seed Admin Utility — College Simplified",
        "desc": "Developer admin bootstrapping utility for database role configuration.",
        "extra_kws": ["admin utility", "seeding database"],
        "robots": "noindex, nofollow"
    },
    "compare_colleges.html": {
        "title": "MHT-CET College Compare Tool — College Simplified",
        "desc": "Compare two Maharashtra engineering colleges side-by-side. Analyze cutoff differences, average placements, rankings, total seat intakes, and tiers.",
        "extra_kws": ["compare colleges", "college comparison tool", "cutoff difference", "placement packages"]
    }
}

def clean_and_inject():
    html_files = [f for f in os.listdir('.') if f.endswith('.html')]

    for f in html_files:
        config = PAGES_CONFIG.get(f)
        if not config:
            print(f"Skipping {f} (no config mapped)")
            continue
            
        filepath = f
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()
            
        # Generate page specific keywords
        kws = BASE_KEYWORDS + config["extra_kws"]
        keywords_str = ", ".join(kws)
        desc_str = config["desc"]
        title_str = config["title"]
        
        # 1. Strip all duplicated/existing comments to avoid cluttering the head
        content = content.replace("<!-- SEO Optimization Meta Tags -->", "")
        content = content.replace("<!-- Open Graph / Facebook Meta Tags -->", "")
        content = content.replace("<!-- Structured Data (JSON-LD) for Search Engines -->", "")
        
        # Strip existing keywords and description meta tags (to avoid duplicates)
        content = re.sub(r'\s*<meta\s+name=["\'](keywords|description)["\']\s+content=["\'][^"\']*["\']\s*/?>', '', content, flags=re.IGNORECASE)
        content = re.sub(r'\s*<meta\s+content=["\'][^"\']*["\']\s+name=["\'](keywords|description)["\']\s*/?>', '', content, flags=re.IGNORECASE)
        
        # Strip existing open graph tags
        content = re.sub(r'\s*<meta\s+property=["\']og:(title|description|type|url|site_name)["\']\s+content=["\'][^"\']*["\']\s*/?>', '', content, flags=re.IGNORECASE)
        content = re.sub(r'\s*<meta\s+content=["\'][^"\']*["\']\s+property=["\']og:(title|description|type|url|site_name)["\']\s*/?>', '', content, flags=re.IGNORECASE)
        
        # Strip existing robots tag
        content = re.sub(r'\s*<meta\s+name=["\']robots["\']\s+content=["\'][^"\']*["\']\s*/?>', '', content, flags=re.IGNORECASE)
        content = re.sub(r'\s*<meta\s+content=["\'][^"\']*["\']\s+name=["\']robots["\']\s*/?>', '', content, flags=re.IGNORECASE)

        # Strip existing application/ld+json blocks
        content = re.sub(r'\s*<script\s+type=["\']application/ld\+json["\']\s*>.*?</script>', '', content, flags=re.IGNORECASE | re.DOTALL)
        
        # Strip existing title tag
        content = re.sub(r'\s*<title>.*?</title>', '', content, flags=re.IGNORECASE)

        # Strip existing favicon links
        content = re.sub(r'\s*<link\s+rel=["\'](?:shortcut )?icon["\']\s+[^>]*\s*/?>', '', content, flags=re.IGNORECASE)

        # Clean up any leftover blank lines at the top of <head> that resulted from stripping
        # (Find head tag, and reduce consecutive newlines right after it)
        content = re.sub(r'(<head[^>]*>)\s*\n(\s*\n)+', r'\1\n', content, flags=re.IGNORECASE)

        # Construct robots meta tag if specified
        robots_tag = f'\n    <meta name="robots" content="{config["robots"]}">' if "robots" in config else ""
        
        # Construct new SEO block
        seo_block = f"""
    <!-- SEO Optimization Meta Tags -->
    <title>{title_str}</title>
    <meta name="keywords" content="{keywords_str}">
    <meta name="description" content="{desc_str}">{robots_tag}
    <link rel="icon" type="image/png" href="favicon.png">
    
    <!-- Open Graph / Facebook Meta Tags -->
    <meta property="og:title" content="{title_str}">
    <meta property="og:description" content="{desc_str}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://counselling.collegesimplified.in/{f}">
    <meta property="og:site_name" content="College Simplified">
    
    <!-- Structured Data (JSON-LD) for Search Engines -->
    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "College Simplified",
      "url": "https://counselling.collegesimplified.in/",
      "sameAs": [
        "https://play.google.com/store/apps/details?id=co.mark.vvzmn",
        "https://apps.apple.com/in/app/myinstitute/id1472483563",
        "https://www.instagram.com/college_simplified/",
        "https://youtube.com/@conceptsimplified"
      ]
    }}
    </script>"""

        # Inject SEO block right after <head>
        head_pattern = re.compile(r'(<head[^>]*>)', re.IGNORECASE)
        if head_pattern.search(content):
            content = head_pattern.sub(r'\1' + seo_block, content, count=1)
            print(f"Successfully injected SEO tags into {f}")
        else:
            print(f"Warning: Could not find <head> in {f}, skipping injection.")
            continue
            
        with open(filepath, 'w', encoding='utf-8') as file:
            file.write(content)

    print("SEO tags injection complete!")

if __name__ == "__main__":
    clean_and_inject()
