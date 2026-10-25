"""End-to-end tests for Fairs and events in your field, with simulated venue calendars.

    python3 build.py && python3 tests/test_events.py

The job ad services are the same fixed answers as in test_app.py. Stockholmsmässan, Malmömässan and Visit Sweden are
replaced with small example calendars, and Kistamässan can't be reached, so the tests also cover a calendar that fails.
The search is for software engineer in Göteborg, whose ads are all in Data/IT."""
import asyncio, json, pathlib, sys
from datetime import date, timedelta
from playwright.async_api import async_playwright

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from test_app import jobsearch, joblinks, history, check, passed

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'index.html').as_uri()
SHOTS = ROOT / 'docs' / 'screenshots'
TODAY = date.today()
day = lambda n: (TODAY + timedelta(days=n)).isoformat()

def sm(id, title, start, cats, tag, venue='Stockholmsmässan', excerpt='', length=1):
    return {"id": id, "title": title, "url": f"https://stockholmsmassan.se/kalender/{id}/", "start_date": f"{day(start)} 01:00:00",
            "end_date": f"{day(start + length - 1)} 23:59:00", "excerpt": f"<p>{excerpt}</p>", "hide_from_listings": False,
            "categories": [{"name": c} for c in cats], "tags": [{"name": tag}], "venue": {"venue": venue}}
STOCKHOLM = {"events": [
    sm(1, 'Datacenter Forum Stockholm', 40, ['IT', 'Övrigt'], 'Konferens'),
    sm(2, 'Comic Con Stockholm', 12, ['Gaming', 'Underhållning'], 'Publikmässa', length=3),
    sm(3, 'Byggmaterialdagen', 15, ['Bygg och Fastighet'], 'Fackmässa'),
    sm(4, 'Embedded Expo Väst', 30, ['Industri'], 'Fackmässa', venue='Åbymässan', excerpt='Träffa företag som söker en software engineer eller en elektronikkonstruktör.', length=2),
    sm(5, 'Sy- &#038; Hantverksfestivalen', -5, ['Fritid och konsument'], 'Publikmässa', length=3)], "next_rest_url": None}

def wp(id, title, start, excerpt='', cancelled=False, length=1):
    return {"id": id, "title": {"rendered": title}, "link": f"https://www.malmomassan.se/calendar/{id}/", "excerpt": {"rendered": f"<p>{excerpt}</p>"},
            "meta_box": {"event_start_date_min": f"{day(start)} 00:00:00", "event_end_date_max": f"{day(start + length - 1)} 00:00:00",
                         "hide_from_archive": "0", "is_cancelled": "1" if cancelled else "0"}}
MALMO = [wp(11, 'Øredev Developers Conference', 14, 'En internationell konferens för developers med spår om AI och .NET.', length=3),
         wp(12, 'Gymnasiemässan', 16, 'Hitta din gymnasieutbildning.', length=3),
         wp(13, 'Cloud Summit Malmö', 60, 'Allt om cloud och plattformar.'),
         wp(14, 'Nordic Agro Summit', 18, 'Lantbruk och livsmedel.'),
         wp(15, 'DevOps Day', 22, 'Inställt i år.', cancelled=True)]

def vs(id, name, start, lat, lon):
    g = [{"@id": f"urn:{id}", "@type": "schema:Event", "schema:name": name, "schema:startDate": {"@value": f"{day(start)}T10:00:00+01:00"},
          "schema:endDate": {"@value": day(start)}, "schema:url": {"@id": f"https://example.se/{id}"}, "schema:geo": {"@id": f"_:g{id}"},
          "schema:description": [{"@value": "A job fair.", "@language": "en"}, {"@value": "En jobbmässa.", "@language": "sv"}]},
         {"@id": f"_:g{id}", "@type": "schema:GeoCoordinates", "schema:latitude": lat, "schema:longitude": lon}]
    return {"entryId": id, "metadata": {"@graph": g}}
VISIT = {"results": 2, "resource": {"children": [vs('21', 'Jobbmässa i Göteborg', 20, 57.70, 11.97), vs('22', 'Jobbmässa i Luleå', 25, 65.58, 22.15)]}}

EVENT_CALLS = []
def ok(body, extra=None):
    return dict(status=200, content_type='application/json', body=json.dumps(body),
                headers={'access-control-allow-origin': '*', 'access-control-expose-headers': 'X-WP-Total, X-WP-TotalPages', **(extra or {})})
async def stockholm(route): EVENT_CALLS.append(route.request.url); await route.fulfill(**ok(STOCKHOLM))
async def malmo(route): EVENT_CALLS.append(route.request.url); await route.fulfill(**ok(MALMO, {'x-wp-total': str(len(MALMO)), 'x-wp-totalpages': '1'}))
async def kista(route): EVENT_CALLS.append(route.request.url); await route.abort()
async def visit(route): EVENT_CALLS.append(route.request.url); await route.fulfill(**ok(VISIT))

async def setup(ctx):
    await ctx.route('https://jobsearch.api.jobtechdev.se/**', jobsearch)
    await ctx.route('https://links.api.jobtechdev.se/**', joblinks)
    await ctx.route('https://historical.api.jobtechdev.se/**', history)
    await ctx.route('https://stockholmsmassan.se/**', stockholm)
    await ctx.route('https://www.malmomassan.se/**', malmo)
    await ctx.route('https://www.kistamassan.se/**', kista)
    await ctx.route('https://data.visitsweden.com/**', visit)

async def search(pg, place, *words):
    await pg.fill('#place', place)
    await pg.evaluate("() => { let b; while ((b = document.querySelector('#kw-box button[data-i]'))) b.click(); }")
    for w in words: await pg.fill('#kw-input', w); await pg.press('#kw-input', 'Enter')
    await pg.evaluate("document.getElementById('msg').textContent=''")
    await pg.click('#go'); await pg.wait_for_function("document.getElementById('msg').textContent.length > 0", timeout=20000)

names = lambda pg: pg.locator('#events .ev-name').all_inner_texts()

async def main():
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(locale='en-US', viewport={'width': 1280, 'height': 1100})
        await setup(ctx)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
        await pg.goto(PAGE)
        check('no panel before a search', await pg.locator('#events').is_hidden())

        await search(pg, 'Göteborg', 'software engineer')
        await pg.wait_for_selector('#events .ev-name', timeout=15000)
        await pg.wait_for_function("!document.querySelector('#events .ev-sub')?.textContent.includes('Checking')", timeout=15000)
        got = await names(pg)
        check('events in the field, soonest first, four at a time', got == ['Øredev Developers Conference', 'Jobbmässa i Göteborg', 'Embedded Expo Väst', 'Datacenter Forum Stockholm'], got)
        text = await pg.locator('#events').inner_text()
        check('the count of all matching events', (await pg.locator('#events .ev-n').inner_text()) == '5')
        check('the panel comes after the first three employers, so the jobs come first', await pg.evaluate("""(() => { const ev = document.getElementById('events'), cards = [...document.querySelectorAll('#list > article.co')];
          return ev.parentElement.id === 'list' && cards.length > 0 && ev.previousElementSibling === cards[Math.min(2, cards.length - 1)]; })()"""))
        check('public fairs, other fields, school fairs, cancelled and past events are left out',
              not any(x in text for x in ['Comic Con', 'Byggmaterialdagen', 'Gymnasiemässan', 'DevOps Day', 'Hantverksfestivalen', 'Agro']), text)
        check('job fairs far away are left out', 'Luleå' not in text)
        items = await pg.locator('#events li.ev').all_inner_texts()
        check('a conference in Malmö says how far it is', 'Conference' in items[0] and 'Malmömässan' in items[0] and 'km away' in items[0] and 'Your field: IT and tech' in items[0], items[0])
        check('a job fair nearby is marked as near', 'Job fair' in items[1] and 'near you' in items[1] and 'Employers meet job seekers' in items[1], items[1])
        check('an event that mentions a keyword says so, with its venue and city', 'Mentions "software engineer"' in items[2] and 'Åbymässan, Mölndal' in items[2] and 'near you' in items[2], items[2])
        check('a Stockholmsmässan category counts as the field', 'Your field: IT and tech' in items[3] and 'Stockholmsmässan' in items[3], items[3])
        check('dates over several days', f'Øredev' in items[0] and '–' in items[0])
        check('links open the organiser\'s page in a new tab', await pg.locator('#events .ev-name').first.get_attribute('target') == '_blank'
              and (await pg.locator('#events .ev-name').first.get_attribute('href')).startswith('https://www.malmomassan.se/'))
        foot = await pg.locator('#events .ev-foot').inner_text()
        check('the sources are named and the one that failed is mentioned', 'Stockholmsmässan, Malmömässan and Visit Sweden' in foot and "Couldn't reach Kistamässan" in foot, foot)
        check('no search words are sent to the calendars', EVENT_CALLS and not any('software' in u.lower() or 'engineer' in u.lower() for u in EVENT_CALLS), EVENT_CALLS)

        await pg.click('#events [data-ev=more]')
        check('Show more shows the rest', (await names(pg))[-1] == 'Cloud Summit Malmö')
        check('and moves focus to the first new one', await pg.evaluate("document.activeElement.textContent") == 'Cloud Summit Malmö')
        await pg.click('#events [data-ev=less]')
        check('Show fewer goes back to four', len(await names(pg)) == 4)
        await pg.locator('#events').screenshot(path=str(SHOTS / 'events-en.png'))

        await pg.click('#events [data-ev=toggle]')
        check('the panel can be hidden', await pg.locator('#ev-body').is_hidden() and await pg.locator('#events [data-ev=toggle]').get_attribute('aria-expanded') == 'false')
        n = len(EVENT_CALLS)
        await pg.reload(); await pg.wait_for_selector('#events h2')
        check('it stays hidden after a reload', await pg.locator('#ev-body').is_hidden())
        await pg.wait_for_timeout(500)
        check('the calendars are kept and not downloaded again on reload', len(EVENT_CALLS) == n, EVENT_CALLS[n:])
        await pg.click('#events [data-ev=toggle]')
        check('and can be shown again', await pg.locator('#ev-body').is_visible() and len(await names(pg)) == 4)

        await pg.click('.lang button[data-lang=sv]')
        sv = await pg.locator('#events').inner_text()
        check('in Swedish', 'Mässor och evenemang inom ditt område' in sv and 'Konferens' in sv and 'Jobbmässa' in sv and 'nära dig' in sv and 'Ditt område: IT och tech' in sv, sv)
        await pg.locator('#events').screenshot(path=str(SHOTS / 'events-sv.png'))
        await pg.click('.lang button[data-lang=en]')

        await search(pg, 'Göteborg', 'zzz')
        await pg.wait_for_function("document.querySelectorAll('#events .ev-name').length === 1", timeout=10000)
        check('a job fair nearby shows whatever the search', await names(pg) == ['Jobbmässa i Göteborg'])
        await search(pg, 'Skåne', 'zzz')
        await pg.wait_for_timeout(300)
        check('with nothing in the field and no job fair nearby there is no panel', await pg.locator('#events').is_hidden())
        await search(pg, 'Skåne', 'software engineer')
        await pg.wait_for_selector('#events .ev-name', timeout=10000)
        got = await names(pg)
        check('a county search gets distances too, and a trade fair as far away as Stockholm is left out', 'Øredev Developers Conference' in got and 'Datacenter Forum Stockholm' not in got
              and 'km away' in await pg.locator('#events').inner_text(), got)

        phone = await browser.new_context(locale='en-US', viewport={'width': 375, 'height': 812}, is_mobile=True)
        await setup(phone)
        ph = await phone.new_page(); ph.on('pageerror', lambda e: errors.append(str(e)))
        await ph.goto(PAGE); await search(ph, 'Göteborg', 'software engineer')
        await ph.wait_for_selector('#events .ev-name', timeout=15000)
        wide = await ph.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        check('fits a phone screen', wide)

        check('no script errors', not errors, errors)
        await browser.close()
    print(f'{len(passed)} checks passed')

if __name__ == '__main__':
    try: asyncio.run(main())
    except AssertionError as e: print('FAILED', e); sys.exit(1)
