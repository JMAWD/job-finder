"""Records a short clip of Fairs and events in your field, for sharing on its own.

    python3 build.py && python3 demo/record_events.py && python3 demo/compose.py events          # English
    python3 demo/record_events.py sv && python3 demo/compose.py events sv                        # Swedish

The job ads are the fictional ones from record.py. The events are real: the entries the venue calendars returned for an
IT search on 21 October 2026, served back in each calendar's own format so the page reads them exactly as it does live.
Writes demo/out/raw-events/ (raw-events-sv/ in Swedish) for compose.py."""
import asyncio, base64, json, pathlib, sys, time
from playwright.async_api import async_playwright

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import record
from record import Rec, ok, jobsearch, joblinks, history, W, SCALE, LANG, ROOT

RAW = ROOT / 'demo' / 'out' / ('raw-events' if LANG == 'en' else 'raw-events-sv')

def sm(id, title, start, end, cats, tag, excerpt):
    return {"id": id, "title": title, "url": f"https://stockholmsmassan.se/kalender/{id}/", "start_date": start + " 01:00:00", "end_date": end + " 23:59:00",
            "excerpt": f"<p>{excerpt}</p>", "hide_from_listings": False, "categories": [{"name": c} for c in cats], "tags": [{"name": tag}], "venue": {"venue": "Stockholmsmässan"}}
def wp(id, title, link, start, end, excerpt=''):
    return {"id": id, "title": {"rendered": title}, "link": link, "excerpt": {"rendered": f"<p>{excerpt}</p>"},
            "meta_box": {"event_start_date_min": start + " 00:00:00", "event_end_date_max": end + " 00:00:00", "hide_from_archive": "0", "is_cancelled": "0"}}
CAL = {
    'stockholmsmassan': {"events": [
        sm('datacenter-forum-stockholm-2026', 'Datacenter Forum Stockholm 2026', '2026-12-03', '2026-12-03', ['IT', 'Övrigt'], 'Konferens', ''),
        sm('retail-technology-2027', 'Retail Technology 2027', '2027-08-24', '2027-08-25', ['IT'], 'Fackmässa', ''),
        sm('byggmaterialdagen-2026', 'Byggmaterialdagen 2026', '2026-11-03', '2026-11-03', ['Bygg och Fastighet'], 'Fackmässa', ''),
        sm('comic-con-stockholm-winter-2026', 'Comic Con Stockholm Winter 2026', '2026-10-30', '2026-11-01', ['Gaming', 'Underhållning'], 'Publikmässa', '')], "next_rest_url": None},
    'kistamassan': [wp(1, 'Business Tech', 'https://www.kistamassan.se/calendar/business-tech/', '2027-02-24', '2027-02-25'),
                    wp(2, 'Stockholm Tech Show', 'https://www.kistamassan.se/calendar/stockholm-tech-show-2/', '2027-05-25', '2027-05-26'),
                    wp(3, 'Data Centre Expo', 'https://www.kistamassan.se/calendar/stockholm-business-expo-2/', '2027-05-25', '2027-05-26'),
                    wp(4, 'Saco Studentmässa', 'https://www.kistamassan.se/calendar/saco-studentmassa/', '2026-11-25', '2026-11-27')],
    'malmomassan': [wp(11, 'Øredev Developers Conference', 'https://www.malmomassan.se/calendar/oredev-developers-conference-2/', '2026-11-04', '2026-11-06',
                       'Välkommen till en internationell utvecklarkonferens med en blandning av praktisk kunskap och visionära talare.')],
    'visitsweden': {"results": 1, "resource": {"children": [{"entryId": "69318", "metadata": {"@graph": [
        {"@id": "urn:uuid:c96ecb96", "@type": "schema:Event", "schema:name": "Jobbmässa i Borås", "schema:url": {"@id": "https://www.vastsverige.com/sjuharad/evenemang/jobbmassa-boras/"},
         "schema:startDate": {"@value": "2026-11-12T10:00:00+01:00"}, "schema:endDate": {"@value": "2026-11-12"}, "schema:geo": {"@id": "_:geo1"},
         "schema:description": {"@value": "Jobbmässa där företag möter arbetssökande och personer som vill söka eller byta jobb.", "@language": "sv"}},
        {"@id": "_:geo1", "@type": "schema:GeoCoordinates", "schema:latitude": 57.7216297, "schema:longitude": 12.9360745}]}}]}},
}
async def calendars(route):
    u = route.request.url
    key = next(k for k in CAL if k in u)
    extra = {'x-wp-total': str(len(CAL[key])), 'x-wp-totalpages': '1', 'access-control-expose-headers': 'X-WP-Total, X-WP-TotalPages'} if isinstance(CAL[key], list) else {}
    r = ok(CAL[key]); r['headers'] = {**r['headers'], **extra}
    await route.fulfill(**r)

TX = {'en': dict(kw='test lead', other='sv', caps=[
          'Search **live job ads** by place and keywords',
          'New: **fairs and events** in your field, right above the results',
          'Each one says **why it fits**: your keywords or your field',
          'Job fairs **near you**, and how far away the rest are',
          'Read from the venues\' **own calendars**. Your search words are **never sent** to them',
          'In **English** and **Swedish**']),
      'sv': dict(kw='testledare', other='en', caps=[
          'Sök bland **lediga jobb** på ort och egna sökord',
          'Nytt: **mässor och evenemang** inom ditt område, direkt ovanför resultaten',
          'Varje evenemang visar **varför det passar**: dina sökord eller ditt område',
          'Jobbmässor **nära dig**, och hur långt bort resten ligger',
          'Hämtas från mässornas **egna kalendrar**. Dina sökord **skickas aldrig** dit',
          'På **svenska** och **engelska**'])}[LANG]

async def below_bar(pg, loc, gap=10, wait=1.4):
    """Scrolls so the element sits just under the sticky filter bar, which would otherwise cover the top of the panel"""
    await loc.evaluate("""(e, gap) => { const c = document.querySelector('#view-res .controls'), cs = c && getComputedStyle(c);
        const under = cs && cs.position === 'sticky' ? (parseFloat(cs.top) || 0) + c.getBoundingClientRect().height : 0;
        window.scrollTo({ top: window.scrollY + e.getBoundingClientRect().top - under - gap, behavior: 'smooth' }); }""", gap)
    await asyncio.sleep(wait)

async def scenes(r, pg):
    hold = asyncio.sleep
    r.cap(TX['caps'][0]); await hold(0.6)
    await r.click(pg.locator('#place'), dx=0.3); await r.type('Göteborg'); await hold(0.2)
    await r.click(pg.locator('#kw-input'), dx=0.25); await r.type(TX['kw']); await r.key('Enter'); await hold(0.4)
    await r.click(pg.locator('#go'))
    await pg.wait_for_function("document.getElementById('msg').textContent.length > 0", timeout=20000)
    await pg.wait_for_selector('#events .ev-name', timeout=20000); await hold(0.8)
    ev = pg.locator('#events')
    r.cap(TX['caps'][1])
    await below_bar(pg, ev); await hold(1.4)
    r.cap(TX['caps'][2])
    whys = ev.locator('.ev-why')
    for i in (0, 2): await r.point(whys.nth(i), dx=0.25, dur=0.6); await hold(1.3)
    r.cap(TX['caps'][3])
    await r.point(ev.locator('li.ev', has_text='Borås').locator('.ev-meta'), dx=0.55, dur=0.6); await hold(1.6)
    await r.point(ev.locator('li.ev').first.locator('.ev-meta'), dx=0.7, dur=0.6); await hold(1.4)
    await r.click(ev.locator('[data-ev=more]')); await hold(1.0)
    await below_bar(pg, ev.locator('li.ev').nth(3), wait=1.2)
    r.cap(TX['caps'][4])
    await r.point(ev.locator('.ev-foot'), dx=0.3, dur=0.7); await hold(3.0)
    r.cap(TX['caps'][5])
    await r.scroll_top(1.0)
    await r.click(pg.locator(f'.lang button[data-lang={TX["other"]}]')); await hold(0.6)
    await below_bar(pg, ev); await hold(2.4)
    r.cap_off(); await hold(0.4)

async def main():
    RAW.mkdir(parents=True, exist_ok=True)
    for f in RAW.glob('*'): f.unlink()
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(locale=record.TX['locale'], viewport={'width': W, 'height': W}, device_scale_factor=SCALE, color_scheme='light')
        await ctx.add_init_script(f"""if (!localStorage.getItem('jf-lang')) {{ localStorage.setItem('jf-lang', '"{LANG}"'); localStorage.setItem('jf-palette', '"seafoam"'); }}""")
        await ctx.route('https://jobsearch.api.jobtechdev.se/**', jobsearch)
        await ctx.route(record.EVENT_HOSTS, calendars)
        await ctx.route('https://links.api.jobtechdev.se/**', joblinks)
        await ctx.route('https://historical.api.jobtechdev.se/**', history)
        pg = await ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
        await pg.goto((ROOT / 'index.html').as_uri()); await pg.wait_for_timeout(800)
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

if __name__ == '__main__':
    asyncio.run(main())
