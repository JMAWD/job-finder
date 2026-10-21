"""End-to-end tests for step 2 (tailoring an application), with the real server code and a fake AI service.

    python3 build.py && python3 tests/test_tailor.py

Starts server/dev.mjs on port 8787 and tests/fake_ai.mjs on port 8799, builds a copy of the page that points at the local
server, and runs through the panel in a browser: fetching the full ad, the CV from a Word file, access code errors,
generating, the Word download, backup, Swedish and a phone-sized screen."""
import asyncio, hashlib, json, os, pathlib, re, shutil, subprocess, sys, tempfile, time, urllib.request, zipfile
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

AD_DOWN = {'on': False}
async def ad_or_search(route):
    url = route.request.url
    if '/ad/' in url and AD_DOWN['on']: return await route.abort()
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
            check('no Mentor without a server', await pg.locator('#tab-mentor').is_hidden() and await pg.locator('[data-act=goto-mentor]').count() == 0)
            check('no translation buttons without a server', await pg.locator('[data-translate]').count() == 0)

            translation_payloads = []
            async def capture_translation(route):
                payload = route.request.post_data_json
                if isinstance(payload, dict) and payload.get('task') == 'translate': translation_payloads.append(payload)
                await route.continue_()
            await pg.route(SERVER + '/**', capture_translation)
            await pg.goto(page.as_uri()); await search(pg)
            acme = pg.locator('article.co', has_text='Acme Robotics'); await acme.locator('button.exp').click()
            trans_role = acme.locator('article.role[data-ad="101"]')
            translate_btn = trans_role.locator('[data-translate]')
            check('translation button names English as the target', await translate_btn.inner_text() == 'Translate ad to English')
            check('no translation button on an ad already in English', await acme.locator('article.role[data-ad="102"] [data-translate]').count() == 0)
            await translate_btn.click()
            code_input = trans_role.locator('[data-translate-code]')
            check('translation asks for a code but not a CV', await code_input.count() == 1 and 'CV is not needed or sent' in await trans_role.locator('.translation-access').inner_text() and await trans_role.locator('.translation-access textarea').count() == 0)
            await code_input.fill(CODE); await trans_role.locator('[data-translate-go]').click()
            await pg.wait_for_selector('article.role[data-ad="101"] .translation-text', timeout=10000)
            first_translation = await trans_role.locator('.translation-text').inner_text()
            check('full ad translation is shown inline', 'Quality Engineer' in first_translation and 'quality improvements' in first_translation, first_translation)
            check('translation sends only the ad text to the server, without CV or job metadata', len(translation_payloads) == 1 and translation_payloads[0].get('job') == {'text': AD_TEXT} and 'cv' not in translation_payloads[0], repr(translation_payloads))
            first_request = last_ai()['body']['messages'][1]['content']
            check('AI receives the full ad but no CV or separate job metadata', 'Erfarenhet av FMEA' in first_request and 'leverantörsrevisioner' not in first_request and '<cv>' not in first_request and 'Acme Robotics' not in first_request and 'Software Engineer till Acme' not in first_request)
            await pg.evaluate("localStorage.removeItem('jf-code')")
            btn = trans_role.locator('[data-tailor]')
            check('tailor button on each role', await btn.inner_text() == 'Tailor my application')
            await btn.click()
            dlg = pg.locator('#tailor')
            await pg.wait_for_function("document.getElementById('tl-ad') && document.getElementById('tl-ad').value.includes('Kvalifikationer')", timeout=5000)
            check('panel opens with the job title', 'Software Engineer till Acme' in await dlg.locator('h2').inner_text())
            check('full ad fetched from Platsbanken', 'Erfarenhet av FMEA' in await pg.input_value('#tl-ad'))
            check('output language follows the ad', await pg.input_value('#tl-lang') == 'sv')
            check('asks for a code, naming the author', 'Ask John Mawdsley for an access code' in await dlg.inner_text())
            check('before anything is written: a draft to check, not a finished text', "You'll get a draft to read and change, not a finished text." in await dlg.locator('.tl-result').inner_text())

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
            note = dlg.locator('.ai-note')
            check('the answer comes with a note that it is an AI draft, above it', await note.count() == 1 and await pg.evaluate("document.querySelector('.ai-note').compareDocumentPosition(document.querySelector('.tl-out')) & 4")
                  and 'Written by AI' == await note.locator('.ai-tag').text_content() and 'This is an estimate from the words in your CV and the ad' in await note.inner_text(), await note.all_inner_texts())
            check('focus lands on the note first', await pg.evaluate("document.activeElement.classList.contains('ai-note')"))
            fc = dlg.locator('.fc')
            check('the answer passed the fact check and says so, between the note and the text', await fc.count() == 1 and 'fc-ok' in (await fc.get_attribute('class'))
                  and 'every employer, job title and date in this text is in your CV' in await fc.inner_text()
                  and await pg.evaluate("document.querySelector('.fc').compareDocumentPosition(document.querySelector('.tl-out')) & 4"), await fc.all_inner_texts())
            report = await note.locator('a[data-fb=ai]').get_attribute('href')
            check('the note links to a report about the answer', '%5BAI%5D' in report and 'Part%3A%20Match%20check' in report, report)
            sent = last_ai()['body']
            user = sent['messages'][1]['content']
            check('server sent the ad, the CV and the wish', 'Erfarenhet av FMEA' in user and 'leverantörsrevisioner' in user and 'Håll det kort' in user and '<annons>' in user)
            check('server added its own rules and key', 'Hitta aldrig på' in sent['messages'][0]['content'] and last_ai()['auth'] == 'Bearer fake-key')
            check('job marked Saved after the first result', await acme.locator('article.role[data-ad="101"] select[data-role=status]').input_value() == 'Saved')

            await dlg.locator('[data-tl=copy]').click()
            clip = await pg.evaluate('navigator.clipboard.readText()')
            check('copy gives plain text', clip.replace('\r\n', '\n').startswith('Det som matchar\n• FMEA: åtta') and '**' not in clip and '##' not in clip and '---' not in clip, clip[:80])

            # Cover letter in English, then the Word file
            await dlg.locator('[data-task=letter]').click()
            check('task switch keeps the CV', (await pg.input_value('#tl-cv')) == cv_loaded)
            await pg.select_option('#tl-lang', 'en')
            await dlg.locator('[data-tl=go]').click(); await pg.wait_for_selector('#tailor .tl-out', timeout=10000)
            check('English prompt used', '<job_ad>' in last_ai()['body']['messages'][1]['content'])
            check('a cover letter gets the interview test', "If you couldn't explain something in an interview, take it out." in await dlg.locator('.ai-note').inner_text())
            check('finished tasks get a dot', await dlg.locator('[data-task=match] .tl-dot').count() == 1)

            # A tailored CV that names a job the CV doesn't have is flagged, by code on the server
            post(FAKE + '/mode', {'invent': True})
            await dlg.locator('[data-task=cv]').click(); await pg.select_option('#tl-lang', 'sv')
            await dlg.locator('[data-tl=go]').click(); await pg.wait_for_selector('#tailor .fc-warn', timeout=10000)
            warn = await dlg.locator('.fc-warn').inner_text()
            check('invented employer, title and date are listed above the answer', 'Fact check: 3 things here are not in your CV' in warn
                  and 'Bosch Rexroth' in warn and 'Senior kvalitetsingenjör' in warn and '2012' in warn and 'not by the AI' in warn, warn)
            check('the warning is announced', await dlg.locator('.fc-warn').get_attribute('role') == 'alert')
            await dlg.locator('.fc-warn').scroll_into_view_if_needed(); await pg.evaluate("document.querySelector('#tailor .fc-warn').scrollIntoView({block: 'center'})")
            await pg.screenshot(path=str(SHOTS / 'factcheck-en.png'))
            post(FAKE + '/mode', {'invent': False})
            stored = await pg.evaluate("JSON.parse(localStorage.getItem('jf-tailor'))['101'].out.cv.check")
            check('the check is saved with the answer', stored and stored['ok'] is False and len(stored['issues']) == 3, stored)
            await dlg.locator('[data-task=letter]').click()
            check('the letter shows its own check', await dlg.locator('.fc-ok').count() == 1 and await dlg.locator('.fc-warn').count() == 0)

            # Translate the ad inline, reusing the saved code without sending the CV
            await dlg.locator('.tl-close').click()
            trans_role = acme.locator('article.role[data-ad="101"]')
            await trans_role.locator('[data-translate]').click()
            await pg.wait_for_selector('article.role[data-ad="101"] .translation-text', timeout=10000)
            translation = await trans_role.locator('.translation-text').inner_text()
            check('English translation shown inline', 'Quality Engineer' in translation and 'quality improvements' in translation, translation)
            request_text = last_ai()['body']['messages'][1]['content']
            check('only ad text sent for translation', 'Erfarenhet av FMEA' in request_text and 'leverantörsrevisioner' not in request_text)
            check('translation code reused', await pg.evaluate("JSON.parse(localStorage.getItem('jf-code')).toUpperCase()") == CODE)
            await pg.locator('.lang button[data-lang=sv]').click()
            await pg.wait_for_function("document.querySelector('.lang button[data-lang=sv]').getAttribute('aria-pressed') === 'true'")
            bolt = pg.locator('article.co', has_text='Bolt Systems'); await bolt.locator('button.exp').click()
            check('no translation button on a Swedish ad in the Swedish interface', await bolt.locator('article.role[data-ad="103"] [data-translate]').count() == 0)
            sw_role = acme.locator('article.role[data-ad="102"]')
            check('Swedish interface offers Swedish translation of an English ad', await sw_role.locator('[data-translate]').inner_text() == 'Översätt annonsen till svenska')
            await sw_role.locator('[data-translate]').click()
            await pg.wait_for_selector('article.role[data-ad="102"] .translation-text', timeout=10000)
            check('Swedish interface requests Swedish translation and sends only ad text', len(translation_payloads) == 3 and translation_payloads[-1].get('lang') == 'sv' and translation_payloads[-1].get('job') == {'text': AD_TEXT} and 'Translate the job ad into natural Swedish' in last_ai()['body']['messages'][1]['content'], repr(translation_payloads[-1:]) + ' ' + last_ai()['body']['messages'][1]['content'])
            await pg.locator('.lang button[data-lang=en]').click()
            await pg.wait_for_function("document.querySelector('.lang button[data-lang=en]').getAttribute('aria-pressed') === 'true'")
            await trans_role.locator('[data-tailor]').click(); await pg.wait_for_selector('#tailor .tl-out', timeout=10000)

            async with pg.expect_download() as dl: await dlg.locator('[data-tl=word]').click()
            d = await dl.value; word = tmp / d.suggested_filename; await d.save_as(word)
            check('Word file name', d.suggested_filename == 'cover-letter-acme-robotics-software-engineer-till-acme.docx', d.suggested_filename)
            import docx
            doc = docx.Document(str(word)); paras = [x.text for x in doc.paragraphs]
            check('Word file opens and has the letter', paras[0] == 'Cover letter: Software Engineer till Acme, Acme Robotics' and 'Dear [contact person],' in paras and '• Eight years of FMEA' in paras, paras)
            check('bold kept in Word', any(r.bold and r.text == 'Acme Robotics' for x in doc.paragraphs for r in x.runs))
            if shutil.which('soffice'):
                conv = subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', str(tmp), str(word)], capture_output=True, timeout=120)
                check('LibreOffice can open the Word file', (tmp / (word.stem + '.pdf')).exists(), conv.stderr[-300:].decode(errors='replace'))
            else: print('SKIPPED LibreOffice open check: soffice is not installed')
            await pg.screenshot(path=str(SHOTS / 'tailor-en.png'))
            await pg.evaluate("document.documentElement.dataset.palette = 'terracotta'")
            check('the panel follows the chosen colours', await dlg.locator('.tl-head').evaluate('e => getComputedStyle(e).backgroundColor') == 'rgb(156, 74, 51)')
            await pg.evaluate("delete document.documentElement.dataset.palette")

            # Applying from the panel
            check('apply button in the panel header', await dlg.locator('.tl-head [data-tl=apply]').get_attribute('href') == 'https://apply.example/101')
            async with ctx.expect_page() as newpage: await dlg.locator('.tl-result [data-tl=apply]').click()
            await (await newpage.value).close()
            await pg.wait_for_selector('#tailor [data-tl=mark]')
            check('asks whether the application was sent', 'Sent your application?' in await dlg.locator('.tl-ask').inner_text())
            await dlg.locator('[data-tl=mark]').click()
            check('mark as applied from the panel', 'Marked as applied' in await dlg.inner_text() and await acme.locator('article.role[data-ad="101"] select[data-role=status]').input_value() == 'Applied')
            async with ctx.expect_page() as newpage: await dlg.locator('.tl-result [data-tl=apply]').click()
            await (await newpage.value).close(); await pg.wait_for_timeout(100)
            check('no question once applied', await dlg.locator('[data-tl=mark]').count() == 0)

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

            # When the full ad can't be fetched, the panel says so and fetches it again on request
            AD_DOWN['on'] = True
            await bolt.locator('article.role[data-ad="103"] [data-tailor]').click()
            await pg.wait_for_selector('#tailor [data-tl=refetch]', timeout=15000)
            check('a failed fetch says only an extract is shown', "Couldn't fetch the full ad from Platsbanken just now" in await dlg.locator('.tl-box').first.inner_text())
            AD_DOWN['on'] = False
            await dlg.locator('[data-tl=refetch]').click()
            await pg.wait_for_function("document.getElementById('tl-ad').value.includes('Kvalifikationer')", timeout=10000)
            check('fetch again fills in the full ad', 'Fetched from Platsbanken' in await dlg.locator('.tl-box').first.inner_text() and await dlg.locator('[data-tl=refetch]').count() == 0)
            await pg.set_viewport_size({'width': 320, 'height': 256})
            check('at 400% zoom the panel scrolls as a whole', await dlg.evaluate("d => getComputedStyle(d).overflowY === 'auto' && d.scrollWidth <= 320"))
            await pg.set_viewport_size({'width': 1280, 'height': 1000})
            await pg.keyboard.press('Escape')

            # Ads from other sites only have a short extract
            echo = pg.locator('article.co', has_text='Echo Apps'); await echo.locator('button.exp').click()
            await echo.locator('[data-tailor]').click(); await pg.wait_for_timeout(200)
            hint, adv = await dlg.locator('.tl-hint').first.inner_text(), await pg.input_value('#tl-ad')
            check('other-site ad: apply on that site', await dlg.locator('.tl-head [data-tl=apply]').inner_text() == 'Apply on The Hub')
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
