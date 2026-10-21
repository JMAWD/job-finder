"""Turns the recording from record.py into the finished demo video and its cover image.

    python3 demo/compose.py        # English, from demo/out/raw/
    python3 demo/compose.py sv     # Swedish, from demo/out/raw-sv/
    python3 demo/compose.py events [sv]   # the short clip of Fairs and events, from record_events.py

Adds a title card, the captions (highlighted words in **double stars**), a pointer with click rings and an end card,
in the seafoam and sunshine colours. Writes demo/out/job-finder-demo.mp4 (job-finder-demo-sv.mp4 in Swedish, 1080 x 1080, 30 fps)
and a cover image."""
import asyncio, bisect, json, pathlib, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
LANG = 'sv' if 'sv' in sys.argv[1:] else 'en'
EVENTS = 'events' in sys.argv[1:]
SUF = ('-events' if EVENTS else '') + ('' if LANG == 'en' else '-sv')
OUT = ROOT / 'demo' / 'out'; RAW = OUT / ('raw' + SUF)
S, FPS = 1080, 30
GREEN, DEEP, SUN, MIST = '#1c6b5a', '#0f2e27', '#ffd86a', '#cde8de'
TITLE_S, END_S, FADE = 3.6, 4.8, 0.4
FONT = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'

LOGO = f"""<svg viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="14" fill="#134f42"/><circle cx="28" cy="28" r="14" fill="none" stroke="{SUN}" stroke-width="6"/>
<path d="M38 38l12 12" stroke="{SUN}" stroke-width="7" stroke-linecap="round"/></svg>"""
CARD = """<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><style>
* {{ box-sizing: border-box; margin: 0; }}
body {{ width: 1080px; height: 1080px; background: {green}; color: #fff; font-family: Inter, system-ui, sans-serif; display: grid; align-content: center; padding: 0 96px; }}
.brand {{ display: flex; align-items: center; gap: 22px; margin-bottom: 44px; }}
.brand span {{ font-family: "DejaVu Sans Mono", monospace; font-size: 28px; letter-spacing: .14em; color: {sun}; }}
h1 {{ font-size: 76px; line-height: 1.06; letter-spacing: -.02em; font-weight: 800; }}
p {{ margin-top: 34px; font-size: 34px; line-height: 1.4; color: {mist}; max-width: 820px; }}
.url {{ display: inline-block; margin-top: 34px; font-family: "DejaVu Sans Mono", monospace; font-size: 34px; color: {sun}; background: #134f42; border: 2px solid rgba(255,255,255,.22); border-radius: 12px; padding: 10px 20px; }}
.small {{ font-size: 24px; color: #a9d6c6; margin-top: 30px; }}
</style></head><body><div class="brand">{logo}<span>JOB FINDER</span></div>{body}</body></html>"""
TITLE = {'en': "<h1>Find who's hiring.<br>Tailor your application.<br>Plan your next step.</h1><p>A free job search for Sweden, built on Platsbanken's open data.</p>",
         'sv': "<h1>Hitta vem som anställer.<br>Anpassa din ansökan.<br>Planera nästa steg.</h1><p>En gratis jobbsökare för Sverige, byggd på Platsbankens öppna data.</p>"}[LANG]
END = {'en': ("<h1>Free. No account.<br>Swedish and English.</h1><div class=\"url\">jmawd.github.io/job-finder</div>"
              "<p>Advice based on your experience and plans, never your age.</p><p class=\"small\">Demo with fictional companies, people and ads.</p>"),
       'sv': ("<h1>Gratis. Inget konto.<br>Svenska och engelska.</h1><div class=\"url\">jmawd.github.io/job-finder</div>"
              "<p>Råd utifrån din erfarenhet och dina planer, aldrig din ålder.</p><p class=\"small\">Demo med påhittade företag, personer och annonser.</p>")}[LANG]
if EVENTS:
    TITLE = {'en': "<h1>Fairs and events<br>in your field.</h1><p>New in Job Finder: trade fairs, conferences and job fairs that fit your search, right above the job ads.</p>",
             'sv': "<h1>Mässor och evenemang<br>inom ditt område.</h1><p>Nytt i Job Finder: fackmässor, konferenser och jobbmässor som passar din sökning, direkt ovanför annonserna.</p>"}[LANG]
    END = {'en': ("<h1>Free. No account.<br>Swedish and English.</h1><div class=\"url\">jmawd.github.io/job-finder</div>"
                  "<p>Go to talk and make contacts, not to hand out CVs.</p><p class=\"small\">Fictional job ads. The events are real, from the venues' calendars in October 2026.</p>"),
           'sv': ("<h1>Gratis. Inget konto.<br>Svenska och engelska.</h1><div class=\"url\">jmawd.github.io/job-finder</div>"
                  "<p>Gå dit för att prata och knyta kontakter, inte för att dela ut CV.</p><p class=\"small\">Påhittade jobbannonser. Evenemangen är riktiga, från mässornas kalendrar i oktober 2026.</p>")}[LANG]

async def cards():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': S, 'height': S})
        for name, body in (('title', TITLE), ('end', END)):
            await pg.set_content(CARD.format(lang=LANG, green=GREEN, sun=SUN, mist=MIST, logo=LOGO, body=body)); await pg.wait_for_timeout(200)
            await pg.screenshot(path=str(OUT / f'{name}{SUF}.png'))
        await b.close()

def caption_sprite(text):
    """The caption bar as an RGBA image: deep green, a sunshine rule on top, white text with the starred words in yellow."""
    font = ImageFont.truetype(FONT, 40); pad, lh, maxw = 44, 54, S - 88
    words, hi, buf, sp, gap = [], False, '', False, False   # words: (text, highlighted, space before it)
    for tok in re.split(r'(\*\*|\s+)', text):
        if tok == '**': hi = not hi
        elif tok and tok.isspace(): gap = True
        elif tok: words.append((tok, hi, gap)); gap = False
    lines, cur, x = [], [], 0
    for w, hi, sp in words:
        gap = font.getlength(' ') if sp and cur else 0
        if cur and x + gap + font.getlength(w) > maxw: lines.append(cur); cur, x, gap = [], 0, 0
        cur.append((w, hi, x + gap)); x += gap + font.getlength(w)
    lines.append(cur)
    h = 2 * 30 + lh * len(lines) + 6
    im = Image.new('RGBA', (S, h), (15, 46, 39, 244)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, S, 5], fill=SUN)
    for i, line in enumerate(lines):
        for w, hi, x in line: d.text((pad + x, 30 + 6 + i * lh), w, font=font, fill=SUN if hi else '#ffffff')
    return im

def cursor_sprite():
    """A plain arrow pointer, white with a dark outline."""
    k = 1.55; pts = [(0, 0), (0, 17), (4.2, 13.2), (7, 19.5), (9.6, 18.4), (6.9, 12.2), (12.2, 12.2)]
    im = Image.new('RGBA', (40, 44), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    shadow = [(3 + x * k, 4 + y * k) for x, y in pts]; d.polygon(shadow, fill=(0, 0, 0, 60))
    poly = [(2 + x * k, 2 + y * k) for x, y in pts]; d.polygon(poly, fill='#ffffff', outline='#14211e'); d.line(poly + [poly[0]], fill='#14211e', width=2)
    return im

def main():
    asyncio.run(cards())
    ev = json.loads((RAW / 'events.json').read_text())
    start, end, scale = ev['start'], ev['end'], ev['scale']
    frames = ev['frames']; fts = [f[0] for f in frames]
    path = ev['path']; pts = [p[0] for p in path]
    caps = [(a - start, (b or end) - start, caption_sprite(t)) for a, b, t in ev['caps']]
    clicks = [(t - start, x * scale, y * scale) for t, x, y in ev['clicks']]
    title, endcard = Image.open(OUT / f'title{SUF}.png').convert('RGB'), Image.open(OUT / f'end{SUF}.png').convert('RGB')
    title.save(OUT / f'job-finder-demo{SUF}-cover.png')
    arrow = cursor_sprite(); app_len = end - start
    cache = {}
    def raw_at(t):
        i = max(0, bisect.bisect_right(fts, start + t) - 1); name = frames[i][1]
        if name not in cache: cache.clear(); cache[name] = Image.open(RAW / name).convert('RGB').resize((S, S))
        return cache[name]
    def cursor_at(t):
        i = max(0, bisect.bisect_right(pts, start + t) - 1); return path[i][1] * scale, path[i][2] * scale
    def app_frame(t):
        im = raw_at(t).convert('RGBA')
        for a, b, spr in caps:
            if a - 0.05 <= t <= b + 0.25:
                al = min(1, (t - a + 0.05) / 0.25, (b + 0.25 - t) / 0.25)
                layer = spr.copy(); layer.putalpha(layer.getchannel('A').point(lambda v: int(v * al)))
                im.alpha_composite(layer, (0, S - spr.height))
        d = ImageDraw.Draw(im)
        for ct, cx, cy in clicks:
            age = t - ct
            if 0 <= age <= 0.5:
                r = 10 + 34 * (age / 0.5); a = int(230 * (1 - age / 0.5))
                ring = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(ring).ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 216, 106, a), width=5)
                im.alpha_composite(ring)
        x, y = cursor_at(t); im.alpha_composite(arrow, (int(x) - 2, int(y) - 2))
        return im.convert('RGB')
    total = TITLE_S + app_len + END_S
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{S}x{S}', '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(OUT / f'job-finder-demo{SUF}.mp4')], stdin=subprocess.PIPE)
    n = int(total * FPS)
    for i in range(n):
        t = i / FPS
        if t < TITLE_S - FADE / 2: im = title
        elif t < TITLE_S + FADE / 2: im = Image.blend(title, app_frame(0), (t - TITLE_S + FADE / 2) / FADE)
        elif t < TITLE_S + app_len - FADE / 2: im = app_frame(t - TITLE_S)
        elif t < TITLE_S + app_len + FADE / 2: im = Image.blend(app_frame(min(app_len, t - TITLE_S)), endcard, (t - TITLE_S - app_len + FADE / 2) / FADE)
        else: im = endcard
        ff.stdin.write(im.tobytes())
    ff.stdin.close(); ff.wait()
    print(f'job-finder-demo{SUF}.mp4: {total:.1f} s, {n} frames')

if __name__ == '__main__':
    main()
