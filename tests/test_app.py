"""End-to-end tests for Job Finder with simulated job data.

    pip install playwright && playwright install chromium
    python3 build.py && python3 tests/test_app.py

The JobTech services are replaced with fixed answers, so the tests run offline and give the same result every time.
Screenshots of the example data are written to docs/screenshots/."""
import asyncio, json, pathlib, sys
from datetime import date, timedelta
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'index.html').as_uri()
SHOTS = ROOT / 'docs' / 'screenshots'
TODAY = date.today()
day = lambda n: (TODAY + timedelta(days=n)).isoformat()

GBG = dict(municipality='Göteborg', municipality_concept_id='mGBG', region='Västra Götalands län', region_concept_id='rVG', country='Sverige', city='Göteborg', coordinates=[11.97, 57.70])
MOL = dict(municipality='Mölndal', municipality_concept_id='mMOL', region='Västra Götalands län', region_concept_id='rVG', country='Sverige', city='Mölndal', coordinates=[12.01, 57.65])
MAL = dict(municipality='Malmö', municipality_concept_id='mMAL', region='Skåne län', region_concept_id='rSK', country='Sverige', city='Malmö', coordinates=[13.0, 55.6])

def ad(id, title, emp, org, where, text, pub=-2, deadline=20, contacts=(), field='Data/IT', duration='Tills vidare'):
    return {"id": id, "headline": title, "webpage_url": f"https://arbetsformedlingen.se/platsbanken/annonser/{id}",
            "employer": {"name": emp, "organization_number": org, "workplace": emp, "url": f"https://{emp.split()[0].lower()}.example"},
            "occupation": {"label": "x"}, "occupation_group": {"concept_id": "g_sw", "label": "x"}, "occupation_field": {"concept_id": "f", "label": field},
            "workplace_address": where, "publication_date": day(pub) + "T08:00:00", "application_deadline": day(deadline) + "T23:59:59",
            "duration": {"label": duration}, "working_hours_type": {"label": "Heltid"}, "experience_required": True,
            "description": {"text": text}, "application_details": {"url": f"https://apply.example/{id}"}, "application_contacts": list(contacts)}

ANNA = {"name": "Anna Svensson", "description": "Enhetschef", "email": "anna.svensson@acme.example", "telephone": "070-111 22 33"}
SW = [ad('101', 'Software Engineer till Acme', 'Acme Robotics AB', '5560000001', GBG, 'Vi söker en software engineer som kan FMEA och kvalitet.', contacts=[ANNA]),
      ad('102', 'Senior Software Engineer', 'Acme Robotics AB', '5560000001', GBG, 'Senior software engineer för plattformen.'),
      ad('103', 'Backend developer', 'Bolt Systems AB', '5560000002', MOL, 'Vi behöver en software engineer med Python.', deadline=2, duration='6 månader eller längre'),
      ad('104', 'Systemutvecklare', 'Bemanningsfirman Rekrytering AB', '5560000003', GBG, 'För vår kunds räkning söker vi en software engineer.')]
FMEA = [SW[0], ad('105', 'Kvalitetsingenjör', 'Cog Industri AB', '5560000004', MOL, 'Riskanalys och kvalitetssäkring i produktionen.', field='Teknik')]
LINKS = [{"id": "l1", "headline": "Fullstack Software Engineer", "brief": "Join us as a software engineer.", "occupation_group": {"concept_id": "g_sw", "label": "x"}, "occupation_field": {"concept_id": "f", "label": "Data/IT"},
          "employer": {"name": "Echo Apps AB"}, "workplace_addresses": [{"municipality": "Mölndal", "municipality_concept_id": "mMOL", "region_concept_id": "rVG", "country": "Sverige"}],
          "publication_date": day(-1) + "T00:00:00", "source_links": [{"label": "thehub.io", "url": "https://thehub.io/jobs/l1"}]},
         {"id": "l2", "headline": "Software engineer", "brief": "Borås office.", "occupation_group": {"concept_id": "g_sw", "label": "x"}, "occupation_field": {"concept_id": "f", "label": "Data/IT"},
          "employer": {"name": "Far Away AB"}, "workplace_addresses": [{"municipality": "Borås", "municipality_concept_id": "mBOR", "region_concept_id": "rVG", "country": "Sverige"}],
          "publication_date": day(-1) + "T00:00:00", "source_links": [{"label": "ledigajobb.se", "url": "https://ledigajobb.se/l2"}]}]
CALLS, STATE = [], {'offline': False}

def ok(body): return dict(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps(body))
async def jobsearch(route):
    q = parse_qs(urlparse(route.request.url).query); CALLS.append(route.request.url)
    if STATE['offline']: return await route.abort()
    term = q.get('q', [''])[0].strip('"').lower()
    if q.get('qfields') == ['location']:
        hits = {'göteborg': [GBG] * 5 + [MOL], 'skåne': [MAL] * 3}.get(term, [])
        return await route.fulfill(**ok({"total": {"value": len(hits)}, "hits": [{"id": f"g{i}", "workplace_address": w} for i, w in enumerate(hits)]}))
    hits = SW if 'software' in term else FMEA if 'fmea' in term else []
    await route.fulfill(**ok({"total": {"value": len(hits)}, "hits": hits}))
async def joblinks(route):
    q = parse_qs(urlparse(route.request.url).query)
    await route.fulfill(**ok({"total": {"value": 2}, "hits": LINKS} if 'software' in q.get('q', [''])[0].lower() else {"total": {"value": 0}, "hits": []}))
async def history(route):
    q = parse_qs(urlparse(route.request.url).query)
    hits = [{"id": f"h{i}", "publication_date": day(-100 - 30 * i) + "T08:00:00", "occupation_group": {"concept_id": "g_sw"}} for i in range(3)] if q.get('employer') == ['5560000001'] else []
    await route.fulfill(**ok({"total": {"value": len(hits)}, "hits": hits}))

passed = []
def check(name, cond, detail=''):
    if not cond: raise AssertionError(f'{name}: {detail}')
    passed.append(name)

async def search(pg):
    await pg.evaluate("document.getElementById('msg').textContent=''")
    await pg.click('#go'); await pg.wait_for_function("document.getElementById('msg').textContent.length > 0", timeout=20000)
    return await pg.locator('#msg').inner_text()

async def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(locale='en-US', viewport={'width': 1280, 'height': 1000}, accept_downloads=True)
        await ctx.route('https://jobsearch.api.jobtechdev.se/**', jobsearch)
        await ctx.route('https://links.api.jobtechdev.se/**', joblinks)
        await ctx.route('https://historical.api.jobtechdev.se/**', history)
        pg = await ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
        await pg.goto(PAGE)

        check('starts empty', 'Start with a search' in await pg.locator('#list').inner_text())
        check('suite navigation sits above the search form', await pg.evaluate("document.getElementById('tab-app').getBoundingClientRect().bottom <= document.getElementById('search').getBoundingClientRect().top"))
        check('three parts in the navigation', await pg.locator('.topbar [role=tab]:visible').all_inner_texts() == ['Find jobs', 'My applications', 'Mentor'])
        await pg.click('[data-act=goto-mentor]')
        check('empty search points to the Mentor', await pg.locator('#tab-mentor').get_attribute('aria-selected') == 'true' and await pg.locator('#view-res').is_hidden()
              and 'Your advice will appear here' in await pg.locator('#mentor').inner_text())
        await pg.click('#tab-res')
        await pg.fill('#place', 'Göteborg')
        for kw in ('software engineer', 'FMEA'): await pg.fill('#kw-input', kw); await pg.press('#kw-input', 'Enter')
        await pg.fill('#ex-input', 'senior'); await pg.press('#ex-input', 'Enter')
        msg = await search(pg)
        check('search message', 'Found 5 matching roles at 5 employers in Göteborg and 25 km around' in msg, msg)
        urls = [u for u in CALLS if 'qfields' not in u]
        check('phrase and distance sent', any('q=%22software%20engineer%22' in u and 'position=57.7000,11.9700&position.radius=25' in u for u in urls), urls)
        names = [x.split('\n')[0] for x in await pg.locator('article.co h2').all_inner_texts()]
        check('excluded word removes the senior ad, other sites inside the area kept, outside dropped', 'Echo Apps' in names and 'Far Away' not in names and len(names) == 5, names)

        acme = pg.locator('article.co', has_text='Acme Robotics'); await acme.locator('button.exp').click(); await pg.wait_for_timeout(300)
        role = acme.locator('article.role').first
        check('keyword tags', await role.locator('.matches .chip').all_inner_texts() == ['software engineer', 'FMEA'])
        check('hiring history', '3 times' in await role.locator('.hist').inner_text())
        check('contact from the ad', 'Anna Svensson' in await acme.locator('.side').inner_text())
        cog = pg.locator('article.co', has_text='Cog Industri'); await cog.locator('button.exp').click()
        check('related-word match marked', await cog.locator('.matches .chip.loose').inner_text() == 'FMEA?')

        await pg.check('#f-all'); check('every keyword filter', await pg.locator('article.co').count() == 1); await pg.uncheck('#f-all')
        await pg.check('#f-direct'); check('hide recruiters filter', await pg.locator('article.co', has_text='Bemanningsfirman').count() == 0); await pg.uncheck('#f-direct')
        await pg.select_option('#emp', 'temp'); check('temporary filter', await pg.locator('article.co').count() == 1); await pg.select_option('#emp', '')

        await role.locator('select[data-role=status]').select_option('Applied')
        acme = pg.locator('article.co', has_text='Acme Robotics')
        await acme.locator('textarea[data-role=note]').fill('Sent CV on Monday'); await pg.wait_for_timeout(600)
        await pg.screenshot(path=str(SHOTS / 'results-en.png'))
        await acme.screenshot(path=str(SHOTS / 'employer-en.png'))
        await pg.click('#tab-app')
        check('applications tab', 'Sent CV on Monday' in await pg.locator('#apps').evaluate("e => [...e.querySelectorAll('textarea')].map(t => t.value).join()"))
        check('search form only on Find jobs', await pg.locator('#search').is_hidden() and await pg.locator('#view-app h1').inner_text() == 'My applications')
        async with pg.expect_download() as dl: await pg.click('#bk-down')
        backup = await (await dl.value).path()
        await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.click('#tab-app')
        await pg.set_input_files('#bk-file', backup); await pg.wait_for_timeout(300)
        check('backup restores', 'Restored 1 tracked role' in await pg.locator('#backup [role=status]').inner_text())
        await pg.click('#tab-res')

        STATE['offline'] = True; await pg.fill('#place', 'Lund')
        check('offline message', "couldn't reach Platsbanken" in await search(pg))
        STATE['offline'] = False
        await pg.fill('#place', 'Atlantis'); check('unknown place message', 'Couldn\'t find "Atlantis"' in await search(pg))
        await pg.fill('#place', 'Skåne län'); await pg.dispatch_event('#place', 'input')
        check('distance off for a county', await pg.locator('#radius').is_disabled())

        await pg.click('.lang button[data-lang=sv]')
        check('Swedish', await pg.locator('#view-res h1').inner_text() == 'Hitta vem som anställer' and await pg.locator('#go').inner_text() == 'Sök'
              and (await pg.locator('#tab-res').inner_text()).startswith('Hitta jobb'))
        await pg.fill('#place', 'Göteborg'); await search(pg)
        await pg.screenshot(path=str(SHOTS / 'results-sv.png'))
        await pg.set_viewport_size({'width': 375, 'height': 900})
        check('no sideways scroll on a phone', await pg.evaluate('document.documentElement.scrollWidth') <= 375)
        check('navigation on the first phone screen', await pg.evaluate("document.getElementById('tab-mentor').getBoundingClientRect().bottom <= 900 && document.getElementById('tab-mentor').getBoundingClientRect().right <= 375"))
        await pg.screenshot(path=str(SHOTS / 'phone-sv.png'))
        check('no script errors', not errors, errors)
        await browser.close()
    print(f'{len(passed)} checks passed')

if __name__ == '__main__':
    try: asyncio.run(main())
    except AssertionError as e: print('FAILED', e); sys.exit(1)
