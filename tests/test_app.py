"""End-to-end tests for Job Finder with simulated job data.

    pip install playwright && playwright install chromium
    python3 build.py && python3 tests/test_app.py

The JobTech services are replaced with fixed answers, so the tests run offline and give the same result every time.
Screenshots of the example data are written to docs/screenshots/."""
import asyncio, json, pathlib, sys
from datetime import date, datetime, timedelta
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
# A new ad that only turns up once STATE['fresh'] is set, published an hour ago, for the welcome-back count
NEW = ad('106', 'Software Engineer, embedded', 'Delta Tech AB', '5560000005', GBG, 'Vi söker en software engineer för inbyggda system.')
NEW['publication_date'] = (datetime.now() - timedelta(hours=1)).isoformat(timespec='seconds')
FMEA = [SW[0], ad('105', 'Kvalitetsingenjör', 'Cog Industri AB', '5560000004', MOL, 'Riskanalys och kvalitetssäkring i produktionen.', field='Teknik')]
LINKS = [{"id": "l1", "headline": "Fullstack Software Engineer", "brief": "Join us as a software engineer.", "occupation_group": {"concept_id": "g_sw", "label": "x"}, "occupation_field": {"concept_id": "f", "label": "Data/IT"},
          "employer": {"name": "Echo Apps AB"}, "workplace_addresses": [{"municipality": "Mölndal", "municipality_concept_id": "mMOL", "region_concept_id": "rVG", "country": "Sverige"}],
          "publication_date": day(-1) + "T00:00:00", "source_links": [{"label": "thehub.io", "url": "https://thehub.io/jobs/l1"}]},
         {"id": "l2", "headline": "Software engineer", "brief": "Borås office.", "occupation_group": {"concept_id": "g_sw", "label": "x"}, "occupation_field": {"concept_id": "f", "label": "Data/IT"},
          "employer": {"name": "Far Away AB"}, "workplace_addresses": [{"municipality": "Borås", "municipality_concept_id": "mBOR", "region_concept_id": "rVG", "country": "Sverige"}],
          "publication_date": day(-1) + "T00:00:00", "source_links": [{"label": "ledigajobb.se", "url": "https://ledigajobb.se/l2"}]}]
# Ads for the keyword tests: one Swedish, one English, and one that only mentions engineering
PL = [ad('201', 'Projektledare, el', 'Nordbygg AB', '5560000011', GBG, 'Vi söker en projektledare till vår engineering-avdelning.', field='Teknik'),
      ad('202', 'Project Leader, Engineering', 'Tyre Works AB', '5560000012', GBG, 'As project leader you will run our engineering projects.', field='Teknik'),
      ad('203', 'Engineering Manager', 'Volt Labs AB', '5560000013', GBG, 'Lead the engineering team.', field='Teknik')]
# How many ads in all of Sweden use each word or phrase, for the check that offers to split a phrase
COUNTS = {'project leader engineering': 0, 'project leader': 11, 'engineering': 1507, 'project': 5000, 'leader': 300, 'leader engineering': 0,
          'quality engineer medtech': 0, 'quality engineer': 40, 'medtech': 20, 'quality': 900, 'engineer medtech': 0}
CALLS, STATE = [], {'offline': False}

def ok(body): return dict(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps(body))
async def jobsearch(route):
    q = parse_qs(urlparse(route.request.url).query); CALLS.append(route.request.url)
    if STATE['offline']: return await route.abort()
    term = q.get('q', [''])[0].strip('"').lower()
    if q.get('qfields') == ['location']:
        hits = {'göteborg': [GBG] * 5 + [MOL], 'skåne': [MAL] * 3}.get(term, [])
        return await route.fulfill(**ok({"total": {"value": len(hits)}, "hits": [{"id": f"g{i}", "workplace_address": w} for i, w in enumerate(hits)]}))
    if q.get('limit') == ['0'] and term in COUNTS: return await route.fulfill(**ok({"total": {"value": COUNTS[term]}, "hits": []}))
    hits = SW + ([NEW] if STATE.get('fresh') else []) if 'software' in term else FMEA if 'fmea' in term else []
    if term in ('project leader', 'projektledare', 'engineering'): hits = [h for h in PL if term in (h['headline'] + ' ' + h['description']['text']).lower()]
    after = q.get('published-after', [''])[0]
    if after.isdigit(): hits = [h for h in hits if datetime.fromisoformat(h['publication_date']) >= datetime.now() - timedelta(minutes=int(after))]
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

# Which element draws the focus ring (the element, or the box around it for keyword chips, colour circles and the Mentor's answers),
# and the contrast of that ring against what's behind it. WCAG asks for 3:1.
RING = """el => {
  const rgb = c => { const m = c.match(/[\\d.]+/g); return m ? m.slice(0, 4).map(Number) : null; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const holder = el.closest('.chips-in') || el.closest('.pal') || (el.matches('.mt-in') ? el.nextElementSibling : null);
  let ringEl = el, s = getComputedStyle(el);
  if (s.outlineStyle === 'none' && holder) { ringEl = holder; s = getComputedStyle(holder); }
  const name = el.tagName + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '');
  if (s.outlineStyle === 'none' || !parseFloat(s.outlineWidth)) return name + ' has no ring';
  let b = ringEl.parentElement, bg = [255, 255, 255];
  while (b) { const c = rgb(getComputedStyle(b).backgroundColor); if (c && (c.length < 4 || c[3] > .9)) { bg = c; break; } b = b.parentElement; }
  const [x, y] = [lum(rgb(s.outlineColor)), lum(bg)].sort((p, q) => q - p), r = (x + .05) / (y + .05);
  return r < 3 ? name + ' ring ' + r.toFixed(2) + ':1' : '';
}"""
async def weak_rings(pg, presses=110):
    weak = []
    await pg.evaluate("document.activeElement && document.activeElement.blur()")
    for _ in range(presses):
        await pg.keyboard.press('Tab')
        r = await pg.evaluate(f"(() => {{ const el = document.activeElement; return !el || el === document.body ? '' : ({RING})(el); }})()")
        if r: weak.append(r)
    return sorted(set(weak))

async def beta_checks(browser, errors):
    """What a beta tester meets when things go wrong: failed searches, old results, feedback, backups. Then phone tabs, focus rings and zoom."""
    ctx = await browser.new_context(locale='en-US', viewport={'width': 1280, 'height': 1000}, accept_downloads=True)
    down = {'links': False, 'hist': True}
    async def links_or_fail(route): return await (route.abort() if down['links'] else joblinks(route))
    async def hist_or_fail(route): return await (route.abort() if down['hist'] else history(route))
    await ctx.route('https://jobsearch.api.jobtechdev.se/**', jobsearch)
    await ctx.route('https://links.api.jobtechdev.se/**', links_or_fail)
    await ctx.route('https://historical.api.jobtechdev.se/**', hist_or_fail)
    pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    await pg.goto(PAGE)

    # The first search fails: the results area says why, with a way to try again and to report it
    await pg.fill('#place', 'Göteborg'); await pg.fill('#kw-input', 'software engineer'); await pg.press('#kw-input', 'Enter')
    STATE['offline'] = True; await search(pg)
    panel = await pg.locator('#list').inner_text()
    check('a failed first search is explained in the results area', "The search didn't go through" in panel and "couldn't reach Platsbanken" in panel and 'Start with a search' not in panel, panel)
    fb = await pg.locator('#list a[data-fb=bug]').get_attribute('href')
    check('with a link to report it on GitHub', fb.startswith('https://github.com/JMAWD/job-finder/issues/new?title=%5BBug%5D%20') and 'Message%20shown' in fb, fb)
    STATE['offline'] = False; down['links'] = True
    await pg.click('#list [data-act=retry]')
    await pg.wait_for_function("document.getElementById('msg').textContent.startsWith('Found')", timeout=20000)
    bar = await pg.locator('#note-bar').inner_text()
    n = await pg.locator('article.co').count(); check('try again runs the search', n > 0, n)
    check('the bar says when the results were last checked', 'Last checked just now.' in bar, bar)
    check('and that other job sites could not be read', "Other job sites couldn't be read in this search, so only Platsbanken's ads are shown." in bar, bar)
    down['links'] = False

    # Hiring history that didn't load can be fetched again
    acme = pg.locator('article.co', has_text='Acme Robotics'); await acme.locator('button.exp').click()
    await pg.wait_for_selector('article.co [data-act=hist-retry]', timeout=15000)
    down['hist'] = False
    await acme.locator('[data-act=hist-retry]').click()
    await pg.wait_for_function("document.querySelector('article.co .facts').textContent.includes('Platsbanken ads in 2 yrs')", timeout=10000)
    check('hiring history: try again after a failure', '3 Platsbanken ads in 2 yrs' in await acme.locator('.facts').inner_text())

    # The first saved job brings a one-time reminder to keep a copy, in its tracker
    role = acme.locator('article.role').first
    await role.locator('select[data-role=status]').select_option('Saved')
    track = await role.locator('.track').inner_text()
    check('the tracker says where it is saved', 'Saved only in this browser' in track, track)
    check('the first saved job asks for a copy', 'Your first saved job. It\'s stored only in this browser' in track, track)
    await role.locator('[data-bk=later]').click()
    check('Not now puts the reminder away', await pg.locator('.bk-prompt').count() == 0 and await pg.evaluate("!!localStorage.getItem('jf-bk-first')")
          and await pg.evaluate("document.activeElement.dataset.ad") == '101')
    await acme.locator('article.role').nth(1).locator('select[data-role=status]').select_option('Saved')
    check('and it does not come back', await pg.locator('.bk-prompt').count() == 0)
    await pg.click('#tab-app')
    check('My applications says where the data lives', 'stored only in this browser on this device' in await pg.locator('#view-app .lede').inner_text())
    check('the backup card stands out when there is no copy', await pg.locator('#backup.warn').count() == 1)
    async with pg.expect_download(): await pg.click('#bk-down')
    check('and calms down after a copy', await pg.locator('#backup.warn').count() == 0 and 'Last copy downloaded' in await pg.locator('#backup').inner_text())
    await pg.locator('#apps select[data-ad="101"]').select_option('Applied')
    check('changes since the copy are counted', '1 change since your last copy.' in await pg.locator('#backup').inner_text(), await pg.locator('#backup').inner_text())
    check('focus follows the role when its status changes', await pg.evaluate("document.activeElement.dataset.ad") == '101')

    # Old results say so and offer a fresh search; a search that fails on top of them keeps them and says why
    await pg.click('#tab-res')
    await pg.evaluate("() => { const r = JSON.parse(localStorage.getItem('jf-results')); r.at = new Date(Date.now() - 3 * 864e5).toISOString(); localStorage.setItem('jf-results', JSON.stringify(r)); }")
    await pg.reload()
    bar = await pg.locator('#note-bar').inner_text()
    check('results three days old say so', 'Last checked 3 days ago.' in bar and 'These results were fetched 3 days ago. Some ads may have closed since' in bar, bar)
    STATE['offline'] = True
    await pg.locator('#note-bar .nb-warn [data-act=refresh]').click()
    await pg.wait_for_function("document.getElementById('msg').classList.contains('err')", timeout=20000)
    bar = await pg.locator('#note-bar').inner_text()
    check('a failed search keeps the earlier results and says so', "The new search didn't go through, so these are the results fetched 3 days ago." in bar and await pg.locator('article.co').count() > 0, bar)
    STATE['offline'] = False
    await pg.locator('#note-bar [data-act=retry]').click()
    await pg.wait_for_function("document.getElementById('msg').textContent.startsWith('Found')", timeout=20000)
    bar = await pg.locator('#note-bar').inner_text()
    check('and try again brings them up to date', 'Last checked just now.' in bar and "didn't go through" not in bar and 'fetched' not in bar, bar)

    # Feedback: one link per kind of problem, with nothing from the person's search in the report
    links = pg.locator('#fb-list a')
    titles = [parse_qs(urlparse(await links.nth(i).get_attribute('href')).query)['title'][0] for i in range(await links.count())]
    check('feedback links for each kind of report', titles == ['[Bug] ', '[Ads] ', '[AI] ', '[Idea] ', '[Other] '], titles)
    await pg.click('#tab-app'); await links.first.focus()
    body = parse_qs(urlparse(await links.first.get_attribute('href')).query)['body'][0]
    check('the report names the version, language and tab, and says it is public', 'Job Finder 1.' in body and 'English · My applications' in body and 'This report is public' in body, body)
    check('and leaves out the search', 'software engineer' not in body and 'Göteborg' not in body, body)
    await pg.click('#tab-res')

    # Phone: every part of the suite fits across the top, labels on one line, in Swedish at 320 px too
    await pg.click('.lang button[data-lang=sv]')
    for w in (320, 375):
        await pg.set_viewport_size({'width': w, 'height': 700})
        fit = await pg.evaluate(f"[...document.querySelectorAll('.tab')].filter(t => !t.hidden).map(t => {{ const r = t.getBoundingClientRect(), s = t.querySelector('.tab-s') || t.querySelector('span[data-t]'); return r.left >= 0 && r.right <= {w} && s.offsetHeight < 20 && s.scrollWidth <= t.clientWidth; }})")
        check(f'all four tabs fit on a {w} px phone', fit == [True] * 4 and await pg.evaluate('document.documentElement.scrollWidth') <= w, fit)
    await pg.set_viewport_size({'width': 1280, 'height': 1000}); await pg.click('.lang button[data-lang=en]')

    # Focus rings: every stop when tabbing through each view has a ring with 3:1 contrast, light and dark
    for scheme in ('light', 'dark'):
        await pg.emulate_media(color_scheme=scheme)
        for view in ('res', 'app', 'market', 'mentor'):
            await pg.click(f'#tab-{view}')
            weak = await weak_rings(pg)
            check(f'focus rings show in {view}, {scheme}', not weak, weak)
    await pg.emulate_media(color_scheme='light')

    # Zoom: 200% and 400% of a 1280 x 720 window, nothing wider than the screen
    for w, h in ((640, 360), (320, 256)):
        await pg.set_viewport_size({'width': w, 'height': h})
        for view in ('res', 'app', 'market', 'mentor'):
            await pg.click(f'#tab-{view}')
            check(f'no sideways scroll in {view} at {1280 // w * 100}% zoom', await pg.evaluate('document.documentElement.scrollWidth') <= w)
    await ctx.close()

async def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(locale='en-US', viewport={'width': 1280, 'height': 1000}, accept_downloads=True)
        await ctx.route('https://jobsearch.api.jobtechdev.se/**', jobsearch)
        await ctx.route('https://links.api.jobtechdev.se/**', joblinks)
        await ctx.route('https://historical.api.jobtechdev.se/**', history)
        # Lets a test set the time of the last visit for the next load. The page saves the visit time when it unloads, so it can't be set before a reload.
        await ctx.add_init_script("const v = sessionStorage.getItem('wb-visit'); if (v) { localStorage.setItem('jf-visit', v); sessionStorage.removeItem('wb-visit'); }")
        pg = await ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
        await pg.goto(PAGE)

        check('starts empty', 'Start with a search' in await pg.locator('#list').inner_text())
        check('suite navigation sits above the search form', await pg.evaluate("document.getElementById('tab-app').getBoundingClientRect().bottom <= document.getElementById('search').getBoundingClientRect().top"))
        check('four parts in the navigation', await pg.locator('.topbar [role=tab]:visible').all_inner_texts() == ['Find jobs', 'My applications', 'Market', 'Mentor'])
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
        applied_at = "JSON.parse(localStorage.getItem('jf-apps'))['101'].appliedAt"
        check('applying records the date', bool(await pg.evaluate(applied_at)))
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
        check('backup keeps the date applied', bool(await pg.evaluate(applied_at)))
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

        # Welcome back: a return visit two days later, with one new ad for the last search and two applications due a follow-up
        wbx, ago = pg.locator('#welcome'), lambda d: (datetime.now() - timedelta(days=d)).isoformat()
        check('no welcome on a first visit or a reload', await wbx.is_hidden())
        await pg.set_viewport_size({'width': 1280, 'height': 1000}); await pg.click('.lang button[data-lang=en]')
        await pg.evaluate("""([ago3, ago15, ago8, closed, open]) => {
          const r = JSON.parse(localStorage.getItem('jf-results')); r.at = ago3; localStorage.setItem('jf-results', JSON.stringify(r));
          const apps = JSON.parse(localStorage.getItem('jf-apps')), snap = (title, company, deadline) => ({ title, company, deadline, url: 'https://x.example/' + title, contacts: [] });
          apps['101'].appliedAt = ago15;
          apps['105'] = { status: 'Applied', note: '', updatedAt: ago8, appliedAt: ago8, snap: snap('Kvalitetsingenjör', 'Cog Industri', closed) };
          apps['102'] = { status: 'Applied', note: '', updatedAt: ago8, appliedAt: ago8, snap: snap('Senior Software Engineer', 'Acme Robotics', open) };
          localStorage.setItem('jf-apps', JSON.stringify(apps));
          sessionStorage.setItem('wb-visit', JSON.stringify(ago3));
        }""", [ago(3), ago(15), ago(8), day(-1), day(10)])
        STATE['fresh'] = True
        await pg.reload()
        counted = lambda word: f"(p => p && !p.textContent.includes('{word}'))(document.querySelector('#welcome .wb-ads p'))"
        await pg.wait_for_function(counted('Checking'), timeout=15000)
        txt = await wbx.inner_text()
        check('welcome back greets a return visit', txt.startswith('Welcome back.'), txt)
        check('welcome back counts new ads since the last search', '1 new ad has come up on Platsbanken since ' in txt and 'for "software engineer" and "FMEA" in Göteborg.' in txt, txt)
        fu = await wbx.locator('.wb-fu li').all_inner_texts()
        check('follow-ups: oldest first, a closed deadline after 7 days, an open one waits for 14', len(fu) == 2 and fu[0].startswith('Software Engineer till Acme')
              and 'applied 15 days ago' in fu[0] and fu[1].startswith('Kvalitetsingenjör') and 'closed' in fu[1], fu)
        mail = await wbx.locator('li[data-ad="101"] a[href^="mailto:"]').get_attribute('href')
        check('follow-up emails the contact named in the ad', mail.startswith('mailto:anna.svensson@acme.example?subject=My%20application%20for%20Software%20Engineer'), mail)
        await pg.screenshot(path=str(SHOTS / 'welcome-en.png'))
        await wbx.locator('li[data-ad="101"] [data-wb=done]').click()
        check('marking a follow-up done', 'Noted.' in await wbx.locator('li[data-ad="101"]').inner_text()
              and await pg.evaluate("(a => a.followedUp === new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10) && a.nudgeAfter > a.followedUp)(JSON.parse(localStorage.getItem('jf-apps'))['101'])"))
        await wbx.locator('[data-wb=show]').click()
        await pg.wait_for_function("document.getElementById('msg').textContent.startsWith('Found')", timeout=20000)
        names = [x.split('\n')[0] for x in await pg.locator('article.co h2').all_inner_texts()]
        check('show the new ones runs the search and lists only the new ad', names == ['Delta Tech'] and await pg.locator('#f-new').is_checked(), names)
        check('my applications shows the follow-up', 'Followed up' in await pg.locator('#apps').inner_text() and 'Applied ' in await pg.locator('#apps').inner_text())
        await pg.reload()
        check('no greeting again on a reload, the one-off filter is gone', await wbx.is_hidden() and not await pg.locator('#f-new').is_checked())

        await pg.click('.lang button[data-lang=sv]')
        await pg.evaluate("v => sessionStorage.setItem('wb-visit', JSON.stringify(v))", ago(1))
        await pg.reload()
        await pg.wait_for_function(counted('Kollar'), timeout=15000)
        txt = await wbx.inner_text()
        check('Swedish welcome, nothing new since the search, followed-up role left out', txt.startswith('Välkommen tillbaka.') and 'Inget nytt i Platsbanken sedan tidigare i dag' in txt
              and 'Dags att höra av dig?' in txt and 'Software Engineer till Acme' not in txt and 'Kvalitetsingenjör' in txt, txt)
        await pg.set_viewport_size({'width': 375, 'height': 900})
        check('welcome card fits a phone', await pg.evaluate('document.documentElement.scrollWidth') <= 375)
        await wbx.locator('li[data-ad="105"] [data-wb=later]').click()
        check('remind me in a week', 'Jag påminner dig om en vecka.' in await wbx.inner_text() and await pg.evaluate("JSON.parse(localStorage.getItem('jf-apps'))['105'].nudgeAfter") == (TODAY + timedelta(days=7)).isoformat())
        await wbx.locator('[data-wb=close]').click()
        check('welcome card closes', await wbx.is_hidden())

        # Colour themes: four split circles in the Find jobs masthead, one choice for every view, kept after a reload
        await pg.set_viewport_size({'width': 1280, 'height': 1000}); await pg.click('#tab-res')
        pal = pg.locator('#palette')
        check('four colour circles, seafoam chosen', await pal.locator('input').count() == 4 and await pal.locator('input:checked').get_attribute('value') == 'seafoam'
              and await pg.evaluate('document.documentElement.dataset.palette') is None)
        check('colour names in Swedish', await pg.locator('#pal-label').text_content() == 'Färger' and await pal.locator('input[value=lavender]').get_attribute('aria-label') == 'Lavendel och persika'
              and await pal.locator('.pal[data-p=ocean]').get_attribute('title') == 'Havsblått och mint')
        bg = "getComputedStyle(document.querySelector('%s')).backgroundColor"
        await pal.locator('.pal[data-p=lavender]').click()
        check('a circle recolours the page at once', await pg.evaluate(bg % '.topbar') == 'rgb(91, 79, 181)' and await pg.evaluate(bg % '#view-res .mast') == 'rgb(91, 79, 181)'
              and await pg.locator('meta[name=theme-color]').get_attribute('content') == '#5b4fb5' and '5b4fb5' in await pg.locator('link[rel=icon]').get_attribute('href'))
        await pg.click('#tab-app'); check('the choice carries to My applications', await pg.evaluate(bg % '#view-app .mast') == 'rgb(91, 79, 181)')
        await pg.reload()
        check('the choice is kept after a reload', await pg.evaluate('document.documentElement.dataset.palette') == 'lavender' and await pg.evaluate(bg % '#view-app .mast') == 'rgb(91, 79, 181)')
        await pg.click('#tab-res'); await pg.focus('#palette input:checked'); await pg.keyboard.press('ArrowRight')
        check('arrow keys move between colours', await pg.evaluate('document.documentElement.dataset.palette') == 'ocean' and await pg.evaluate('localStorage.getItem("jf-palette")') == '"ocean"')

        def lum(h):
            c = [int(h.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
            c = [x / 12.92 if x <= 0.03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
            return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
        ratio = lambda a, b: (max(lum(a), lum(b)) + .05) / (min(lum(a), lum(b)) + .05)
        pairs = [('ink', 'bg'), ('ink', 'surface'), ('muted', 'bg'), ('muted', 'surface'), ('muted', 'sunk'), ('on-accent', 'accent'), ('accent-ink', 'surface'), ('accent-ink', 'accent-soft'),
                 ('tag-fg', 'tag-bg'), ('recruit', 'recruit-soft'), ('warn', 'warn-soft'), ('pivot', 'pivot-soft'), ('signal', 'signal-soft'), ('pop-ink', 'pop'), ('ink', 'mark'), ('bg', 'ink'),
                 ('mast-ink', 'mast-bg'), ('mast-muted', 'mast-bg'), ('mast-accent', 'mast-bg'), ('mast-accent-ink', 'mast-accent'), ('mast-field-ink', 'mast-field'), ('mast-err', 'mast-bg')]
        names = sorted({n for p in pairs for n in p})
        low = []
        for scheme in ('light', 'dark'):
            await pg.emulate_media(color_scheme=scheme)
            for k in ('seafoam', 'lavender', 'ocean', 'terracotta'):
                await pal.locator(f'.pal[data-p={k}]').click()
                v = await pg.evaluate('n => { const s = getComputedStyle(document.documentElement); return Object.fromEntries(n.map(x => [x, s.getPropertyValue("--" + x).trim()])); }', names)
                low += [f'{k} {scheme} {a}/{b} {ratio(v[a], v[b]):.2f}' for a, b in pairs if ratio(v[a], v[b]) < 4.5]
        check('every theme keeps text at 4.5:1 or better, light and dark', not low, low)
        await pg.emulate_media(color_scheme='light'); await pal.locator('.pal[data-p=seafoam]').click()
        check('back to seafoam clears the theme', await pg.evaluate('document.documentElement.dataset.palette') is None and await pg.evaluate(bg % '.topbar') == 'rgb(28, 107, 90)')
        # Keywords: a phrase no ad uses is offered as separate keywords, and English job titles bring the Swedish word along
        await pg.click('.lang button[data-lang=en]'); await pg.fill('#place', 'Göteborg')
        while await pg.locator('#kw-box .tok').count(): await pg.click('#kw-box .tok button')
        toks = "[...document.querySelectorAll('#kw-box .tok')].map(t => t.firstChild.textContent)"
        alts = "[...document.querySelectorAll('#kw-box .tok-alt')].map(t => t.firstChild.textContent)"
        await pg.fill('#kw-input', 'project leader engineering'); await pg.dispatch_event('#kw-input', 'input')
        check('typing several words says they are one phrase', 'searched as one exact phrase' in await pg.locator('#kw-hint').inner_text())
        await pg.press('#kw-input', 'Enter')
        await pg.wait_for_selector('#kw-hint [data-kwh=split]', timeout=10000)
        hint = await pg.locator('#kw-hint').inner_text()
        check('a phrase no ad uses is offered as separate keywords, keeping the real phrase together',
              'No ads in Sweden use the exact phrase "project leader engineering"' in hint and '"project leader" and "engineering"' in hint, hint)
        await pg.click('#kw-hint [data-kwh=split]')
        check('split into two keywords, with the Swedish word for project leader', await pg.evaluate(toks) == ['project leader', 'engineering'] and await pg.evaluate(alts) == ['+ projektledare'],
              [await pg.evaluate(toks), await pg.evaluate(alts)])
        check('splitting turns on ads with every keyword and says so', await pg.locator('#f-all').is_checked() and 'Now searching "project leader" and "engineering" separately' in await pg.locator('#kw-hint').inner_text())
        CALLS.clear(); await search(pg)
        sent = [parse_qs(urlparse(u).query).get('q', [''])[0] for u in CALLS if 'qfields' not in u and 'limit=0' not in u]
        check('the Swedish word is searched as well', {'"project leader"', 'projektledare', 'engineering'} <= set(sent), sent)
        names = [x.split('\n')[0] for x in await pg.locator('article.co h2').all_inner_texts()]
        check('Swedish and English ads that mention both are kept', sorted(names) == ['Nordbygg', 'Tyre Works'], names)
        nb = pg.locator('article.co', has_text='Nordbygg'); await nb.locator('button.exp').click()
        check('the tag shows the word the ad uses', await nb.locator('.matches .chip').all_inner_texts() == ['projektledare', 'engineering'])
        check('the note names the Swedish word', '"project leader" (+ projektledare), "engineering"' in await pg.locator('#note-bar').inner_text())
        await pg.click('#kw-box .tok-alt button')
        check('the Swedish word can be removed', await pg.evaluate(alts) == [] and await pg.evaluate(toks) == ['project leader', 'engineering'])
        CALLS.clear(); await search(pg)
        sent = [parse_qs(urlparse(u).query).get('q', [''])[0] for u in CALLS if 'qfields' not in u and 'limit=0' not in u]
        names = [x.split('\n')[0] for x in await pg.locator('article.co h2').all_inner_texts()]
        check('and then it is not searched', 'projektledare' not in sent and names == ['Tyre Works'], [sent, names])
        await pg.reload()
        check('a removed Swedish word stays removed after a reload', await pg.evaluate(alts) == [] and await pg.evaluate(toks) == ['project leader', 'engineering'])
        await pg.fill('#kw-input', 'senior nurse'); await pg.press('#kw-input', 'Enter')
        check('senior doesn\'t stop the Swedish word', await pg.evaluate(alts) == ['+ sjuksköterska'], await pg.evaluate(alts))
        await pg.fill('#kw-input', 'quality engineer medtech'); await pg.press('#kw-input', 'Enter')
        await pg.wait_for_selector('#kw-hint [data-kwh=keep]', timeout=10000)
        await pg.click('#kw-hint [data-kwh=keep]')
        check('a phrase can be kept as it is', await pg.locator('#kw-hint').inner_text() == '' and 'quality engineer medtech' in await pg.evaluate(toks))
        await pg.click('.lang button[data-lang=sv]'); await pg.fill('#kw-input', 'projektledare inom bygg'); await pg.dispatch_event('#kw-input', 'input')
        check('the phrase hint in Swedish', 'söks som en exakt fras' in await pg.locator('#kw-hint').inner_text())
        await pg.fill('#kw-input', ''); await pg.dispatch_event('#kw-input', 'input')
        check('the hint goes away when the box is cleared', await pg.locator('#kw-hint').inner_text() == '')

        await beta_checks(browser, errors)
        check('no script errors', not errors, errors)
        await browser.close()
    print(f'{len(passed)} checks passed')

if __name__ == '__main__':
    try: asyncio.run(main())
    except AssertionError as e: print('FAILED', e); sys.exit(1)
