"""Records the Job Finder demo: the real page in Chromium, fictional job ads, the real server code and a stand-in AI.

    python3 build.py && python3 demo/record.py && python3 demo/compose.py          # English
    python3 demo/record.py sv && python3 demo/compose.py sv                        # Swedish: Swedish ads, CV, AI answers and captions

Writes demo/out/raw/ (raw-sv/ for Swedish): one JPEG per screen update (1080 x 1080) and events.json with the cursor path,
clicks and captions. compose.py turns that into the finished video and a cover image. Companies, people and ads are made up."""
import asyncio, base64, hashlib, json, os, pathlib, re, shutil, subprocess, sys, tempfile, time, urllib.request
from datetime import date, timedelta
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
LANG = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in ('en', 'sv') else 'en'
RAW = ROOT / 'demo' / 'out' / ('raw' if LANG == 'en' else 'raw-sv')
SERVER, AI = 'http://127.0.0.1:8787', 'http://127.0.0.1:8798'
CODE = 'BETA-DEMO1'
W, SCALE = 800, 1.35            # the page is 800 x 800 CSS pixels, captured at 1080 x 1080
TODAY = date.today()
day = lambda n: (TODAY + timedelta(days=n)).isoformat()

GBG = dict(municipality='Göteborg', municipality_concept_id='mGBG', region='Västra Götalands län', region_concept_id='rVG', country='Sverige', city='Göteborg', coordinates=[11.97, 57.70])
MOL = dict(municipality='Mölndal', municipality_concept_id='mMOL', region='Västra Götalands län', region_concept_id='rVG', country='Sverige', city='Mölndal', coordinates=[12.01, 57.65])

def ad(id, title, emp, org, where, text, pub=-2, deadline=23, contacts=(), duration='Tills vidare'):
    return {"id": id, "headline": title, "webpage_url": f"https://arbetsformedlingen.se/platsbanken/annonser/{id}",
            "employer": {"name": emp, "organization_number": org, "workplace": emp, "url": f"https://{emp.split()[0].lower()}.example"},
            "occupation": {"label": "Testare"}, "occupation_group": {"concept_id": "g_test", "label": "Testare"}, "occupation_field": {"concept_id": "f_it", "label": "Data/IT"},
            "workplace_address": where, "publication_date": day(pub) + "T08:00:00", "application_deadline": day(deadline) + "T23:59:59",
            "duration": {"label": duration}, "working_hours_type": {"label": "Heltid"}, "experience_required": True,
            "description": {"text": text}, "application_details": {"url": f"https://apply.example/{id}"}, "application_contacts": list(contacts)}

SARA = {"name": "Sara Lindqvist", "description": "Test manager", "email": "sara.lindqvist@nordvik.example", "telephone": "031-555 01 20"}
ADS = [
    ad('301', 'Test Lead, Embedded Systems', 'Nordvik Automotive AB', '5560100001', GBG,
       "We're looking for a test lead to plan and run verification of our embedded control units for heavy vehicles. You'll own the test strategy for each release, "
       "lead a team of five test engineers and work closely with our test automation team. Experience with ISTQB, Python and hardware-in-the-loop testing is a plus.", contacts=[SARA]),
    ad('302', 'Test Automation Engineer', 'Nordvik Automotive AB', '5560100001', GBG,
       "Join our test automation team and build the pipelines that test every software release of our control units, in Python and CI.", pub=-3),
    ad('303', 'QA Automation Engineer', 'Kvarnby Games AB', '5560100002', GBG, "Kvarnby Games is growing and needs a QA engineer who loves test automation for our mobile games.", deadline=40),
    ad('304', 'Test Automation Engineer, Python', 'Älvsborg Systems AB', '5560100003', MOL, "We build software for ports and logistics. As test automation engineer you'll grow our Python test framework."),
    ad('305', 'Testledare till vår kund', 'Västra Konsult AB', '5560100004', GBG, "För vår kunds räkning söker vi en testledare (test lead) med erfarenhet av test automation.", pub=-3),
    ad('306', 'Test Lead, Medical Devices', 'Hisingen MedTech AB', '5560100005', GBG, "Lead verification of our infusion pump software as test lead, from test plans to release.", pub=-4),
    ad('307', 'Test Lead, Platform', 'Lindholmen Software AB', '5560100006', GBG, "Test lead for our cloud platform team. You set the test strategy and coach the team in test automation.", pub=-5),
    ad('308', 'Testare med fokus på test automation', 'Gamlestaden Logistics AB', '5560100007', GBG, "Vi söker en testare som vill bygga test automation för våra lagersystem.", pub=-6),
    ad('309', 'Testledare', 'Mölndal Energi AB', '5560100008', MOL, "Mölndal Energi söker en testledare (test lead) till vårt nya kundsystem.", pub=-3),
    # What the Mentor's "QA Lead" button finds
    ad('311', 'QA Lead, Platform', 'Lindholmen Software AB', '5560100006', GBG, "As QA lead you set quality goals for three platform teams.", pub=-3),
    ad('312', 'Lead QA Engineer', 'Älvsborg Systems AB', '5560100003', MOL, "We need a QA lead who can grow a small quality team.", pub=-5),
    ad('313', 'QA Lead', 'Gamlestaden Logistics AB', '5560100007', GBG, "QA lead for our warehouse systems, working with four product teams.", pub=-6),
]
LINKS = [{"id": "L1", "headline": "QA Engineer, test automation", "brief": "Help us test the apps behind our e-scooters, with test automation from day one.",
          "occupation_group": {"concept_id": "g_test", "label": "x"}, "occupation_field": {"concept_id": "f_it", "label": "Data/IT"}, "employer": {"name": "Torslanda Mobility AB"},
          "workplace_addresses": [{"municipality": "Göteborg", "municipality_concept_id": "mGBG", "region_concept_id": "rVG", "country": "Sverige"}],
          "publication_date": day(-1) + "T00:00:00", "source_links": [{"label": "thehub.io", "url": "https://thehub.io/jobs/L1"}]}]
HIRED = {'5560100001': 9, '5560100002': 2, '5560100003': 3, '5560100006': 4}   # earlier ads of the same kind, for the hiring history
# Open ads for the Mentor's roles in Göteborg + 25 km, and how many of the sampled ads name each course's skill
COUNTS = {'test lead': (14, 'ISTQB', 5), 'test automation': (22, 'Robot Framework', 6), 'qa lead': (3, None, 0), 'test architect': (2, None, 0),
          'testchef': (0, None, 0), 'product owner': (12, 'Scrum', 7), 'devops': (9, 'Kubernetes', 4)}
NATIONAL = {'testchef': 5}
CV = """Sam Ekström
Senior Test Engineer, Göteborg

Experience
2019–now Senior Test Engineer, Göta Telematics AB. Plan and run release testing for a vehicle telematics unit. Built the team's automated regression suite in Python and run it in CI.
2016–2019 Test Engineer, Brännö Software AB. System and integration testing of IoT gateways.

Education
BSc Computer Engineering, 2016

Certificates
ISTQB Foundation

Skills
Test strategy, risk-based testing, Python, pytest, Jenkins, hardware-in-the-loop, Jira"""

if LANG == 'sv':   # The same people and companies, with the ads, keywords and CV in Swedish
    SARA = {**SARA, "description": "Testchef"}
    ADS = [
        ad('301', 'Testledare, inbyggda system', 'Nordvik Automotive AB', '5560100001', GBG,
           "Vi söker en testledare som planerar och driver verifieringen av våra styrenheter för tunga fordon. Du äger teststrategin för varje release, "
           "leder ett team på fem testingenjörer och arbetar nära vårt team för testautomatisering. Erfarenhet av ISTQB, Python och hardware-in-the-loop är meriterande.", contacts=[SARA]),
        ad('302', 'Ingenjör inom testautomatisering', 'Nordvik Automotive AB', '5560100001', GBG,
           "Bli en del av vårt team för testautomatisering och bygg flödena som testar varje mjukvarurelease av våra styrenheter, i Python och CI.", pub=-3),
        ad('303', 'QA-ingenjör, testautomatisering', 'Kvarnby Games AB', '5560100002', GBG, "Kvarnby Games växer och behöver en QA-ingenjör som älskar testautomatisering för våra mobilspel.", deadline=40),
        ad('304', 'Utvecklare inom testautomatisering, Python', 'Älvsborg Systems AB', '5560100003', MOL, "Vi bygger mjukvara för hamnar och logistik. Hos oss utvecklar du vårt ramverk för testautomatisering i Python."),
        ad('305', 'Testledare till vår kund', 'Västra Konsult AB', '5560100004', GBG, "För vår kunds räkning söker vi en testledare med erfarenhet av testautomatisering.", pub=-3),
        ad('306', 'Testledare, medicinteknik', 'Hisingen MedTech AB', '5560100005', GBG, "Som testledare leder du verifieringen av mjukvaran i våra infusionspumpar, från testplan till release.", pub=-4),
        ad('307', 'Testledare, plattform', 'Lindholmen Software AB', '5560100006', GBG, "Testledare till vårt plattformsteam. Du sätter teststrategin och coachar teamet i testautomatisering.", pub=-5),
        ad('308', 'Testare med fokus på testautomatisering', 'Gamlestaden Logistics AB', '5560100007', GBG, "Vi söker en testare som vill bygga testautomatisering för våra lagersystem.", pub=-6),
        ad('309', 'Testledare', 'Mölndal Energi AB', '5560100008', MOL, "Mölndal Energi söker en testledare till vårt nya kundsystem.", pub=-3),
        ad('311', 'QA-ledare, plattform', 'Lindholmen Software AB', '5560100006', GBG, "Som QA-ledare sätter du kvalitetsmålen för tre plattformsteam.", pub=-3),
        ad('312', 'Ledande QA-ingenjör', 'Älvsborg Systems AB', '5560100003', MOL, "Vi behöver en QA-ledare som kan bygga upp ett litet kvalitetsteam.", pub=-5),
        ad('313', 'QA-ledare', 'Gamlestaden Logistics AB', '5560100007', GBG, "QA-ledare för våra lagersystem, tillsammans med fyra produktteam.", pub=-6),
    ]
    LINKS = [{**LINKS[0], "headline": "QA-ingenjör, testautomatisering", "brief": "Hjälp oss testa apparna bakom våra elsparkcyklar, med testautomatisering från dag ett."}]
    COUNTS = {'testledare': (14, 'ISTQB', 5), 'testautomatisering': (22, 'Robot Framework', 6), 'qa-ledare': (3, None, 0), 'testarkitekt': (2, None, 0),
              'testchef': (0, None, 0), 'produktägare': (12, 'Scrum', 7), 'devops': (9, 'Kubernetes', 4)}
    CV = """Sam Ekström
Senior testingenjör, Göteborg

Erfarenhet
2019–nu Senior testingenjör, Göta Telematics AB. Planerar och genomför releasetester för en telematikenhet till fordon. Byggde teamets automatiserade regressionssvit i Python och kör den i CI.
2016–2019 Testingenjör, Brännö Software AB. System- och integrationstest av IoT-gateways.

Utbildning
Högskoleingenjör i datateknik, 2016

Certifikat
ISTQB Foundation

Kunskaper
Teststrategi, riskbaserad testning, Python, pytest, Jenkins, hardware-in-the-loop, Jira"""

# What gets typed and clicked, and the captions (**words** are highlighted)
TX = {
    'en': dict(locale='en-US', kw=('test lead', 'test automation'), note='Called Sara on Monday. Apply before Friday', letter='Cover letter', lead='Lead people or projects', qa='QA Lead',
               caps=['Search **live job ads** by place and keywords', 'Ads grouped **by employer**, with contacts and hiring history', "**Track** where you've applied, with your own notes",
                     'An AI **tailors your cover letter** to the ad, using only your CV', 'The Mentor **reads your CV** and suggests what to do next', 'Pick a **direction** and the advice changes instantly',
                     'Roles to apply for **now**, **within reach**, or as a **change of track**', 'What to learn next, fitted to your **time, budget and plans**',
                     'One click from a suggested role to **its job ads**', 'New: pick **your colours**, and every page follows']),
    'sv': dict(locale='sv-SE', kw=('testledare', 'testautomatisering'), note='Ringde Sara i måndags. Sök före fredag', letter='Personligt brev', lead='Leda människor eller projekt', qa='QA-ledare',
               caps=['Sök bland **lediga jobb** på ort och egna sökord', 'Annonserna samlas **per arbetsgivare**, med kontakter och tidigare rekryteringar',
                     '**Håll koll** på var du har sökt, med egna anteckningar', 'En AI **anpassar ditt personliga brev** till annonsen, bara utifrån ditt CV',
                     'Mentorn **läser ditt CV** och föreslår vad du kan göra härnäst', 'Välj en **riktning** så ändras råden direkt',
                     'Jobb att söka **nu**, **inom räckhåll** eller som **ett byte av bana**', 'Vad du kan lära dig härnäst, efter din **tid, budget och dina planer**',
                     'Ett klick från ett föreslaget jobb till **annonserna**', 'Nytt: välj **dina färger**, så följer alla sidor med']),
}[LANG]

def ok(body): return dict(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps(body))
def has(a, term): return term.lower() in (a['headline'] + ' ' + a['description']['text']).lower()

async def jobsearch(route):
    url = route.request.url; q = parse_qs(urlparse(url).query)
    if '/ad/' in url:
        a = next((x for x in ADS if url.rstrip('/').endswith('/' + x['id'])), None)
        return await route.fulfill(**ok(a)) if a else await route.fulfill(status=404, body='{}')
    term = q.get('q', [''])[0].strip('"').lower()
    if q.get('qfields') == ['location']:
        hits = [GBG] * 5 + [MOL] if term == 'göteborg' else []
        return await route.fulfill(**ok({"total": {"value": len(hits)}, "hits": [{"id": f"g{i}", "workplace_address": w} for i, w in enumerate(hits)]}))
    if q.get('limit') in (['1'], ['60']):        # the Mentor counting open ads for a role
        if 'country' in q: return await route.fulfill(**ok({"total": {"value": NATIONAL.get(term, 0)}, "hits": []}))
        n, skill, named = COUNTS.get(term, (0, None, 0))
        hits = [{"headline": term.title(), "description": {"text": f"We need a {term}." + (f" {skill} is a plus." if skill and i < named else "")}} for i in range(n)] if q['limit'] == ['60'] else []
        return await route.fulfill(**ok({"total": {"value": n}, "hits": hits}))
    hits = [a for a in ADS if has(a, term)]
    await route.fulfill(**ok({"total": {"value": len(hits)}, "hits": hits}))

async def joblinks(route):
    q = parse_qs(urlparse(route.request.url).query); term = q.get('q', [''])[0].strip('"').lower()
    hits = [l for l in LINKS if term and term in (l['headline'] + ' ' + l['brief']).lower()]
    await route.fulfill(**ok({"total": {"value": len(hits)}, "hits": hits}))

async def history(route):
    q = parse_qs(urlparse(route.request.url).query); n = HIRED.get(q.get('employer', [''])[0], 0)
    hits = [{"id": f"h{i}", "publication_date": day(-40 - 70 * i) + "T08:00:00", "occupation_group": {"concept_id": "g_test"}} for i in range(n)]
    await route.fulfill(**ok({"total": {"value": len(hits)}, "hits": hits}))

class Rec:
    """Drives the page like a person would and notes where the pointer was, when it clicked and which caption shows."""
    def __init__(self, pg):
        self.pg, self.x, self.y = pg, W * 0.62, W * 0.7
        self.path, self.clicks, self.caps = [(time.time(), self.x, self.y)], [], []
    async def move(self, x, y, dur=0.55):
        n = max(2, int(dur * 40)); x0, y0 = self.x, self.y
        for i in range(1, n + 1):
            f = i / n; f = f * f * (3 - 2 * f)
            self.x, self.y = x0 + (x - x0) * f, y0 + (y - y0) * f
            await self.pg.mouse.move(self.x, self.y); self.path.append((time.time(), self.x, self.y))
            await asyncio.sleep(dur / n)
    async def point(self, loc, dx=0.5, dy=0.5, dur=0.55):
        b = await loc.bounding_box()
        if b['y'] < 0 or b['y'] + b['height'] > W - 90:      # off screen or under the caption: bring it into view first
            await self.scroll(loc, top=160, wait=1.0); b = await loc.bounding_box()
        await self.move(b['x'] + b['width'] * dx, b['y'] + b['height'] * dy, dur)
    async def click(self, loc, dx=0.5, dy=0.5, dur=0.55, pause=0.15):
        await self.point(loc, dx, dy, dur); await asyncio.sleep(pause)
        self.clicks.append((time.time(), self.x, self.y))
        await self.pg.mouse.down(); await asyncio.sleep(0.07); await self.pg.mouse.up()
    async def type(self, text, delay=0.075):
        for ch in text: await self.pg.keyboard.type(ch); await asyncio.sleep(delay)
    async def key(self, k): await self.pg.keyboard.press(k)
    def cap(self, text): self.cap_off(); self.caps.append([time.time(), None, text])
    def cap_off(self):
        if self.caps and self.caps[-1][1] is None: self.caps[-1][1] = time.time()
    async def scroll(self, loc, top=90, wait=0.9):
        """Smoothly scrolls the page, or the open panel, so the element sits `top` pixels from the top."""
        await loc.evaluate("""(e, top) => { const box = e.closest('.tl-body'), r = e.getBoundingClientRect();
            if (box) box.scrollTo({ top: box.scrollTop + r.top - box.getBoundingClientRect().top - top, behavior: 'smooth' });
            else { const c = e.closest('#list') && document.querySelector('#view-res .controls');   // keep it clear of the sticky filter bar
                   const under = c && getComputedStyle(c).position === 'sticky' ? c.getBoundingClientRect().height : 0;
                   window.scrollTo({ top: window.scrollY + r.top - top - under, behavior: 'smooth' }); } }""", top)
        await asyncio.sleep(wait)
    async def scroll_by(self, dy, wait=0.9):
        await self.pg.evaluate("dy => window.scrollBy({ top: dy, behavior: 'smooth' })", dy); await asyncio.sleep(wait)
    async def scroll_top(self, wait=0.9):
        await self.pg.evaluate("window.scrollTo({ top: 0, behavior: 'smooth' })"); await asyncio.sleep(wait)

async def scenes(r, pg):
    hold = asyncio.sleep
    # 1. Search
    r.cap(TX['caps'][0])
    await hold(0.6)
    await r.click(pg.locator('#place'), dx=0.3); await r.type('Göteborg'); await hold(0.2)
    await r.click(pg.locator('#kw-input'), dx=0.25); await r.type(TX['kw'][0]); await r.key('Enter'); await hold(0.25)
    await r.type(TX['kw'][1]); await r.key('Enter'); await hold(0.5)
    await r.click(pg.locator('#go'))
    await pg.wait_for_function("document.getElementById('msg').textContent.length > 0", timeout=20000); await hold(1.2)
    await r.scroll(pg.locator('#stats'), top=40, wait=1.4)
    await r.scroll(pg.locator('#list article.co').first, top=8, wait=1.2)
    # 2. Employers
    r.cap(TX['caps'][1])
    nordvik = pg.locator('article.co', has_text='Nordvik Automotive')
    await r.click(nordvik.locator('button.exp')); await hold(0.9)
    await r.scroll(nordvik.locator('article.role').first, top=12, wait=1.3)
    await r.point(nordvik.locator('.hist').first, dx=0.3, dur=0.6); await hold(0.9)
    await r.scroll(nordvik.locator('.side'), top=12, wait=1.2); await hold(0.8)
    # 3. Tracking
    r.cap(TX['caps'][2])
    role = nordvik.locator('article.role').first
    await r.scroll(role.locator('.track'), top=150, wait=1.0)
    sel = role.locator('select[data-role=status]')
    await r.click(sel); await hold(0.3); await sel.select_option('Applied'); await pg.keyboard.press('Escape'); await hold(0.6)
    note = nordvik.locator('article.role').first.locator('textarea[data-role=note]')
    await r.click(note, dx=0.2); await r.type(TX['note'], delay=0.05); await hold(1.0)
    # 4. Tailoring
    r.cap(TX['caps'][3])
    await r.click(nordvik.locator('article.role').first.locator('[data-tailor]')); await hold(1.6)
    dlg = pg.locator('#tailor')
    await r.click(dlg.locator('.tl-task', has_text=TX['letter'])); await hold(0.7)
    await r.click(dlg.locator('[data-tl=go]')); await hold(1.0)
    await pg.wait_for_selector('#tailor .tl-out', timeout=20000); await hold(0.5)
    await r.scroll(dlg.locator('.tl-out'), top=24, wait=1.4)
    r.cap_off(); await hold(2.8)
    await r.click(dlg.locator('.tl-close')); await hold(0.6)
    # 5. Mentor
    r.cap(TX['caps'][4])
    await r.scroll_top(1.1)
    await r.click(pg.locator('#tab-mentor')); await hold(1.0)
    await r.click(pg.locator('#mentor [data-mt=go]')); await hold(0.6)
    await pg.wait_for_selector('#mentor .mt-note', timeout=20000); await hold(0.4)
    await r.scroll(pg.locator('#mentor .mt-note'), top=16, wait=1.0); await hold(2.4)
    r.cap(TX['caps'][5])
    lead = pg.locator('#mentor label.mt-opt', has_text=TX['lead'])
    await r.click(lead); await hold(1.6)
    await r.scroll(pg.locator('#mentor .mt-note'), top=16, wait=0.9); await hold(1.6)
    r.cap(TX['caps'][6])
    await r.scroll(pg.locator('#mentor .mt-block-head').first, top=16, wait=1.2); await hold(1.2)
    await r.scroll(pg.locator('#mentor .mt-tier').nth(1), top=16, wait=1.2); await hold(1.4)
    r.cap(TX['caps'][7])
    await r.scroll(pg.locator('#mentor .mt-block-head').nth(1), top=16, wait=1.2); await hold(2.4)
    r.cap(TX['caps'][8])
    qa = pg.locator('#mentor .mt-role', has_text=TX['qa'])
    await r.scroll(qa, top=200, wait=1.1)
    await r.click(qa.locator('[data-mt=search]')); await hold(0.6)
    await pg.wait_for_function("document.querySelectorAll('#list article.co').length === 3", timeout=20000); await hold(0.6)
    await r.scroll(pg.locator('#stats'), top=150, wait=1.0); await hold(1.4)
    # 6. Colours
    r.cap(TX['caps'][9])
    await r.scroll_top(1.0)
    for k, wait in (('lavender', 1.1), ('ocean', 1.0), ('terracotta', 1.0), ('seafoam', 1.5)):
        await r.click(pg.locator(f'#palette .pal[data-p={k}]'), dur=0.45, pause=0.1); await hold(wait)
    r.cap_off(); await hold(0.3)

async def main():
    RAW.mkdir(parents=True, exist_ok=True)
    for f in RAW.glob('*'): f.unlink()
    tmp = pathlib.Path(tempfile.mkdtemp())
    page = tmp / 'Job Finder.html'
    page.write_text(re.sub(r'"tailor": "[^"]*"', f'"tailor": "{SERVER}"', (ROOT / 'index.html').read_text(encoding='utf-8'), count=1), encoding='utf-8')
    env = {**os.environ, 'AI_KEY': 'demo', 'ACCESS_CODES': hashlib.sha256(CODE.encode()).hexdigest(), 'ALLOWED_ORIGINS': 'null',
           'AI_BASE_URL': AI + '/v1', 'LIMIT_PER_HOUR': '50', 'LIMIT_PER_DAY': '100'}
    procs = [subprocess.Popen(['node', str(ROOT / 'demo' / 'demo_ai.mjs'), '8798']),
             subprocess.Popen(['node', 'dev.mjs'], cwd=ROOT / 'server', env=env, stdout=subprocess.DEVNULL)]
    try:
        for _ in range(60):
            try: urllib.request.urlopen(AI + '/last'); urllib.request.urlopen(SERVER + '/', timeout=1); break
            except urllib.error.HTTPError: break
            except Exception: time.sleep(0.1)
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            ctx = await browser.new_context(locale=TX['locale'], viewport={'width': W, 'height': W}, device_scale_factor=SCALE, color_scheme='light')
            await ctx.add_init_script(f"""if (!localStorage.getItem('jf-cv')) {{ localStorage.setItem('jf-cv', {json.dumps(json.dumps(CV))});
                localStorage.setItem('jf-code', '"{CODE}"'); localStorage.setItem('jf-lang', '"{LANG}"'); localStorage.setItem('jf-palette', '"seafoam"'); }}""")
            await ctx.route('https://jobsearch.api.jobtechdev.se/**', jobsearch)
            await ctx.route('https://links.api.jobtechdev.se/**', joblinks)
            await ctx.route('https://historical.api.jobtechdev.se/**', history)
            pg = await ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
            await pg.goto(page.as_uri()); await pg.wait_for_timeout(800)
            frames = []
            cdp = await ctx.new_cdp_session(pg)
            def on_frame(e):
                frames.append((e['metadata']['timestamp'], e['data']))
                asyncio.ensure_future(cdp.send('Page.screencastFrameAck', {'sessionId': e['sessionId']}))
            cdp.on('Page.screencastFrame', on_frame)
            await cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 95, 'maxWidth': 1080, 'maxHeight': 1080, 'everyNthFrame': 1})
            await asyncio.sleep(0.6)
            r = Rec(pg); start = time.time()
            await pg.mouse.move(r.x, r.y)
            try: await scenes(r, pg)
            except Exception:
                await pg.screenshot(path=str(RAW / 'error.png')); raise
            end = time.time()
            await cdp.send('Page.stopScreencast')
            await browser.close()
        if errors: print('page errors:', errors)
        names = []
        for i, (ts, data) in enumerate(sorted(frames)):
            name = f'f{i:05d}.jpg'; (RAW / name).write_bytes(base64.b64decode(data)); names.append([ts, name])
        (RAW / 'events.json').write_text(json.dumps({'start': start, 'end': end, 'scale': SCALE, 'frames': names, 'path': r.path, 'clicks': r.clicks, 'caps': r.caps}))
        print(f'{len(names)} frames, {end - start:.1f} s')
    finally:
        for pr in procs: pr.terminate()
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == '__main__':
    asyncio.run(main())
