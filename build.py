"""Builds Job Finder into one self-contained page.

    python3 build.py

Writes index.html (for GitHub Pages) and "Job Finder.html" (the same page, to download and open as a file).
Fill in config.json first: your name, LinkedIn, GitHub, the repo link and the site address.
tailor_url is the address of the tailoring server (see server/SETUP.md). Leave it empty to build without step 2."""
import json, pathlib, html

here = pathlib.Path(__file__).parent
cfg = json.loads((here / 'config.json').read_text(encoding='utf-8'))
munis = [l.split('|') for l in (here / 'src' / 'munis.txt').read_text(encoding='utf-8').strip().splitlines()]
about = {k: cfg.get(k, '') for k in ('author', 'linkedin', 'github', 'repo', 'version')}
about['tailor'] = cfg.get('tailor_url', '').strip()

js = (here / 'src' / 'app.js').read_text(encoding='utf-8')
js = js.replace('/*__MUNIS__*/', json.dumps(munis, ensure_ascii=False, separators=(',', ':')), 1)
js = js.replace('/*__ABOUT__*/', json.dumps(about, ensure_ascii=False), 1)
js = js.replace('/*__TAILOR__*/', (here / 'src' / 'tailor.js').read_text(encoding='utf-8'), 1)

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
print(f'index.html and Job Finder.html written ({round(len(page) / 1024)} KB)')
