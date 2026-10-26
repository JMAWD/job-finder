"""Turns the recording from record.py into the finished demo video and its cover image.

    python3 demo/compose.py            # English, from demo/out/raw/
    python3 demo/compose.py sv         # Swedish, from demo/out/raw-sv/
    python3 demo/compose.py new        # what's new in 1.8, from demo/out/raw-new/

Adds a title card, the captions (highlighted words in **double stars**), a pointer with click rings and an end card,
in the seafoam and sunshine colours. Writes demo/out/job-finder-demo.mp4 (job-finder-demo-sv.mp4 in Swedish,
job-finder-demo-new.mp4 for what's new, 1080 x 1080, 30 fps) and a cover image. What's new also cuts to the PDF it
downloaded, with the lines Sam added marked, where record.py marked the cut."""
import asyncio, bisect, json, pathlib, re, subprocess, sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
LANG = 'sv' if 'sv' in sys.argv[1:] else 'en'
CLIP = 'new' if 'new' in sys.argv[1:] else ''
SUF = '-new' if CLIP else '' if LANG == 'en' else '-sv'
OUT = ROOT / 'demo' / 'out'; RAW = OUT / ('raw' + SUF)
S, FPS = 1080, 30
GREEN, DEEP, SUN, MIST = '#1c6b5a', '#0f2e27', '#ffd86a', '#cde8de'
TITLE_S, END_S, PDF_S, FADE = (2.4, 3.4, 2.4, 0.3) if CLIP else (3.6, 4.8, 2.6, 0.4)
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
.tag {{ justify-self: start; font-family: "DejaVu Sans Mono", monospace; font-size: 26px; letter-spacing: .12em; color: {deep}; background: {sun}; border-radius: 10px; padding: 8px 18px; margin-bottom: 30px; }}
</style></head><body><div class="brand">{logo}<span>JOB FINDER</span></div>{body}</body></html>"""
TITLE = {'en': "<h1>Find who's hiring.<br>Tailor your application.<br>Plan your next step.</h1><p>A free job search for Sweden, built on Platsbanken's open data.</p>",
         'sv': "<h1>Hitta vem som anställer.<br>Anpassa din ansökan.<br>Planera nästa steg.</h1><p>En gratis jobbsökare för Sverige, byggd på Platsbankens öppna data.</p>"}[LANG]
END = {'en': ("<h1>Free. No account.<br>Swedish and English.</h1><div class=\"url\">jmawd.github.io/job-finder</div>"
              "<p>Advice based on your experience and plans, never your age.</p><p class=\"small\">Demo with fictional companies, people and ads.</p>"),
       'sv': ("<h1>Gratis. Inget konto.<br>Svenska och engelska.</h1><div class=\"url\">jmawd.github.io/job-finder</div>"
              "<p>Råd utifrån din erfarenhet och dina planer, aldrig din ålder.</p><p class=\"small\">Demo med påhittade företag, personer och annonser.</p>")}[LANG]
if CLIP:   # What's new: a short title, and an end card on what step 2 promises
    TITLE = ("<div class=\"tag\">WHAT'S NEW</div><h1>Six new things<br>in Job Finder</h1>"
             "<p>A free job search for Sweden, with an AI that sticks to your CV.</p>")
    END = ("<h1>Free. No account.<br>Checked against<br>your CV.</h1><div class=\"url\">jmawd.github.io/job-finder</div>"
           "<p>Tailoring is in a small beta and needs an access code.</p><p class=\"small\">Demo with fictional companies, people and ads.</p>")

async def cards():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': S, 'height': S})
        for name, body in (('title', TITLE), ('end', END)):
            await pg.set_content(CARD.format(lang=LANG, green=GREEN, deep=DEEP, sun=SUN, mist=MIST, logo=LOGO, body=body)); await pg.wait_for_timeout(200)
            await pg.screenshot(path=str(OUT / f'{name}{SUF}.png'))
        await b.close()

def caption_sprite(text):
    """The caption bar as an RGBA image: deep green, a sunshine rule on top, white text with the starred words in yellow."""
    font = ImageFont.truetype(FONT, 31); pad, lh, maxw, top = 32, 40, S - 64, 14
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
    h = 2 * top + lh * len(lines) + 4
    im = Image.new('RGBA', (S, h), (15, 46, 39, 236)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, S, 3], fill=SUN)
    for i, line in enumerate(lines):
        for w, hi, x in line: d.text((pad + x, top + 4 + i * lh), w, font=font, fill=SUN if hi else '#ffffff')
    return im

def cursor_sprite():
    """A plain arrow pointer, white with a dark outline."""
    k = 1.55; pts = [(0, 0), (0, 17), (4.2, 13.2), (7, 19.5), (9.6, 18.4), (6.9, 12.2), (12.2, 12.2)]
    im = Image.new('RGBA', (40, 44), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    shadow = [(3 + x * k, 4 + y * k) for x, y in pts]; d.polygon(shadow, fill=(0, 0, 0, 60))
    poly = [(2 + x * k, 2 + y * k) for x, y in pts]; d.polygon(poly, fill='#ffffff', outline='#14211e'); d.line(poly + [poly[0]], fill='#14211e', width=2)
    return im

def pdf_card(caption):
    """The 1.8 clip's last shot: the CV PDF it downloaded, cropped to the text, with the lines that mention ISO 26262
    marked in sunshine, on the brand green with the last caption."""
    pdf, png = RAW / 'cv.pdf', OUT / f'pdf{SUF}'
    subprocess.run(['pdftoppm', '-r', '200', '-png', '-singlefile', '-f', '1', '-l', '1', str(pdf), str(png)], check=True)
    page, k = Image.open(f'{png}.png').convert('RGB'), 200 / 72
    bbox = subprocess.run(['pdftotext', '-f', '1', '-l', '1', '-bbox', str(pdf), '-'], capture_output=True, text=True, check=True).stdout
    words = [(float(a), float(b), float(c), float(d), w) for a, b, c, d, w in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', bbox)]
    marks = []
    for x0, y0, x1, y1, w in words:
        if w != '26262': continue
        # The run of words on the same line around it (key skills sit in two columns, so a wide gap ends the run)
        line = sorted(v for v in words if abs(v[1] - y0) < 1); i = line.index((x0, y0, x1, y1, w)); a = b = i
        while a > 0 and line[a][0] - line[a - 1][2] < 14: a -= 1
        while b < len(line) - 1 and line[b + 1][0] - line[b][2] < 14: b += 1
        marks.append((line[a][0], y0, line[b][2], y1))
    top, bottom = min(w[1] for w in words) - 34, max(w[3] for w in words) + 34
    left, right = min(w[0] for w in words) - 30, max(w[2] for w in words) + 30
    # A highlighter: sunshine multiplied under the text, so the letters stay dark
    tint = Image.new('RGB', page.size, 'white'); d = ImageDraw.Draw(tint)
    for x0, y0, x1, y1 in marks: d.rounded_rectangle([(x0 - 5) * k, (y0 - 3) * k, (x1 + 5) * k, (y1 + 3) * k], radius=8, fill=SUN)
    page = ImageChops.multiply(page, tint)
    crop = page.crop((int(left * k), int(top * k), int(right * k), int(bottom * k)))
    cap = caption_sprite(caption); room_w, room_h = S - 120, S - cap.height - 90
    f = min(room_w / crop.width, room_h / crop.height); crop = crop.resize((int(crop.width * f), int(crop.height * f)), Image.LANCZOS)
    im = Image.new('RGBA', (S, S), GREEN); x, y = (S - crop.width) // 2, 45 + (room_h - crop.height) // 2
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(shadow).rounded_rectangle([x + 6, y + 10, x + crop.width + 6, y + crop.height + 10], radius=14, fill=(8, 30, 25, 140))
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)))
    m = Image.new('L', crop.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, crop.width - 1, crop.height - 1], radius=14, fill=255)
    im.paste(crop, (x, y), m); im.alpha_composite(cap, (0, S - cap.height))
    return im.convert('RGB')

def main():
    asyncio.run(cards())
    ev = json.loads((RAW / 'events.json').read_text())
    start, end, scale = ev['start'], ev['end'], ev['scale']
    frames = ev['frames']; fts = [f[0] for f in frames]
    path = ev['path']; pts = [p[0] for p in path]
    caps = [(a - start, (b or end) - start, caption_sprite(t)) for a, b, t in ev['caps']]
    clicks = [(t - start, x * scale, y * scale) for t, x, y in ev['clicks']]
    spots = [(a - start, b - start, x * scale, y * scale, w * scale, h * scale) for a, b, x, y, w, h in ev.get('spots', [])]
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
        for a, b, x, y, w, h in spots:      # a sunshine box around what the caption is about, fading in and out
            if a <= t <= b:
                al = min(1, (t - a) / 0.25, (b - t) / 0.25)
                box = Image.new('RGBA', (S, S), (0, 0, 0, 0))
                ImageDraw.Draw(box).rounded_rectangle([x, y, x + w, y + h], radius=10, outline=(255, 216, 106, int(255 * al)), width=6)
                ImageDraw.Draw(box).rounded_rectangle([x - 3, y - 3, x + w + 3, y + h + 3], radius=12, outline=(15, 46, 39, int(110 * al)), width=2)
                im.alpha_composite(box)
        d = ImageDraw.Draw(im)
        for ct, cx, cy in clicks:
            age = t - ct
            if 0 <= age <= 0.5:
                r = 10 + 34 * (age / 0.5); a = int(230 * (1 - age / 0.5))
                ring = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(ring).ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 216, 106, a), width=5)
                im.alpha_composite(ring)
        x, y = cursor_at(t); im.alpha_composite(arrow, (int(x) - 2, int(y) - 2))
        return im.convert('RGB')
    # The shots in order, each (length, frame at a time within it), with a cross-fade at every cut
    # The app is cut where record.py marked a shot of its own (the PDF), and jumps over what it said to skip (waiting for
    # the AI, or getting from one view to the next). Every cut cross-fades.
    shots, done = [(TITLE_S, lambda t: title)], 0
    def upto(at):
        if at - done > 0.3: shots.append((at - done, lambda t, o=done: app_frame(o + t)))
    marks = [(a - start, 'card', c) for a, k, c in ev.get('inserts', []) if k == 'pdf' and (RAW / 'cv.pdf').exists()]
    marks += [(a - start, 'skip', b - start) for a, b in ev.get('skips', []) if b]
    for at, kind, x in sorted(marks, key=lambda m: m[0]):
        upto(at)
        if kind == 'card': card = pdf_card(x); shots.append((PDF_S, lambda t, im=card: im)); done = at
        else: done = max(done, x)
    upto(app_len); shots.append((END_S, lambda t: endcard))
    cuts = [sum(s[0] for s in shots[:i + 1]) for i in range(len(shots))]
    total = cuts[-1]
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{S}x{S}', '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(OUT / f'job-finder-demo{SUF}.mp4')], stdin=subprocess.PIPE)
    n = int(total * FPS)
    for i in range(n):
        t = i / FPS
        k = next(j for j, c in enumerate(cuts) if t < c or j == len(cuts) - 1)
        begin = cuts[k - 1] if k else 0
        if k + 1 < len(shots) and t > cuts[k] - FADE / 2:      # fading into the next shot
            im = Image.blend(shots[k][1](min(shots[k][0], t - begin)), shots[k + 1][1](0), (t - cuts[k] + FADE / 2) / FADE)
        elif k and t < begin + FADE / 2:                        # still fading in from the one before
            im = Image.blend(shots[k - 1][1](shots[k - 1][0]), shots[k][1](0), (t - begin + FADE / 2) / FADE)
        else: im = shots[k][1](t - begin)
        ff.stdin.write(im.tobytes())
    ff.stdin.close(); ff.wait()
    print(f'job-finder-demo{SUF}.mp4: {total:.1f} s, {n} frames')

if __name__ == '__main__':
    main()
