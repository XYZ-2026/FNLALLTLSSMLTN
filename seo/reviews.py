"""Data-driven college reviews for the generated college pages.

Every statement is computed from the cutoff, seat, fee and placement files the page already uses.
Nothing here is a student opinion, and the section says so. No Review/AggregateRating markup:
Google treats ratings a site gives to the entities it lists as self-serving.
"""
import html, json, re
from statistics import median

NEXT, DATA = 2027, 2026


def _tier(pos, n, sing, plur):
    """Position (1 = most competitive) among n colleges -> (label, noun phrase)."""
    f = pos / max(n, 1)
    if f <= .05: return 'Very high demand', f'one of the most sought-after {plur}'
    if f <= .15: return 'High demand', f'a highly sought-after {sing}'
    if f <= .35: return 'Above-average demand', f'an above-average {sing} by demand'
    if f <= .65: return 'Moderate demand', f'a mid-range {sing}'
    return 'Easier admission', f'one of the easier {plur} to get into'


def _top(pos, n):
    p = max(1, round(100 * pos / max(n, 1)))
    return f'top {p}%' if p <= 50 else f'bottom {101 - p}%'


def _ul(items): return '<ul>' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>'


def render(esc, title, verdict, label, pros, cons, who, tips, faqs, basis):
    """One review block plus FAQPage JSON-LD built from the same question text."""
    h = [f'<section class="seo-review" id="review" aria-labelledby="review-h"><h2 id="review-h">{esc(title)}</h2>',
         f'<p class="seo-verdict"><span class="seo-tag">{esc(label)}</span> {verdict}</p>']
    if pros or cons:
        h.append('<div class="seo-pc">' + (f'<div class="seo-pro"><h3>Strengths</h3>{_ul(pros)}</div>' if pros else '')
                 + (f'<div class="seo-con"><h3>Things to weigh</h3>{_ul(cons)}</div>' if cons else '') + '</div>')
    if who: h.append(f'<h3>Who should apply</h3><p>{who}</p>')
    if tips: h.append(f'<h3>Admission tips</h3>{_ul(tips)}')
    if faqs:
        h.append('<h3>Common questions</h3>' + ''.join(f'<details class="seo-d" open><summary>{esc(q)}</summary><p>{a}</p></details>' for q, a in faqs))
    h.append(f'<p class="seo-src">How this review is written: {basis} It is College Simplified’s analysis, not a student review. Talk to current students and visit the campus before you decide.</p></section>')
    if faqs:
        txt = lambda s: html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s)).strip())
        ld = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': txt(a)}} for q, a in faqs]}
        h.append('<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace('</', '<\\/') + '</script>')
    return ''.join(h)


# ───────────────────────── MHT-CET ─────────────────────────
def mhtcet(g, code, nm, region, pos, n, dse_rows, link):
    esc, pct, num = g.esc, g.pct, g.num
    facts, es = g.inst[code], g.by_inst[code]
    status, uni = facts['status'], facts['uni']
    rows = []  # (branch, cat, {round: (pct, rank)})
    for _, e in es:
        c = g.open_cat(e)
        if c and 1 in e['cats'][c]: rows.append((e['branch'], c, e['cats'][c]))
    rows.sort(key=lambda r: -r[2][1][0])
    label, frag = _tier(pos, n, 'engineering college in Maharashtra', 'engineering colleges in Maharashtra')
    pros, cons, tips, faqs = [], [], [], []

    seats = list(g.seats.get(code, {}).values())
    si = lambda k: sum(int(r[k]) for r in seats if str(r[k]).isdigit())
    intake, ai_seats, tfws = si(1), si(3), si(4)

    if rows:
        hi, lo = rows[0], rows[-1]
        last = lambda v: v[max(v)]
        lo_last = min(rows, key=lambda r: last(r[2])[0])
        cs = [r for r in rows if g.is_cs(r[0])]
        verdict = (f'{esc(nm)} is {frag}. By its open-category CAP {DATA} cutoffs it ranks <strong>#{pos} of {n}</strong> colleges in our data ({_top(pos, n)}). '
                   + (f'Its highest Round 1 cutoff was {pct(hi[2][1][0])} percentile for {esc(hi[0])}' + (f', and its lowest was {pct(lo[2][1][0])} for {esc(lo[0])}.' if len(rows) > 1 else '.')))
    else:
        verdict = f'{esc(nm)} had no open-category Stage I cutoff in CAP {DATA}, so we cannot place it against other colleges. Use the category tables above.'

    # what the college is
    if re.match(r'Government|University Department|University$|University Autonomous', status):
        pros.append(f'{esc(status)} institute: fees are usually much lower than at unaided private colleges.')
    elif 'Aided' in status and 'Un-Aided' not in status:
        pros.append(f'{esc(status)} institute: grant-in-aid seats usually cost less than at unaided colleges.')
    elif 'Un-Aided' in status:
        cons.append('Unaided (private) college: the yearly fee is set by the Fee Regulating Authority and is usually higher than at government colleges. Check the current fee before you lock a choice.')
    if 'Autonomous' in status: pros.append('Autonomous: the college sets its own syllabus and exams, so it can update courses faster than affiliated colleges.')
    m = re.search(r'Minority - (.+)$', status)
    if m: cons.append(f'{esc(m.group(1))} minority institute: part of the intake is kept for that community, so fewer seats are open to everyone else.')

    if rows:
        if pos / n <= .15: pros.append(f'Strong demand: in the {_top(pos, n)} of {n} Maharashtra colleges by cutoff.')
        if cs:
            b = cs[0]
            (pros if b[2][1][0] >= 90 else tips).append(f'{esc(b[0])} closed at {pct(b[2][1][0])} percentile in Round 1' + (f' and {pct(last(b[2])[0])} in Round {max(b[2])}.' if max(b[2]) > 1 else '.'))
        if len(rows) >= 2 and hi[2][1][0] - lo[2][1][0] >= 8:
            cons.append(f'Branch matters a lot here: Round 1 cutoffs ranged {hi[2][1][0] - lo[2][1][0]:.1f} percentile points, from {esc(hi[0])} to {esc(lo[0])}.')
        if len(rows) >= 6: pros.append(f'{len(rows)} branches with open seats, so you have several ways in.')
        drops = [v[1][0] - last(v)[0] for _, _, v in rows if max(v) > 1]
        if len(drops) >= 2:
            d = median(drops)
            if d >= 1.5: tips.append(f'Cutoffs fell in later rounds: the typical branch dropped {d:.1f} percentile points by the last round. If you are a little below the Round 1 cutoff, keep this college in your option form.')
            elif d < .5: tips.append('Seats fill early: cutoffs barely moved after Round 1, so do not count on later rounds here.')

        def gap(a, b):
            out = [e['cats'][a][1][0] - e['cats'][b][1][0] for _, e in es if 1 in e['cats'].get(a, {}) and 1 in e['cats'].get(b, {})]
            return (median(out), len(out)) if out else (None, 0)
        d, k = gap('GOPENO', 'GOPENH')
        if k >= 2 and abs(d) >= .5:
            who_wins = f'Students from {esc(uni)} (home university)' if d > 0 else f'Students from outside {esc(uni)}'
            tips.append(f'{who_wins} had the easier cutoff: home-university and other-university open seats differed by about {abs(d):.1f} percentile points in Round 1. Check the GOPENH and GOPENO rows above.')
        d, k = gap('GOPENS', 'LOPENS')
        if k >= 2 and d >= .5: tips.append(f'Girls: ladies open seats closed about {d:.1f} percentile points lower than general open seats in Round 1.')

    women = bool(rows) and all(r[1].startswith('L') for r in rows)
    if women: pros.append('Women-only college: every seat is a ladies seat, so you compete only with other women candidates.')
    if tfws: pros.append(f'{tfws} tuition fee waiver (TFWS) seats for students with family income up to ₹8 lakh a year.')
    if code in g.ai and ai_seats: pros.append(f'{ai_seats} All India seats: students outside Maharashtra can join on their JEE Main score.')
    if dse_rows: pros.append('Direct Second Year (DSE) seats for diploma holders.')
    if code in g.package: pros.append(f'Average package of {esc(g.package[code])} LPA in figures compiled by College Simplified.')
    else: cons.append('We have no verified placement figures for this college. Ask for the last three years’ placement report, with median salary and the share of students placed.')
    if intake and intake < 300: cons.append(f'Small intake of {intake} seats: fewer seats means a single branch cutoff can move sharply from year to year.')
    elif intake >= 1000: pros.append(f'Large intake of {intake:,} seats across all branches.')

    who = ''
    if rows:
        who = ((f'Open-category women' if women else f'Open-category students') + f' with an MHT-CET percentile of about {pct(last(lo_last[2])[0])} or higher have a realistic chance at some branch here, based on the last CAP {DATA} round. '
               f'For the top branch you need about {pct(hi[2][1][0])} or higher. ' + ('Reserved-category cutoffs are lower; see the category tables above.' if women else 'Reserved-category and ladies cutoffs are lower; see the category tables above.'))

    short = nm
    if rows:
        faqs.append((f'Is {short} a good college?', f'By admission demand, it is {frag}, ranked #{pos} of {n} by CAP {DATA} cutoffs. The CET Cell lists it as {esc(status)}' + (f', under {esc(uni)}.' if 'Universit' in uni else '.')
                     + (f' The average package compiled by College Simplified is {esc(g.package[code])} LPA.' if code in g.package else ' Check its recent placement report before you decide.')))
        faqs.append((f'What MHT-CET percentile is needed for {short}?', f'In CAP {DATA}, open-category cutoffs ran from {pct(hi[2][1][0])} ({esc(hi[0])}, Round 1) down to {pct(last(lo_last[2])[0])} ({esc(lo_last[0])}, Round {max(lo_last[2])}). {NEXT} cutoffs will differ, so treat these as a guide.'))
        if cs:
            b = cs[0]
            faqs.append((f'What is the {short} {b[0]} cutoff?', f'{esc(b[0])} closed at {pct(b[2][1][0])} percentile (merit rank {num(b[2][1][1])}) in CAP {DATA} Round 1' + (f', and at {pct(last(b[2])[0])} in Round {max(b[2])}.' if max(b[2]) > 1 else '.')))
    if code in g.ai and ai_seats:
        jm = sorted(v[1] for br, v in ((br, r[min(r)]) for br, r in g.ai[code].values()))
        faqs.append((f'Can I get into {short} with JEE Main?', f'Yes. It has {ai_seats} All India seats, filled on JEE Main percentile. In CAP {DATA} Round 1 these closed between {pct(jm[0])} and {pct(jm[-1])} percentile, depending on branch.'))
    if tfws: faqs.append((f'Does {short} have TFWS seats?', f'Yes, {tfws} seats in the {DATA} seat matrix. TFWS waives the tuition fee for students with family income up to ₹8 lakh a year. Its cutoffs are usually higher than open seats.'))

    basis = f'we compared {esc(nm)} with {n} Maharashtra colleges using State CET Cell CAP {DATA} cutoffs (Stage I, Rounds 1 to 4) and the {DATA} seat matrix.'
    return render(esc, f'{nm} review: our verdict for {NEXT}', verdict, label, pros, cons, who, tips, faqs, basis)


# ───────────────────────── JoSAA ─────────────────────────
PLACEMENT_ALIAS = {'VNIT Nagpur': 'Visvesvaraya National Institute of Technology, Nagpur', 'MNNIT Allahabad': 'Motilal Nehru National Institute of Technology Allahabad',
                   'SVNIT Surat': 'Sardar Vallabhbhai National Institute of Technology, Surat'}


def josaa_placements(load, insts):
    """Institute name -> placement record, matched by distinctive words; ambiguous names are dropped."""
    stop = set('nit iit iiit gfti national institute of technology indian information and the'.split())
    tok = lambda s: {w for w in re.sub(r'[^a-z ]', ' ', s.lower()).split() if w not in stop and len(w) > 2}
    out = {}
    for f in ('IIT', 'NIT', 'IIIT', 'GFTI'):
        for p in load(f'placement/{f}_PLACEMENTS.json'):
            if p['Institute'] in PLACEMENT_ALIAS:
                m = [PLACEMENT_ALIAS[p['Institute']]]
            else:
                t = tok(p['Institute'])
                m = [i for i, k in insts.items() if k == f and t and t <= tok(i)]
            if len(m) == 1 and m[0] in insts: out[m[0]] = p
    return out


def josaa(esc, num, inst, kind, state, opn, rows, last, pos, n, csab_n, place, aka, paper2, strip):
    exam = 'JEE Advanced' if kind == 'IIT' else 'JEE Main'
    r_ = lambda v: int(v) if str(v).isdigit() else None
    label, frag = _tier(pos, n, kind, kind + 's') if pos else ('Special rounds only', '')
    short = aka or inst
    pros, cons, tips, faqs = [], [], [], []
    good = [(r, r_(r[4].get(last))) for r in opn if not paper2(r[0]) and r_(r[4].get(last))]
    good.sort(key=lambda x: x[1])
    if good:
        (b, br), (z, zr) = good[0], good[-1]
        verdict = (f'{esc(inst)} is {frag} in JoSAA. By its open-category closing ranks across branches it ranks <strong>#{pos} of {n} {kind}s</strong> in our {DATA} data ({_top(pos, n)}). '
                   f'The most competitive seat was {esc(strip(b[0]))} at {exam} rank {num(br)}' + (f'; the least competitive was {esc(strip(z[0]))} at {num(zr)}.' if len(good) > 1 else '.'))
    else:
        verdict = f'{esc(inst)} filled seats in the CSAB special rounds in {DATA}. Use the tables above for each branch.'
    if kind in ('IIT', 'NIT', 'IIIT'): pros.append(f'Centrally funded {kind}: fees are subsidised and the degree is widely recognised by employers and for higher studies.')
    if good and pos / n <= .15: pros.append(f'Strong demand: in the {_top(pos, n)} of {n} {kind}s by closing rank.')
    cs = [x for x in good if re.match(r'computer science', x[0][0], re.I)]
    if cs: (pros if pos / max(n, 1) <= .35 else tips).append(f'Computer Science closed at {exam} rank {num(cs[0][1])} ({esc({"HS": "Home State", "OS": "Other State", "AI": "All India"}.get(cs[0][0][1], cs[0][0][1]))} quota, Round {last}).')
    if len({x[0][0] for x in good}) >= 8: pros.append(f'{len({x[0][0] for x in good})} programmes with open seats, so a wide range of ranks can get in.')
    elif good and len({x[0][0] for x in good}) <= 3: cons.append(f'Only {len({x[0][0] for x in good})} programmes, so there are few fallback branches.')
    if good:
        (cons if zr / max(br, 1) > 8 else tips).append(f'Branch decides the rank you need: closing ranks ran from {num(br)} to {num(zr)}.')
    # home state vs other state
    hs = {r[0]: r_(r[4].get(last)) for r in opn if r[1] == 'HS' and r_(r[4].get(last))}
    os_ = {r[0]: r_(r[4].get(last)) for r in opn if r[1] == 'OS' and r_(r[4].get(last))}
    both = [hs[p] / os_[p] for p in hs if p in os_]
    if len(both) >= 2:
        x = median(both)
        if x >= 1.3: tips.append(f'Home State quota helps a lot: {esc(state) + " " if state else ""}students closed at ranks about {x:.1f}× the Other State ranks for the same branch.')
        elif x <= .77: tips.append(f'Other State quota closed at higher ranks than Home State here (about {1 / x:.1f}× on the same branch), so outside students are not at a disadvantage.')
    fem = [r for r in rows if r[2] == 'OPEN' and r[3] == 'Female-only' and r_(r[4].get(last))]
    if fem:
        gn = {(r[0], r[1]): r_(r[4].get(last)) for r in opn if r_(r[4].get(last))}
        ratio = [r_(r[4][last]) / gn[(r[0], r[1])] for r in fem if (r[0], r[1]) in gn]
        if len(ratio) >= 2 and median(ratio) >= 1.3: tips.append(f'Girls: female-only seats closed at ranks about {median(ratio):.1f}× the gender-neutral ranks.')
    drift = [r_(r[4][last]) / r_(r[4][1]) for r, _ in good if r_(r[4].get(1))]
    if len(drift) >= 3:
        d = median(drift)
        if d >= 1.15: tips.append(f'Ranks rose by about {round(100 * (d - 1))}% from Round 1 to Round {last} for a typical branch, so do not give up after Round 1.')
        elif d < 1.03: tips.append(f'Seats fill in Round 1: closing ranks barely moved by Round {last}.')
    if csab_n: tips.append(f'{csab_n} open-category seat lists were filled again in the CSAB special rounds, which gives a second chance after JoSAA.')
    if place:
        bits = [f'{k.lower()} {esc(place[k])}' for k in ('Avg Package', 'Median Package', 'Highest Package') if place.get(k)]
        if place.get('Placement %'): bits.append(f'{esc(place["Placement %"])} placed')
        pros.append('Placements in figures compiled by College Simplified: ' + ', '.join(bits) + '.')
    else:
        cons.append('We have no verified placement figures for this institute. Check the latest placement report on its website.')
    who = ''
    if good: who = f'Open-category, gender-neutral candidates with a {exam} rank up to about {num(zr)} had a seat here in {DATA}; the top branch needed about {num(br)} or better. Category ranks, female-only seats{", Home State quota" if hs else ""} and PwD ranks are in the tables above.'
    if good:
        faqs.append((f'Is {short} a good college?', f'By admission demand it is {frag}, ranked #{pos} of {n} by {DATA} closing ranks.' + (f' Its compiled average package is {esc(place["Avg Package"])}.' if place and place.get('Avg Package') else '')))
        faqs.append((f'What {exam} rank is needed for {short}?', f'In JoSAA {DATA}, open-category gender-neutral seats closed between rank {num(br)} ({esc(strip(b[0]))}) and {num(zr)} ({esc(strip(z[0]))}) in Round {last}.'))
        if cs: faqs.append((f'What is the {short} CSE cutoff?', f'Computer Science closed at {exam} rank {num(cs[0][1])} for open, gender-neutral seats in Round {last} of JoSAA {DATA}.'))
    if hs and os_: faqs.append((f'Does {short} have a home state quota?', f'Yes. NITs keep Home State (HS) seats for students from {esc(state) or "the state"} and Other State (OS) seats for everyone else, each with its own closing rank.'))
    basis = f'we compared {esc(inst)} with {n} {kind}s using JoSAA {DATA} and CSAB {DATA} closing ranks' + (', plus placement figures compiled by College Simplified.' if place else '.')
    return render(esc, f'{short} review: our verdict for {NEXT}', verdict, label, pros, cons, who, tips, faqs, basis)


# ───────────────────────── COMEDK ─────────────────────────
def comedk(esc, num, nm, gm, kk, fee_rows, pos, n):
    ints = lambda v: [int(x) for x in v.values() if str(x).isdigit()]
    first = lambda v: next((int(v[r]) for r in (1, 2, 3, 4) if str(v.get(r, '')).isdigit()), None)
    rows = sorted(((b, first(v), v) for b, v in gm if ints(v)), key=lambda x: x[1])
    label, frag = _tier(pos, n, 'COMEDK college', 'COMEDK colleges') if rows else ('Limited data', '')
    pros, cons, tips, faqs = [], [], [], []
    if rows:
        b, br, _ = rows[0]
        z, zv = max(((r[0], r[2]) for r in rows), key=lambda x: max(ints(x[1])))
        zr = max(ints(zv))
        verdict = (f'{esc(nm)} is {frag}. By its General Merit closing ranks across branches it ranks <strong>#{pos} of {n}</strong> colleges in our data ({_top(pos, n)}). '
                   f'{esc(b)} had the toughest General Merit cutoff, closing at rank {num(br)} in its first round' + (f', and the easiest branch, {esc(z)}, went up to {num(zr)}.' if len(rows) > 1 else '.'))
        if pos / n <= .15: pros.append(f'Strong demand: in the {_top(pos, n)} of {n} COMEDK colleges by cutoff.')
        cs = [r for r in rows if re.match(r'computer science', r[0], re.I)]
        if cs: (pros if pos / n <= .35 else tips).append(f'{esc(cs[0][0])} closed at General Merit rank {num(cs[0][1])}.')
        if len(rows) >= 8: pros.append(f'{len(rows)} branches with General Merit seats.')
        if len(rows) > 1 and zr / max(br, 1) > 5: cons.append(f'Branch matters a lot: General Merit closing ranks ran from {num(br)} to {num(zr)}.')
        drift = [max(ints(v)) / int(v[1]) for _, _, v in rows if str(v.get(1, '')).isdigit() and int(v[1]) and len(ints(v)) > 1]
        if len(drift) >= 2:
            d = median(drift)
            if d >= 1.2: tips.append(f'Ranks rose by about {round(100 * (d - 1))}% after Round 1 for a typical branch. If you just miss Round 1, keep this college in your options.')
            elif d < 1.05: tips.append('Seats fill early: closing ranks barely moved after Round 1.')
    else:
        verdict = f'We have no General Merit cutoff for {esc(nm)}, so we cannot place it against other COMEDK colleges.'
    if kk: tips.append(f'Kalyana Karnataka (KKR) candidates have separate seats in {len(kk)} branches, with their own cutoffs (table above).')
    fees = [int(re.sub(r'\D', '', r[5])) for r in fee_rows if re.sub(r'\D', '', r[5])]
    seats = sum(int(r[1]) for r in fee_rows if str(r[1]).isdigit())
    if fees:
        lo, hi = min(fees), max(fees)
        span = f'₹{num(lo)}' if lo == hi else f'₹{num(lo)} to ₹{num(hi)}'
        (cons if hi > 300000 else pros).append(f'Total COMEDK fee of {span} a year' + ('' if lo == hi else ', depending on branch') + '. Hostel and other charges are extra.')
    else: cons.append('We do not have this college’s COMEDK fee. Check the fee in the COMEDK seat matrix before choice filling.')
    if seats: (pros if seats >= 300 else cons).append(f'{seats} COMEDK seats across branches' + (', so a single branch cutoff can move sharply from year to year.' if seats < 300 else '.'))
    cons.append('We have no verified placement figures for this college. Ask for the last three years’ placement report, with median salary and the share of students placed.')
    who = f'General Merit candidates with a COMEDK rank up to about {num(zr)} had a seat in at least one branch; the top branch needed about {num(br)} or better.' if rows else ''
    if rows:
        faqs.append((f'Is {nm} a good college?', f'By admission demand it is {frag}, ranked #{pos} of {n} by General Merit closing rank.' + (f' Its total fee is {span} a year.' if fees else '')))
        faqs.append((f'What COMEDK rank is needed for {nm}?', f'General Merit seats closed between rank {num(br)} ({esc(b)}) and {num(zr)} ({esc(z)}) across the rounds in our data.'))
    if fees: faqs.append((f'What is the fee at {nm} through COMEDK?', f'The total fee was {span} a year in our COMEDK seat and fee list, depending on branch.'))
    basis = f'we compared {esc(nm)} with {n} colleges using COMEDK UGET round-wise General Merit and KKR closing ranks and the COMEDK seat and fee list.'
    return render(esc, f'{nm} review: our verdict for {NEXT}', verdict, label, pros, cons, who, tips, faqs, basis)
