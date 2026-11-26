"""Generates everything search engines read on the static site.

Run after changing data or page metadata:   python seo/build_seo.py

- <head> metadata and JSON-LD of every page      (between <!--seo:head--> markers)
- data tables under the tools                    (between <!--seo:NAME--> markers)
- college, branch, percentile, JoSAA, COMEDK and counselling-2027 pages (data_pages.py)
- /about, /methodology, 404.html, sitemap.xml, llms.txt

Staged release: data pages go live over several days (seo/release.json). Each run publishes
the pages due by today; links to pages not out yet stay plain text.
  --day N             build as if it were day N
  --start YYYY-MM-DD  move the first day

Safe to re-run: it only replaces what it generated. Uses the standard library only.
"""
import csv, datetime, difflib, glob, hashlib, html, json, os, re, subprocess, sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, os.path.join(ROOT, 'seo'))
sys.dont_write_bytecode = True
BASE = 'https://counselling.collegesimplified.in'
BRAND = 'College Simplified'
esc = lambda s: html.escape(str(s), quote=True)
num = lambda n: f'{n:,}' if n < 1000 else indian(n)

def indian(n):
    s = str(int(n)); head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2: parts.insert(0, head[-2:]); head = head[:-2]
    if head: parts.insert(0, head)
    return ','.join(parts + [tail])

def load(p):
    d = json.load(open(p, encoding='utf8'))
    return d if isinstance(d, list) else next(v for v in d.values() if isinstance(v, list))

def read(p):
    s = open(p, encoding='utf8', newline='').read()
    return s.replace('\r\n', '\n'), '\r\n' in s

RELEASED = None  # paths live today; None = no filter
def prune(s):
    if RELEASED is None: return s
    return re.sub(r'<a href="(/(?:colleges|mht-cet-cutoff|mht-cet-colleges|josaa-cutoff|comedk-cutoff|counselling-2027)/[^"#?]*)">(.*?)</a>', lambda m: m.group(0) if m.group(1) in RELEASED else m.group(2), s)

def write(p, s, crlf=False):
    if p.endswith('.html'): s = prune(s)
    os.makedirs(os.path.dirname(p) or '.', exist_ok=True)
    new = s.replace('\n', '\r\n') if crlf else s
    if os.path.exists(p) and open(p, encoding='utf8', newline='').read() == new: return
    open(p, 'w', encoding='utf8', newline='').write(new)

def url_of(name):
    return BASE + '/' + {'index': '', 'Branch': 'branch'}.get(name, name)

# ───────────────────────── page metadata ─────────────────────────
# file: (title without brand, description, section, breadcrumb label)
HUB = {'cet': ('MHT-CET', 'cet-landing'), 'josaa': ('JoSAA', 'josaa-landing'), 'csab': ('CSAB', 'csab-landing'),
       'comedk': ('COMEDK', 'comedk-landing'), 'dse': ('DSE', 'dse-landing'), '': None, 'manipal': None}
OG = {'cet': 'mht-cet', 'josaa': 'josaa', 'csab': 'josaa', 'comedk': 'comedk', 'dse': 'dse', 'manipal': 'manipal', '': 'home'}
PAGES = {
 'index': ('Engineering Counselling 2027: Predictors & Cutoffs', 'Engineering counselling 2027: college predictors, cutoffs and guides for MHT-CET, JoSAA, CSAB, COMEDK, DSE and Manipal MET admissions.', '', 'Home'),
 'cet-landing': ('MHT-CET Counselling Tools 2027', 'MHT-CET 2027 counselling tools: college predictor, latest CAP cutoffs, marks vs percentile, percentile vs rank, college comparison and checklist.', 'cet', 'MHT-CET'),
 'mht_cet_college_predictor': ('MHT-CET College Predictor 2027', 'MHT-CET college predictor 2027: enter your percentile or rank, category and home university to see colleges from CAP 2026 cutoffs.', 'cet', 'College Predictor'),
 'percentile_vs_college_predictor': ('JEE Main All India Seats in Maharashtra 2027', 'Maharashtra engineering colleges on All India seats for 2027 admission, by JEE Main percentile, from CAP 2026 Round 1 cutoffs.', 'cet', 'All India Seats Predictor'),
 'cet_rank': ('MHT-CET Percentile vs Rank 2027', 'MHT-CET percentile vs rank 2027: convert a percentile into an estimated state merit rank, with the full percentile vs rank table.', 'cet', 'Percentile vs Rank'),
 'cet_marks': ('MHT-CET Marks vs Percentile 2027', 'MHT-CET marks vs percentile 2027: estimated percentile for marks out of 200 on an easy, moderate or hard shift, with the full table.', 'cet', 'Marks vs Percentile'),
 'cet_colleges': ('Top Engineering Colleges in Maharashtra 2027', 'Top engineering colleges in Maharashtra for MHT-CET 2027, with CAP institute codes, latest cutoffs and region rankings.', 'cet', 'Top Colleges'),
 'college_explorer': ('MHT-CET College Explorer & Cutoffs 2027', 'Explore Maharashtra engineering colleges for 2027 admission: CAP 2026 seat matrix, and MHT-CET and JEE Main cutoffs for Rounds 1 to 4.', 'cet', 'College Explorer'),
 'compare_colleges': ('Compare Maharashtra Engineering Colleges', 'Compare two Maharashtra engineering colleges side by side on cutoffs, placements, rankings, seat intake and tier.', 'cet', 'Compare Colleges'),
 'auto-preference-builder': ('MHT-CET 2027 Auto Preference List Generator', 'Generate an MHT-CET 2027 CAP option form preference list from your percentile, category, home university and preferred branches.', 'cet', 'Auto Preference List'),
 'preference-builder': ('MHT-CET 2027 Preference List Builder', 'Build, reorder and export your MHT-CET 2027 CAP option form. Drag and drop choices, use templates, and download a PDF or Excel list.', 'cet', 'Preference Builder'),
 'cet_chatbot': ('MHT-CET Chatbot Mentor', 'Ask the MHT-CET chatbot mentor about colleges, branches and CAP counselling for your percentile, category and home university.', 'cet', 'Chatbot Mentor'),
 'document_checklist': ('Engineering Admission Documents Checklist 2027', 'Documents checklist for engineering counselling 2027: track what you need by category and mark each one ready before verification.', '', 'Document Checklist'),
 'non-cap-admissions': ('Non-CAP Engineering Admissions 2027', 'Institute-level (non-CAP) engineering admissions and vacant seats in Maharashtra after the CAP rounds.', 'cet', 'Non-CAP Admissions'),
 'air': ('JEE Main Rank: Maharashtra College Predictor', 'Find Maharashtra engineering colleges for your JEE Main All India Rank, with 2025 All India seat cutoffs for reference.', 'cet', 'AIR Predictor'),
 'josaa-landing': ('JoSAA Counselling Tools 2027', 'JoSAA counselling 2027 tools: college predictor, 2026 closing ranks, JEE Main marks vs percentile and choice filling builder.', 'josaa', 'JoSAA'),
 'josaa': ('JoSAA College Predictor 2027: NIT, IIIT & GFTI', 'JoSAA college predictor 2027: NIT, IIIT and GFTI options for your JEE Main rank, category, gender and home state, from 2026 closing ranks.', 'josaa', 'JoSAA Predictor'),
 'josaa_iit': ('IIT College Predictor 2027', 'IIT college predictor 2027: branches for your JEE Advanced rank, from JoSAA 2026 closing ranks for every round.', 'josaa', 'IIT Predictor'),
 'josaa-preference-builder': ('JoSAA 2027 Choice Filling Preference Builder', 'Build your JoSAA 2027 choice list for NITs, IIITs and GFTIs from your JEE Main rank, category and home state, then export it.', 'josaa', 'Preference Builder'),
 'josaa_cutoff': ('JoSAA Cutoff Checker 2027: Closing Ranks', 'Check JoSAA closing ranks for 2027 admission: 2026 round-wise ranks for IITs, NITs, IIITs and GFTIs by branch, category, quota and gender.', 'josaa', 'JoSAA Cutoffs'),
 'josaa_rank': ('JEE Main Percentile vs Rank 2027', 'JEE Main percentile vs rank 2027: estimated All India Rank for each percentile, for JoSAA and CSAB planning.', 'josaa', 'Percentile vs Rank'),
 'josaa_marks': ('JEE Main Marks vs Percentile 2027', 'JEE Main marks vs percentile 2027: estimated percentile for marks out of 300 on an easy, moderate or difficult shift, with the full table.', 'josaa', 'Marks vs Percentile'),
 'csab-landing': ('CSAB Counselling Tools 2027', 'CSAB counselling 2027 tools: special round predictor, 2026 closing ranks and guidance for vacant NIT, IIIT and GFTI seats.', 'csab', 'CSAB'),
 'csab': ('CSAB College Predictor 2027', 'CSAB college predictor 2027: NIT, IIIT and GFTI seats in the special rounds for your JEE Main rank, category and quota.', 'csab', 'CSAB Predictor'),
 'comedk-landing': ('COMEDK Counselling Tools 2027', 'COMEDK counselling 2027 tools: college predictor, round-wise cutoff ranks, seats and fees, and an option form builder.', 'comedk', 'COMEDK'),
 'comedk_predictor': ('COMEDK College Predictor 2027', 'COMEDK college predictor 2027: Karnataka engineering colleges for your COMEDK UGET rank, from round-wise closing ranks.', 'comedk', 'COMEDK Predictor'),
 'comedk_cutoff': ('COMEDK Cutoff & Fee Explorer 2027', 'COMEDK UGET closing ranks for Rounds 1 to 4, with seats and fees, for students applying to Karnataka engineering colleges in 2027.', 'comedk', 'COMEDK Cutoffs'),
 'comedk-preference-builder': ('COMEDK 2027 Option Form Preference Builder', 'Build, reorder and export your COMEDK UGET 2027 option form preference list.', 'comedk', 'Preference Builder'),
 'manipal_cutoff': ('Manipal MET Cutoff Ranks for 2027 Admission', 'Manipal MET cutoff for 2027 admission: MET 2025 ranks for Manipal, Bengaluru, Jaipur, Sikkim and Dubai, Rounds 1 to 4 by branch.', 'manipal', 'Manipal MET Cutoffs'),
 'dse-landing': ('Direct Second Year (DSE) Tools 2027', 'Direct Second Year Engineering 2027 tools for Maharashtra: college predictor, DSE CAP 2026 cutoffs and college comparison.', 'dse', 'DSE'),
 'dse_college_predictor': ('DSE College Predictor 2027', 'DSE college predictor 2027: Direct Second Year Engineering colleges in Maharashtra for your diploma percentage, category and branch.', 'dse', 'DSE Predictor'),
 'dse_cutoff_checker': ('DSE Cutoff Explorer 2027', 'DSE cutoffs for 2027 admission: Direct Second Year Engineering CAP 2026 cutoffs by college, branch and category.', 'dse', 'DSE Cutoffs'),
 'dse_compare_colleges': ('Compare DSE Colleges', 'Compare two Direct Second Year Engineering colleges side by side on 2026 cutoffs, placements and seat intake.', 'dse', 'Compare Colleges'),
 'dse-preference-builder': ('DSE 2027 Option Form Preference Builder', 'Build, reorder and export your Direct Second Year Engineering 2027 option form preference list.', 'dse', 'Preference Builder'),
 'Branch': ('Engineering Branch Prediction Test 2027', 'Choosing a branch for 2027? Take a 60-question engineering aptitude and interest test to see which branches suit you.', '', 'Branch Test'),
 'career_library': ('Career Library for Engineering Students', 'Browse engineering careers by cluster: what the work involves, the skills needed and the branches that lead there.', '', 'Career Library'),
 'calendar': ('Engineering Counselling Calendar 2027', 'Counselling calendar 2027: dates and deadlines for MHT-CET CAP, JoSAA and COMEDK in one place.', '', 'Calendar'),
 'tools': ('Free Image & PDF Tools', 'Compress, resize, crop and convert images, and merge, split or create PDFs in your browser. Files stay on your device.', '', 'Image & PDF Tools'),
 'privacy': ('Privacy Policy', 'How College Simplified (Concept Simplified) collects, uses and protects your information.', '', 'Privacy Policy'),
 'terms': ('Terms & Conditions', 'Terms and conditions for using College Simplified predictors and counselling tools.', '', 'Terms & Conditions'),
}
NOINDEX = {  # not in the sitemap
 'auth': ('Sign In or Register', 'Sign in to College Simplified or create a free account.', 'noindex, follow'),
 'results': ('Prediction Results', 'Your college prediction results.', 'noindex, follow'),
 'dse_results': ('DSE Prediction Results', 'Your DSE college prediction results.', 'noindex, follow'),
 'coming-soon': ('Coming Soon', 'New features are on the way.', 'noindex, follow'),
 'admin': ('Admin Dashboard', 'College Simplified administration.', 'noindex, nofollow'),
 'seed': ('Admin Utility', 'College Simplified administration.', 'noindex, nofollow'),
}

ORG = {'@type': 'Organization', '@id': BASE + '/#organization', 'name': BRAND, 'alternateName': 'Concept Simplified', 'url': BASE + '/',
       'logo': {'@type': 'ImageObject', 'url': BASE + '/logo.png', 'width': 512, 'height': 512},
       'sameAs': ['https://www.collegesimplified.in/', 'https://www.conceptsimplified.in/', 'https://play.google.com/store/apps/details?id=co.mark.vvzmn',
                  'https://apps.apple.com/in/app/myinstitute/id1472483563', 'https://www.instagram.com/college_simplified/', 'https://youtube.com/@conceptsimplified']}
SITE = {'@type': 'WebSite', '@id': BASE + '/#website', 'name': BRAND, 'url': BASE + '/', 'inLanguage': 'en-IN', 'publisher': {'@id': BASE + '/#organization'}}

def crumbs_for(name):
    title, _, section, label = PAGES[name]
    trail = [('Home', BASE + '/')]
    hub = HUB.get(section)
    if hub and hub[1] != name: trail.append((hub[0], url_of(hub[1])))
    if name != 'index': trail.append((label, url_of(name)))
    return trail

def crumb_ld(trail):
    return {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': i, 'name': n, 'item': u} for i, (n, u) in enumerate(trail, 1)]}

def head_block(title, desc, url, og, robots, trail, home=False):
    full = f'{title} | {BRAND}'
    if len(full) > 65: full = title
    page = {'@type': 'WebPage', '@id': url, 'url': url, 'name': full, 'description': desc, 'inLanguage': 'en-IN', 'isPartOf': {'@id': BASE + '/#website'}, 'publisher': {'@id': BASE + '/#organization'}}
    graph = ([ORG, SITE] if home else []) + [page] + ([crumb_ld(trail)] if len(trail) > 1 else [])
    ld = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False).replace('<', '\\u003c')
    img = f'{BASE}/og/{og}.jpg'
    out = ['<meta charset="UTF-8">', f'<title>{esc(full)}</title>', f'<meta name="description" content="{esc(desc)}">']
    if 'noindex' in robots:
        out.append(f'<meta name="robots" content="{robots}">')
    else:
        out += ['<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">', f'<link rel="canonical" href="{url}">']
    out += ['<link rel="icon" type="image/png" href="/favicon.png">',
            f'<meta property="og:title" content="{esc(full)}">', f'<meta property="og:description" content="{esc(desc)}">',
            '<meta property="og:type" content="website">', f'<meta property="og:url" content="{url}">', f'<meta property="og:site_name" content="{BRAND}">',
            '<meta property="og:locale" content="en_IN">', f'<meta property="og:image" content="{img}">', '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">', '<meta name="twitter:card" content="summary_large_image">']
    if 'noindex' not in robots: out.append(f'<script type="application/ld+json">{ld}</script>')
    out.append('<link rel="stylesheet" href="/seo/seo.css">')
    return '<!--seo:head-->\n' + '\n'.join(out) + '\n<!--/seo:head-->'

META_NAMES = r'(?:description|keywords|robots|author|language|geo\.[a-z]+|twitter:[a-z:]+|revisit-after)'
def apply_head(s, block):
    m = re.search(r'<head[^>]*>(.*?)</head>', s, flags=re.S | re.I)
    h = m.group(1)
    h = re.sub(r'\s*<!--seo:head-->.*?<!--/seo:head-->', '', h, flags=re.S)
    for rx in (r'<title>.*?</title>', rf'<meta\s+name="{META_NAMES}"[^>]*>', r'<meta\s+property="og:[^"]*"[^>]*>', r'<meta\s+charset="[^"]*"\s*/?>',
               r'<link\s+rel="canonical"[^>]*>', r'<link\s+rel="icon"[^>]*>', r'<script type="application/ld\+json">.*?</script>',
               r'<!-- (?:SEO Optimization Meta Tags|Open Graph / Facebook Meta Tags|Open Graph[^>]*|Twitter Card[^>]*|Structured Data[^>]*) -->'):
        h = re.sub(r'[ \t]*' + rx + r'[ \t]*\n?', '', h, flags=re.S | re.I)
    return s[:m.start(1)] + '\n' + block + '\n' + h.lstrip('\n') + s[m.end(1):]

# ───────────────────────── placing sections under a tool ─────────────────────────
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
class Finder(HTMLParser):
    """End offset of the direct child of <body> that contains #toolArea (or the first <main>)."""
    def __init__(self, s):
        super().__init__(convert_charrefs=True)
        self.lines = [0]
        for m in re.finditer('\n', s): self.lines.append(m.end())
        self.stack, self.inbody, self.hit, self.end, self.s = [], False, False, None, s
        self.feed(s)
    def off(self):
        l, c = self.getpos(); return self.lines[l - 1] + c
    def handle_starttag(self, t, attrs):
        if t == 'body': self.inbody = True; return
        if not self.inbody or self.end: return
        if dict(attrs).get('id') == 'toolArea': self.hit = True
        if t not in VOID: self.stack.append(t)
    def handle_endtag(self, t):
        if not self.inbody or self.end or t not in self.stack: return
        while self.stack and self.stack.pop() != t: pass
        if self.hit and not self.stack: self.end = self.s.index('>', self.off()) + 1

def put(s, name, body):
    """Fill <!--seo:name--> markers, creating them after the tool when missing."""
    a, b = f'<!--seo:{name}-->', f'<!--/seo:{name}-->'
    if a in s:
        i, j = s.index(a) + len(a), s.index(b)
        return s[:i] + '\n' + body + '\n' + s[j:]
    end = Finder(s).end
    if not end and name == 'guide':  # hub pages have no #toolArea: place before the body scripts
        end = s.rindex('<script', 0, s.index('firebase-app-compat', s.index('<body')))
    assert end, ('no #toolArea', s[s.find('<title>'):s.find('</title>')])
    return s[:end] + f'\n{a}\n{body}\n{b}' + s[end:]

def table(caption, heads, rows, wide=False):
    th = ''.join(f'<th scope="col">{esc(h)}</th>' for h in heads)
    tr = ''.join('<tr>' + ''.join(f'<td>{c if str(c).startswith("<a ") else esc(c)}</td>' for c in r) + '</tr>\n' for r in rows)
    return f'<div class="seo-tw"><table><caption>{esc(caption)}</caption><thead><tr>{th}</tr></thead><tbody>\n{tr}</tbody></table></div>'

METHOD = '<p class="seo-src">{src} <a href="/methodology">How we prepare the data</a>. Always confirm on the official portal before you decide.</p>'
def section(inner, trail):
    nav = ' › '.join(f'<a href="{u.replace(BASE, "") or "/"}">{esc(n)}</a>' for n, u in trail[:-1])
    nav = f'<nav class="seo-crumb" aria-label="Breadcrumb">{nav} › {esc(trail[-1][0])}</nav>' if len(trail) > 1 else ''
    return f'<section class="seo-section">{nav}\n{inner}\n</section>'

# ───────────────────────── MHT-CET data ─────────────────────────
clean = lambda s: re.sub(r'\s+', ' ', str(s or '')).strip()
cet = {}      # (code, choice) -> {name, branch, cats: {cat: {round: (pct, rank)}}}
inst = {}     # code -> facts
for rnd in (1, 2, 3, 4):
    for r in load(f'CUTOFFS 2026/mhtcet_round{rnd}.json'):
        if r.get('stage') != 'I' or r.get('percentile') is None: continue
        code, choice = r['institute_code'], r['choice_code']
        inst.setdefault(code, {'name': clean(r['institute_name']), 'status': clean(r['status']), 'uni': clean(r['home_university'])})
        e = cet.setdefault((code, choice), {'branch': clean(r['branch_name']), 'cats': {}})
        # seats moved between home-university and other-university pools are listed separately
        moved = r['seat_type'] if r['seat_type'] in ('HU to OHU', 'OHU to HU') else ''
        v = e['cats'].setdefault(f"{r['category']} {moved}".strip(), {})
        if rnd not in v or r['percentile'] < v[rnd][0]: v[rnd] = (r['percentile'], r['rank'])  # repeated rows: the closing one

short, site, package = {}, {}, {}
# The CSV has several rows for some codes; take the one closest to the official CAP name, and
# keep the official name when they do not clearly agree.
GENERIC = set('of and the for college engineering institute technology technological university society trust mandal management'.split())
words = lambda s: {w for w in re.sub(r'[^a-z0-9 ]', ' ', re.sub(r'(?<=\b\w)\.', ' ', s.lower())).split() if w not in GENERIC and len(w) > 1}
REVIEWED = {'04116', '04138', '04144', '05401', '06274', '06278', '06815', '03216', '06220'}  # same college, different wording
WRONG_PLACE = {'04188', '06268', '06625'}  # CSV gives a different town from the CAP list
best_row = {}
for r in csv.DictReader(open('mhtcet_colleges_with_codes.csv', encoding='utf8')):
    c = clean(r.get('College Code')).zfill(5)
    if c in inst:
        score = difflib.SequenceMatcher(None, clean(r['College Name']).lower(), inst[c]['name'].lower()).ratio()
        if c not in best_row or score > best_row[c][0]: best_row[c] = (score, r)
for c, (score, r) in best_row.items():
    a, b = words(r['College Name']), words(inst[c]['name'])
    if c in WRONG_PLACE or (c not in REVIEWED and len(a & b) / max(1, len(a)) < 0.5):
        continue
    short[c] = clean(r['College Name']).replace(' (duplicate)', '')
    u = clean(r.get('Official Sites '))
    if u.startswith('http'): site[c] = u
    v = clean(r['Avg Package (LPA)']).replace('-', '–')
    if v and v != '2–3': package[c] = v  # 2–3 is the file's default value, not a reported figure

OPEN_PREF = ('GOPENS', 'GOPENH', 'GOPENO', 'LOPENS', 'LOPENH', 'LOPENO')  # ladies seats: women's colleges have only these
def open_cat(e):
    return next((c for c in OPEN_PREF if c in e['cats']), None)
def open_val(e, rnd=1):
    c = open_cat(e)
    return e['cats'][c].get(rnd) if c else None
is_cs = lambda b: bool(re.match(r'(computer (science|engineering)|information technology)', b, re.I))

by_inst = {}
for (code, choice), e in cet.items(): by_inst.setdefault(code, []).append((choice, e))

def slugify(s):
    s = s.lower().replace('&', ' and ').replace("'", '').replace('’', '')
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s)).strip('-')[:70].strip('-')

ranked = []
for code, es in by_inst.items():
    vals = sorted((v[0] for _, e in es for v in [open_val(e)] if v), reverse=True)
    ranked.append((vals[min(2, len(vals) - 1)] if vals else 0, code))  # under two open rows: page is noindexed
ranked.sort(reverse=True)
top = [c for _, c in ranked]
name_of = lambda c: short.get(c) or inst[c]['name']
slug_of, used = {}, set()
for c in top:
    s = slugify(name_of(c))
    if s in used: s += '-' + c
    used.add(s); slug_of[c] = s
def college_link(code, text=None):
    t = esc(text or name_of(code))
    return f'<a href="/colleges/{slug_of[code]}">{t}</a>' if code in slug_of else (text or name_of(code))

SRC_CET = 'Source: State CET Cell MHT-CET CAP 2026 cutoff lists, Stage I.'

# best CS/IT open cutoff per college
cs_best = []
for code, es in by_inst.items():
    b = max(((open_val(e)[0], open_val(e)[1], e['branch'], open_cat(e)) for _, e in es if is_cs(e['branch']) and open_val(e) and open_cat(e)[0] == 'G'), default=None)
    if b: cs_best.append((b, code))
cs_best.sort(key=lambda x: -x[0][0])
pct = lambda p: f'{p:.2f}'

def cs_rows(rows): return [[college_link(c), b[2], b[3], pct(b[0]), num(b[1])] for b, c in rows]
CS_HEAD = ['College', 'Branch', 'Seat type', 'Percentile', 'Merit rank']

# ───────────────────────── other data ─────────────────────────
def to_int(v):
    v = re.sub(r'[^\d]', '', str(v or '')); return int(v) if v else None
J = load('JOSAA/JOSAA_CUTOFF_CONSOLIDATED_2026.json')
jr = lambda r, n: to_int(r.get(f'Round {n} - Closing Rank '))
def josaa_rows(kind, quota, pattern, n=99):
    out = []
    for r in J:
        if r['Type'] == kind and r['Quota'] == quota and r['Seat Type'] == 'OPEN' and r['Gender'] == 'Gender-Neutral' and re.match(pattern, r['Academic Program Name']) and jr(r, 5):
            out.append((jr(r, 5), clean(r['Institute']), jr(r, 1)))
    out.sort()
    return [[i, num(a) if a else '–', num(z)] for z, i, a in out[:n]]
CSE4 = r'Computer Science and Engineering \(4 Years'
nit_cse = josaa_rows('NIT', 'OS', CSE4)
iiit_cse = josaa_rows('IIIT', 'AI', CSE4)
clgs = json.load(open('JOSAA/clgs.json', encoding='utf8'))
iit = {}
for n in range(1, 7):
    for r in load(f'JOSAA/IIT_ROUND_{n}_2026.json'):
        if r['Seat Type'] == 'OPEN' and r['Gender'] == 'Gender-Neutral' and re.match(CSE4, r['Academic Program Name']):
            iit.setdefault(clean(r['Institute']), {})[n] = to_int(r['Closing Rank'])
iit_rows = [[i, num(v[1]) if v.get(1) else '–', num(v[6])] for i, v in sorted(iit.items(), key=lambda x: x[1].get(6) or 9e9) if v.get(6)]
SRC_J = 'Source: JoSAA 2026 closing ranks.'
csab = sorted(([clean(r['Institute']), to_int(r['Round 1 - Closing Rank ']), to_int(r['Round 2 - Closing Rank '])] for r in load('JOSAA/CSAB_CUTOFF_CONSOLIDATED_2026.json')
  if r['Type'] == 'NIT' and r['Quota'] == 'Other State' and r['Seat Type'] == 'OPEN' and r['Gender'] == 'Gender-Neutral' and re.match(CSE4, r['Academic Program Name'])), key=lambda x: x[2] or x[1] or 9e9)
csab_rows = [[i, num(a) if a else '–', num(b) if b else '–'] for i, a, b in csab]
CK = load('COMEDK/COMEDK_GM_CUTOFF.json')
def comedk_rows(pattern, n=500):
    rows = [(to_int(r['Round 1']), clean(r['College']), clean(r['Branch']).title(), [num(x) if (x := to_int(r[f'Round {k}'])) else '–' for k in (1, 2, 3, 4)]) for r in CK if re.search(pattern, r['Branch'], re.I) and to_int(r['Round 1'])]
    rows.sort(key=lambda x: x[0])
    return [[re.sub(r'(\w+)(?: \1)$', r'\1', c), b, *v] for _, c, b, v in rows[:n]]
MP = [[clean(r['Campus']), clean(r['Branch']).replace('B.Tech in ', ''), *[num(x) if (x := to_int(r[f'Round {k}'])) else '–' for k in (1, 2, 3, 4)]] for r in load('MANIPAL/MANIPAL_CUTOFF.json')]
MP.sort(key=lambda r: (r[0], r[1]))
def dse_rows(pattern, n=500):
    seen = {}
    for r in load('DSE 2026/DSE_CAP_1_2026_cutoffs.json'):
        if r['Seat Type'] == 'GOPEN' and re.match(pattern, clean(r['Branch']), re.I) and r['Stage'] == 'Stage-I':
            k = r['Institute Code']; v = (float(r['Percentile']), to_int(r['Rank']), clean(r['Institute']), clean(r['Branch']))
            if k not in seen or v[0] > seen[k][0]: seen[k] = v
    return [[v[2], v[3], pct(v[0]), num(v[1])] for v in sorted(seen.values(), key=lambda v: (-v[0], v[1]))[:n]]
def ai_parse(r):
    m = re.match(r'(\d+)\s*\(([\d.]+)', clean(r['All India Merit']))
    n = re.match(r'(\d+)\s*-\s*(.*)', clean(r['Institute Name']))
    return (int(m.group(1)), float(m.group(2)), n.group(1).zfill(5), n.group(2)) if m and n else None
ai = {}  # code -> choice -> (branch, {round: (rank, pct)})
for rnd in (1, 2, 3, 4):
    for r in load(f'CUTOFFS 2026/round{rnd}_all_india.json'):
        p = ai_parse(r)
        if p: ai.setdefault(p[2], {}).setdefault(clean(r['Choice Code']), (clean(r['Course Name']), {}))[1].setdefault(rnd, (p[0], p[1]))
def ai_rows(n=500):
    out = []
    for code, ch in ai.items():
        b = max(((v[1][1], v[1][0], br) for br, v in ch.values() if 1 in v and is_cs(br)), default=None)
        if b: out.append((b, code))
    out.sort(key=lambda x: -x[0][0])
    return [[college_link(c) if c in inst else c, b[2], pct(b[0]), num(b[1])] for b, c in out[:n]]
def air25(n=500):
    best = {}
    for r in load('jee_data.json'):
        p = to_int(str(r['All India Merit']).split('(')[0]); b = clean(r['Branch Name'])
        if p and is_cs(b) and (r['College Code'] not in best or p < best[r['College Code']][0]):
            best[r['College Code']] = (p, re.sub(r'^\d+\s*-\s*', '', clean(r['Institute Name'])), b, r['JEE Percentile'])
    return [[v[1], v[2], num(v[0]), pct(float(v[3]))] for v in sorted(best.values())[:n]]

def pr_rows(path):
    return [[r['Percentile'], f"{num(int(r['Minimum Rank']))} – {num(int(r['Maximum Rank']))}"] for r in load(path)]

def cet_mark_rows():
    s, _ = read('cet_marks.html')
    block = s[s.index('MHT_CET_2026_DATA = {'):]
    block = block[:block.index('};')]
    out = {}
    for lvl in ('easy', 'moderate', 'hard'):
        part = re.search(lvl + r':\s*\[(.*?)\]', block, re.S).group(1)
        for a, b, lo, hi in re.findall(r'min: (\d+), max: (\d+), lowPct: ([\d.]+), highPct: ([\d.]+)', part):
            out.setdefault((int(a), int(b)), {})[lvl] = f'{float(lo):g} – {float(hi):g}'
    return [[f'{a}–{b}', *[v.get(l, '–') for l in ('easy', 'moderate', 'hard')]] for (a, b), v in sorted(out.items(), reverse=True)]

def jee_mark_rows():
    cols = [('easy_moderate_marks.json', 0), ('moderate_marks.json', 1), ('moderate_difficult_marks.json', 2), ('difficult_marks.json', 3)]
    out = {}
    for f, i in cols:
        for r in load(f): out.setdefault(clean(r['Marks']), ['–'] * 4)[i] = clean(r['Percentile'])
    return [[m, *v] for m, v in sorted(out.items(), key=lambda kv: -int(re.match(r'\d+', kv[0]).group()))]

# ───────────────────────── sections ─────────────────────────
def band(lo, hi, n=40): return [x for x in cs_best if lo <= x[0][0] < hi][:n]
below95 = [x for x in cs_best if x[0][0] <= 95][:3]
v95 = '; '.join(f'{name_of(c)} ({b[2]}, {pct(b[0])})' for b, c in below95)
first_link = lambda: f'See <a href="/colleges/">cutoffs by college</a>.'

S = {}
t1 = nit_cse[0]; tl = nit_cse[-1]
S['mht_cet_college_predictor'] = ('<h2>Which colleges match your MHT-CET percentile?</h2>'
 f'<p>In 2026 CAP Round 1, the highest open-category Computer or IT cutoff at or below 95 percentile was at {esc(v95)}. These are Round 1 closing scores for general open seats. Other categories, home university seats and later rounds differ.</p>'
 + ''.join(table(f'{lab}: Computer and IT closing cutoffs, CAP Round 1 2026', CS_HEAD, cs_rows(band(lo, hi))) for lab, lo, hi in (('99 percentile and above', 99, 101), ('97 to 99 percentile', 97, 99), ('95 to 97 percentile', 95, 97), ('90 to 95 percentile', 90, 95)))
 + '<p>Each table shows up to 40 colleges. GOPENS seats are state level; GOPENH seats are for the college’s home university. ' + first_link() + '</p>', SRC_CET)
S['college_explorer'] = ('<h2>2026 cutoffs by college</h2><p>Open a college for its CAP Round 1 to 4 cutoffs, JEE Main All India cutoffs and seats.</p><ul class="seo-links">'
 + ''.join(f'<li>{college_link(c)}</li>' for c in top[:60]) + f'</ul><p><a href="/colleges/">All colleges</a> · <a href="/mht-cet-cutoff/">By branch and region</a> · <a href="/mht-cet-colleges/">By percentile</a></p>', SRC_CET)
S['cet_marks'] = ('<h2>MHT-CET marks vs percentile table</h2><p>Estimated percentile for marks out of 200, by shift difficulty. These are the same bands the calculator uses.</p>'
 + table('MHT-CET marks (out of 200) and estimated percentile', ['Marks', 'Easy shift', 'Moderate shift', 'Hard shift'], cet_mark_rows())
 + '<p>The official percentile compares you with candidates in your own shift, so the same marks can give different percentiles. Next, <a href="/cet_rank">convert percentile to rank</a>.</p>', 'Estimates by College Simplified; the CET Cell does not publish a marks vs percentile table.')
S['cet_rank'] = ('<h2>MHT-CET percentile vs rank table</h2><p>Estimated state merit rank range for each percentile.</p>'
 + table('MHT-CET percentile and estimated merit rank', ['Percentile', 'Estimated rank'], pr_rows('MHT CET percentile vs rank.json'))
 + '<p>Next, check <a href="/mht_cet_college_predictor">which colleges match your rank</a>.</p>', 'Estimates by College Simplified. Your official merit number comes from the CET Cell.')
S['josaa_rank'] = ('<h2>JEE Main percentile vs rank table</h2><p>Estimated All India Rank (CRL) range for each percentile.</p>'
 + table('JEE Main percentile and estimated rank', ['Percentile', 'Estimated rank'], pr_rows('josaa_percentile_vs_rank.json'))
 + '<p>Next, see <a href="/josaa_cutoff">2026 JoSAA closing ranks</a>.</p>', 'Estimates by College Simplified. Your official rank comes from NTA.')
S['josaa_marks'] = ('<h2>JEE Main marks vs percentile table</h2><p>Estimated percentile for marks out of 300, by shift difficulty.</p>'
 + table('JEE Main marks (out of 300) and estimated percentile', ['Marks', 'Easy to moderate', 'Moderate', 'Moderate to difficult', 'Difficult'], jee_mark_rows())
 + '<p>Next, <a href="/josaa_rank">convert percentile to rank</a>.</p>', 'Estimates by College Simplified; NTA does not publish a marks vs percentile table.')
NIT_T = table('NIT Computer Science closing ranks, JoSAA 2026 (OPEN, Other State, gender-neutral)', ['Institute', 'Round 1', 'Round 5'], nit_cse)
S['josaa_cutoff'] = (f'<h2>NIT Computer Science cutoff 2026</h2><p>{esc(t1[0])} closed first, at rank {t1[2]} in Round 5. {esc(tl[0])} closed last, at {tl[2]}.</p>' + NIT_T, SRC_J)
S['josaa'] = ('<h2>IIIT Computer Science cutoff 2026</h2><p>Closing ranks for open, gender-neutral seats on the All India quota.</p>' + table('IIIT Computer Science closing ranks, JoSAA 2026 (OPEN, All India, gender-neutral)', ['Institute', 'Round 1', 'Round 5'], iiit_cse) + '<p>For NITs, see <a href="/josaa_cutoff">JoSAA closing ranks</a>.</p>', SRC_J)
S['josaa_iit'] = ('<h2>IIT Computer Science cutoff 2026</h2><p>JEE Advanced closing ranks for open, gender-neutral seats.</p>' + table('IIT Computer Science closing ranks, JoSAA 2026 (OPEN, gender-neutral)', ['Institute', 'Round 1', 'Round 6'], iit_rows), SRC_J)
S['csab'] = ('<h2>NIT Computer Science cutoff in CSAB 2026</h2><p>Closing ranks in the CSAB special rounds for open, gender-neutral Other State seats.</p>' + table('NIT Computer Science closing ranks, CSAB 2026 (OPEN, Other State, gender-neutral)', ['Institute', 'Round 1', 'Round 2'], csab_rows), 'Source: CSAB 2026 special round closing ranks.')
CKH = ['College', 'Branch', 'Round 1', 'Round 2', 'Round 3', 'Round 4']
S['comedk_cutoff'] = ('<h2>COMEDK Computer Science cutoff ranks</h2><p>Round 1 to 4 closing ranks for Computer branches in the General Merit category.</p>' + table('COMEDK closing ranks, Computer branches (General Merit)', CKH, comedk_rows(r'COMPUTER')), 'Source: COMEDK UGET round-wise cutoff lists.')
S['comedk_predictor'] = ('<h2>COMEDK Electronics cutoff ranks</h2><p>Round 1 to 4 closing ranks for Electronics and Communication in the General Merit category.</p>' + table('COMEDK closing ranks, Electronics and Communication (General Merit)', CKH, comedk_rows(r'ELECTRONICS.*COMMUNICATION')) + '<p>For Computer branches, see <a href="/comedk_cutoff">COMEDK cutoffs</a>.</p>', 'Source: COMEDK UGET round-wise cutoff lists.')
S['manipal_cutoff'] = ('<h2>MET 2025 cutoff ranks by campus and branch</h2>' + table('Manipal MET 2025 closing ranks', ['Campus', 'Branch', 'Round 1', 'Round 2', 'Round 3', 'Round 4'], MP), 'Source: MET 2025 cutoff ranks.')
DH = ['College', 'Branch', 'Percentile', 'Merit rank']
S['dse_cutoff_checker'] = ('<h2>DSE Computer Engineering cutoff 2026</h2><p>Open-category cutoffs for Computer and IT branches in DSE CAP Round 1.</p>' + table('DSE 2026 CAP Round 1: Computer and IT (GOPEN)', DH, dse_rows(r'computer|information tech')), 'Source: State CET Cell DSE CAP Round 1 2026, Stage I.')
S['dse_college_predictor'] = ('<h2>DSE Mechanical Engineering cutoff 2026</h2><p>Open-category cutoffs for Mechanical Engineering in DSE CAP Round 1.</p>' + table('DSE 2026 CAP Round 1: Mechanical (GOPEN)', DH, dse_rows(r'mechanical engineering')) + '<p>For Computer branches, see <a href="/dse_cutoff_checker">DSE cutoffs</a>.</p>', 'Source: State CET Cell DSE CAP Round 1 2026, Stage I.')
S['percentile_vs_college_predictor'] = ('<h2>All India seat cutoffs in Maharashtra, 2026</h2><p>Highest Computer or IT cutoff at each college on All India (JEE Main) seats in CAP Round 1.</p>' + table('All India seats, CAP Round 1 2026: Computer and IT', ['College', 'Branch', 'JEE Main percentile', 'All India merit'], ai_rows()), 'Source: State CET Cell CAP Round 1 2026, All India seats.')
S['air'] = ('<h2>All India seat cutoffs in Maharashtra, 2025</h2><p>This predictor uses 2025 data. For 2026, use the <a href="/percentile_vs_college_predictor">All India seats predictor</a>.</p>' + table('All India seats, CAP 2025: Computer and IT', ['College', 'Branch', 'All India merit', 'JEE Main percentile'], air25()), 'Source: State CET Cell CAP 2025, All India seats.')

GUIDE = {
 'index': ('Engineering counselling 2027', [('/counselling-2027/', 'Counselling 2027 guides'), ('/colleges/', 'MHT-CET cutoffs by college'), ('/mht-cet-cutoff/', 'MHT-CET cutoffs by branch and region'), ('/mht-cet-colleges/', 'Colleges by MHT-CET percentile'), ('/josaa-cutoff/', 'JoSAA cutoffs: IIT, NIT, IIIT, GFTI'), ('/comedk-cutoff/', 'COMEDK cutoffs and fees'), ('/cet_marks', 'MHT-CET marks vs percentile'), ('/josaa_rank', 'JEE Main percentile vs rank'), ('/about', 'About and contact'), ('/methodology', 'Methodology')]),
 'cet-landing': ('MHT-CET 2027 cutoffs and guide', [('/counselling-2027/mht-cet', 'MHT-CET counselling 2027 guide'), ('/colleges/', 'Cutoffs for all colleges'), ('/mht-cet-cutoff/', 'Cutoffs by branch and region'), ('/mht-cet-colleges/', 'Colleges by percentile')]),
 'josaa-landing': ('JoSAA 2027 cutoffs and guide', [('/counselling-2027/josaa', 'JoSAA counselling 2027 guide'), ('/josaa-cutoff/', 'JoSAA cutoffs for all institutes')]),
 'csab-landing': ('CSAB 2027 cutoffs and guide', [('/counselling-2027/csab', 'CSAB counselling 2027 guide'), ('/josaa-cutoff/', 'JoSAA and CSAB ranks by institute')]),
 'comedk-landing': ('COMEDK 2027 cutoffs and guide', [('/counselling-2027/comedk', 'COMEDK counselling 2027 guide'), ('/comedk-cutoff/', 'COMEDK cutoffs for all colleges')]),
 'dse-landing': ('DSE 2027 cutoffs and guide', [('/counselling-2027/dse', 'DSE counselling 2027 guide'), ('/colleges/', 'College pages with DSE cutoffs')]),
}

INLINE = {
 'cet_colleges': {'cet-top': '<h3 style="font-size:17px;font-weight:700;color:#111827;margin:28px 0 12px">Highest Computer and IT cutoffs, CAP Round 1 2026</h3>' + table('Open-category closing cutoffs', ['College', 'CAP code', 'Branch', 'Seat type', 'Percentile'], [[college_link(c), c, b[2], b[3], pct(b[0])] for b, c in cs_best]) + METHOD.format(src=SRC_CET)},
 'josaa-preference-builder': {
  'josaa-guide': f'<p>Your options depend on your JEE Main rank, category, gender and home state. As a guide, these are the 2026 closing ranks for NIT Computer Science. Compare them with your own rank, which you can estimate from your <a href="/josaa_rank">percentile</a>.</p>{NIT_T}' + METHOD.format(src=SRC_J),
  **{f'josaa-{k.lower()}': f'<h3 style="font-size:17px;font-weight:700;color:#111827;margin:28px 0 12px">{k}s in our JoSAA 2026 data ({len(clgs[k])})</h3><p style="font-size:12px;color:#4b5563;line-height:2">' + ' · '.join(esc(clean(x)) for x in clgs[k]) + '</p>' for k in ('NIT', 'IIIT', 'GFTI')}},
}

# ───────────────────────── new pages ─────────────────────────
CSS = '''body{overflow-x:clip}
/* the mobile layout hides the hub hero; keep its heading visible */
@media(max-width:768px){.hero:has(> h1){display:block!important;padding:4px 16px 12px!important;margin:0!important;min-height:0!important;background:none!important;text-align:left!important}
.hero:has(> h1)>*:not(h1){display:none!important}.hero:has(> h1)::before,.hero:has(> h1)::after{display:none!important}
.hero>h1{font-size:1.3rem!important;line-height:1.3!important;margin:0!important;display:block!important;color:var(--ink,#111827)!important}}
.seo-section{max-width:1100px;margin:40px auto 0;padding:28px 20px 48px;color:var(--ink,#111827);font:400 15px/1.65 Inter,system-ui,sans-serif;box-sizing:border-box;text-align:left}
.seo-section h1{font:800 clamp(1.6rem,4vw,2.3rem)/1.2 Lexend,Inter,sans-serif;margin:0 0 12px}
.seo-section h2{font:800 1.35rem/1.3 Lexend,Inter,sans-serif;margin:28px 0 8px;color:var(--ink,#111827)}
.seo-section p{margin:0 0 12px;color:var(--ink,#374151)}
.seo-section a,.seo-tw a{color:#b91c1c}
.seo-crumb{font-size:13px;margin:0 0 12px;color:var(--muted,#4b5563)}
.seo-src{font-size:13px;color:var(--muted,#4b5563)!important}
.seo-tw{overflow-x:auto;margin:12px 0 18px;border:1px solid var(--stroke,rgba(0,0,0,.1));border-radius:14px;background:var(--card,#fff)}
.seo-tw table{width:100%;border-collapse:collapse;font:400 14px/1.45 Inter,system-ui,sans-serif;color:var(--ink,#111827)}
.seo-tw caption{text-align:left;font-weight:700;padding:12px 14px}
.seo-tw th{text-align:left;background:#fef2f2;color:#991b1b;white-space:nowrap}
.seo-tw th,.seo-tw td{padding:9px 14px;border-top:1px solid var(--stroke,rgba(0,0,0,.08));vertical-align:top}
.seo-links{columns:2;column-gap:28px;padding-left:20px;margin:8px 0 16px}
.seo-links li{margin:0 0 6px;break-inside:avoid}
.seo-d{margin:8px 0;border:1px solid var(--stroke,rgba(0,0,0,.1));border-radius:12px;background:var(--card,#fff)}
.seo-d summary{cursor:pointer;padding:12px 14px;font-weight:600}
.seo-d .seo-tw{margin:0 12px 12px}
body.seo-page,.seo-page *{box-sizing:border-box}
html:has(body.seo-page),body.seo-page{overflow-x:hidden;width:100%}
body.seo-page{margin:0;padding-top:72px;background:var(--bg,#fafafa);font-family:'Inter',sans-serif;color:var(--ink,#111827);line-height:1.5}
.seo-page .seo-section{margin-top:0}
@media(max-width:640px){.seo-links{columns:1}.seo-section{padding:20px 16px 90px}}
@media(min-width:1025px){body.seo-page.sidebar-visible{padding-left:280px}}
.seo-review{margin:36px 0 12px;padding:22px 22px 10px;border:1px solid var(--stroke,rgba(0,0,0,.1));border-radius:16px;background:var(--card,#fff)}
.seo-review h2{margin-top:0}
.seo-review h3{font:700 1.05rem/1.35 Lexend,Inter,sans-serif;margin:22px 0 8px;color:var(--ink,#111827)}
.seo-review ul{padding-left:20px;margin:6px 0 12px}.seo-review li{margin:0 0 6px}
.seo-verdict{font-size:16px}
.seo-tag{display:inline-block;font:700 12px/1 Inter,sans-serif;letter-spacing:.02em;padding:6px 10px;margin-right:6px;border-radius:999px;background:#fef2f2;color:#991b1b;vertical-align:2px}
.seo-pc{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0 4px}
.seo-pc>div{padding:6px 18px 4px;border-radius:12px;border:1px solid var(--stroke,rgba(0,0,0,.08))}
.seo-pc h3{margin-top:10px}
.seo-pro{border-left:4px solid #15803d!important}.seo-con{border-left:4px solid #b45309!important}
.seo-review .seo-d{margin:10px 0}
.seo-review .seo-d summary{padding:14px 18px;line-height:1.45}
.seo-review .seo-d>p{margin:0!important;padding:0 18px 16px}
.seo-review>.seo-src{margin-top:16px}
@media(max-width:640px){.seo-pc{grid-template-columns:1fr}.seo-review{padding:18px 14px 6px}.seo-review .seo-d summary{padding:12px 14px}.seo-review .seo-d>p{padding:0 14px 14px}}
'''
write('seo/seo.css', CSS)
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lexend:wght@400;600;700;800&display=swap" rel="stylesheet">'
def page(title, desc, path, og, trail, inner, robots='index'):
    head = head_block(title, desc, BASE + path, og, robots, trail)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
{head}
<meta name="viewport" content="width=device-width, initial-scale=1.0">
{FONTS}
</head>
<body class="seo-page">
<main>
{section(inner, trail)}
</main>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js" defer></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js" defer></script>
<script src="/firebase_config.js" defer></script>
<script src="/shared_auth.js" defer></script>
<script>document.addEventListener('DOMContentLoaded', function () {{ initAuth({{ requireLogin: false }}); }});</script>
</body>
</html>
'''

seats = {}
for r in load('CUTOFFS 2026/MHT_CET_2026_Seat_Matrix.json'):
    e = seats.setdefault(r['College_Code'], {}).setdefault(r['Choice_Code'], None)
    if e is None: seats[r['College_Code']][r['Choice_Code']] = [clean(r['Course_Name']), r['SI'], r['CAP_Seats'], r['All_India'], r['TFWS_Seats']]

CAT = {'OPEN': 'Open', 'OBC': 'OBC', 'SEBC': 'SEBC', 'SC': 'SC', 'ST': 'ST', 'VJ': 'VJ/DT', 'NTB': 'NT-B', 'NTC': 'NT-C', 'NTD': 'NT-D'}
import data_pages
draft = data_pages.build(globals(), dry=True)
REL = 'seo/release.json'
if os.path.exists(REL):
    plan = json.load(open(REL))
else:
    first = [p for p, f, i, q in draft if i and re.match(r'/(counselling-2027|mht-cet-cutoff|mht-cet-colleges)/|/(colleges|josaa-cutoff|comedk-cutoff)/$|/josaa-cutoff/(nit|iit|iiit)-', p)]
    rest = {k: [p for p, f, i, q in sorted((x for x in draft if x[2] and x[0].startswith(f'/{k}/') and x[0] not in first), key=lambda x: x[3])] for k in ('colleges', 'josaa-cutoff', 'comedk-cutoff')}
    queue = [p for _, p in sorted(((n + .5) / len(v), p) for v in rest.values() for n, p in enumerate(v))]
    room = 100 - 2 - len(first)  # 100 new pages on day one, counting /about and /methodology
    days = {p: 0 for p in first + queue[:room]}
    later = queue[room:]
    for n, p in enumerate(later): days[p] = 1 + n * 8 // len(later)
    plan = {'start': datetime.date.today().isoformat(), 'days': days}
arg = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None
if arg('--start'): plan['start'] = datetime.date.fromisoformat(arg('--start')).isoformat()
for p, f, i, q in draft: plan['days'].setdefault(p, 8)
open(REL, 'w', newline='\n').write(json.dumps(plan, indent=1) + '\n')
day = int(arg('--day')) if arg('--day') else (datetime.date.today() - datetime.date.fromisoformat(plan['start'])).days
day = max(0, min(8, day))
RELEASED = {p for p, d in plan['days'].items() if d <= day}
pages = [x for x in data_pages.build(globals()) if x[0] in RELEASED]

trail = [('Home', BASE + '/'), ('Methodology', BASE + '/methodology')]
write('methodology.html', page('Methodology: How Our Data Is Prepared', 'Where College Simplified cutoffs, seats and rank estimates come from, how they are prepared, and their limits.', '/methodology', 'home', trail, '''<h1>How our data is prepared</h1>
<p>College Simplified tools compare your score with past closing cutoffs. They are estimates, not offers of admission.</p>
<p>Pages for 2027 admission use the latest published cutoffs, mostly from 2026. No 2027 cutoffs exist until the 2027 rounds are held, and each table states its own year.</p>
<h2>Sources</h2>
<ul><li>MHT-CET: State CET Cell CAP 2026 cutoff lists for Rounds 1 to 4 and the 2026 seat matrix.</li><li>All India seats in Maharashtra: CAP 2026 All India cutoff lists. The AIR predictor uses 2025 lists.</li><li>Direct Second Year: DSE CAP 2026 Rounds 1 and 2.</li><li>JoSAA and CSAB: 2026 closing ranks.</li><li>COMEDK UGET: round-wise General Merit and KKR cutoff ranks.</li><li>Manipal: MET 2025 cutoff ranks.</li></ul>
<h2>How the tables are made</h2>
<p>MHT-CET tables on college pages use Stage I cutoffs. For each branch we show one open-category seat type: state level (GOPENS) if it exists, otherwise home university (GOPENH), otherwise other than home university (GOPENO). Women’s colleges show the ladies seats (LOPENS, LOPENH, LOPENO). “HU to OHU” and “OHU to HU” mark seats moved between the home-university and other-university pools. Percentiles are rounded to two decimals.</p>
<p>Average packages are figures compiled by College Simplified, not published by the CET Cell. Ask the college for its latest placement report.</p>
<p>Marks vs percentile and percentile vs rank tables are our own estimates. The exam authorities do not publish them.</p>
<h2>Limits</h2>
<p>Cutoffs change every year with seats, applicants and difficulty. Check the official brochure and portal before you submit an option form: <a href="https://cetcell.mahacet.org/" rel="noopener" target="_blank">State CET Cell</a>, <a href="https://josaa.nic.in/" rel="noopener" target="_blank">JoSAA</a>, <a href="https://www.comedk.org/" rel="noopener" target="_blank">COMEDK</a>.</p>
<p>Found a mistake? <a href="/about">Contact us</a>.</p>'''))
trail = [('Home', BASE + '/'), ('About', BASE + '/about')]
write('about.html', page('About & Contact', 'About College Simplified (Concept Simplified): engineering admission predictors and counselling tools for India, and how to reach us.', '/about', 'home', trail, '''<h1>About College Simplified</h1>
<p>College Simplified (Concept Simplified) offers predictors, cutoff data and counselling tools for engineering admissions in India: MHT-CET, Direct Second Year, JoSAA, CSAB, COMEDK and Manipal MET.</p>
<p>Our numbers come from official counselling cutoff lists. See <a href="/methodology">how we prepare the data</a>.</p>
<h2>Contact</h2>
<ul><li><a href="https://www.instagram.com/college_simplified/" rel="noopener" target="_blank">Instagram: @college_simplified</a></li><li><a href="https://youtube.com/@conceptsimplified" rel="noopener" target="_blank">YouTube: @conceptsimplified</a></li><li><a href="https://www.collegesimplified.in/" rel="noopener" target="_blank">collegesimplified.in</a></li></ul>
<p>Read our <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms &amp; Conditions</a>.</p>'''))
write('404.html', page('Page Not Found', 'This page does not exist.', '/404', 'home', [('Home', BASE + '/'), ('Page not found', BASE + '/404')], '''<h1>Page not found</h1>
<p>The page may have moved. Try one of these:</p>
<ul><li><a href="/">Home</a></li><li><a href="/colleges/">MHT-CET cutoffs by college</a></li><li><a href="/josaa_cutoff">JoSAA closing ranks</a></li><li><a href="/ai-counsellor">AI counsellor</a></li></ul>''', robots='noindex, follow'))

# ───────────────────────── apply ─────────────────────────
for name, (title, desc, sec, label) in PAGES.items():
    f = name + '.html'
    s, crlf = read(f)
    trail = crumbs_for(name)
    s = apply_head(s, head_block(title, desc, url_of(name), OG[sec], 'index', trail, home=name == 'index'))
    if name in S:
        inner, src = S[name]
        s = put(s, 'data', section(inner + METHOD.format(src=src), trail))
    for k, body in INLINE.get(name, {}).items(): s = put(s, k, body)
    if name in GUIDE:
        t, ls = GUIDE[name]
        s = put(s, 'guide', f'<section class="seo-section"><h2>{esc(t)}</h2><ul class="seo-links">' + ''.join(f'<li><a href="{u}">{esc(x)}</a></li>' for u, x in ls) + '</ul></section>')
    write(f, s, crlf)
for name, (title, desc, robots) in NOINDEX.items():
    s, crlf = read(name + '.html')
    write(name + '.html', apply_head(s, head_block(title, desc, url_of(name), 'home', robots, [])), crlf)

# ───────────────────────── sitemap ─────────────────────────
# lastmod: kept while a page's content hash is unchanged, so it only moves on real edits
STATE = 'seo/lastmod.json'
state = json.load(open(STATE)) if os.path.exists(STATE) else {}
today = datetime.date.today().isoformat()
items = [(url_of(n), n + '.html') for n in PAGES] + [(BASE + '/ai-counsellor', 'netlify/functions/ai-counsellor-page/ai-counsellor-page.mjs')]
items += [(BASE + p, f) for p, f, index, q in pages if index] + [(BASE + '/methodology', 'methodology.html'), (BASE + '/about', 'about.html')]
new, xml = {}, ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u, f in items:
    t = open(f, encoding='utf8').read()
    if f.endswith('.html'): t = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', t))  # text only: a name becoming a link is not an update
    h = hashlib.sha1(t.encode()).hexdigest()[:16]
    d = state[u]['date'] if state.get(u, {}).get('hash') == h else today
    new[u] = {'hash': h, 'date': d}
    xml.append(f'  <url><loc>{esc(u)}</loc><lastmod>{d}</lastmod></url>')
write('sitemap.xml', '\n'.join(xml + ['</urlset>', '']))
write(STATE, json.dumps(new, indent=1) + '\n')
write('llms.txt', f'# {BRAND}\n\n> Engineering admission predictors, cutoffs and counselling tools for India: MHT-CET, DSE, JoSAA, CSAB, COMEDK and Manipal MET.\n\n## Cutoffs and data\n\n'
      + ''.join(f'- [{t}]({u}): {d}\n' for t, u, d in [('Counselling 2027', BASE + '/counselling-2027/', 'Guides for each exam'), ('MHT-CET cutoffs by college', BASE + '/colleges/', 'CAP 2026 Rounds 1 to 4'), ('MHT-CET cutoffs by branch and region', BASE + '/mht-cet-cutoff/', 'CAP 2026'), ('Colleges by MHT-CET percentile', BASE + '/mht-cet-colleges/', 'CAP 2026'), ('JoSAA and CSAB closing ranks', BASE + '/josaa-cutoff/', '2026'), ('COMEDK cutoffs and fees', BASE + '/comedk-cutoff/', 'By college')] + [(PAGES[n][0], url_of(n), PAGES[n][1]) for n in ('josaa_cutoff', 'josaa_iit', 'csab', 'comedk_cutoff', 'dse_cutoff_checker', 'manipal_cutoff', 'cet_marks', 'cet_rank', 'josaa_marks', 'josaa_rank')])
      + f'\n## About\n\n- [Methodology]({BASE}/methodology): sources and limits\n- [About]({BASE}/about): who we are and contact\n')
print(f'Release day {day} of 8 (start {plan["start"]}): {len(pages)} of {len(draft)} data pages live, {len(items)} URLs in sitemap')
