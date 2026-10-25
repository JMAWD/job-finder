"""End-to-end tests for the Mentor tab, with the real server code and a fake AI service.

    python3 build.py && python3 tests/test_mentor.py

Starts the same local server and fake AI as test_tailor.py and runs through the Mentor in a browser: the CV from a
Word file, access code errors, the advice and what was read from the CV, open-ad counts from Platsbanken, the four
answers re-ranking roles and courses without a new AI call, the jump from a role to Find jobs, the CV shared with
step 2, Swedish, a phone-sized screen, reloading and the backup."""
import asyncio, hashlib, json, os, pathlib, re, subprocess, sys, tempfile, time, urllib.request
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from test_app import joblinks, history, ok, ad, GBG, check, passed, EVENT_HOSTS, no_events
from test_tailor import ad_or_search, make_docx, post, last_ai, CODE, SERVER, FAKE, CV

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / 'docs' / 'screenshots'
# Twelve quality engineer ads: nine mention FMEA and three mention Python, so the skill shares are 75% and 25%
QA = [ad(f'2{i:02d}', 'Kvalitetsingenjör', f'Firma {i} AB', f'55600010{i:02d}', GBG,
         ('Vi söker en kvalitetsingenjör med erfarenhet av FMEA. ' if i < 9 else 'Vi söker en kvalitetsingenjör. ') + ('Python är ett plus.' if i < 3 else '')) for i in range(12)]

COUNT_DOWN = {'on': False}
COUNT_QS = []
async def mentor_search(route):
    q = parse_qs(urlparse(route.request.url).query)
    if COUNT_DOWN['on'] and q.get('limit', [''])[0] in ('1', '60'): return await route.abort()   # the Mentor's open-ad counts
    qq = q.get('q', [''])[0]
    if q.get('limit', [''])[0] in ('1', '60'): COUNT_QS.append(qq)
    # A phrase in quotes finds nothing, as on Platsbanken where ads rarely use a model's phrase word for word. Its words
    # without quotes find the ads that mention all of them.
    if q.get('limit', [''])[0] in ('1', '60') and qq.startswith('"') and ' ' in qq: return await route.fulfill(**ok({"total": {"value": 0}, "hits": []}))
    if qq.lower() == 'produktionschef tillverkning': return await route.fulfill(**ok({"total": {"value": 3}, "hits": []}))
    if qq.lower() == 'utbildare kvalitetsteknik': return await route.fulfill(**ok({"total": {"value": 0}, "hits": []}))
    if qq.lower() == 'utbildare': return await route.fulfill(**ok({"total": {"value": 12}, "hits": []}))
    if 'kvalitetsingenjör' in q.get('q', [''])[0].lower() and q.get('qfields') != ['location']:
        return await route.fulfill(**ok({"total": {"value": 34}, "hits": QA}))
    if 'kvalitetschef' in q.get('q', [''])[0].lower():   # none near Göteborg, seven in the whole country
        return await route.fulfill(**ok({"total": {"value": 7 if 'country' in q else 0}, "hits": []}))
    await ad_or_search(route)

async def text_of(locator):
    return await locator.evaluate('e => e.textContent.replace(/\\s+/g, " ")')

async def main():
    tmp = pathlib.Path(tempfile.mkdtemp())
    page = tmp / 'Job Finder.html'
    page.write_text(re.sub(r'"tailor": "[^"]*"', f'"tailor": "{SERVER}"', (ROOT / 'index.html').read_text(encoding='utf-8'), count=1), encoding='utf-8')
    env = {**os.environ, 'AI_KEY': 'fake-key', 'ACCESS_CODES': hashlib.sha256(CODE.encode()).hexdigest(), 'ALLOWED_ORIGINS': 'null',
           'AI_BASE_URL': FAKE + '/v1', 'LIMIT_PER_HOUR': '50', 'LIMIT_PER_DAY': '100'}
    procs = [subprocess.Popen(['node', str(ROOT / 'tests' / 'fake_ai.mjs'), '8799']),
             subprocess.Popen(['node', 'dev.mjs'], cwd=ROOT / 'server', env=env, stdout=subprocess.DEVNULL)]
    try:
        for _ in range(50):
            try: urllib.request.urlopen(FAKE + '/last'); break
            except Exception: time.sleep(0.1)
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            ctx = await browser.new_context(locale='en-US', viewport={'width': 1280, 'height': 1000}, accept_downloads=True)
            await ctx.route('https://jobsearch.api.jobtechdev.se/**', mentor_search)
            await ctx.route(EVENT_HOSTS, no_events)
            await ctx.route('https://links.api.jobtechdev.se/**', joblinks)
            await ctx.route('https://historical.api.jobtechdev.se/**', history)
            pg = await ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
            m = pg.locator('#mentor')
            go = m.locator('[data-mt=go]')

            await pg.goto(page.as_uri() + '#mentor')
            check('a link ending in #mentor opens the Mentor', await pg.locator('#tab-mentor').get_attribute('aria-selected') == 'true' and await pg.locator('#view-res').is_hidden())
            check('starts by asking for the CV', await pg.locator('#mt-cv').is_visible() and 'Start by pasting your CV' in await m.inner_text())
            check('says what leaves the browser', 'your CV is sent to the Job Finder server' in await m.inner_text())
            await go.click()
            check('no CV: clear message', 'at least 200 characters' in await m.locator('.tl-err').inner_text())

            cvdoc = tmp / 'cv.docx'
            make_docx([('Kvalitetsingenjör', False)] + [(line, False) for line in CV.split('. ') if line] + [('FMEA', True), ('8D', True)], cvdoc)
            await pg.set_input_files('#mt-file', str(cvdoc)); await pg.wait_for_timeout(300)
            cv_loaded = await pg.input_value('#mt-cv')
            check('CV loaded from a Word file', cv_loaded.startswith('Kvalitetsingenjör\n') and 'Loaded cv.docx' in await m.locator('#mt-cvmsg').inner_text())

            await go.click()
            check('no code: asks for it', 'Enter your access code first' in await m.locator('.tl-err').inner_text() and await pg.evaluate('document.activeElement.id') == 'mt-code')
            await pg.fill('#mt-code', 'WRONG-CODE9'); await go.click()
            await pg.wait_for_selector('#mentor .tl-err', timeout=10000)
            check('wrong code refused by the server', "wasn't accepted" in await m.locator('.tl-err').inner_text())

            await pg.fill('#mt-code', CODE.lower()); await go.click()
            check('busy while the CV is read', await go.is_disabled() and 'Reading your CV' in await go.inner_text())
            await pg.wait_for_selector('#mentor .mt-note', timeout=15000)
            sent = last_ai(); calls = sent['count']
            system, user = sent['body']['messages'][0]['content'], sent['body']['messages'][1]['content']
            check('server used the mentor prompt with the CV only', 'career mentor' in system and "Never estimate, mention or hint at the person's age" in system
                  and 'leverantörsrevisioner' in user and '<job_ad>' not in user and 'Write every text value in plain, natural English' in system)
            side = await pg.locator('#mt-side').inner_text()
            check('what was read from the CV', all(x in side for x in ('Established', '8 years', "Age isn't estimated or used.", 'Nordvik Automotive', 'Root cause analysis')), side)
            check('code field hidden once it works', await pg.locator('#mt-code').count() == 0)
            check('advice in three tiers', [await m.locator(f'.mt-tier.t-{k} .mt-role').count() for k in ('direct', 'stretch', 'pivot')] == [2, 3, 2])
            check('note from the mentor', 'Eight years of FMEA' in await m.locator('.mt-note').inner_text() and 'Pick a direction' in await m.locator('.mt-note').inner_text())
            ai = m.locator('.ai-note')
            check('the advice says what the AI saw and that it can be wrong', 'Suggestions, not decisions' in await ai.inner_text() and 'has only read your CV and your four answers' in await ai.inner_text()
                  and 'Part%3A%20Mentor' in await ai.locator('a[data-fb=ai]').get_attribute('href'))
            check('and that the CV and advice live only in this browser', 'Your CV and this advice are stored only in this browser.' in side, side)
            async with pg.expect_download(): await m.locator('[data-mt=backup]').click()
            check('a copy puts that line away', await m.locator('[data-mt=backup]').count() == 0)

            await pg.wait_for_function("((document.querySelector('#mt-main .mt-block-head p') || {}).textContent || '').startsWith('Open ads now in all of Sweden · counted ')", timeout=10000)
            check('open ads counted from Platsbanken', '34 open ads' in await m.locator('.mt-role', has_text='Kvalitetsingenjör').inner_text()
                  and '7 open ads' in await m.locator('.mt-role', has_text='Quality Manager').inner_text()
                  and 'No open ads right now' in await m.locator('.mt-role', has_text='Functional Safety Engineer').inner_text())
            check('a role is counted by its words, not as a quoted phrase', '3 open ads' in await m.locator('.mt-role', has_text='Production Manager').inner_text()
                  and 'produktionschef tillverkning' in COUNT_QS and not any(x.startswith('"') for x in COUNT_QS), COUNT_QS)
            fmea = await m.locator('.mt-role', has_text='FMEA Trainer').inner_text()
            check('with nothing for all its words, the first word is counted and the card says so', '12 open ads for "utbildare"' in fmea, fmea)
            check('how often a skill is named in those ads', 'Named in 25% of 12 recent ads for Kvalitetsingenjör' in await m.locator('.mt-course', has_text='Python for engineers').inner_text()
                  and 'Named in 75% of 12' in await m.locator('.mt-course', has_text='AIAG-VDA').inner_text()
                  and 'Rarely named' in await m.locator('.mt-course', has_text='AI tools').inner_text())
            check('no share shown for a generic word like "utbildning"', await m.locator('.mt-course', has_text='Train the trainer').locator('.mt-demand').count() == 0)
            order = await m.locator('.mt-course h4').all_inner_texts()
            check('unsure of direction: courses ranked by the track the person is on', order == ['AIAG-VDA FMEA (2019 method)', 'Train the trainer', 'AI tools for quality work', 'UGL leadership course', 'Python for engineers'], order)

            # The four answers re-rank the advice in the browser
            await pg.click('label[for=mt-dir-lead]')
            check('direction changes the note', 'Take the lead on improvement projects' in await m.locator('.mt-note').inner_text())
            check('roles that fit the direction are marked', 'Fits your direction' in await m.locator('.mt-role', has_text='Quality Manager').inner_text()
                  and await m.locator('.mt-tier.t-stretch .mt-role').count() == 1)
            check('courses follow the direction', await m.locator('.mt-course', has_text='UGL leadership course').count() == 1 and await m.locator('.mt-course', has_text='Software testing').count() == 0)
            await pg.click('label[for=mt-budget-free]')
            check('paid courses set aside when only free ones will do', await m.locator('.mt-course', has_text='UGL').count() == 0
                  and 'Costs about 26,000 SEK, and you asked for free options only.' in await text_of(m.locator('.mt-skipped')))
            await pg.click('label[for=mt-budget-self]')
            check('paying yourself sets aside courses over 25 000 SEK', await m.locator('.mt-course', has_text='UGL').count() == 0
                  and 'About 26,000 SEK is a lot to pay yourself.' in await text_of(m.locator('.mt-skipped')) and 'over 25 000 SEK' in await m.locator('.mt-note').inner_text())
            await pg.click('label[for=mt-dir-deeper]')
            check('a 14 000 SEK certification still fits when paying yourself', await m.locator('.mt-course', has_text='AIAG-VDA').count() == 1)
            await pg.click('label[for=mt-budget-employer]'); await pg.click('label[for=mt-horizon-under5]')
            check('long road flagged for a short time frame', 'About 2.5 years to close the gaps' in await m.locator('.mt-role', has_text='Functional Safety Engineer').inner_text())
            skipped = await text_of(m.locator('.mt-skipped'))
            check('slow payoff set aside with the reason', 'ISO 26262 Functional Safety Engineer' in skipped and 'before it pays off' in skipped and 'long for the time frame you gave' in skipped, skipped)
            await pg.click('label[for=mt-dir-change]'); await pg.click('label[for=mt-time-t1]')
            check('weekly time checked against a course', 'Needs about 10 h a week for about 5 months. You said about 1 h a week.' in await text_of(m.locator('.mt-skipped')))
            check('changing answers asks the AI nothing new', last_ai()['count'] == calls)

            await pg.click('label[for=mt-dir-lead]'); await pg.click('label[for=mt-horizon-y10plus]'); await pg.click('label[for=mt-time-t3]')
            await pg.evaluate("window.scrollTo(0, 0); document.getElementById('mt-side').scrollTop = 0"); await pg.wait_for_timeout(900)
            await pg.screenshot(path=str(SHOTS / 'mentor-en.png'))

            # From a suggested role to its job ads
            await pg.click('label[for=mt-dir-change]')
            await pg.evaluate("document.getElementById('msg').textContent = ''")
            await m.locator('.mt-role', has_text='Software Test Engineer').locator('[data-mt=search]').click()
            await pg.wait_for_function("document.getElementById('msg').textContent.length > 0", timeout=20000)
            toks = await pg.evaluate("[...document.querySelectorAll('#kw-box .tok')].map(t => t.firstChild.textContent)")
            check('a role opens Find jobs with its keyword', await pg.locator('#tab-res').get_attribute('aria-selected') == 'true' and toks == ['software engineer'], toks)
            check('and runs the search', 'Found' in await pg.locator('#msg').inner_text() and await pg.locator('article.co', has_text='Acme Robotics').count() == 1)

            # Step 2 reads the same CV
            acme = pg.locator('article.co', has_text='Acme Robotics'); await acme.locator('button.exp').click()
            await acme.locator('article.role[data-ad="101"] [data-tailor]').click(); await pg.wait_for_selector('#tl-cv')
            check('Tailor uses the CV from the Mentor', await pg.input_value('#tl-cv') == cv_loaded and 'shared with the Mentor' in await pg.locator('#tailor').inner_text())
            await pg.keyboard.press('Escape')

            # A role with no ads near the place searched shows the national count and offers a country-wide search
            await pg.evaluate('window.scrollTo(0, 0)'); await pg.fill('#place', 'Göteborg')
            await pg.evaluate("document.getElementById('msg').textContent = ''"); await pg.click('#go')
            await pg.wait_for_function("document.getElementById('msg').textContent.length > 0", timeout=20000)
            COUNT_DOWN['on'] = True
            await pg.click('#tab-mentor')
            await pg.wait_for_selector('#mentor [data-mt=recount]', timeout=15000)
            check('open-ad counts that fail say so', "Couldn't count open ads right now." in await m.locator('.mt-block-head p').first.inner_text())
            COUNT_DOWN['on'] = False
            await m.locator('[data-mt=recount]').click()
            await pg.wait_for_function("((document.querySelector('#mt-main .mt-block-head p') || {}).textContent || '').startsWith('Open ads now in Göteborg + 25 km · counted ')", timeout=10000)
            check('and try again counts them', await pg.evaluate("document.activeElement.id") == 'mt-roles-h')
            qm = m.locator('.mt-role', has_text='Quality Manager')
            check('none here, national count shown', 'None here right now · 7 in Sweden' in await qm.inner_text() and await qm.locator('[data-mt=search]').inner_text() == 'Search all of Sweden')
            await qm.locator('[data-mt=search]').click()
            await pg.wait_for_function("document.getElementById('msg').textContent.length > 0", timeout=20000)
            toks = await pg.evaluate("[...document.querySelectorAll('#kw-box .tok')].map(t => t.firstChild.textContent)")
            check('country-wide search from that role', await pg.input_value('#place') == '' and toks == ['kvalitetschef'], toks)

            # A changed CV marks the advice as older
            await pg.click('#tab-mentor'); await m.locator('[data-mt=edit]').first.click()
            await pg.fill('#mt-cv', cv_loaded + '\nLedde ett FMEA-team på fyra personer.'); await m.locator('[data-mt=done]').click()
            check('changed CV flagged', 'Your CV has changed since this advice' in await pg.locator('#mt-side').inner_text())

            # An unusable answer keeps the earlier advice
            post(FAKE + '/mode', {'mentorBad': True})
            await go.click(); await pg.wait_for_selector('#mentor .tl-err', timeout=15000)
            check('unusable answer: clear message, advice kept', 'came back in the wrong shape' in await m.locator('.tl-err').inner_text() and await m.locator('.mt-note').count() == 1)
            post(FAKE + '/mode', {'mentorBad': False})
            await pg.route(SERVER + '/**', lambda r: r.fulfill(status=400, content_type='application/json', headers={'access-control-allow-origin': '*'}, body='{"error": "bad_task"}'))
            await go.click(); await pg.wait_for_selector('#mentor .tl-err', timeout=10000)
            check('a server without the Mentor yet: clear message', "isn't switched on for the server yet" in await m.locator('.tl-err').inner_text())
            await pg.unroute(SERVER + '/**')

            # Swedish and a phone
            await pg.click('.lang button[data-lang=sv]')
            side = await pg.locator('#mt-side').inner_text()
            check('old messages cleared when the language changes', await m.locator('.tl-err').count() == 0)
            check('Mentor in Swedish', await pg.locator('#view-mentor h1').inner_text() == 'Ditt nästa steg' and 'Etablerad' in side and 'Råden är på engelska' in side
                  and 'Lediga jobb just nu i hela Sverige' in await m.inner_text())
            await pg.set_viewport_size({'width': 375, 'height': 812}); await pg.wait_for_timeout(200)
            check('no sideways scroll on a phone', await pg.evaluate('document.documentElement.scrollWidth') <= 375)
            tops = await pg.evaluate("['.mt-note', '.mt-qs-card', '.mt-role', '#mt-cv-label'].map(s => document.querySelector('#mentor ' + s).getBoundingClientRect().top)")
            check('on a phone the advice comes first, the CV cards last', tops == sorted(tops), tops)
            await m.locator('.mt-note').scroll_into_view_if_needed(); await pg.evaluate('window.scrollBy(0, -12)'); await pg.wait_for_timeout(900)
            await pg.screenshot(path=str(SHOTS / 'mentor-phone-sv.png'))
            await pg.set_viewport_size({'width': 1280, 'height': 1000}); await pg.click('.lang button[data-lang=en]')

            # Reloading keeps the tab, the advice and the answers
            await pg.reload(); await pg.wait_for_selector('#mentor .mt-note')
            check('reload keeps the tab and the advice', await pg.locator('#tab-mentor').get_attribute('aria-selected') == 'true' and await pg.locator('#mt-dir-change').is_checked())

            # The backup carries the advice
            await pg.click('#tab-app')
            async with pg.expect_download() as dl: await pg.click('#bk-down')
            backup = await (await dl.value).path()
            data = json.loads(pathlib.Path(backup).read_text(encoding='utf-8'))['data']
            check('backup has the advice and answers', data['mentor']['data']['roles'][0]['title'] == 'Kvalitetsingenjör' and data['mentorAnswers']['dir'] == 'change')
            await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.click('#tab-app')
            await pg.set_input_files('#bk-file', backup); await pg.wait_for_timeout(300)
            await pg.click('#tab-mentor'); await pg.wait_for_selector('#mentor .mt-note')
            check('restore brings back the advice', await pg.locator('#mt-dir-change').is_checked() and 'Kvalitetsingenjör' in await m.inner_text())

            check('no script errors', not errors, errors)
            await browser.close()
    finally:
        for pr in procs: pr.terminate()
    print(f'{len(passed)} checks passed')

if __name__ == '__main__':
    try: asyncio.run(main())
    except AssertionError as e: print('FAILED', e); sys.exit(1)
