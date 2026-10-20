"""Builds Job Finder into one self-contained page.

    pip install sweden_labour_data-0.1.0-py3-none-any.whl   # once, for the Market tab
    python3 build.py              # fetches SCB's latest figures, falls back to the package's copies
    python3 build.py --offline    # only the figures that ship with the package, no network

Writes index.html (for GitHub Pages) and "Job Finder.html" (the same page, to download and open as a file).
Fill in config.json first: your name, LinkedIn, GitHub, the repo link and the site address.
tailor_url is the address of the tailoring server (see server/SETUP.md). Leave it empty to build without step 2 and the Mentor.
The Market tab's national figures come from the sweden-labour-data package, the data behind the Labor Market Tracker."""
import json, pathlib, html, re, sys

try:
    import sweden_labour as sl
except ImportError:
    sys.exit('The Market tab needs the sweden-labour-data package. Install it first:\n'
             '    pip install sweden_labour_data-0.1.0-py3-none-any.whl')

here = pathlib.Path(__file__).parent
offline = '--offline' in sys.argv[1:]
cfg = json.loads((here / 'config.json').read_text(encoding='utf-8'))
munis = [l.split('|') for l in (here / 'src' / 'munis.txt').read_text(encoding='utf-8').strip().splitlines()]
# English job titles -> the Swedish words Swedish ads use, as [[english, ...], [swedish, ...]]
titles = [[[w.strip() for w in side.split(',') if w.strip()] for side in l.split('|')]
          for l in (here / 'src' / 'titles.txt').read_text(encoding='utf-8').splitlines() if l.strip() and not l.lstrip().startswith('#')]
assert all(len(x) == 2 and x[0] and x[1] for x in titles), 'every line in titles.txt needs English titles | Swedish words'
about = {k: cfg.get(k, '') for k in ('author', 'linkedin', 'github', 'repo', 'version')}
about['tailor'] = cfg.get('tailor_url', '').strip()


def market_data():
    """The national figures the Market tab shows, trimmed to what it draws. Each keeps the date it was compiled
    and whether a live source failed and the package's own copy was used instead."""
    def last_periods(rows, key, n):
        # The last n periods (months or quarters), for every sector if the rows have one
        periods = sorted({r[key] for r in rows})[-n:]
        return [r for r in rows if r[key] in periods]
    trim = {
        'redundancies': lambda r: last_periods(r, 'month', 25),
        'hiring_plans': lambda r: last_periods(r, 'month', 13),
        'tech_employment': lambda r: last_periods(r, 'quarter', 5),
        'job_openings': lambda r: last_periods(r, 'quarter', 5),
    }
    out = {}
    for did in ('national_now', 'national_yearly', 'hiring_outlook', 'hiring_plans', 'redundancies', 'engineers', 'consulting',
                'tech_employment', 'job_openings'):
        ds = sl.get(did, offline=offline)
        rows = trim.get(did, lambda r: r)(ds.rows)
        out[did] = {'as_of': ds.as_of, 'stale': ds.stale, 'rows': rows}
        if did == 'hiring_outlook':   # the survey quarter is only named in the description, e.g. "outlook for Q4 2026"
            m = re.search(r'\bQ([1-4]) (\d{4})', ds.description)
            out[did]['period'] = f'{m.group(2)} Q{m.group(1)}' if m else ''
        if ds.stale and not offline:
            print(f'  {did}: {ds.note[:140]}')
    return out


market = market_data()
# All 21 occupation fields (yrkesområden) with their JobTech ids, as [Swedish label, id]
fields = sorted([label, cid] for label, cid in sl.jobtech.OCCUPATION_FIELDS.items())

js = (here / 'src' / 'app.js').read_text(encoding='utf-8')
js = js.replace('/*__MUNIS__*/', json.dumps(munis, ensure_ascii=False, separators=(',', ':')), 1)
js = js.replace('/*__TITLES__*/', json.dumps(titles, ensure_ascii=False, separators=(',', ':')), 1)
js = js.replace('/*__ABOUT__*/', json.dumps(about, ensure_ascii=False), 1)
js = js.replace('/*__TAILOR__*/', (here / 'src' / 'tailor.js').read_text(encoding='utf-8'), 1)
js = js.replace('/*__MENTOR__*/', (here / 'src' / 'mentor.js').read_text(encoding='utf-8'), 1)
js = js.replace('/*__MARKET_JS__*/', (here / 'src' / 'market.js').read_text(encoding='utf-8'), 1)
js = js.replace('/*__MARKET__*/', json.dumps(market, ensure_ascii=False, separators=(',', ':')), 1)
js = js.replace('/*__FIELDS__*/', json.dumps(fields, ensure_ascii=False, separators=(',', ':')), 1)

page = (here / 'src' / 'shell.html').read_text(encoding='utf-8')
og = ''
if cfg.get('site_url'):
    url = cfg['site_url'].rstrip('/') + '/'
    desc = 'Free job search for Sweden. Search Platsbanken and other job sites by place and keywords, see who is hiring, and keep track of your applications.'
    og = '\n'.join([
        '<meta property="og:type" content="website">',
        '<meta property="og:title" content="Job Finder">',
        f'<meta property="og:description" content="{html.escape(desc)}">',
        f'<meta property="og:url" content="{html.escape(url)}">',
        f'<meta property="og:image" content="{html.escape(url)}social-card.png">',
        '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="627">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<link rel="canonical" href="{html.escape(url)}">'])
page = page.replace('<!--__OG__-->', og, 1).replace('/*__APP__*/', js, 1)
assert '/*__' not in page and '<!--__' not in page, 'a placeholder was left in the page'

(here / 'index.html').write_text(page, encoding='utf-8')
(here / 'Job Finder.html').write_text(page, encoding='utf-8')
stale = [k for k, v in market.items() if v['stale']]
print(f'index.html and Job Finder.html written ({round(len(page) / 1024)} KB)'
      + (f'. Market figures from the package\'s own copies: {", ".join(stale)}' if stale else ''))
