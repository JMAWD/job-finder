"""End-to-end tests for step 2 (tailoring an application), with the real server code and a fake AI service.

    python3 build.py && python3 tests/test_tailor.py

Starts server/dev.mjs on port 8787 and tests/fake_ai.mjs on port 8799, builds a copy of the page that points at the local
server, and runs through the panel in a browser: fetching the full ad, the CV from a Word file, access code errors,
generating, the Word download, backup, Swedish and a phone-sized screen."""
import asyncio, hashlib, json, os, pathlib, re, subprocess, sys, tempfile, time, urllib.request, zipfile
from playwright.async_api import async_playwright

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from test_app import jobsearch, joblinks, history, search, ok, SW, check, passed

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / 'docs' / 'screenshots'
CODE = 'TESTA-CODE2'
SERVER, FAKE = 'http://127.0.0.1:8787', 'http://127.0.0.1:8799'
AD_TEXT = ('Om tjänsten\nVi söker en software engineer som kan FMEA och kvalitet. Du kommer att arbeta med riskanalys, '
           'leverantörer och förbättringar i produktionen tillsammans med vårt team i Göteborg.\n\nKvalifikationer\n- Erfarenhet av FMEA\n- Python')
CV = ('Kvalitetsingenjör med åtta års erfarenhet av FMEA, 8D och leverantörsrevisioner inom fordonsindustrin. '
      'Har lett förbättringsarbete i produktionen och utbildat kollegor i riskanalys. ') * 2

def make_docx(paragraphs, path):
    """A Word file with compressed parts, the way Word itself saves them."""
    num = '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'
    body = ''.join(f'<w:p>{num if bullet else ""}<w:r><w:t xml:space="preserve">{text}</w:t></w:r></w:p>' for text, bullet in paragraphs)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml', f'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{body}</w:body></w:document>')

def post(url, data):
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    return json.loads(urllib.request.urlopen(req).read())
last_ai = lambda: json.loads(urllib.request.urlopen(FAKE + '/last').read())

async def ad_or_search(route):
    url = route.request.url
    if '/ad/' in url:
        a = next((x for x in SW if url.rstrip('/').endswith('/' + x['id'])), None)
        return await route.fulfill(**ok({**a, 'description': {'text': AD_TEXT}})) if a else await route.fulfill(status=404, body='{}')
    await jobsearch(route)

async def main():
    tmp = pathlib.Path(tempfile.mkdtemp())
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    page, off = tmp / 'Job Finder.html', tmp / 'no-server.html'
    page.write_text(re.sub(r'"tailor": "[^"]*"', f'"tailor": "{SERVER}"', html, count=1), encoding='utf-8')
    off.write_text(re.sub(r'"tailor": "[^"]*"', '"tailor": ""', html, count=1), encoding='utf-8')
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
            await ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
            await ctx.route('https://jobsearch.api.jobtechdev.se/**', ad_or_search)
            await ctx.route('https://links.api.jobtechdev.se/**', joblinks)
            await ctx.route('https://historical.api.jobtechdev.se/**', history)
            pg = await ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))

            # Without a server address there is no step 2
            await pg.goto(off.as_uri())
            await pg.fill('#place', 'Göteborg'); await pg.fill('#kw-input', 'software engineer'); await pg.press('#kw-input', 'Enter'); await search(pg)
            check('no tailor buttons without a server', await pg.locator('[data-tailor]').count() == 0)

            await pg.goto(page.as_uri()); await search(pg)
            acme = pg.locator('article.co', has_text='Acme Robotics'); await acme.locator('button.exp').click()
            btn = acme.locator('article.role[data-ad="101"] [data-tailor]')
            check('tailor button on each role', await btn.inner_text() == 'Tailor my application')
            await btn.click()
            dlg = pg.locator('#tailor')
            await pg.wait_for_function("document.getElementById('tl-ad') && document.getElementById('tl-ad').value.includes('Kvalifikationer')", timeout=5000)
            check('panel opens with the job title', 'Software Engineer till Acme' in await dlg.locator('h2').inner_text())
            check('full ad fetched from Platsbanken', 'Erfarenhet av FMEA' in await pg.input_value('#tl-ad'))
            check('output language follows the ad', await pg.input_value('#tl-lang') == 'sv')
            check('asks for a code, naming the author', 'Ask John Mawdsley for an access code' in await dlg.inner_text())

            await dlg.locator('[data-tl=go]').click()
            check('no code: clear message', 'Enter your access code first' in await dlg.locator('.tl-err').inner_text())
            await pg.fill('#tl-code', 'WRONG-CODE9'); await dlg.locator('[data-tl=go]').click()
            check('short CV: clear message', 'at least 200 characters' in await dlg.locator('.tl-err').inner_text())

            # CV from a Word file, with a bullet list
            cvdoc = tmp / 'my-cv.docx'
            make_docx([('Kvalitetsingenjör', False)] + [(line, False) for line in CV.split('. ') if line] + [('FMEA', True), ('8D', True)], cvdoc)
            await pg.set_input_files('#tl-file', str(cvdoc)); await pg.wait_for_timeout(300)
            cv_loaded = await pg.input_value('#tl-cv')
            check('CV read from a compressed Word file', cv_loaded.startswith('Kvalitetsingenjör\n') and '- FMEA\n- 8D' in cv_loaded, cv_loaded[:200])
            check('Word load confirmed', 'Loaded my-cv.docx' in await dlg.locator('#tl-cvmsg').inner_text())

            await dlg.locator('[data-tl=go]').click()
            await pg.wait_for_selector('#tailor .tl-err', timeout=10000)
            check('wrong code refused by the server', "wasn't accepted" in await dlg.locator('.tl-err').inner_text())

            await pg.fill('#tl-code', CODE.lower()); await pg.fill('#tl-extra', 'Håll det kort')
            await dlg.locator('[data-tl=go]').click()
            check('busy state while writing', await dlg.locator('[data-tl=go]').is_disabled())
            await pg.wait_for_selector('#tailor .tl-out', timeout=10000)
            out = dlg.locator('.tl-out')
            check('divider lines left out', '---' not in await out.inner_text())
            check('answer shown with headings and lists', await out.locator('h4').count() == 3 and await out.locator('li').count() == 3 and await out.locator('b').first.inner_text() == 'FMEA')
            sent = last_ai()['body']
            user = sent['messages'][1]['content']
            check('server sent the ad, the CV and the wish', 'Erfarenhet av FMEA' in user and 'leverantörsrevisioner' in user and 'Håll det kort' in user and '<annons>' in user)
            check('server added its own rules and key', 'Hitta aldrig på' in sent['messages'][0]['content'] and last_ai()['auth'] == 'Bearer fake-key')
            check('job marked Saved after the first result', await acme.locator('article.role[data-ad="101"] select[data-role=status]').input_value() == 'Saved')

            await dlg.locator('[data-tl=copy]').click()
            clip = await pg.evaluate('navigator.clipboard.readText()')
            check('copy gives plain text', clip.startswith('Det som matchar\n• FMEA: åtta') and '**' not in clip and '##' not in clip and '---' not in clip, clip[:80])

            # Cover letter in English, then the Word file
            await dlg.locator('[data-task=letter]').click()
            check('task switch keeps the CV', (await pg.input_value('#tl-cv')) == cv_loaded)
            await pg.select_option('#tl-lang', 'en')
            await dlg.locator('[data-tl=go]').click(); await pg.wait_for_selector('#tailor .tl-out', timeout=10000)
            check('English prompt used', '<job_ad>' in last_ai()['body']['messages'][1]['content'])
            check('finished tasks get a dot', await dlg.locator('[data-task=match] .tl-dot').count() == 1)
            async with pg.expect_download() as dl: await dlg.locator('[data-tl=word]').click()
            d = await dl.value; word = tmp / d.suggested_filename; await d.save_as(word)
            check('Word file name', d.suggested_filename == 'cover-letter-acme-robotics-software-engineer-till-acme.docx', d.suggested_filename)
            import docx
            doc = docx.Document(str(word)); paras = [x.text for x in doc.paragraphs]
            check('Word file opens and has the letter', paras[0] == 'Cover letter: Software Engineer till Acme, Acme Robotics' and 'Dear [contact person],' in paras and '• Eight years of FMEA' in paras, paras)
            check('bold kept in Word', any(r.bold and r.text == 'Acme Robotics' for x in doc.paragraphs for r in x.runs))
            conv = subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', str(tmp), str(word)], capture_output=True, timeout=120)
            check('LibreOffice can open the Word file', (tmp / (word.stem + '.pdf')).exists(), conv.stderr[-300:])
            await pg.screenshot(path=str(SHOTS / 'tailor-en.png'))

            # Errors from the AI service and the network
            post(FAKE + '/mode', {'status': 429})
            await dlg.locator('[data-tl=go]').click(); await pg.wait_for_selector('#tailor .tl-err', timeout=10000)
            check('AI busy: clear message', "couldn't answer right now" in await dlg.locator('.tl-err').inner_text())
            check('earlier answer kept after an error', await dlg.locator('.tl-out').count() == 1)
            post(FAKE + '/mode', {'status': 200})
            await pg.route(SERVER + '/**', lambda r: r.abort())
            await dlg.locator('[data-tl=go]').click(); await pg.wait_for_selector('#tailor .tl-err', timeout=10000)
            check('server down: clear message', "Couldn't reach the tailoring server" in await dlg.locator('.tl-err').inner_text())
            await pg.unroute(SERVER + '/**')

            # Closing returns focus, and everything is still there next time
            await pg.keyboard.press('Escape')
            check('Escape closes the panel', not await dlg.evaluate('d => d.open'))
            check('focus back on the button', await pg.evaluate("document.activeElement.dataset.tailor") == '101')
            check('button shows that texts exist', await btn.locator('.tl-dot').count() == 1)
            await btn.click(); await pg.wait_for_selector('#tailor .tl-out')
            check('reopens on the last task with its answer', await dlg.locator('[data-task=letter]').get_attribute('aria-selected') == 'true' and 'Dear [contact person]' in await dlg.locator('.tl-out').inner_text())
            await dlg.locator('.tl-close').click()

            # Ads from other sites only have a short extract
            echo = pg.locator('article.co', has_text='Echo Apps'); await echo.locator('button.exp').click()
            await echo.locator('[data-tailor]').click(); await pg.wait_for_timeout(200)
            hint, adv = await dlg.locator('.tl-hint').first.inner_text(), await pg.input_value('#tl-ad')
            check('other-site ad: asks for the full text', 'This ad is on The Hub' in hint and adv == 'Join us as a software engineer.', (hint, adv))
            await pg.keyboard.press('Escape')

            # From the applications tab, in Swedish
            await pg.click('#tab-app')
            await pg.click('.lang button[data-lang=sv]')
            await pg.locator('#apps [data-tailor="101"]').click(); await pg.wait_for_selector('#tailor .tl-out')
            check('panel in Swedish', await dlg.locator('.tl-close').get_attribute('aria-label') == 'Stäng' and await dlg.locator('[data-task=letter]').inner_text() == 'Personligt brev ●')
            await pg.set_viewport_size({'width': 375, 'height': 800}); await pg.wait_for_timeout(200)
            check('panel fits a phone', await dlg.evaluate('d => d.scrollWidth <= d.clientWidth && d.getBoundingClientRect().width <= 375'))
            check('ad and CV stacked on a phone', await pg.evaluate("document.getElementById('tl-cv').getBoundingClientRect().top > document.getElementById('tl-ad').getBoundingClientRect().bottom"))
            await pg.screenshot(path=str(SHOTS / 'tailor-phone-sv.png'))
            await pg.keyboard.press('Escape'); await pg.set_viewport_size({'width': 1280, 'height': 1000})

            # The backup carries the CV and the texts
            async with pg.expect_download() as dl: await pg.click('#bk-down')
            backup = await (await dl.value).path()
            data = json.loads(pathlib.Path(backup).read_text(encoding='utf-8'))['data']
            check('backup has the CV and texts', 'leverantörsrevisioner' in data['cv'] and 'letter' in data['tailor']['101']['out'])
            await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.click('#tab-app')
            await pg.set_input_files('#bk-file', backup); await pg.wait_for_timeout(300)
            await pg.locator('#apps [data-tailor="101"]').click(); await pg.wait_for_selector('#tailor .tl-out')
            check('restore brings back the CV and texts', 'leverantörsrevisioner' in await pg.input_value('#tl-cv') and 'Dear [contact person]' in await dlg.locator('.tl-out').inner_text())
            check('the access code is not in the backup', 'TESTA' not in json.dumps(data).upper())

            check('no script errors', not errors, errors)
            await browser.close()
    finally:
        for pr in procs: pr.terminate()
    print(f'{len(passed)} checks passed')

if __name__ == '__main__':
    try: asyncio.run(main())
    except AssertionError as e: print('FAILED', e); sys.exit(1)
