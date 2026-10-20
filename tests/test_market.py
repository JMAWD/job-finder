"""End-to-end tests for the Market tab and the pop-up after a few rejections.

    python3 build.py && python3 tests/test_market.py

The page reads its ad counts from data/market.json, which market.py fills on the 1st of every month. These tests put a
fixed set of counts in a copy of the built page instead. The IT figures are the real counts for July to September 2026
(6,251 closed and 947 open IT ads against 14,495 a year earlier; 114,236 and 13,922 for all ads against 233,853), so the
expected answer is the real one: IT down about 24% while new postings across Sweden fell about 17%."""
import asyncio, json, pathlib, sys, tempfile
from datetime import date, datetime, timedelta
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from test_app import jobsearch, joblinks, history, check, passed

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / 'docs' / 'screenshots'
IT, HEALTH, MILITARY = 'apaJ_2ja_LuF', 'NYW6_mP6_vwf', 'bH5L_uXD_ZAX'
# "field|county" -> closed ads in the archive, ads still open, the same months a year earlier, all open ads on the 1st
COUNTS = {'on': '2026-10-01', 'window': {'from': '2026-07-01', 'to': '2026-09-30', 'from_prev': '2025-07-01', 'to_prev': '2025-09-30'},
          'n': {'|': [114236, 13922, 233853, 41000], f'{IT}|': [6251, 947, 14495, 2310], '|rVG': [20000, 2500, 40000, 7900], f'{IT}|rVG': [1100, 160, 2600, 410],
                f'{HEALTH}|': [12000, 1800, 19000, 3900], f'{HEALTH}|rVG': [400, 50, 500, 120], f'{MILITARY}|': [30, 5, 60, 12], f'{MILITARY}|rVG': [4, 1, 9, 2],
                f'{MILITARY}|rSK': [150, 20, 290, 40]}}
REGIONS = [['Skåne län', 'rSK'], ['Västra Götalands län', 'rVG'], ['Stockholms län', 'rST']]
tmp = pathlib.Path(tempfile.mkdtemp())

def page_with(counts):
    """A copy of the built page with these counts in place of this month's"""
    lines = (ROOT / 'index.html').read_text(encoding='utf-8').split('\n')
    i = next(i for i, l in enumerate(lines) if l.startswith('const MK = '))
    mk = json.loads(lines[i][len('const MK = '):].rstrip(';'))
    mk['counts'], mk['regions'] = counts, REGIONS if counts else mk['regions']
    lines[i] = 'const MK = ' + json.dumps(mk, ensure_ascii=False) + ';'
    path = tmp / (f'market-{len(list(tmp.iterdir()))}.html')
    path.write_text('\n'.join(lines), encoding='utf-8')
    return path.as_uri()

# The browser must never count market figures itself: they come with the page
MARKET_CALLS = []
def is_count(q): return 'q' not in q and q.get('limit') == ['0']
async def market_search(route):
    if is_count(parse_qs(urlparse(route.request.url).query)): MARKET_CALLS.append(route.request.url)
    await jobsearch(route)
async def market_history(route):
    if is_count(parse_qs(urlparse(route.request.url).query)): MARKET_CALLS.append(route.request.url)
    await history(route)

def snap(title, field='Data/IT', field_id='f'):
    return {"title": title, "company": "Firma AB", "url": f"https://x.example/{title}", "deadline": "", "contacts": [], "field": field, "fieldId": field_id}

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(locale='en-US', viewport={'width': 1280, 'height': 1000})
        await ctx.route('https://jobsearch.api.jobtechdev.se/**', market_search)
        await ctx.route('https://links.api.jobtechdev.se/**', joblinks)
        await ctx.route('https://historical.api.jobtechdev.se/**', market_history)
        pg = await ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
        mkt, verdict = pg.locator('#market'), pg.locator('#market .mk-verdict')
        PAGE = page_with(COUNTS)
        async def pick(sel, value):
            await pg.select_option(sel, value)

        # A search in Göteborg for software engineers: the Market tab picks IT and offers Västra Götaland
        await pg.goto(PAGE)
        await pg.fill('#place', 'Göteborg'); await pg.fill('#kw-input', 'software engineer'); await pg.press('#kw-input', 'Enter')
        await pg.click('#go'); await pg.wait_for_function("document.getElementById('msg').textContent.startsWith('Found')", timeout=20000)
        await pg.click('#tab-market')
        check('market tab sits between My applications and the Mentor', (await pg.locator('.topbar [role=tab]:visible').all_inner_texts())[2:] == ['Market', 'Mentor'])
        check('field picked from the search', await pg.locator('#mk-field').input_value() == IT and 'Picked from your searches' in await pg.locator('#mk-hint').inner_text())
        check('every county that was counted is offered', await pg.locator('#mk-place option').all_inner_texts() == ['All of Sweden', 'Skåne län', 'Stockholms län', 'Västra Götalands län'])
        txt = await verdict.inner_text()
        check('verdict for IT in Sweden', 'A tough market' in txt and 'There were about 24% fewer IT ads in Sweden from July to September 2026 than a year earlier.' in txt, txt)
        check('compared with the market as a whole', "That's weaker than the job market as a whole, where new postings fell 17% in September 2026." in txt, txt)
        tiles = await verdict.locator('.mk-tile').all_inner_texts()
        check('open ads, the change and the share', len(tiles) == 3 and 'OPEN ADS ON 1 OCT 2026' in tiles[0] and '2,310' in tiles[0] and '−24%' in tiles[1] and '5.6%' in tiles[2] and '6.2% a year earlier' in tiles[2], tiles)
        bars = await mkt.locator('.mk-bar').first.locator('xpath=..').locator('.mk-bar').all_inner_texts()
        check('bars: IT against all of Sweden', len(bars) == 2 and bars[0].startswith('IT, all of Sweden') and '−24%' in bars[0] and '−17%' in bars[1], bars)
        txt = await mkt.inner_text()
        check('figures for Sweden from the package', all(x in txt for x in ('65,000', '8.6%', '5,487', '139,600', 'Unemployment by year', 'Redundancy notices each month', "Employers' hiring plans for Q4 2026")), txt[:400])
        check('industry figures for IT', 'More on IT' in txt and 'people work in information and communication' in txt and "hiring outlook for IT and tech is +41 for Q4 2026, against +27" in txt and 'listed Nordic consultancies' in txt)
        main = await mkt.locator('.mk-card', has_text='hiring plans').locator('.mk-bar.main .mk-bar-label').all_inner_texts()
        check('outlook highlights your industry and region', [m.split(' ')[0] for m in main] == ['IT', 'Västra'], main)
        check('sources with dates', 'compiled 19 Oct 2026' in txt and "Platsbanken, through JobTech's open APIs, counted 1 Oct 2026" in txt)
        await pg.hover('#market .mk-chart .mk-hit >> nth=0')
        check('hovering a column shows its value', '6.9%' in await pg.locator('#mk-tip').inner_text() and await pg.locator('#mk-tip').is_visible())
        await pg.focus('#market .mk-chart >> nth=1'); await pg.keyboard.press('End')
        check('arrow keys step through a chart', await pg.locator('#mk-tip').is_visible() and 'Sep 2026' in await pg.locator('#mk-tip').inner_text())
        await pg.click('#market .mk-table summary >> nth=0')
        check('every chart has a table', await mkt.locator('.mk-table').count() == 2 and '2030' in await mkt.locator('.mk-table table').first.inner_text())
        await pg.evaluate('window.scrollTo(0, 0)'); await pg.mouse.move(0, 0); await pg.screenshot(path=str(SHOTS / 'market-en.png'))

        await pick('#mk-place', 'rVG')
        bars = await mkt.locator('.mk-bars').first.locator('.mk-bar').all_inner_texts()
        check('a county: IT there, IT in Sweden, all ads there and in Sweden', len(bars) == 4 and bars[0].startswith('IT, Västra Götalands län') and '−26%' in bars[0] and '−14%' in bars[2], bars)
        tiles = await verdict.locator('.mk-tile').all_inner_texts()
        check("a field in a county is a share of that county's ads", 'SHARE OF JOB ADS IN VÄSTRA GÖTALANDS LÄN' in tiles[2] and '5.6%' in tiles[2] and '6.5% a year earlier' in tiles[2], tiles)
        await pick('#mk-field', MILITARY)
        txt = await verdict.inner_text()
        check('too few ads goes by the nearest wider figure', 'too few Military ads in Västra Götalands län' in txt and 'all job ads in Västra Götalands län' in txt and 'Slower than last year' in txt, txt)
        await pick('#mk-place', ''); await pick('#mk-field', HEALTH)
        txt = await verdict.inner_text()
        check('a growing field', 'Busier than last year' in txt and 'about 10% more Health care ads' in txt and "stronger than the job market" in txt, txt)
        check('no industry card without a match', await mkt.locator('#mk-sec-h').count() == 0)
        await pick('#mk-place', 'rVG')
        txt = await verdict.inner_text()
        check('a small slice is called a rough guide', "That's based on 450 ads, so treat it as a rough guide" in txt, txt)
        await pick('#mk-field', MILITARY); await pick('#mk-place', 'rSK')
        check('170 ads against 290 is too few to compare', 'too few Military ads in Skåne län' in await verdict.inner_text())
        await pick('#mk-place', '')
        await pick('#mk-field', '')
        txt = await verdict.inner_text()
        check('all fields in Sweden is the official figure', 'Arbetsförmedlingen got 17% fewer new job postings in September 2026' in txt and await mkt.locator('.mk-bars').count() == 1, txt)
        await pg.reload()
        check('the choice is kept', await pg.locator('#mk-field').input_value() == '' and await pg.locator('#tab-market').get_attribute('aria-selected') == 'true')

        await pg.click('.lang button[data-lang=sv]'); await pick('#mk-field', IT)
        txt = await verdict.inner_text()
        check('Swedish', 'En tuff marknad' in txt and 'Det kom ungefär 24 % färre annonser inom Data/IT i Sverige under ' in txt and await pg.locator('#tab-market').inner_text() == 'Marknad', txt)
        check('Swedish figures for Sweden', '8,6 %' in await mkt.inner_text() and 'Arbetslöshet per år' in await mkt.inner_text())
        await pg.set_viewport_size({'width': 375, 'height': 900})
        check('market fits a phone', await pg.evaluate('document.documentElement.scrollWidth') <= 375)
        check('navigation still on the first phone screen', await pg.evaluate("document.getElementById('tab-mentor').getBoundingClientRect().right <= 375"))
        await pg.screenshot(path=str(SHOTS / 'market-phone-sv.png'), full_page=True)
        await pg.set_viewport_size({'width': 1280, 'height': 1000}); await pg.click('.lang button[data-lang=en]')

        # Before the first count on the 1st: the figures for Sweden, and a note that the fields aren't in yet
        await pg.goto(page_with(None))
        txt = await verdict.inner_text()
        check('before the first count', "counted on Platsbanken on the 1st of every month and aren't in yet" in txt and 'Arbetsförmedlingen got 17% fewer' in txt
              and '8.6%' in await mkt.inner_text() and await pg.locator('#mk-place').is_disabled() and await mkt.locator('.mk-bars').count() == 1, txt)
        await pg.goto(PAGE)

        # Chart colours: the highlight and the grey both stand out from the card in every theme, light and dark
        def lum(rgb):
            c = [x / 255 for x in rgb]; c = [x / 12.92 if x <= 0.03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
            return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
        ratio = lambda a, b: (max(lum(a), lum(b)) + .05) / (min(lum(a), lum(b)) + .05)
        low = []
        for scheme in ('light', 'dark'):
            await pg.emulate_media(color_scheme=scheme)
            for k in ('seafoam', 'lavender', 'ocean', 'terracotta'):
                await pg.evaluate(f"document.documentElement.dataset.palette = '{k}'")
                v = await pg.evaluate("""() => { const g = el => getComputedStyle(el).backgroundColor, c = document.createElement('canvas').getContext('2d');
                  const px = col => { c.clearRect(0, 0, 1, 1); c.fillStyle = col; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); };
                  return { main: px(g(document.querySelector('#market .mk-bar.main .mk-fill'))), ctx: px(g(document.querySelector('#market .mk-bar:not(.main) .mk-fill'))),
                    card: px(g(document.querySelector('#market .mk-card'))) }; }""")
                if ratio(v['main'], v['card']) < 3: low.append(f"{k} {scheme} highlight {ratio(v['main'], v['card']):.2f}")
                if ratio(v['ctx'], v['card']) < 2: low.append(f"{k} {scheme} grey {ratio(v['ctx'], v['card']):.2f}")
                if ratio(v['main'], v['ctx']) < 2.5: low.append(f"{k} {scheme} highlight vs grey {ratio(v['main'], v['ctx']):.2f}")
        check('chart colours stand out in every theme', not low, low)
        await pg.emulate_media(color_scheme='dark'); await pg.evaluate("document.documentElement.dataset.palette = 'lavender'")
        await pg.emulate_media(color_scheme='light'); await pg.evaluate("delete document.documentElement.dataset.palette")

        # The pop-up: seven applications in IT, rejected one by one in My applications
        await pg.evaluate("""apps => { localStorage.setItem('jf-apps', JSON.stringify(apps)); localStorage.removeItem('jf-nudge'); localStorage.removeItem('jf-market'); }""",
                          {f'a{i}': {"status": "Applied", "note": "", "updatedAt": datetime.now().isoformat(), "snap": snap(f'Role {i}')} for i in range(7)})
        await pg.reload(); await pg.click('#tab-app')
        dlg = pg.locator('#nudge')
        async def reject(i):
            await pg.select_option(f'#apps select[data-ad="a{i}"]', 'Rejected')
        await reject(0); await reject(1); await pg.wait_for_timeout(400)
        check('no pop-up after two rejections', not await dlg.is_visible())
        await reject(2); await pg.wait_for_selector('#nudge[open]', timeout=10000)
        txt = await dlg.inner_text()
        check('pop-up after the third: a tough market, in numbers', "It's a tough market right now" in txt and "You've marked 3 applications as rejected" in txt
              and 'about 24% fewer IT ads in Sweden' in txt and 'Unemployment in Sweden is 8.6%.' in txt and 'even strong candidates hear no more often than usual' in txt, txt)
        check('a hopeful note from the forecast', 'Konjunkturinstitutet expects unemployment to ease to 7.9% in 2027.' in txt, txt)
        check('suggests the Mentor', 'The Mentor reads your CV' in txt and await dlg.locator('[data-ng=mentor]').inner_text() == 'Get ideas from the Mentor'
              and await pg.evaluate("document.activeElement.dataset.ng") == 'mentor')
        await pg.wait_for_timeout(400); await pg.screenshot(path=str(SHOTS / 'nudge-en.png'))
        await dlg.locator('[data-ng=mentor]').click()
        check('opens the Mentor', not await dlg.is_visible() and await pg.locator('#tab-mentor').get_attribute('aria-selected') == 'true')
        await pg.click('#tab-app'); await reject(3); await reject(4); await reject(5); await pg.wait_for_timeout(500)
        check('not again within two weeks', not await dlg.is_visible() and await pg.evaluate("JSON.parse(localStorage.getItem('jf-nudge')).n") == 3)
        await pg.evaluate("v => { const n = JSON.parse(localStorage.getItem('jf-nudge')); n.on = v; localStorage.setItem('jf-nudge', JSON.stringify(n)); }", (date.today() - timedelta(days=15)).isoformat())
        await reject(6); await pg.wait_for_selector('#nudge[open]', timeout=10000)
        check('again after three more and two weeks', "You've marked 7 applications as rejected" in await dlg.inner_text())
        await dlg.locator('[data-ng=market]').click()
        check('see the market for the field', await pg.locator('#tab-market').get_attribute('aria-selected') == 'true' and await pg.locator('#mk-field').input_value() == IT)

        # A field that is doing well gets a different message, in Swedish too
        await pg.click('.lang button[data-lang=sv]')
        await pg.evaluate("""apps => { localStorage.setItem('jf-apps', JSON.stringify(apps)); localStorage.removeItem('jf-nudge'); }""",
                          {f'h{i}': {"status": "Rejected" if i < 2 else "Applied", "note": "", "updatedAt": datetime.now().isoformat(), "snap": snap(f'Sjuksköterska {i}', 'Hälso- och sjukvård', '')} for i in range(3)})
        await pg.reload(); await pg.click('#tab-app'); await pg.select_option('#apps select[data-ad="h2"]', 'Rejected')
        await pg.wait_for_selector('#nudge[open]', timeout=10000)
        txt = await dlg.inner_text()
        check('a growing field: no is normal, in Swedish', 'Avslag hör till varje jobbsökande' in txt and 'ungefär 10 % fler annonser inom Hälso- och sjukvård' in txt
              and 'Arbetsgivarna anställer fortfarande' in txt and 'räknar med' not in txt, txt)
        await pg.keyboard.press('Escape')
        check('Escape closes it', not await dlg.is_visible())
        check('and focus goes back to the role that was changed', await pg.evaluate("document.activeElement.dataset.ad") == 'h2')
        await pg.set_viewport_size({'width': 375, 'height': 800}); await pg.select_option('#apps select[data-ad="h0"]', 'Applied'); await pg.select_option('#apps select[data-ad="h0"]', 'Rejected')
        await pg.wait_for_timeout(300)
        check('rejecting again soon after gives no pop-up', not await dlg.is_visible())

        check('the browser never counts market figures itself', not MARKET_CALLS, MARKET_CALLS)
        check('no script errors', not errors, errors)
        await browser.close()
    print(f'{len(passed)} checks passed')

if __name__ == '__main__':
    try: asyncio.run(main())
    except AssertionError as e: print('FAILED', e); sys.exit(1)
