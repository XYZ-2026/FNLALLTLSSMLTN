"""Data pages for the 2027 admission cycle. Called by build_seo.py, which owns the shared helpers.

2027 is the year students are applying for; every cutoff keeps the year it was published.
Returns [(path, file, indexable, priority)]. With dry=True nothing is written.
"""
import difflib, glob, os, re
import reviews
from types import SimpleNamespace

NEXT, DATA = 2027, 2026


def build(ctx, dry=False):
    g = SimpleNamespace(**ctx)
    esc, num, pct, table, clean, load = g.esc, g.num, g.pct, g.table, g.clean, g.load
    BASE, METHOD = g.BASE, g.METHOD
    out, kept, titles = [], {}, set()

    # names students search for
    AKA = {'National Institute of Technology, Tiruchirappalli': 'NIT Trichy', 'National Institute of Technology Karnataka, Surathkal': 'NIT Surathkal (NITK)',
           'Motilal Nehru National Institute of Technology Allahabad': 'MNNIT Allahabad', 'Malaviya National Institute of Technology Jaipur': 'MNIT Jaipur',
           'Visvesvaraya National Institute of Technology, Nagpur': 'VNIT Nagpur', 'Sardar Vallabhbhai National Institute of Technology, Surat': 'SVNIT Surat',
           'Maulana Azad National Institute of Technology Bhopal': 'MANIT Bhopal', 'Dr. B R Ambedkar National Institute of Technology, Jalandhar': 'NIT Jalandhar'}
    # B.Arch and B.Planning use the JEE Main Paper 2 rank lists, not the B.Tech list
    paper2 = lambda prog: bool(re.search(r'architecture|planning', prog, re.I)) and not re.search(r'computer|technology', re.sub(r'\(.*', '', prog), re.I)

    def fit(nm, suffixes):
        """Page title within ~65 characters: search-style abbreviations first, then shorter forms."""
        t = nm
        for a, b in (('Indian Institute of Information Technology', 'IIIT'), ('National Institute of Technology', 'NIT'), ('Indian Institute of Technology', 'IIT')): t = re.sub(a + r',?(?:\s*\(' + b + r'\))?', b, t, flags=re.I)
        t = AKA.get(nm, t)
        forms = [t]
        m = re.match(r"^.*\b(?:Trust|Society|Sanstha|Sansthan|Mandal|Mandir|Foundation|Pratishthan|Samiti|Sangh|Sangha)(?:['’]s|s['’])?,?\s+(.{18,})$", t)
        t2 = m.group(1) if m and re.search(r'College|Institute|School|University|Academy|Campus|Faculty', m.group(1)) else t
        t2 = t2.replace(' and ', ' & ')
        forms.append(t2)
        t3 = t2
        for a, b in (('College of Engineering', 'COE'), ('Institute of Technology', 'Inst. of Tech.'), ('Engineering', 'Engg'), ('Technology', 'Tech'), ('Management', 'Mgmt'), ('Institute', 'Inst.'), ('University', 'Univ.'), ('Research', 'Res.')): t3 = t3.replace(a, b)
        forms.append(t3)
        forms.append(re.sub(r'\s*\([^)]*\)', '', t3))
        parts = [x.strip() for x in re.split(r',|-(?=[A-Z])', forms[-1]) if x.strip()]
        if len(parts) > 2: forms.append(f'{parts[0]}, {parts[-1]}')
        forms.append(parts[0] if parts else t3)
        for f in forms:
            for sx in suffixes:
                c = f'{f} {sx}'
                if len(c) <= 65 and c not in titles: titles.add(c); return c
        tail = (re.findall(r'\(([^)]*)\)', t) or parts[-1:] or [''])[-1][:22]
        room = 65 - len(suffixes[-1]) - len(tail) - 3
        c = f"{forms[-1][:room].rsplit(' ', 1)[0].rstrip(' ,-&')}, {tail} {suffixes[-1]}"
        k = 2
        while c in titles: c = f'{c.rsplit(" #", 1)[0]} #{k}'; k += 1
        titles.add(c)
        return c

    def emit(folder, slug, title, desc, og, trail, inner, src, index=True, prio=0):
        path = f'/{folder}/' + (slug or '')
        f = f'{folder}/{slug or "index"}.html'
        if len(desc) > 160: desc = desc[:157].rsplit(' ', 1)[0].rstrip(',;:') + '...'
        body = '\n'.join(inner) + METHOD.format(src=src)
        if not dry and path in g.RELEASED:
            g.write(f, g.page(title, desc, path, og, trail, body, robots='index' if index else 'noindex, follow'))
            kept.setdefault(folder, set()).add(os.path.basename(f))
        out.append((path, f, index, prio))
        return path

    def unique(slug, used, extra):
        if not slug or slug in used: slug = f'{slug}-{extra}'.strip('-')
        used.add(slug)
        return slug

    link = lambda href, text: f'<a href="{href}">{esc(text)}</a>'
    ul = lambda items: '<ul class="seo-links">' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>'
    home = ('Home', BASE + '/')
    NOTE = f'There are no {NEXT} cutoffs yet. These are {DATA} cutoffs, the latest published, for students applying in {NEXT}.'
    rank = lambda v: num(int(v)) if str(v).isdigit() else (clean(v) or '–')
    raw = lambda v: clean(v).replace(',', '')

    # ═════════ MHT-CET: one page per college ═════════
    SRC = f'Source: State CET Cell MHT-CET CAP {DATA} cutoff lists (Stage I) and {DATA} seat matrix.'
    open_rows = lambda code: sorted(((c, e) for c, e in g.by_inst[code] if g.open_cat(e)), key=lambda x: -max(v[0] for v in x[1]['cats'][g.open_cat(x[1])].values()))

    dse = {}
    for n in (1, 2):
        for r in load(f'DSE {DATA}/DSE_CAP_{n}_{DATA}_cutoffs.json'):
            if r['Stage'] == 'Stage-I':
                dse.setdefault(r['Institute Code'].zfill(5), {}).setdefault(r['Choice Code'], (clean(r['Branch']), {}))[1].setdefault(r['Seat Type'], {}).setdefault(n, (float(r['Percentile']), g.to_int(r['Rank'])))

    def cat_label(cat):
        cat, _, moved = cat.partition(' ')
        if moved: return f'{cat_label(cat)} ({moved})'
        if cat in ('EWS', 'TFWS', 'ORPHAN', 'MI'): return cat
        m = re.match(r'([GL])(.+?)([SHO])$', cat)
        if not m or m.group(2) not in g.CAT: return cat
        return f"{g.CAT[m.group(2)]} · {'General' if m.group(1) == 'G' else 'Ladies'} · {dict(S='State', H='Home univ.', O='Other univ.')[m.group(3)]}"

    REGION = {'1': 'Amravati', '2': 'Chhatrapati Sambhajinagar', '3': 'Mumbai', '4': 'Nagpur', '5': 'Nashik', '6': 'Pune'}
    region_of = lambda code: REGION.get(code.lstrip('0')[1] if len(code.lstrip('0')) == 5 else code.lstrip('0')[0], 'Other')
    order = {c: i for i, c in enumerate(g.top)}
    n_ranked = sum(1 for c in g.top if open_rows(c) and any(g.open_val(e) for _, e in open_rows(c)))
    hub_trail = [home, ('Colleges', BASE + '/colleges/')]
    for code in g.top:
        nm, facts = g.name_of(code), g.inst[code]
        es = open_rows(code)
        trail = hub_trail + [(nm, f'{BASE}/colleges/{g.slug_of[code]}')]
        inner = [f'<h1>{esc(nm)}: MHT-CET Cutoff for {NEXT} Admission</h1>']
        if es and g.open_val(es[0][1]):
            b0, v0 = es[0][1], g.open_val(es[0][1])
            inner.append(f'<p>In CAP Round 1 {DATA}, {esc(nm)} closed highest for {esc(b0["branch"])}, at {pct(v0[0])} percentile (merit rank {num(v0[1])}). {NOTE}</p>')
            desc = f'{nm} cutoff for MHT-CET {NEXT}: CAP {DATA} closing percentiles for every branch and category. {b0["branch"]} closed at {pct(v0[0])}.'
        else:
            inner.append(f'<p>{NOTE}</p>')
            desc = f'{nm} cutoff for MHT-CET {NEXT} admission: CAP {DATA} closing percentiles by branch and category, with seats.'
        inner.append(f'<p>CAP institute code: <strong>{code}</strong>. Type: {esc(facts["status"])}. Home university: {esc(facts["uni"])}. Region: {esc(region_of(code))}.' + (f' Name in CAP lists: {esc(facts["name"])}.' if facts['name'] != nm else '') + '</p>')
        if code in g.package: inner.append(f'<p>Average package listed by College Simplified: <strong>{esc(g.package[code])} LPA</strong>. Check the latest placement report with the college.</p>')
        if es:
            rows = []
            for c, e in es:
                cat = g.open_cat(e)
                rows.append([e['branch'], cat] + [(f'{pct(e["cats"][cat][r][0])} ({num(e["cats"][cat][r][1])})' if r in e['cats'][cat] else '–') for r in (1, 2, 3, 4)])
            inner += [f'<h2>Open-category cutoff by branch, CAP {DATA} Rounds 1 to 4</h2><p>Closing percentile with merit rank in brackets. A dash means no open-category entry for that round.</p>',
                      table(f'{nm}: MHT-CET CAP {DATA} open-category cutoffs', ['Branch', 'Seat type', 'Round 1', 'Round 2', 'Round 3', 'Round 4'], rows)]
        allb = sorted(g.by_inst[code], key=lambda x: -max((v[0] for c in x[1]['cats'].values() for v in c.values()), default=0))
        inner.append('<h2>Category-wise cutoff for every branch</h2><p>OBC, SC, ST, SEBC, EWS, NT, TFWS and ladies seats. Open a branch to see each round.</p>')
        for c, e in allb:
            rows = [[cat_label(k)] + [(f'{pct(v[r][0])} ({num(v[r][1])})' if r in v else '–') for r in (1, 2, 3, 4)] for k, v in sorted(e['cats'].items(), key=lambda kv: -max(x[0] for x in kv[1].values()))]
            inner.append(f'<details class="seo-d"><summary>{esc(e["branch"])} (choice code {esc(c)})</summary>' + table(f'{e["branch"]}: CAP {DATA} closing percentile (merit rank)', ['Category', 'Round 1', 'Round 2', 'Round 3', 'Round 4'], rows) + '</details>')
        if code in g.ai:
            ar = sorted(g.ai[code].values(), key=lambda x: min(v[0] for v in x[1].values()))
            inner += ['<h2>JEE Main All India cutoff</h2>', table(f'{nm}: All India seats, CAP {DATA} (JEE Main percentile, All India merit in brackets)', ['Branch', 'Round 1', 'Round 2', 'Round 3', 'Round 4'],
                      [[br] + [(f'{pct(v[r][1])} ({num(v[r][0])})' if r in v else '–') for r in (1, 2, 3, 4)] for br, v in ar])]
        if code in dse:
            dr = sorted(((b, s['GOPEN']) for b, s in dse[code].values() if 'GOPEN' in s), key=lambda x: -max(v[0] for v in x[1].values()))
            if dr: inner += ['<h2>Direct Second Year (DSE) cutoff</h2>', table(f'{nm}: DSE CAP {DATA}, open category (percentile, merit rank in brackets)', ['Branch', 'Round 1', 'Round 2'], [[b] + [(f'{pct(v[r][0])} ({num(v[r][1])})' if r in v else '–') for r in (1, 2)] for b, v in dr])]
        if code in g.seats:
            inner += [f'<h2>Seats, {DATA}</h2>', table(f'{nm}: seat matrix, MHT-CET {DATA}', ['Branch', 'Sanctioned intake', 'CAP seats', 'All India seats', 'TFWS seats'], sorted(g.seats[code].values()))]
        i = order[code]
        inner.append(reviews.mhtcet(g, code, nm, region_of(code), i + 1, max(n_ranked, i + 1), code in dse, link))
        near = [c for c in g.top[max(0, i - 4):i + 5] if c != code]
        inner += ['<h2>Colleges with similar cutoffs</h2>' + ul(g.college_link(c) for c in near),
                  '<h2>Next steps</h2>' + ul([link('/mht_cet_college_predictor', f'MHT-CET {NEXT} college predictor'), link('/mht-cet-cutoff/', f'MHT-CET cutoffs by branch and region'), link('/counselling-2027/mht-cet', f'MHT-CET counselling {NEXT} guide'), link('/compare_colleges', 'Compare two colleges')]
                  + ([f'<a href="{esc(g.site[code])}" rel="noopener" target="_blank">Official website</a>'] if code in g.site else []))]
        n_rows = len(es)
        emit('colleges', g.slug_of[code], fit(nm, [f'Cutoff for MHT-CET {NEXT}', f'MHT-CET Cutoff {NEXT}', f'Cutoff {NEXT}']), desc, 'mht-cet', trail, inner, SRC, index=sum(len(e['cats']) for _, e in g.by_inst[code]) >= 6, prio=i)

    by_region = {}
    for c in g.top: by_region.setdefault(region_of(c), []).append(c)
    inner = [f'<h1>MHT-CET Cutoff for {NEXT} Admission: All Colleges</h1>', f'<p>CAP {DATA} cutoffs for Maharashtra engineering colleges, by region. More college pages are added daily. Each page lists every branch, category and round, with JEE Main seats, DSE cutoffs and intake where available. {NOTE}</p>']
    for reg, cs in sorted(by_region.items()): inner.append(f'<h2>{esc(reg)} region ({len(cs)})</h2>' + ul(g.college_link(c) for c in cs))
    emit('colleges', '', f'MHT-CET Cutoff {NEXT}: All Engineering Colleges', f'MHT-CET cutoffs for {NEXT} admission at Maharashtra engineering colleges: CAP {DATA} Rounds 1 to 4 by branch and category, seats and JEE Main cutoffs.', 'mht-cet', hub_trail, inner, SRC)

    # ═════════ MHT-CET: by branch, region and percentile ═════════
    BR = [('computer-engineering', 'Computer Engineering & CSE', r'computer (engineering|science and engineering|science & engineering|science|technology|engg)( \(.*regional.*\))?$'),
          ('information-technology', 'Information Technology', r'information technology'),
          ('artificial-intelligence-data-science', 'AI & Data Science', r'(artificial intelligence.*data science|computer science.*data science|data science|data engineering)'),
          ('artificial-intelligence-machine-learning', 'AI & Machine Learning', r'(artificial intelligence and machine|artificial intelligence$|computer science.*(artificial intelligence|machine learning))'),
          ('cyber-security-iot', 'Cyber Security & IoT', r'.*(cyber|internet of things|\biot\b|block chain)'),
          ('electronics-telecommunication', 'Electronics & Telecommunication', r'electronics and (telecommunication|communication)'),
          ('electronics-computer', 'Electronics & Computer', r'electronics and computer'),
          ('electrical-engineering', 'Electrical Engineering', r'electrical'),
          ('mechanical-engineering', 'Mechanical Engineering', r'mechanical'),
          ('civil-engineering', 'Civil Engineering', r'civil'),
          ('chemical-engineering', 'Chemical Engineering', r'chemical'),
          ('instrumentation-engineering', 'Instrumentation Engineering', r'instrumentation'),
          ('robotics-automation-mechatronics', 'Robotics, Automation & Mechatronics', r'(robotics|automation|mechatronics)'),
          ('food-biotechnology', 'Food Technology & Biotechnology', r'(food|bio)')]
    ct = [home, ('MHT-CET cutoff', BASE + '/mht-cet-cutoff/')]
    SRC2 = f'Source: State CET Cell MHT-CET CAP {DATA} cutoff lists, Stage I.'
    blist = []
    for slug, label, rx in BR:
        rows = []
        for (code, choice), e in g.cet.items():
            cat = g.open_cat(e)
            if cat and re.match(rx, e['branch'], re.I):
                v = e['cats'][cat]
                rows.append((max(x[0] for x in v.values()), [g.college_link(code), e['branch'], cat] + [pct(v[r][0]) if r in v else '–' for r in (1, 2, 3, 4)], g.name_of(code), v))
        rows.sort(key=lambda r: -r[0])
        if len(rows) < 8: continue
        t, z = rows[0], rows[len(rows) // 2]
        inner = [f'<h1>{esc(label)} Cutoff: MHT-CET {NEXT}</h1>', f'<p>The highest open-category cutoff in CAP {DATA} was {pct(t[0])} percentile at {esc(t[2])}. Half of the {len(rows)} listed choices closed at or above {pct(z[0])} at their highest round. {NOTE}</p>',
                 table(f'{label}: MHT-CET CAP {DATA} open-category closing percentile, all colleges', ['College', 'Branch', 'Seat type', 'Round 1', 'Round 2', 'Round 3', 'Round 4'], [r[1] for r in rows]),
                 '<p>For OBC, SC, ST, SEBC, EWS, NT and ladies cutoffs, open the college.</p>']
        p = emit('mht-cet-cutoff', slug, f'{label} Cutoff MHT-CET {NEXT}', f'{label} cutoff for MHT-CET {NEXT}: CAP {DATA} closing percentiles at {len(rows)} college choices in Maharashtra, Rounds 1 to 4.', 'mht-cet', ct + [(label, f'{BASE}/mht-cet-cutoff/{slug}')], inner, SRC2)
        blist.append((p, f'{label} cutoff', len(rows)))
    rlist = []
    groups = [('Computer / IT', g.is_cs), ('E&TC', lambda b: bool(re.match(r'electronics and (tele|comm)', b, re.I))), ('Mechanical', lambda b: b.lower().startswith('mechanical')), ('Civil', lambda b: b.lower().startswith('civil'))]
    for reg, cs in sorted(by_region.items()):
        if len(cs) < 5: continue
        rows = []
        for c in cs:
            cells = []
            for _, fn in groups:
                best = max((g.open_val(e)[0] for _, e in g.by_inst[c] if fn(e['branch']) and g.open_val(e)), default=None)
                cells.append(pct(best) if best else '–')
            rows.append([g.college_link(c), c] + cells)
        slug = g.slugify(reg) + '-region'
        p = emit('mht-cet-cutoff', slug, f'{reg} Engineering College Cutoffs, MHT-CET {NEXT}', f'MHT-CET {NEXT}: engineering colleges in {reg} region with CAP {DATA} Round 1 open-category cutoffs for Computer, E&TC, Mechanical and Civil.', 'mht-cet', ct + [(f'{reg} region', f'{BASE}/mht-cet-cutoff/{slug}')],
                 [f'<h1>Engineering Colleges in {esc(reg)} Region: MHT-CET {NEXT} Cutoff</h1>', f'<p>{len(cs)} colleges, ordered by open-category cutoff. The highest Round 1 open-category percentile is shown for each branch group. {NOTE}</p>', table(f'{reg} region: CAP Round 1 {DATA} open-category percentile', ['College', 'CAP code'] + [n for n, _ in groups], rows)], SRC2)
        rlist.append((p, f'{reg} region', len(cs)))
    ranks = {float(r['Percentile']): r for r in load('MHT CET percentile vs rank.json')}
    plist = []
    for p in (99, 98, 97, 96, 95, 92, 90, 85, 80, 75, 70, 60, 50):
        inner = [f'<h1>Colleges for {p} Percentile in MHT-CET {NEXT}</h1>']
        rr = ranks.get(float(p))
        est = f' Our estimated merit rank for {p} percentile is {num(int(rr["Minimum Rank"]))} to {num(int(rr["Maximum Rank"]))}.' if rr else ''
        def options(cats, n):
            o = []
            for (code, choice), e in g.cet.items():
                for k in cats:
                    v = e['cats'].get(k, {}).get(1)
                    if v:
                        if v[0] <= p: o.append((v[0], [g.college_link(code), e['branch'], k, pct(v[0]), num(v[1])]))
                        break
            o.sort(key=lambda x: -x[0])
            return [r for _, r in o[:n]]
        H = ['College', 'Branch', 'Seat type', f'{DATA} percentile', 'Merit rank']
        inner.append(f'<p>These choices closed at or below {p} percentile in CAP Round 1 {DATA}, highest first.{est} {NOTE}</p>')
        inner.append(table(f'Open category: closest choices at or below {p} percentile', H, options(('GOPENS', 'GOPENH', 'GOPENO'), 40)))
        for lab, cats in (('OBC', ('GOBCS', 'GOBCH', 'GOBCO')), ('SEBC', ('GSEBCS', 'GSEBCH', 'GSEBCO')), ('SC', ('GSCS', 'GSCH', 'GSCO')), ('ST', ('GSTS', 'GSTH', 'GSTO')), ('EWS', ('EWS',)), ('Ladies, open', ('LOPENS', 'LOPENH', 'LOPENO'))):
            rows = options(cats, 12)
            if rows: inner.append(f'<h2>{lab}</h2>' + table(f'{lab}: closest choices at or below {p} percentile', H, rows))
        inner.append('<p>Where a college has several seat types, one is shown: state level first, then home university, then other than home university. ' + link('/mht_cet_college_predictor', 'Use the predictor') + ' for your exact category and university.</p>')
        path = emit('mht-cet-colleges', f'{p}-percentile', f'Colleges for {p} Percentile in MHT-CET {NEXT}', f'Which colleges can you get with {p} percentile in MHT-CET {NEXT}? Choices that closed at or below {p} in CAP {DATA}, for open, OBC, SC, ST, EWS and ladies.', 'mht-cet', [home, ('Colleges by percentile', BASE + '/mht-cet-colleges/'), (f'{p} percentile', f'{BASE}/mht-cet-colleges/{p}-percentile')], inner, SRC2)
        plist.append((path, f'{p} percentile'))
    emit('mht-cet-colleges', '', f'Colleges by Percentile: MHT-CET {NEXT}', f'Pick your MHT-CET percentile to see matching Maharashtra engineering colleges for {NEXT} admission, from CAP {DATA} cutoffs.', 'mht-cet', [home, ('Colleges by percentile', BASE + '/mht-cet-colleges/')],
         [f'<h1>Colleges by Percentile: MHT-CET {NEXT}</h1>', f'<p>Choose the percentile nearest to yours. {NOTE}</p>', ul(link(p, f'Colleges for {l}') for p, l in plist)], SRC2)
    emit('mht-cet-cutoff', '', f'MHT-CET Cutoff {NEXT}: Branch & Region Wise', f'MHT-CET cutoffs for {NEXT} admission by branch, region and college, from CAP {DATA} Rounds 1 to 4.', 'mht-cet', ct,
         [f'<h1>MHT-CET Cutoff {NEXT}: By Branch and Region</h1>', f'<p>{NOTE}</p>', '<h2>By branch</h2>' + ul(link(p, f'{l} ({n} choices)') for p, l, n in blist), '<h2>By region</h2>' + ul(link(p, f'{l} ({n} colleges)') for p, l, n in rlist), '<h2>More</h2>' + ul([link('/colleges/', 'All colleges'), link('/mht-cet-colleges/', 'Colleges by percentile'), link('/percentile_vs_college_predictor', 'JEE Main All India seats')])], SRC2)

    # ═════════ JoSAA / CSAB: one page per institute ═════════
    J = {}
    def add(inst, kind, state, prog, quota, seat, gender, rounds):
        e = J.setdefault(inst, {'kind': kind, 'state': state, 'rows': []})
        e['rows'].append((prog, quota, seat, 'Female-only' if gender.startswith('Female') else 'Gender-neutral', rounds))
    for r in g.J:
        add(clean(r['Institute']), r['Type'], clean(r['State']), clean(r['Academic Program Name']), r['Quota'], r['Seat Type'], r['Gender'], {n: raw(r.get(f'Round {n} - Closing Rank ')) for n in range(1, 6)})
    iit = {}
    for n in range(1, 7):
        for r in load(f'JOSAA/IIT_ROUND_{n}_{DATA}.json'):
            iit.setdefault((clean(r['Institute']), clean(r['Academic Program Name']), r['Quota'], r['Seat Type'], r['Gender']), {})[n] = raw(r['Closing Rank'])
    for (i, p, q, s, gd), rd in iit.items(): add(i, 'IIT', '', p, q, s, gd, rd)
    CS = {}
    for r in load(f'JOSAA/CSAB_CUTOFF_CONSOLIDATED_{DATA}.json'):
        CS.setdefault(clean(r['Institute']), []).append((clean(r['Academic Program Name']), r['Quota'], r['Seat Type'], 'Female-only' if r['Gender'].startswith('Female') else 'Gender-neutral', raw(r['Round 1 - Closing Rank ']), raw(r['Round 2 - Closing Rank ']), clean(r['State']), r['Type']))
    QN = {'HS': 'Home State', 'OS': 'Other State', 'AI': 'All India', 'JK': 'J&K', 'LA': 'Ladakh', 'GO': 'Goa'}
    strip = lambda p: re.sub(r'\s*\((\d) Years, (?:Bachelor of (?:Technology|Engineering))\)$', '', p)
    key = lambda v: int(re.sub(r'\D', '', v) or 10**9)
    jt = [home, ('JoSAA cutoff', BASE + '/josaa-cutoff/')]
    used, jslug = set(), {}
    long_slug = lambda n: re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', n.lower().replace('&', ' and '))).strip('-')[:100].strip('-')
    for inst in sorted(set(J) | set(CS)):
        jslug[inst] = unique(long_slug(inst), used, 'x')
    jl = lambda i: link(f'/josaa-cutoff/{jslug[i]}', i)
    kinds = {}
    CATS = ['OPEN', 'EWS', 'OBC-NCL', 'SC', 'ST']
    num_ = lambda v: int(v) if str(v).isdigit() else None
    jbest = {}  # institute -> best open, gender-neutral final-round rank (B.Tech-type programmes)
    for inst, e in J.items():
        last = 6 if e['kind'] == 'IIT' else 5
        v = sorted(num_(r[4].get(last)) for r in e['rows'] if r[2] == 'OPEN' and r[3] == 'Gender-neutral' and not paper2(r[0]) and num_(r[4].get(last)))
        if v: jbest[inst] = v[min(2, len(v) - 1)]  # third-best seat, so one outlier does not decide the position
    jpos = {}
    for k in {e['kind'] for e in J.values()}:
        ins = sorted((i for i in jbest if J[i]['kind'] == k), key=jbest.get)
        for n, i in enumerate(ins): jpos[i] = (n + 1, len(ins))
    jplace = reviews.josaa_placements(load, {i: (J[i]['kind'] if i in J else CS[i][0][7]) for i in jslug})
    for inst in sorted(jslug):
        e = J.get(inst); kind = e['kind'] if e else CS[inst][0][7]
        kinds.setdefault(kind, []).append(inst)
        src = f'Source: JoSAA {DATA} and CSAB {DATA} closing ranks.'
        inner = [f'<h1>{esc(inst)}: JoSAA Cutoff for {NEXT} Admission</h1>']
        desc = f'{AKA.get(inst, inst)} cutoff for JoSAA {NEXT}: {DATA} closing ranks by branch, category, quota and round.'
        if inst in AKA: inner.append(f'<p>Also known as {esc(AKA[inst])}.</p>')
        n_rows = 0
        if e:
            last = 6 if kind == 'IIT' else 5
            opn = sorted((r for r in e['rows'] if r[2] == 'OPEN' and r[3] == 'Gender-neutral'), key=lambda r: (paper2(r[0]), key(r[4].get(last, ''))))
            n_rows = len(opn)
            lead = next((r for r in opn if r[4].get(last) and not paper2(r[0])), None)
            exam = 'JEE Advanced' if kind == 'IIT' else 'JEE Main'
            if lead:
                inner.append(f'<p>The most competitive open seat in {DATA} was {esc(strip(lead[0]))} ({QN.get(lead[1], lead[1])} quota), closing at {exam} rank {rank(lead[4][last])} in Round {last}. {NOTE}</p>')
            else: inner.append(f'<p>{NOTE}</p>')
            inner += [f'<h2>Open-category closing ranks, Rounds 1 to {last}</h2>', table(f'{inst}: JoSAA {DATA}, OPEN, gender-neutral', ['Branch', 'Quota'] + [f'Round {n}' for n in range(1, last + 1)], [[strip(r[0]), QN.get(r[1], r[1])] + [rank(r[4].get(n, '')) for n in range(1, last + 1)] for r in opn])]
            for title, cats in (('Category-wise closing ranks', CATS), ('PwD closing ranks', [c + ' (PwD)' for c in CATS])):
                m = {}
                for p, q, s, gd, rd in e['rows']:
                    if s in cats and rd.get(last): m.setdefault((p, q, gd), {})[s] = rd[last]
                if m:
                    rows = [[strip(p), QN.get(q, q), gd] + [rank(v.get(c, '')) for c in cats] for (p, q, gd), v in sorted(m.items())]
                    t = table(f'{inst}: JoSAA {DATA} Round {last} closing ranks', ['Branch', 'Quota', 'Seats'] + cats, rows)
                    inner.append(f'<h2>{title}, Round {last}</h2>' + (t if 'PwD' not in title else f'<details class="seo-d"><summary>Show PwD ranks</summary>{t}</details>'))
            inner.append('<p>OPEN ranks are common ranks. Ranks for other categories are category ranks. A “P” marks a preparatory course rank.' + (' Architecture and Planning use separate rank lists.' if any(paper2(r[0]) for r in opn) else '') + '</p>')
        if inst in CS:
            rows = sorted((r for r in CS[inst] if r[2] == 'OPEN' and r[3] == 'Gender-neutral' and 'DASA' not in r[1]), key=lambda r: key(r[5] or r[4]))
            n_rows += len(rows)
            m = {}
            for p, q, s, gd, r1, r2, *_ in CS[inst]:
                if s in CATS and (r2 or r1): m.setdefault((p, q, gd), {})[s] = r2 or r1
            inner.append(f'<h2>CSAB special round cutoff, {DATA}</h2>')
            if rows: inner.append(table(f'{inst}: CSAB {DATA}, OPEN, gender-neutral', ['Branch', 'Quota', 'Round 1', 'Round 2'], [[strip(r[0]), r[1], rank(r[4]), rank(r[5])] for r in rows]))
            if m: inner.append('<details class="seo-d"><summary>CSAB ranks for all categories</summary>' + table(f'{inst}: CSAB {DATA} latest round closing ranks', ['Branch', 'Quota', 'Seats'] + CATS, [[strip(p), q, gd] + [rank(v.get(c, '')) for c in CATS] for (p, q, gd), v in sorted(m.items())]) + '</details>')
        if e:
            p_, n_ = jpos.get(inst, (None, 0))
            csab_n = sum(1 for r in CS.get(inst, []) if r[2] == 'OPEN' and r[3] == 'Gender-neutral' and 'DASA' not in r[1])
            inner.append(reviews.josaa(esc, g.num, inst, kind, e['state'], opn, e['rows'], last, p_, n_, csab_n, jplace.get(inst), AKA.get(inst), paper2, strip))
        inner.append('<h2>Next steps</h2>' + ul([link('/josaa_iit', f'IIT predictor {NEXT}') if kind == 'IIT' else link('/josaa', f'JoSAA {NEXT} college predictor'), link('/josaa-cutoff/', 'All JoSAA institutes'), link('/josaa_rank', 'JEE Main percentile to rank'), link('/counselling-2027/josaa', f'JoSAA counselling {NEXT} guide')]))
        emit('josaa-cutoff', jslug[inst], fit(inst, [f'Cutoff for JoSAA {NEXT}', f'JoSAA Cutoff {NEXT}', f'Cutoff {NEXT}'] if e else [f'CSAB Cutoff {NEXT}']), desc, 'josaa', jt + [(inst, f'{BASE}/josaa-cutoff/{jslug[inst]}')], inner, src, index=n_rows >= 2, prio={'IIT': 0, 'NIT': 1, 'IIIT': 2}.get(kind, 3))
    jb = []
    for slug, label, rx in (('computer-science', 'Computer Science (CSE)', r'computer (science|engineering)'), ('information-technology', 'Information Technology', r'information technology'), ('electronics-communication', 'Electronics & Communication (ECE)', r'electronics (and|&) (communication|telecommunication)'), ('electrical', 'Electrical Engineering', r'electrical'), ('mechanical', 'Mechanical Engineering', r'mechanical'), ('civil', 'Civil Engineering', r'civil'), ('chemical', 'Chemical Engineering', r'chemical'), ('artificial-intelligence-data-science', 'AI & Data Science', r'(artificial intelligence|data science)'), ('mathematics-computing', 'Mathematics & Computing', r'mathematics')):
        for kset, kl, ks in ((('NIT',), 'NIT', 'nit'), (('IIIT',), 'IIIT', 'iiit'), (('IIT',), 'IIT', 'iit')):
            last = 6 if ks == 'iit' else 5
            rows = []
            for inst, e in J.items():
                if e['kind'] in kset:
                    for p, q, s, gd, rd in e['rows']:
                        if s == 'OPEN' and gd == 'Gender-neutral' and rd.get(last) and re.match(rx, p, re.I): rows.append((key(rd[last]), [jl(inst), strip(p), QN.get(q, q), rank(rd.get(1, '')), rank(rd[last])], inst))
            rows.sort(key=lambda r: r[0])
            if len(rows) < 8: continue
            path = emit('josaa-cutoff', f'{ks}-{slug}', f'{kl} {label} Cutoff {NEXT} (JoSAA)', f'{kl} {label} cutoff for JoSAA {NEXT}: {DATA} open-category closing ranks for {len(rows)} seats, Round 1 and final round.', 'josaa', jt + [(f'{kl} {label}', f'{BASE}/josaa-cutoff/{ks}-{slug}')],
                        [f'<h1>{kl} {esc(label)} Cutoff: JoSAA {NEXT}</h1>', f'<p>The lowest closing rank in Round {last} of JoSAA {DATA} was {rows[0][1][4]}, at {esc(rows[0][2])}. {NOTE}</p>', table(f'{kl} {label}: JoSAA {DATA}, OPEN, gender-neutral', ['Institute', 'Branch', 'Quota', 'Round 1', f'Round {last}'], [r[1] for r in rows])], f'Source: JoSAA {DATA} closing ranks.')
            jb.append(link(path, f'{kl} {label}'))
    inner = [f'<h1>JoSAA Cutoff {NEXT}: IIT, NIT, IIIT and GFTI Closing Ranks</h1>', f'<p>Closing ranks for IITs, NITs, IIITs and GFTIs by branch, category, quota and round. {NOTE}</p>', '<h2>By branch</h2>' + ul(jb)]
    for k in ('IIT', 'NIT', 'IIIT', 'GFTI'):
        if kinds.get(k): inner.append(f'<h2>{k}s ({len(kinds[k])})</h2>' + ul(jl(i) for i in kinds[k]))
    rest = [i for k, v in kinds.items() if k not in ('IIT', 'NIT', 'IIIT', 'GFTI') for i in v]
    if rest: inner.append('<h2>Other institutes</h2>' + ul(jl(i) for i in rest))
    emit('josaa-cutoff', '', f'JoSAA Cutoff {NEXT}: IIT, NIT, IIIT, GFTI Ranks', f'JoSAA cutoffs for {NEXT} admission: {DATA} opening-to-final round closing ranks for IITs, NITs, IIITs and GFTIs.', 'josaa', jt, inner, f'Source: JoSAA {DATA} and CSAB {DATA} closing ranks.')

    # ═════════ COMEDK: one page per college ═════════
    CK = {}
    for f, lab in (('COMEDK/COMEDK_GM_CUTOFF.json', 'GM'), ('COMEDK/COMEDK_KKR_CUTOFF.json', 'KKR')):
        for r in load(f):
            v = {n: raw(r[f'Round {n}']) for n in (1, 2, 3, 4)}
            if any(x.isdigit() for x in v.values()): CK.setdefault(clean(str(r['College']).split('\n')[0]), {}).setdefault(clean(r['Branch']).title(), {})[lab] = v
    fees = {}
    for r in load('COMEDK/COMDEK_CLG_DETAILS.json'):
        if clean(r['College Name']): fees.setdefault(clean(r['College Name']), []).append([re.sub(r'^[A-Z]{2,3}-', '', clean(r['Course Code & Course Name']))] + [clean(r[k]) or '–' for k in ('Total Seats', 'GM\nSeats', 'KKR\nSeats', 'Tuition Fee\n₹', 'Total Fee\n₹')])
    norm = lambda n: re.sub(r'[^a-z0-9]', '', n.lower())
    def same(a, b):
        x, y = norm(a), norm(b)
        if x == y: return True
        short, long_ = sorted((x, y), key=len)
        if len(short) > 24 and long_.startswith(short): return True
        return difflib.SequenceMatcher(None, x, y).ratio() > 0.93 and re.findall(r'\d+', x) == re.findall(r'\d+', y)
    for f, c in {'KLE Technological University, Belagavi Campus. Formerly known as KLE Dr. M.S. Sheshgiri College of Engineering and Technology-Udyambag, Belagavi': 'KLE Technological University Formerly called as KLE Dr. M.S. Sheshgiri College of Engineering and Technology-Udyambag, Belagavi',
                 'Karavali Institute of Technology, Mangaluru': 'Karavali Institute of Technology-Kottara, Mangaluru',
                 'Yenepoya Institute of Technology, NH-13, Thodar, Moodbidri, Mangaluru': 'Yenepoya Institute of Technology formerly known as Dr. M V Shetty Institute of Technology-Moodbidri, Mangaluru'}.items():
        if f in fees and c in CK: fees[c] = fees.pop(f)
    for f in list(fees):
        if f not in CK:
            m = [c for c in CK if c not in fees and same(c, f)]
            if len(m) == 1: fees[m[0]] = fees.pop(f)
    kt = [home, ('COMEDK cutoff', BASE + '/comedk-cutoff/')]
    used, ks = set(), {n: None for n in sorted(set(CK) | set(fees))}
    for n in ks: ks[n] = unique(g.slugify(n), used, 'x')
    KNOTE = f'There are no {NEXT} cutoffs yet. These are the latest round-wise ranks in our COMEDK data.'
    KS = 'Source: COMEDK UGET round-wise cutoff and seat lists.'
    thin = []
    kbest = {}
    for nm in ks:
        # each branch by its Round 1 rank (first round it appears otherwise); the third-best branch places the college
        v = sorted(int(x['GM'][r]) for x in CK.get(nm, {}).values() if 'GM' in x for r in [next((r for r in (1, 2, 3, 4) if x['GM'].get(r, '').isdigit()), None)] if r)
        if v: kbest[nm] = v[min(2, len(v) - 1)]
    kpos = {nm: n + 1 for n, nm in enumerate(sorted(kbest, key=kbest.get))}
    for nm in ks:
        br = CK.get(nm, {})
        fmt = lambda v: [rank(v.get(n, '')) if v.get(n, '').isdigit() else '–' for n in (1, 2, 3, 4)]
        inner = [f'<h1>{esc(nm)}: COMEDK Cutoff for {NEXT} Admission</h1>']
        gm = sorted(((b, v['GM']) for b, v in br.items() if 'GM' in v), key=lambda x: min(int(y) for y in x[1].values() if y.isdigit()))
        kk = sorted(((b, v['KKR']) for b, v in br.items() if 'KKR' in v), key=lambda x: min(int(y) for y in x[1].values() if y.isdigit()))
        if gm: inner.append(f'<p>The lowest General Merit closing rank was {rank(str(min(int(y) for y in gm[0][1].values() if y.isdigit())))}, for {esc(gm[0][0])}. {KNOTE}</p>' + '<h2>General Merit (GM) cutoff ranks</h2>' + table(f'{nm}: COMEDK GM closing ranks', ['Branch', 'Round 1', 'Round 2', 'Round 3', 'Round 4'], [[b] + fmt(v) for b, v in gm]))
        else: inner.append(f'<p>{KNOTE}</p>')
        if kk: inner.append('<h2>Kalyana Karnataka (KKR) cutoff ranks</h2>' + table(f'{nm}: COMEDK KKR closing ranks', ['Branch', 'Round 1', 'Round 2', 'Round 3', 'Round 4'], [[b] + fmt(v) for b, v in kk]))
        if nm in fees: inner.append('<h2>Seats and fees</h2>' + table(f'{nm}: COMEDK seats and yearly fees (₹)', ['Branch', 'Total seats', 'GM seats', 'KKR seats', 'Tuition fee', 'Total fee'], fees[nm]))
        inner.append(reviews.comedk(esc, g.num, nm, gm, kk, fees.get(nm, []), kpos.get(nm, 0), len(kpos)))
        inner.append('<h2>Next steps</h2>' + ul([link('/comedk_predictor', f'COMEDK {NEXT} college predictor'), link('/comedk-cutoff/', 'All COMEDK colleges'), link('/counselling-2027/comedk', f'COMEDK counselling {NEXT} guide')]))
        emit('comedk-cutoff', ks[nm], fit(re.sub(r'-(?=\S)', ', ', nm, count=1), [f'COMEDK Cutoff {NEXT}', f'COMEDK {NEXT}']),
             f'{nm}: COMEDK cutoff ranks for {NEXT} admission by branch and round' + (', with seats and fees.' if nm in fees else '.'), 'comedk', kt + [(nm, f'{BASE}/comedk-cutoff/{ks[nm]}')], inner, KS, index=len(gm) + len(fees.get(nm, [])) >= 2, prio=min((int(y) for _, v in gm for y in v.values() if y.isdigit()), default=10**9))
    emit('comedk-cutoff', '', f'COMEDK Cutoff {NEXT}: All Colleges', f'COMEDK UGET cutoff ranks, seats and fees for Karnataka engineering colleges, for {NEXT} admission.', 'comedk', kt,
         [f'<h1>COMEDK Cutoff for {NEXT} Admission: All Colleges</h1>', f'<p>{KNOTE}</p>', ul(link(f'/comedk-cutoff/{s}', n) for n, s in ks.items())], KS)

    # ═════════ Counselling 2027 guides ═════════
    gt = [home, (f'Counselling {NEXT}', f'{BASE}/counselling-2027/')]
    off = lambda u, t: f'<a href="{u}" rel="noopener" target="_blank">{t}</a>'
    G = [
     ('mht-cet', f'MHT-CET Counselling {NEXT}', f'MHT-CET Counselling {NEXT}: Dates, CAP Rounds & Cutoff', 'mht-cet', f'MHT-CET counselling {NEXT} guide: exam dates, CAP process, seat types, {DATA} cutoffs by college and branch, and free tools.',
      [f'<p>MHT-CET counselling is the Centralised Admission Process (CAP) run by the State CET Cell for engineering seats in Maharashtra.</p><h2>MHT-CET {NEXT} exam dates</h2><p>As reported in November 2026 after the CET Cell announcement, PCM runs 16–26 April {NEXT} (first attempt) and 10–15 May {NEXT} (second attempt). CAP dates follow the results and are not out yet. Confirm on {off("https://cetcell.mahacet.org/", "cetcell.mahacet.org")}.</p>',
       '<h2>How CAP works</h2><ol><li>Register and upload documents, then complete verification.</li><li>Check the provisional and final merit lists.</li><li>Submit an option form for each round, best choice first.</li><li>Check your allotment, then accept it or stay in for a later round as the brochure allows.</li><li>Report to the college with original documents.</li></ol>',
       f'<h2>Seat types</h2><p>S means state level, H home university and O other than home university. G is general and L is ladies, so GOPENS is a general open state-level seat. Our CAP {DATA} data has four rounds.</p>'],
      [('/colleges/', 'Cutoffs for all colleges'), ('/mht-cet-cutoff/', 'Cutoffs by branch and region'), ('/mht-cet-colleges/', 'Colleges by percentile'), ('/mht_cet_college_predictor', f'MHT-CET college predictor {NEXT}'), ('/cet_marks', 'Marks vs percentile'), ('/cet_rank', 'Percentile vs rank'), ('/document_checklist', 'Document checklist')]),
     ('josaa', f'JoSAA Counselling {NEXT}', f'JoSAA Counselling {NEXT}: Process & Closing Ranks', 'josaa', f'JoSAA counselling {NEXT} guide: how choice filling, rounds and quotas work, with {DATA} closing ranks for IITs, NITs, IIITs and GFTIs.',
      [f'<p>JoSAA allots seats at IITs on JEE Advanced ranks, and at NITs, IIITs and GFTIs on JEE Main ranks.</p><h2>JoSAA {NEXT} dates</h2><p>The {NEXT} schedule is not out yet. Check {off("https://josaa.nic.in/", "josaa.nic.in")} and, for JEE Main dates, {off("https://jeemain.nta.nic.in/", "jeemain.nta.nic.in")}.</p>',
       '<h2>How JoSAA works</h2><ol><li>Register and fill choices in order of preference.</li><li>Check your seat after each round.</li><li>Choose Freeze (keep the seat), Float (move up to any higher choice) or Slide (move up within the same institute).</li><li>Pay the acceptance fee and finish document verification.</li></ol>',
       f'<h2>Quotas</h2><p>NITs have Home State (HS) and Other State (OS) seats. IITs and IIITs use the All India (AI) quota. Our {DATA} data covers five rounds for NITs, IIITs and GFTIs and six for IITs.</p>'],
      [('/josaa-cutoff/', f'JoSAA cutoff for {NEXT}, all institutes'), ('/josaa', f'JoSAA college predictor {NEXT}'), ('/josaa_iit', f'IIT predictor {NEXT}'), ('/josaa_marks', 'JEE Main marks vs percentile'), ('/josaa_rank', 'JEE Main percentile vs rank'), ('/josaa-preference-builder', 'Choice filling builder')]),
     ('csab', f'CSAB Counselling {NEXT}', f'CSAB Counselling {NEXT}: Special Rounds & Cutoff', 'josaa', f'CSAB counselling {NEXT} guide: how the special rounds fill vacant NIT, IIIT and GFTI seats after JoSAA, with {DATA} closing ranks.',
      [f'<p>CSAB runs special rounds after JoSAA to fill vacant seats at NITs, IIITs and GFTIs. You register separately. The {NEXT} schedule is not out yet; check {off("https://csab.nic.in/", "csab.nic.in")}.</p>', f'<h2>NIT Computer Science in CSAB {DATA}</h2>' + table(f'NIT Computer Science closing ranks, CSAB {DATA} (OPEN, Other State, gender-neutral)', ['Institute', 'Round 1', 'Round 2'], g.csab_rows)],
      [('/csab', f'CSAB college predictor {NEXT}'), ('/josaa-cutoff/', 'JoSAA and CSAB ranks by institute'), ('/csab-landing', 'CSAB tools')]),
     ('comedk', f'COMEDK Counselling {NEXT}', f'COMEDK Counselling {NEXT}: Rounds, Cutoff & Fees', 'comedk', f'COMEDK counselling {NEXT} guide: General Merit and KKR seats, round-wise cutoff ranks, seats and fees at Karnataka engineering colleges.',
      [f'<p>COMEDK UGET counselling fills seats at private engineering colleges in Karnataka. The {NEXT} schedule was not announced when we last checked in November 2026; check {off("https://www.comedk.org/", "comedk.org")}.</p><h2>Seat categories</h2><p>GM (General Merit) seats are open to all candidates. KKR seats are for Kalyana Karnataka region candidates.</p>'],
      [('/comedk-cutoff/', f'COMEDK cutoff, all colleges'), ('/comedk_predictor', f'COMEDK college predictor {NEXT}'), ('/comedk_cutoff', 'Cutoff and fee explorer'), ('/comedk-preference-builder', 'Option form builder')]),
     ('dse', f'DSE Counselling {NEXT}', f'Direct Second Year (DSE) Counselling {NEXT}', 'dse', f'Direct Second Year Engineering counselling {NEXT} guide for diploma students in Maharashtra, with DSE CAP {DATA} cutoffs.',
      [f'<p>Direct Second Year Engineering (DSE) lets diploma holders join the second year of a degree in Maharashtra through CAP. The {NEXT} schedule is not out yet; check {off("https://cetcell.mahacet.org/", "cetcell.mahacet.org")}.</p>', f'<h2>Highest DSE Computer and IT cutoffs, {DATA}</h2>' + table(f'DSE CAP Round 1 {DATA}: Computer and IT (GOPEN)', g.DH, g.dse_rows(r'computer|information tech', 60))],
      [('/dse_college_predictor', f'DSE college predictor {NEXT}'), ('/dse_cutoff_checker', 'DSE cutoff explorer'), ('/colleges/', 'College pages with DSE cutoffs'), ('/dse-landing', 'DSE tools')]),
     ('manipal', f'Manipal MET Counselling {NEXT}', f'Manipal MET Counselling {NEXT}: Cutoff Ranks', 'manipal', f'Manipal MET counselling {NEXT}: latest round-wise cutoff ranks (MET 2025) for Manipal, Bengaluru, Jaipur, Sikkim and Dubai campuses.',
      [f'<p>Manipal allots B.Tech seats on MET ranks over several rounds. Our latest ranks are from MET 2025. Check {off("https://www.manipal.edu/", "manipal.edu")} for {NEXT} dates.</p>'], [('/manipal_cutoff', 'MET cutoff ranks by campus and branch')]),
    ]
    for slug, label, title, og, desc, inner, links in G:
        emit('counselling-2027', slug, title, desc, og, gt + [(label, f'{BASE}/counselling-2027/{slug}')], [f'<h1>{esc(title)}</h1>'] + inner + ['<h2>Cutoffs and tools</h2>' + ul(link(u, t) for u, t in links)], 'Cutoff sources are listed on each data page.')
    emit('counselling-2027', '', f'Engineering Counselling {NEXT}: Guides & Cutoffs', f'Engineering counselling {NEXT}: guides, predictors and cutoffs for MHT-CET, JoSAA, CSAB, COMEDK, DSE and Manipal MET.', 'home', gt,
         [f'<h1>Engineering Counselling {NEXT}</h1>', f'<p>Guides, predictors and cutoff data for students applying to engineering colleges in {NEXT}. Cutoffs are from {DATA} unless a page says otherwise.</p>', '<h2>Guides</h2>' + ul(link(f'/counselling-2027/{s}', l) for s, l, *_ in G),
          '<h2>Cutoff data</h2>' + ul([link('/colleges/', 'MHT-CET cutoffs by college'), link('/mht-cet-cutoff/', 'MHT-CET by branch and region'), link('/mht-cet-colleges/', 'MHT-CET colleges by percentile'), link('/josaa-cutoff/', 'JoSAA and CSAB cutoffs by institute'), link('/comedk-cutoff/', 'COMEDK cutoffs by college'), link('/manipal_cutoff', 'Manipal MET ranks')]),
          '<h2>Predictors</h2>' + ul([link('/mht_cet_college_predictor', f'MHT-CET {NEXT}'), link('/josaa', f'JoSAA {NEXT}'), link('/josaa_iit', f'IIT {NEXT}'), link('/csab', f'CSAB {NEXT}'), link('/comedk_predictor', f'COMEDK {NEXT}'), link('/dse_college_predictor', f'DSE {NEXT}'), link('/ai-counsellor', 'AI counsellor')])], 'Cutoff sources are listed on each data page.')

    if dry: return out
    for folder, names in kept.items():  # remove pages this run no longer makes
        for f in glob.glob(folder + '/*.html'):
            if os.path.basename(f) not in names: os.remove(f)
    return out
