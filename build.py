"""Builds Job Finder into one self-contained page.

    python3 build.py

Writes index.html (for GitHub Pages) and "Job Finder.html" (the same page, to download and open as a file).
Fill in config.json first: your name, LinkedIn, GitHub, the repo link and the site address.
tailor_url is the address of the tailoring server (see server/SETUP.md). Leave it empty to build without step 2 and the Mentor.
The Market tab's figures come from data/market.json, which market.py writes on the 1st of every month."""
import json, pathlib, html, sys

here = pathlib.Path(__file__).parent
cfg = json.loads((here / 'config.json').read_text(encoding='utf-8'))
munis = [l.split('|') for l in (here / 'src' / 'munis.txt').read_text(encoding='utf-8').strip().splitlines()]
# English job titles -> the Swedish words Swedish ads use, as [[english, ...], [swedish, ...]]
titles = [[[w.strip() for w in side.split(',') if w.strip()] for side in l.split('|')]
          for l in (here / 'src' / 'titles.txt').read_text(encoding='utf-8').splitlines() if l.strip() and not l.lstrip().startswith('#')]
assert all(len(x) == 2 and x[0] and x[1] for x in titles), 'every line in titles.txt needs English titles | Swedish words'
# The server's fact check uses the same list, so an English title for a Swedish one in the CV isn't flagged as invented
(here / 'server' / 'titles.json').write_text(json.dumps(titles, ensure_ascii=False, indent=0) + '\n', encoding='utf-8')
about = {k: cfg.get(k, '') for k in ('author', 'linkedin', 'github', 'repo', 'version')}
about['tailor'] = cfg.get('tailor_url', '').strip()
# The figures for Sweden, the 21 occupation fields and 21 counties, and this month's ad counts (see market.py)
try:
    market = json.loads((here / 'data' / 'market.json').read_text(encoding='utf-8'))
except FileNotFoundError:
    sys.exit('data/market.json is missing. Run python3 market.py first (pip install requests).')
mk = {**market['datasets'], 'counts': market.get('counts'), 'regions': market.get('regions', [])}

js = (here / 'src' / 'app.js').read_text(encoding='utf-8')
js = js.replace('/*__MUNIS__*/', json.dumps(munis, ensure_ascii=False, separators=(',', ':')), 1)
js = js.replace('/*__TITLES__*/', json.dumps(titles, ensure_ascii=False, separators=(',', ':')), 1)
js = js.replace('/*__ABOUT__*/', json.dumps(about, ensure_ascii=False), 1)
js = js.replace('/*__TAILOR__*/', (here / 'src' / 'tailor.js').read_text(encoding='utf-8'), 1)
js = js.replace('/*__MENTOR__*/', (here / 'src' / 'mentor.js').read_text(encoding='utf-8'), 1)
js = js.replace('/*__MARKET_JS__*/', (here / 'src' / 'market.js').read_text(encoding='utf-8'), 1)
js = js.replace('/*__EVENTS__*/', (here / 'src' / 'events.js').read_text(encoding='utf-8'), 1)
js = js.replace('/*__MARKET__*/', json.dumps(mk, ensure_ascii=False, separators=(',', ':')), 1)
js = js.replace('/*__FIELDS__*/', json.dumps(market['fields'], ensure_ascii=False, separators=(',', ':')), 1)

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
c = market.get('counts')
print(f'index.html and Job Finder.html written ({round(len(page) / 1024)} KB). '
      + (f"Market counts from {c['on']} ({c['window']['from']} to {c['window']['to']})." if c else 'No market counts yet: run python3 market.py.'))
