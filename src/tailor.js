/* ---------- Step 2: tailor an application to one job ----------
   Opens a panel over the list with the full ad, the person's CV and four things the AI can write.
   Platsbanken ads can also be translated inline; translation sends only the ad text, without a CV.
   The CV and access code are kept in this browser. Translation sends only the ad text; Generate sends the CV,
   ad, any extra wishes and anything the person added that their CV leaves out to the tailoring server, which forwards
   them to an AI model hosted in the EU. */
const TASKS = ["match", "cv", "letter", "interview"];
const DOC_TASKS = new Set(["cv", "letter"]);   // the texts that go to the employer, so they download as a PDF with no title of ours
const TAILOR_TIMEOUT = 110000;
let tl = null;   // the open job: { id, title, employer, muni, url, src, task, busy, ctrl }
let tailorStore = store.get("jf-tailor", {});   // ad id -> { ad, extra, facts, out: { task: { text, at, model, lang, facts, check, trace, impact, keep } } }
const saveTailor = () => store.set("jf-tailor", tailorStore);
const tlEntry = id => tailorStore[id] || (tailorStore[id] = { out: {} });
const fullAds = new Map(), adFails = new Set();   // ads fetched in full, and Platsbanken ads that couldn't be fetched this time
const translations = new Map();   // translated ads stay in memory for this page view; never saved with application data

const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;   // a "---" divider line, left out everywhere
// Small Markdown reader for the AI's answers: headings, lists, bold, italics. Everything is escaped first.
// "#" (the name on a tailored CV) becomes h3, "##" h4 and "###" or deeper h5.
// With ann (annotate below), sentences are marked: unsupported ones always, and every sentence's source when sources is on.
function mdHtml(text, ann = null, sources = false) {
  const out = []; let list = null;
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*(\S[^*]*?)\*(?=[\s).,;:!?]|$)/g, "$1<i>$2</i>");
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const sentence = (a, si) => {
    const html = inline(esc(a.parts[si])), k = a.kinds[si], label = esc(t("src.k." + k));
    if (a.block >= 0) return sources ? `<span class="src src-${k}">${html}</span>` : html;   // a job that isn't in the CV is marked as a whole
    if (k === "u") return `<span class="src src-u${a.q[si] ? "" : " kept"}">${html}</span> <span class="q-tag">${esc(t(a.q[si] ? "q.tag" : "q.tagkept"))}</span>`;
    return sources ? `<span class="src src-${k}" title="${label}">${html}<span class="vh"> (${label})</span></span>` : html;
  };
  String(text).split("\n").forEach((raw, li) => {
    const l = esc(raw), a = ann?.[li];
    if (RULE.test(l)) { close(); return; }
    const h = l.match(/^\s*(#{1,6})\s+(.*)/), ul = l.match(/^\s*[-*•]\s+(.*)/), ol = l.match(/^\s*\d+[.)]\s+(.*)/);
    const marked = a && a.parts.length && (sources || a.block >= 0 || a.kinds.includes("u"));
    const body = s => marked ? a.parts.map((_, si) => sentence(a, si)).join(" ") + (a.head ? ` <span class="q-tag">${esc(t(a.q[0] ? "q.jobtag" : "q.tagkept"))}</span>` : "") : inline(s);
    const cls = a && a.block >= 0 ? ` class="q-block${a.q.some(Boolean) ? "" : " kept"}"` : "";
    if (h) { close(); const tag = h[1].length === 1 ? "h3" : h[1].length === 2 ? "h4" : "h5"; out.push(`<${tag}${cls}>${body(h[2])}</${tag}>`); }
    else if (ul || ol) { const tag = ul ? "ul" : "ol"; if (list !== tag) { close(); out.push(`<${tag}>`); list = tag; } out.push(`<li${cls}>${body((ul || ol)[1])}</li>`); }
    else if (!l.trim()) close();
    else { close(); out.push(`<p${cls}>${body(l)}</p>`); }
  });
  close();
  return out.join("");
}
const plainText = md => md.split("\n").filter(l => !RULE.test(l)).join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\s*#{1,6}\s+/gm, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/^\s*[-*]\s+/gm, "• ").trim();

/* ---------- Reading a .docx CV in the browser (a .docx file is a zip with the text in word/document.xml) ---------- */
async function docxText(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip");
  let p = dv.getUint32(eocd + 16, true);
  for (let n = dv.getUint16(eocd + 10, true); n > 0; n--) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    if (name === "word/document.xml") {
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      let data = u8.subarray(start, start + size);
      if (method === 8) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
      else if (method !== 0) throw new Error("unsupported compression");
      const doc = new DOMParser().parseFromString(new TextDecoder().decode(data), "application/xml");
      const lines = [];
      for (const para of doc.getElementsByTagName("w:p")) {
        let s = "";
        for (const node of para.getElementsByTagName("*")) {
          if (node.tagName === "w:t") s += node.textContent;
          else if (node.tagName === "w:tab") s += "\t";
          else if (node.tagName === "w:br") s += "\n";
        }
        const isList = para.getElementsByTagName("w:numPr").length > 0;
        lines.push((isList && s.trim() ? "- " : "") + s);
      }
      return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    p += 46 + nlen + xlen + clen;
  }
  throw new Error("no document.xml");
}

/* ---------- Writing a simple .docx from the AI's answer, so it opens in Word, Pages or Google Docs ---------- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xffffffff; for (const b of u8) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zipStore(files, type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {   // files: [[name, Uint8Array]] stored without compression
  const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
  for (const [name, data] of files) {
    const nb = enc.encode(name), crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, nb.length, true);
    parts.push(new Uint8Array(local.buffer), nb, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true); cen.setUint16(28, nb.length, true); cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), nb);
    offset += 30 + nb.length + data.length;
  }
  const cenSize = central.reduce((n, b) => n + b.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type });
}
// An Excel file of rows of text, the first row bold and frozen as headings. Made here, like the Word file, with nothing sent.
function xlsxBlob(rows, sheetName = "Sheet1") {
  const enc = new TextEncoder(), x = v => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const col = i => { let s = ""; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n', ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const widths = (rows[0] || []).map((_, ci) => Math.min(60, Math.max(8, ...rows.slice(0, 200).map(r => String(r[ci] ?? "").length + 2))));
  const sheet = `${head}<worksheet ${ns}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    + `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>`
    + rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => `<c r="${col(ci)}${ri + 1}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${x(v)}</t></is></c>`).join("")}</row>`).join("")
    + `</sheetData>${rows.length > 1 ? `<autoFilter ref="A1:${col((rows[0] || []).length - 1)}${rows.length}"/>` : ""}</worksheet>`;
  const files = [
    ["[Content_Types].xml", `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels", `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `${head}<workbook ${ns} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${x(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `${head}<styleSheet ${ns}><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`],
    ["xl/worksheets/sheet1.xml", sheet],
  ];
  return zipStore(files.map(([n, v]) => [n, enc.encode(v)]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
function docxBlob(md, title, textLang) {
  const x = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const runs = (s, base = "") => s.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(part => {
    const bold = /^\*\*.*\*\*$/.test(part), txt = bold ? part.slice(2, -2) : part;
    return `<w:r><w:rPr>${base}${bold ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${x(txt)}</w:t></w:r>`;
  }).join("");
  // A CV or cover letter is sent as it is, so it gets no title of ours; the match check and interview prep do
  const paras = title ? [`<w:p><w:pPr><w:spacing w:after="200"/></w:pPr>${runs(title, '<w:b/><w:sz w:val="32"/>')}</w:p>`] : [];
  for (const line of md.split("\n")) {
    const h = line.match(/^\s*(#{1,6})\s+(.*)/), ul = line.match(/^\s*[-*•]\s+(.*)/), ol = line.match(/^\s*(\d+)[.)]\s+(.*)/);
    if (!line.trim() || RULE.test(line)) continue;
    if (h) { const lv = h[1].length; paras.push(`<w:p><w:pPr><w:spacing w:before="${lv === 1 ? 0 : lv === 2 ? 240 : 160}" w:after="${lv === 1 ? 40 : 80}"/><w:keepNext/></w:pPr>${runs(h[2], `<w:b/><w:sz w:val="${lv === 1 ? 40 : lv === 2 ? 26 : 22}"/>`)}</w:p>`); }
    else if (ul) paras.push(`<w:p><w:pPr><w:ind w:left="360" w:hanging="240"/><w:spacing w:after="60"/></w:pPr>${runs("• " + ul[1])}</w:p>`);
    else if (ol) paras.push(`<w:p><w:pPr><w:ind w:left="360" w:hanging="300"/><w:spacing w:after="60"/></w:pPr>${runs(ol[1] + ". " + ol[2])}</w:p>`);
    else paras.push(`<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${runs(line.trim())}</w:p>`);
  }
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="${textLang === "en" ? "en-GB" : "sv-SE"}"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  const enc = new TextEncoder();
  return zipStore([
    ["[Content_Types].xml", enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`)],
    ["_rels/.rels", enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)],
    ["word/_rels/document.xml.rels", enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)],
    ["word/document.xml", enc.encode(doc)],
    ["word/styles.xml", enc.encode(styles)],
  ]);
}

/* ---------- Writing a PDF from the AI's answer, in the browser with no library ----------
   Uses the PDF viewer's own Helvetica, so no font is embedded and the file stays small. Those fonts cover Swedish and the
   other Western European letters (WinAnsi); anything else is drawn as "?" and counted, so the panel can suggest Word instead.
   A tailored CV gets a CV layout: the name large, the contact line under it, section headings, and each job's years
   right-aligned on its heading line. Email addresses and web links can be clicked. */
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const HELV_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];
// Characters outside Latin-1 that WinAnsi still has (curly quotes, dashes, bullet, euro …), and near matches for a few others
const WIN = new Map([[0x20ac, 0x80], [0x201a, 0x82], [0x192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x2c6, 0x88], [0x2030, 0x89], [0x160, 0x8a],
  [0x2039, 0x8b], [0x152, 0x8c], [0x17d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x2dc, 0x98],
  [0x2122, 0x99], [0x161, 0x9a], [0x203a, 0x9b], [0x153, 0x9c], [0x17e, 0x9e], [0x178, 0x9f]]);
const NEAR = { "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2212": "-", "\u2032": "'", "\u2033": '"', "\u00ad": "", "\u200b": "", "\u2009": " ", "\u202f": " ", "\u2007": " ",
  "\u0141": "L", "\u0142": "l", "\u0110": "D", "\u0111": "d", "\u0131": "i", "\u2192": "->", "\u2264": "<=", "\u2265": ">=", "\u25cf": "\u2022", "\u25aa": "\u2022" };
const latin = c => (c >= 32 && c < 127) || (c >= 0xa0 && c <= 0xff);
function winAnsi(s) {   // the text as WinAnsi bytes (one char per byte), and how many characters had to become "?"
  let out = "", lost = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c === 9) { out += " "; continue; }
    if (c < 32) continue;
    if (latin(c)) { out += ch; continue; }
    if (WIN.has(c)) { out += String.fromCharCode(WIN.get(c)); continue; }
    const near = NEAR[ch] ?? ch.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    if (near && [...near].every(b => latin(b.codePointAt(0)) || WIN.has(b.codePointAt(0)))) { out += [...near].map(b => latin(b.codePointAt(0)) ? b : String.fromCharCode(WIN.get(b.codePointAt(0)))).join(""); continue; }
    out += "?"; lost++;
  }
  return { text: out, lost };
}
const pdfStr = s => s.replace(/[\\()]/g, "\\$&");
const utf16 = s => "<FEFF" + [...String(s)].map(ch => { const c = ch.codePointAt(0); return c > 0xffff ? "003F" : c.toString(16).toUpperCase().padStart(4, "0"); }).join("") + ">";
const glyphW = (code, font) => (font === "B" ? HELV_B : HELV)[code - 32] || 556;
// "### Quality Engineer, Nordvik (2018–now)" -> the role on the left and its years on the right
function splitYears(s) {
  const m = s.match(/^(.*?)[\s,·|]*\(([^()]*\b(?:19|20)\d\d\b[^()]*)\)\s*$/) || s.match(/^(.*?)\s*[·|,–]\s*((?:[\p{L}.]+\s+)?(?:19|20)\d\d(?:\s*[–—-]\s*(?:[\p{L}.]+\s+)?(?:(?:19|20)\d\d|[\p{L}]+))?)\s*$/u);
  return m && m[1].trim() ? [m[1].trim(), m[2].trim()] : [s, ""];
}

function pdfBlob(md, { title = "", author = "", lang: textLang = "sv", letter = false } = {}) {
  // A letter is read as running text, so it gets a slightly larger size, more line spacing and room between paragraphs
  const BODY = letter ? { size: 10.6, lead: 15.4, para: 9 } : { size: 10, lead: 13.6, para: 6 };
  const PW = 595.28, PH = 841.89, L = 56, R = 56, TOP = 56, BOTTOM = 62, FULL = PW - L - R;
  const C = { ink: "0.13 0.15 0.17", muted: "0.39 0.42 0.45", accent: "0.11 0.35 0.41", rule: "0.78 0.81 0.83" };
  const pages = []; let pg, y, lost = 0;
  const newPage = () => { pg = { ops: [], annots: [] }; pages.push(pg); y = PH - TOP; };
  newPage();
  const atTop = () => y === PH - TOP;

  // Markdown inline (**bold**, *italic*, [link](url), `code`) -> runs of text in one font
  function runs(s, font, upper, count = true) {
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => txt === url ? url : `${txt} (${url})`).replace(/`/g, "");
    const out = [];
    for (const part of s.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*)/)) {
      if (!part) continue;
      const bold = /^(\*\*|__).*(\*\*|__)$/.test(part) && part.length > 4, ital = !bold && /^\*.*\*$/.test(part) && part.length > 2;
      const txt = bold ? part.slice(2, -2) : ital ? part.slice(1, -1) : part;
      const enc = winAnsi(upper ? txt.toLocaleUpperCase(textLang === "en" ? "en" : "sv") : txt); if (count) lost += enc.lost;
      out.push({ t: enc.text, f: font === "B" || bold ? "B" : ital ? "I" : font });
    }
    return out;
  }
  // Runs -> words that each know their width; a word can mix fonts ("**FMEA**,")
  function words(rs, size, tc) {
    const out = []; let cur = null, space = false;
    for (const r of rs) for (const ch of r.t) {
      if (ch === " ") { if (cur) { out.push(cur); cur = null; } space = true; continue; }
      if (!cur) { cur = { segs: [], w: 0, space: space && out.length > 0 }; space = false; }
      const last = cur.segs[cur.segs.length - 1];
      if (last && last.f === r.f) last.t += ch; else cur.segs.push({ t: ch, f: r.f });
      cur.w += glyphW(ch.charCodeAt(0), r.f) * size / 1000 + tc;
    }
    if (cur) out.push(cur);
    return out;
  }
  // Greedy line breaking; a word longer than the line (a long link) is cut where it has to be
  function wrap(ws, width, size, tc) {
    const sp = glyphW(32, "R") * size / 1000 + tc, lines = []; let line = [], w = 0;
    const push = wd => { const s = line.length > 0 && wd.space; line.push({ ...wd, space: s }); w += (s ? sp : 0) + wd.w; };
    for (const wd of ws) {
      if (line.length && w + (wd.space ? sp : 0) + wd.w > width) { lines.push(line); line = []; w = 0; }
      if (!line.length && wd.w > width) {
        let piece = { segs: [], w: 0, space: false };
        for (const s of wd.segs) for (const ch of s.t) {
          const cw = glyphW(ch.charCodeAt(0), s.f) * size / 1000 + tc;
          if (piece.w + cw > width && piece.w) { lines.push([piece]); piece = { segs: [], w: 0, space: false }; }
          const last = piece.segs[piece.segs.length - 1];
          if (last && last.f === s.f) last.t += ch; else piece.segs.push({ t: ch, f: s.f });
          piece.w += cw;
        }
        line = [piece]; w = piece.w; continue;
      }
      push(wd);
    }
    if (line.length) lines.push(line);
    return lines.length ? lines : [[]];
  }
  const LINK = /^(?:(?:https?:\/\/|www\.)\S+|(?:linkedin|github)\.com\/\S+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)$/i;
  function draw(line, x, base, size, color, tc = 0) {
    const segs = [];
    let cx = x;
    for (const wd of line) {
      if (wd.space) { const last = segs[segs.length - 1]; if (last) last.t += " "; else segs.push({ t: " ", f: wd.segs[0]?.f || "R" }); cx += glyphW(32, "R") * size / 1000 + tc; }
      const text = wd.segs.map(s => s.t).join("").replace(/[.,;:)]+$/, "");
      if (LINK.test(text)) {
        const w = [...text].reduce((n, ch, i) => n + glyphW(ch.charCodeAt(0), wd.segs[0].f) * size / 1000 + tc, 0);
        pg.annots.push({ rect: [cx, base - 2.5, cx + w, base + size * 0.85], uri: /@/.test(text) && !/^https?:/i.test(text) ? "mailto:" + text : /^https?:/i.test(text) ? text : "https://" + text });
      }
      for (const s of wd.segs) { const last = segs[segs.length - 1]; if (last && last.f === s.f) last.t += s.t; else segs.push({ ...s }); }
      cx += wd.w;
    }
    if (!segs.length) return;
    pg.ops.push(`BT ${color} rg${tc ? ` ${tc} Tc` : ""} ${x.toFixed(2)} ${base.toFixed(2)} Td ${segs.map(s => `/${s.f} ${size} Tf (${pdfStr(s.t)}) Tj`).join(" ")}${tc ? " 0 Tc" : ""} ET`);
  }
  const ruleAt = (yy, color, width = 0.6) => pg.ops.push(`q ${width} w ${color} RG ${L} ${yy.toFixed(2)} m ${(PW - R).toFixed(2)} ${yy.toFixed(2)} l S Q`);
  const textW = (rs, size, tc) => words(rs, size, tc).reduce((n, w, i) => n + w.w + (i && w.space ? glyphW(32, "R") * size / 1000 + tc : 0), 0);

  // One block of text: wraps it, moves to a new page when needed, and keeps a heading with what follows it
  function block(text, { size = 10, lead = 13.6, font = "R", color = C.ink, x = L, width = FULL, tc = 0, upper = false, before = 0, keep = 0, marker = "", markerX = L, right = "" }) {
    const rightRuns = right ? runs(right, "R") : null, rightW = right ? textW(rightRuns, size - 1, 0) : 0;
    const lines = wrap(words(runs(text, font, upper), size, tc), width - (right ? rightW + 14 : 0), size, tc);
    if (!atTop()) y -= before;
    if (y - lead * Math.min(lines.length, 2) - keep < BOTTOM) newPage();
    lines.forEach((line, i) => {
      if (y - lead < BOTTOM) newPage();
      const base = y - size;
      if (i === 0 && marker) draw(words(runs(marker, "R"), size, 0), markerX, base, size, color);
      draw(line, x, base, size, color, tc);
      if (i === 0 && right) draw(wrap(words(rightRuns, size - 1, 0), FULL, size - 1, 0)[0], PW - R - rightW, base, size - 1, C.muted);
      y -= lead;
    });
  }

  // A run of short bullet points right under a section heading (key skills, tools, languages) goes into two or three
  // columns, so the CV stays short. Bullets under a job stay in one column.
  let list = [], listGap = 0, listCols = false, lastHead = 0;
  function flushList() {
    if (!list.length) return;
    const items = list, lead = 13.6, widest = Math.max(...items.map(t => textW(runs(t, "R", false, false), 10, 0)));
    const cols = items.length < 4 || !listCols ? 1 : widest + 31 <= FULL / 3 ? 3 : widest + 31 <= FULL / 2 ? 2 : 1;
    list = [];
    if (cols === 1) { items.forEach((t, i) => block(t, { x: L + 13, width: FULL - 13, marker: "•", markerX: L + 2, before: i === 0 && listGap ? 3 : 1.5 })); return; }
    const rows = Math.ceil(items.length / cols), colW = FULL / cols;
    if (!atTop()) y -= listGap ? 3 : 1.5;
    if (y - lead * Math.min(rows, 2) < BOTTOM) newPage();
    for (let r = 0; r < rows; r++) {
      if (y - lead < BOTTOM) newPage();
      for (let c = 0; c < cols; c++) {
        const t = items[c * rows + r]; if (t == null) continue;
        draw(words(runs("•", "R"), 10, 0), L + c * colW + 2, y - 10, 10, C.ink);
        draw(wrap(words(runs(t, "R"), 10, 0), colW - 13, 10, 0)[0], L + c * colW + 13, y - 10, 10, C.ink);
      }
      y -= lead;
    }
  }

  const src = String(md || "").replace(/\r/g, "").split("\n");
  let gap = 0, seen = 0, contactNext = false;
  for (const raw of src) {
    if (RULE.test(raw)) continue;
    if (!raw.trim()) { gap = 5; continue; }
    const h = raw.match(/^\s*(#{1,6})\s+(.*)/), ul = raw.match(/^\s*[-*•]\s+(.*)/), ol = raw.match(/^\s*(\d+)[.)]\s+(.*)/);
    if (ul && !h) { if (!list.length) { listGap = gap; listCols = lastHead === 2; } list.push(ul[1]); gap = 0; seen++; contactNext = false; continue; }
    flushList();
    const first = seen++ === 0;
    lastHead = h ? h[1].length : 0;
    if (h && h[1].length === 1) {
      block(h[2], { size: first ? 21 : 15, lead: first ? 25 : 19, font: "B", before: first ? 0 : 14, keep: 30 });
      contactNext = first;
    } else if (h && h[1].length === 2) {
      block(h[2], { size: 9.8, lead: 13, font: "B", color: C.accent, tc: 0.9, upper: true, before: Math.max(15, gap), keep: 56 });   // never alone at the foot of a page
      ruleAt(y - 0.5, C.rule, 0.5); y -= 5;
    } else if (h) {
      const [left, years] = splitYears(h[2].replace(/\*\*/g, ""));
      block(left, { size: 10.5, lead: 14, font: "B", before: Math.max(8, gap), keep: 24, right: years });
    } else if (ol) {
      block(ol[2], { x: L + 17, width: FULL - 17, marker: ol[1] + ".", markerX: L, before: gap ? 3 : 1.5 });
    } else if (contactNext) {
      block(raw.trim(), { size: 9.5, lead: 13, color: C.muted, before: 2 });
      y -= 5; ruleAt(y, C.accent, 0.9); y -= 6;
    } else {
      block(raw.trim(), { size: BODY.size, lead: BODY.lead, before: gap ? BODY.para : 2 });
    }
    if (!(h && h[1].length === 1)) contactNext = false;
    gap = 0;
  }
  flushList();
  // Page numbers, only when there is more than one page
  if (pages.length > 1) pages.forEach((p, i) => {
    const label = `${i + 1} / ${pages.length}`, w = [...label].reduce((n, ch) => n + glyphW(ch.charCodeAt(0), "R") * 8 / 1000, 0);
    p.ops.push(`BT ${C.muted} rg ${(PW - R - w).toFixed(2)} 34 Td /R 8 Tf (${label}) Tj ET`);
  });

  // The file: catalog, pages, three standard fonts, one content stream and the link annotations per page
  const objs = [], add = s => objs.push(s);
  add(null); add(null);
  for (const [k, name] of [["R", "Helvetica"], ["B", "Helvetica-Bold"], ["I", "Helvetica-Oblique"]]) add(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`);
  const kids = [];
  for (const p of pages) {
    const content = p.ops.join("\n"), cRef = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const aRefs = p.annots.map(a => add(`<< /Type /Annot /Subtype /Link /Rect [${a.rect.map(n => n.toFixed(2)).join(" ")}] /Border [0 0 0] /A << /S /URI /URI (${pdfStr(encodeURI(a.uri))}) >> >>`));
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /R 3 0 R /B 4 0 R /I 5 0 R >> >> /Contents ${cRef} 0 R${aRefs.length ? ` /Annots [${aRefs.map(n => n + " 0 R").join(" ")}]` : ""} >>`));
  }
  objs[0] = `<< /Type /Catalog /Pages 2 0 R /Lang (${textLang === "en" ? "en-GB" : "sv-SE"}) >>`;
  objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const info = add(`<< /Title ${utf16(title)} /Author ${utf16(author)} /Creator (Job Finder) /Producer (Job Finder) /CreationDate (D:${stamp}Z) >>`);
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets = objs.map((o, i) => { const at = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return { blob: new Blob([bytes], { type: "application/pdf" }), lost, pages: pages.length };
}
// The name a tailored CV starts with ("# Eva Lind"), unless it's still the [Your name] placeholder
const cvName = md => { const m = String(md || "").match(/^\s*#\s+(.+)$/m); return m && !/\[/.test(m[1]) ? m[1].replace(/\*\*/g, "").trim() : ""; };

/* ---------- The panel ---------- */
const guessLang = text => {
  const f = " " + fold(text).replace(/[^a-z ]+/g, " ") + " ";
  const sv = (f.match(/ (och|att|som|for|med|ar|vi|du|har|pa|till|av|det) /g) || []).length, en = (f.match(/ (and|the|to|with|for|is|we|you|are|of|our|in) /g) || []).length;
  return en > sv * 1.3 ? "en" : "sv";
};
function jobFor(id) {
  const a = results?.ads.find(x => x.id === id);
  if (a) { const c = companies.find(x => x.ads.includes(a)); return { id, title: a.title, employer: c ? coName(c) : shortName(a.employer), muni: a.muni, url: a.url || adUrl(a.id), src: a.src, source: a.source, snippet: a.snippet, adLang: a.adLang, apply: a.apply || (a.applyEmail ? `mailto:${a.applyEmail}` : "") }; }
  const sn = apps[id]?.snap;
  return sn ? { id, title: sn.title, employer: sn.company, muni: sn.muni, url: sn.url, src: id.startsWith("L:") ? "links" : "pb", snippet: "", apply: sn.apply || "" } : null;
}
async function loadFullAd(job) {
  const e = tlEntry(job.id);
  if (e.ad) return e.ad;
  if (fullAds.has(job.id)) return fullAds.get(job.id);
  if (job.src !== "pb") return job.snippet || "";
  try {
    const h = await getJSON(`${JS_API}/ad/${encodeURIComponent(job.id)}`, 2);
    const raw = String(h.description?.text || ""), m = checks();
    // Invisible characters, runs of empty lines and paragraphs repeated word for word come out (cleanAd in server/factcheck.js)
    const text = (m?.cleanAd ? m.cleanAd(raw) : raw).trim();
    fullAds.set(job.id, text); adFails.delete(job.id);
    return text;
  } catch (err) { console.warn("The full ad could not be fetched", err); adFails.add(job.id); return job.snippet || ""; }
}
function translateBtn(id) {
  if (!ABOUT.tailor) return "";
  const job = jobFor(id), state = translations.get(id);
  if (!job || job.src !== "pb") return "";
  if (job.adLang === lang && !state) return "";   // already in the interface language
  const label = state?.busy ? t("tr.busy") : state?.text ? t("tr.again") : t("tr.btn");
  return `<button class="btn ghost sm" type="button" data-translate="${esc(id)}"${state?.busy ? " disabled" : ""}>${esc(label)}</button>`;
}
function translationHtml(id) {
  const state = translations.get(id); if (!state) return "";
  const langAttr = state.lang === "en" ? "en" : "sv";
  const error = state.error ? `<p class="translation-error" role="alert">${esc(t(state.error, state.errorVars))}</p>` : "";
  const access = state.askCode ? `<div class="translation-access"><p>${esc(t("tr.ask"))}</p><label>${esc(t("tl.code"))}<input data-translate-code type="text" maxlength="64" value="${esc(store.get("jf-code", ""))}" autocomplete="off" spellcheck="false" placeholder="ABCDE-FGHJK"></label><button class="btn sm" type="button" data-translate-go="${esc(id)}">${esc(t("tr.go"))}</button></div>` : "";
  const result = state.text ? `<p class="translation-note">${esc(t("tr.note"))}${state.trimmed ? " " + esc(t("tr.trimmed")) : ""}</p><div class="translation-text" lang="${langAttr}">${mdHtml(state.text)}</div>` : "";
  return `<section class="translation-panel" tabindex="-1" aria-live="polite">${state.busy ? `<p class="translation-status">${esc(t("tr.wait"))}</p>` : ""}${error}${access}${result}</section>`;
}
function redrawTranslation(id, focusSel = ".translation-panel") {
  const role = document.querySelector(`article.role[data-ad="${CSS.escape(id)}"]`), company = role?.closest("article.co");
  if (company) rerenderCompany(company.dataset.id, focusSel);
}
const TRANSLATE_ERRORS = { bad_code: "tr.e.code", limit_reached: "tr.e.limit", ad_too_short: "tr.e.ad", too_long: "tr.e.ad", origin_not_allowed: "tr.e.origin", ai_timeout: "tr.e.timeout", ai_busy: "tr.e.service", ai_error: "tr.e.service", ai_empty: "tr.e.service", ai_unreachable: "tr.e.network" };
async function runTranslation(id, code) {
  const job = jobFor(id); if (!job || !code) return;
  const state = { lang, busy: true, askCode: false, error: "", text: "" };
  translations.set(id, state); redrawTranslation(id);
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), TAILOR_TIMEOUT);
  try {
    const ad = (await loadFullAd(job)).trim();
    if (ad.length < 100 || (adFails.has(id) && !tlEntry(id).ad)) { state.error = "tr.e.ad"; return; }
    const r = await fetch(ABOUT.tailor, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ code, task: "translate", lang: state.lang, job: { text: ad } }) });
    const data = await r.json().catch(() => ({}));
    if (r.ok && typeof data.text === "string" && data.text.trim()) {
      state.text = data.text.trim(); state.trimmed = Boolean(data.adTrimmed); store.set("jf-code", code);
    } else { state.error = TRANSLATE_ERRORS[data.error] || "tr.e.service"; if (data.error === "limit_reached") state.errorVars = { perHour: data.perHour, perDay: data.perDay }; }
  } catch (err) { state.error = err.name === "AbortError" ? "tr.e.timeout" : "tr.e.network"; }
  finally { clearTimeout(timer); state.busy = false; redrawTranslation(id); }
}
function onTranslateClick(e) {
  const go = e.target.closest("[data-translate-go]");
  if (go) {
    const id = go.dataset.translateGo, code = go.closest(".translation-panel")?.querySelector("[data-translate-code]")?.value.trim();
    if (!code) { go.closest(".translation-panel")?.querySelector("[data-translate-code]")?.focus(); return; }
    runTranslation(id, code); return;
  }
  const button = e.target.closest("[data-translate]"); if (!button || button.disabled) return;
  const id = button.dataset.translate, code = store.get("jf-code", "");
  if (code) runTranslation(id, code);
  else { translations.set(id, { lang, askCode: true, busy: false, error: "", text: "" }); redrawTranslation(id, "[data-translate-code]"); }
}
// Fetches a Platsbanken ad again after a failure. The text box is only replaced if the person hasn't changed the extract.
async function refetchAd() {
  if (!tl) return;
  const id = tl.id, job = { ...tl }, before = tl.adText;
  adFails.delete(id); tl.refetching = true; drawTailor();
  const text = await loadFullAd(job);
  if (!tl || tl.id !== id) return;
  const ta = $("tl-ad");
  if (ta && tlEntry(id).ad == null && ta.value === (before ?? "")) ta.value = text;
  tl.adText = text; tl.refetching = false;
  drawTailor(adFails.has(id) ? '[data-tl="refetch"]' : "#tl-ad");
}
// What the AI is and isn't, above everything it writes. The match check and interview prep get their own wording.
function aiNoteHtml(textKey, partName, titleKey = "ai.title") {
  return `<aside class="ai-note" aria-labelledby="ai-note-h" tabindex="-1"><div class="ai-head"><span class="ai-tag">${esc(t("ai.label"))}</span><b id="ai-note-h">${esc(t(titleKey))}</b></div>
    <p>${esc(t(textKey))}</p>${fbLink("ai", t("ai.report"), t("fb.part", { p: partName }))}</aside>`;
}
// The apply button: the employer's own page or email, or for other job sites the ad on that site
function applyHtml(job, big) {
  const href = job.apply || (job.src === "links" ? job.url : "");
  if (!href) return "";
  const label = job.apply ? t("howapply") : t("tl.applyon", { site: job.source || t("othersite") });
  return `<a class="btn ${big ? "" : "ghost "}sm" href="${esc(href)}" target="_blank" rel="noopener" data-tl="apply">${esc(label)}</a>`;
}
// The server's fact check (server/factcheck.js). Answers saved before it existed have none, and show nothing.
// After the person edits a text, the same code checks it again here in the browser (see reviewText below).
function factCheckHtml(check, edited, fixed) {
  if (edited && !check) return `<p class="fc fc-warn" role="status">${esc(t("fc.unchecked"))}</p>`;
  if (!check || !Array.isArray(check.issues)) return "";
  // The server's correction pass (server/pipeline.js) took things out before the person saw the text; say so
  const again = edited ? ` ${esc(t("fc.again"))}` : fixed ? ` ${esc(t(fixed === 1 ? "fc.fixed1" : "fc.fixed", { n: fixed }))}` : "";
  if (!check.issues.length) return `<p class="fc fc-ok" role="status">${esc(t("fc.ok"))}${again}</p>`;
  return `<section class="fc fc-warn" role="alert"><p><b>${esc(check.issues.length === 1 ? t("fc.warn1") : t("fc.warn", { n: check.issues.length }))}</b>${again}</p>
    <ul>${check.issues.map(i => { const ctx = i.line ? plainLine(i.line).replace(/^\s*(?:#{1,6}\s+|>\s*|[-*•+]\s+|\d+[.)]\s+)+/, "").trim() : "";
      const inLine = ctx && fold(ctx) !== fold(i.text) ? `<span class="fc-in">${esc(t("fc.in", { line: ctx.length > 140 ? ctx.slice(0, 137) + "…" : ctx }))}</span>` : "";
      return `<li><span class="fc-kind">${esc(t("fc.k." + i.kind))}:</span> <b>${esc(i.text)}</b>${inLine}</li>`; }).join("")}</ul>
    <p class="tl-hint">${esc(t("fc.how"))}</p></section>`;
}
// The style check (server/style.js): what still makes a CV or letter sound machine written after the server has taken
// the dashes out. Jobs of even length, buzzwords the CV and ad don't use, and dashes the person typed in themselves.
function styleHtml(st) {
  if (!st) return "";
  const notes = [];
  if (st.even) notes.push(t("st.even"));
  if (st.words?.length) notes.push(t("st.words", { words: st.words.join(", ") }));
  if (st.dashes) notes.push(t(st.dashes === 1 ? "st.dash1" : "st.dashes", { n: st.dashes }));
  if (st.order?.length) notes.push(t("st.order", { words: st.order.map(x => `"${x}"`).join(", ") }));
  if (!notes.length) return "";
  return `<section class="fc fc-style" role="status"><p><b>${esc(t("st.title"))}</b></p><ul>${notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></section>`;
}
const cleanStyle = st => st && typeof st === "object" ? { even: !!st.even, words: (Array.isArray(st.words) ? st.words : []).slice(0, 10).map(w => String(w).slice(0, 40)), dashes: +st.dashes || 0, order: (Array.isArray(st.order) ? st.order : []).slice(0, 5).map(w => String(w).slice(0, 60)) } : null;

// server/factcheck.js and server/style.js, built into the page by build.py and compiled on first use. A browser too old
// for their patterns goes without, and the panel says the edits weren't checked.
const FACTCHECK_SRC = /*__FACTCHECK__*/;
const STYLE_SRC = /*__STYLE__*/;
let localCheck, localStyle;   // the compiled fact check module (factCheck, review, lineParts, trimAd …) and style check
function compiled(src, pick) {
  try { const module = { exports: {} }; new Function("module", "require", src)(module, () => TITLES); return pick(module.exports) || null; }
  catch (err) { console.warn("A check can't run in this browser", err); return null; }
}
const checks = () => (localCheck === undefined ? (localCheck = compiled(FACTCHECK_SRC, m => m.review ? m : null)) : localCheck) || null;
const cleanCheck = c => c && Array.isArray(c.issues) ? { ok: !!c.ok, issues: c.issues.slice(0, 30).map(i => ({ kind: String(i.kind), text: String(i.text).slice(0, 200), ...(i.line ? { line: String(i.line).slice(0, 200) } : {}) })) } : null;
function cleanImpact(im) {
  if (!im || typeof im !== "object") return null;
  const n = x => Math.max(0, Math.min(999, Math.round(+x || 0))), list = a => (Array.isArray(a) ? a : []).slice(0, 12).map(x => String(x).slice(0, 40));
  return { terms: n(im.terms), before: n(im.before), after: n(im.after), gained: list(im.gained), unsupported: list(im.unsupported), lost: list(im.lost) };
}
// The fact check, the sentence trace and (for a CV) the keyword match, worked out here with the server's own code
function reviewText(text, { task = tl?.task, outLang, ad } = {}) {
  const m = checks();
  if (!m || !tl) return null;
  try {
    const e = tlEntry(tl.id), o = e.out[task];
    const r = m.review(text, { cv: cvWithFacts(e), ad: ad ?? e.ad ?? tl.adText ?? "", title: tl.title, employer: tl.employer, extra: e.extra || "", year: new Date().getFullYear(), task, lang: outLang || o?.lang || e.lang || lang });
    return { check: cleanCheck(r), trace: String(r.trace), impact: task === "cv" ? cleanImpact(r.impact) : null };
  } catch (err) { console.warn("The fact check failed", err); return null; }
}
function restyle(text) {
  if (localStyle === undefined) localStyle = compiled(STYLE_SRC, m => m.styleCheck);
  if (!localStyle || !tl || !DOC_TASKS.has(tl.task)) return null;
  try { const e = tlEntry(tl.id); return cleanStyle(localStyle(text, { cv: cvWithFacts(e), ad: e.ad ?? tl.adText ?? "", task: tl.task })); }
  catch (err) { console.warn("The style check failed", err); return null; }
}

/* ---------- Where each sentence comes from, and what stays out of downloads ----------
   Every answer comes with a trace (review in server/factcheck.js): one letter per sentence, line by line, c from the CV,
   a from the ad, i inferred by the AI, u unsupported. Unsupported sentences are marked in the text and left out of the
   PDF, the Word file, the plain text and Copy until the person keeps them; a job heading that isn't in the CV takes the
   lines under it with it. Edit text always shows everything. */
function traceOf(o) {
  if (typeof o?.trace !== "string") return null;
  const tr = o.trace.split(","), n = String(o.text || "").split("\n").length;
  return tr.length === n && tr.every(x => /^[caiu]*$/.test(x)) ? tr : null;
}
function partsOf(raw) {
  const m = checks();
  if (m?.lineParts) try { return m.lineParts(raw); } catch {}
  const prefix = raw.match(/^(\s*(?:#{1,6}\s+|>\s*|[-+*•]\s+|\d+[.)]\s+)*)/)[1], body = raw.slice(prefix.length).trim();
  return { prefix, sentences: body ? [body] : [] };
}
let annMemo = { key: null, value: null };
// Per line: its prefix, its sentences, their labels, which are left out (q), and the job heading it sits under if that job is left out
function annotate(o) {
  const tr = traceOf(o);
  if (!tr) return null;
  const keep = new Set(Array.isArray(o.keep) ? o.keep.map(String) : []);
  const key = [o.text, o.trace, [...keep].join(" "), checks() ? 1 : 0].join("\u0000");
  if (annMemo.key === key) return annMemo.value;
  let block = -1;
  const value = String(o.text).split("\n").map((raw, li) => {
    const t = tr[li], h = raw.match(/^\s*(#{1,6})\s/), p = partsOf(raw);
    if (h) block = -1;
    let kinds = t.split(""), parts = p.sentences;
    // A heading is one unit, and so is a line whose sentences don't line up with the trace (it takes its worst label)
    if (kinds.length && (h || kinds.length !== parts.length)) { kinds = [["u", "i", "a", "c"].find(k => t.includes(k))]; parts = [raw.slice(p.prefix.length).trim()]; }
    if (!kinds.length) parts = [];
    const a = { prefix: p.prefix, parts, kinds, block, head: false, q: [] };
    if (h && h[1].length >= 3 && kinds[0] === "u") { block = li; a.block = li; a.head = true; }
    a.q = kinds.map((k, si) => a.block >= 0 ? !keep.has(String(a.block)) : k === "u" && !keep.has(`${li}.${si}`));
    return a;
  });
  annMemo = { key, value };
  return value;
}
// The text that leaves the panel: the answer without what is left out
function sendText(o) {
  const ann = annotate(o);
  if (!ann || !ann.some(a => a.q.some(Boolean))) return o.text;
  const out = [];
  String(o.text).split("\n").forEach((raw, li) => {
    const a = ann[li];
    if (!a.q.some(Boolean)) { out.push(raw); return; }
    const kept = a.parts.filter((_, si) => !a.q[si]);
    if (kept.length) out.push(a.prefix + kept.join(" "));
  });
  // A section heading left with nothing under it goes too
  const next = i => out.slice(i + 1).find(x => x.trim());
  return out.filter((l, i) => !/^\s*##\s/.test(l) || (next(i) && !/^\s*#{1,2}\s/.test(next(i)))).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
const plainLine = s => String(s).replace(/\*\*(.+?)\*\*/g, "$1").replace(/[*_`]/g, "");
function quarantineHtml(o, ann) {
  if (!ann) return "";
  const keep = new Set(Array.isArray(o.keep) ? o.keep.map(String) : []), items = [];
  ann.forEach((a, li) => {
    if (a.head) { const n = ann.filter((x, i) => i > li && x.block === li && x.parts.length).length; items.push({ key: String(li), text: t(n === 0 ? "q.job0" : n === 1 ? "q.job1" : "q.job", { job: plainLine(a.parts[0]), n }) }); return; }
    if (a.block < 0) a.kinds.forEach((k, si) => { if (k === "u") items.push({ key: `${li}.${si}`, text: plainLine(a.parts[si]) }); });
  });
  if (!items.length) return "";
  const out = items.filter(x => !keep.has(x.key)).length;
  return `<section class="q-panel" aria-labelledby="q-h"><p id="q-h"><b>${esc(out ? t("q.title", { n: out }) : t("q.allkept"))}</b></p>
    <p class="tl-hint">${esc(t("q.how"))}</p>
    <ul>${items.map(x => { const kept = keep.has(x.key); return `<li${kept ? ' class="kept"' : ""}><span class="q-text">${esc(x.text)}</span> <button class="btn ghost sm" type="button" data-tl="keep" data-k="${esc(x.key)}">${esc(t(kept ? "q.drop" : "q.keep"))}</button>${kept ? ` <span class="tl-hint">${esc(t("q.kept"))}</span>` : ""}</li>`; }).join("")}</ul></section>`;
}
// The keyword match (for a CV) and the evidence, as two separate lines, with the switch for marking every sentence
function evidenceHtml(o, ann, task) {
  if (!ann) return "";
  const n = { c: 0, a: 0, i: 0, u: 0 };
  ann.forEach(a => a.kinds.forEach(k => n[k]++));
  if (!(n.c + n.a + n.i + n.u)) return "";
  const counts = ["c", "a", "i", "u"].filter(k => n[k]).map(k => t("src.n." + k, { n: n[k] })).join(" · ");
  const im = task === "cv" ? cleanImpact(o.impact) : null, words = a => a.join(", ");
  const ats = im && im.terms ? `<p class="im-line"><b>${esc(t("im.title"))}</b> ${esc(t("im.line", im))}${im.gained.length ? " " + esc(t("im.gained", { words: words(im.gained) })) : ""}${im.lost.length ? " " + esc(t("im.lost", { words: words(im.lost) })) : ""}</p>
    ${im.unsupported.length ? `<p class="im-warn"><b>${esc(t("im.not"))}</b> ${esc(t("im.notline", { words: words(im.unsupported) }))}</p>` : ""}` : "";
  const across = o.lang && guessLang(store.get("jf-cv", "")) !== o.lang ? `<p class="tl-hint">${esc(t("src.across"))}</p>` : "";
  const legend = tl.sources ? `<ul class="src-legend">${["c", "a", "i", "u"].map(k => `<li><span class="src src-${k}">${esc(t("src.k." + k))}</span> ${esc(t("src.d." + k))}</li>`).join("")}</ul>` : "";
  return `<section class="src-sum" aria-label="${esc(t("src.aria"))}">${ats}<p class="src-line"><b>${esc(t(ats ? "src.evidence" : "src.title"))}</b> ${esc(counts)}.</p>${across}
    <div class="row"><button class="btn ghost sm" type="button" data-tl="sources" aria-pressed="${tl.sources ? "true" : "false"}">${esc(t("src.show"))}</button></div>${legend}${ats ? `<p class="tl-hint">${esc(t("im.how"))}</p>` : ""}</section>`;
}
// One line above the text on how the checks came out, so the text itself is on the first screen. The checks follow the
// text in full.
function checkSumHtml(o, ann) {
  const c = o.check;
  if (!c || !Array.isArray(c.issues)) return "";
  const held = (ann || []).reduce((n, a) => n + a.q.filter(Boolean).length, 0);
  const style = o.style && (o.style.even || o.style.words?.length || o.style.dashes || o.style.order?.length);
  const parts = [c.issues.length ? t(c.issues.length === 1 ? "sum.issue1" : "sum.issues", { n: c.issues.length }) : t("sum.ok")];
  if (held) parts.push(t(held === 1 ? "sum.held1" : "sum.held", { n: held }));
  if (style) parts.push(t("sum.style"));
  return `<p class="fc-sum ${c.issues.length ? "warn" : "ok"}" role="status">${esc(parts.join(" · "))} <a href="#tl-checks" class="linkbtn" data-tl="tochecks">${esc(t("sum.see"))}</a></p>`;
}
// The whole text as plain text in a box, for when downloads or the clipboard are blocked
function plainHtml(o, ann) {
  if (!tl.plain) return "";
  const left = (ann || []).some(a => a.q.some(Boolean));
  return `<section class="tl-plain"><label class="tl-label" for="tl-plain">${esc(t("pt.label"))}</label>
    ${tl.plainMsg ? `<p class="tl-err" role="alert">${esc(t(tl.plainMsg))}</p>` : ""}
    <textarea id="tl-plain" readonly rows="14" lang="${o.lang === "en" ? "en" : "sv"}">${esc(plainText(sendText(o)))}</textarea>
    <p class="tl-hint">${esc(t("pt.hint"))}${left ? " " + esc(t("pt.left")) : ""}</p>
    <div class="row"><button class="btn sm" type="button" data-tl="txt">${esc(t("pt.txt"))}</button><button class="btn ghost sm" type="button" data-tl="selectall">${esc(t("pt.select"))}</button></div></section>`;
}
/* ---------- How much of the ad there is ----------
   A long ad or a short extract is a warning with a way forward, not a stop: the person can go ahead with the visible
   excerpt. A long ad is cut at a paragraph first (trimAd in server/factcheck.js) and shown in the ad box, so what's
   sent is what's on screen. */
const MAX_AD = 20000, MIN_AD = 30, FULL_AD = 100;
const fmtCount = n => Number(n).toLocaleString(lang === "sv" ? "sv-SE" : "en-GB");
function adWarnHtml() {
  if (!tl.adWarn) return "";
  const long = tl.adWarn === "long";
  return `<section class="tl-adwarn" role="alert"><p><b>${esc(t(long ? "xc.long.t" : "xc.short.t", { n: fmtCount(tl.adWarnLen || 0), max: fmtCount(MAX_AD) }))}</b></p>
    <p>${esc(t(long ? "xc.long" : tl.adWarnWhy === "links" ? "xc.links" : "xc.short", { site: tl.source || t("othersite") }))}</p>
    <div class="row"><button class="btn sm" type="button" data-tl="excerpt">${esc(t("xc.use"))}</button>${long || !tl.url ? "" : `<a class="btn ghost sm" href="${esc(tl.url)}" target="_blank" rel="noopener">${esc(t("xc.open"))}</a>`}</div></section>`;
}
const trimmedAd = text => { const m = checks(); return m?.trimAd ? m.trimAd(text, MAX_AD) : text.slice(0, MAX_AD); };

// Saves what the person typed in Edit text, and checks it again
function saveEdit() {
  if (!tl?.editing) return;
  const o = tlEntry(tl.id).out[tl.task], text = (tl.editDraft ?? "").replace(/\s+$/, "");
  tl.editing = false; tl.editDraft = null;
  if (!o || !text.trim() || text === o.text) return;
  o.text = text; o.edited = new Date().toISOString(); delete o.cut; delete o.fixed; delete o.keep;
  const rv = reviewText(text), style = restyle(text);
  if (rv) { o.check = rv.check; o.trace = rv.trace; if (rv.impact) o.impact = rv.impact; else delete o.impact; }
  else { delete o.check; delete o.trace; delete o.impact; }
  if (style) o.style = style; else delete o.style;
  saveTailor();
}
// The file name for a download: "cv-eva-lind-acme-robotics.pdf", or the task, employer and job when there's no name
function docName(o, ext) {
  const name = DOC_TASKS.has(tl.task) ? cvName(tlEntry(tl.id).out.cv?.text || "") : "";
  const kind = tl.task === "cv" ? "cv" : tl.task === "letter" ? (o.lang === "en" ? "cover-letter" : "personligt-brev") : t("tl.t." + tl.task);
  return [kind, ...(name ? [name, tl.employer] : [tl.employer, tl.title])].map(slugify).filter(Boolean).join("-").replace(/-+/g, "-") + "." + ext;
}
function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
/* ---------- What the CV leaves out ----------
   Under an answer the person can write down true things their CV forgot and run the task again. They are kept for this
   job only, sent to the model at the end of the CV (server/prompts.js) and read as part of the CV by every check, here
   and on the server. "Add to my CV for every job" moves them into the saved CV instead, for other jobs and the Mentor. */
const MAX_FACTS = 3000;
const cvWithFacts = e => { const cv = store.get("jf-cv", ""), f = String(e?.facts || "").trim(); return cv && f ? `${cv}\n\n${f}` : cv; };
// Whether the answer on screen used what is in the box now: a key for the line under the box, or "" for none
function factsState(out, f, task) {
  if (!out || !f) return "";
  return out.facts === f ? "tl.more.used" : DOC_TASKS.has(task) ? "tl.more.notyet.doc" : "tl.more.notyet";
}
// Generating again replaces the answer, so one the person has edited or kept sentences in is asked about first
const wouldLose = o => Boolean(o && (o.edited || (Array.isArray(o.keep) && o.keep.length)));
const loseHtml = () => `<div class="tl-adwarn tl-lose" role="alert"><p>${esc(t("tl.lose"))}</p>
    <div class="row"><button class="btn sm" type="button" data-tl="replace">${esc(t("tl.lose.go"))}</button><button class="btn ghost sm" type="button" data-tl="noreplace">${esc(t("tl.lose.no"))}</button></div></div>`;
// The ad's key terms your CV doesn't use, as a checklist. Ticking one only adds a line to the box below, for you to say how
// it's true in your own words; nothing counts as yours until it's written there. The keyword match can then go up honestly.
// Place names are left out, since where the job is says nothing about you.
const PLACE_NAMES = new Set(MUNIS.flatMap(([m, c]) => [fold(m), fold(c)]));
function termsHtml(out, e) {
  const m = checks(), ad = e.ad ?? tl.adText ?? "";
  if (!out || !m?.missingTerms || !ad) return "";
  const facts = fold(e.facts || ""), list = m.missingTerms(store.get("jf-cv", ""), ad, { title: tl.title, employer: tl.employer, max: 16 })
    .filter(w => !PLACE_NAMES.has(fold(w))).slice(0, 12);
  if (!list.length) return "";
  return `<div class="tl-terms"><p class="tl-hint" id="tl-terms-h">${esc(t("terms.hint"))}</p>
    <div class="row" role="group" aria-labelledby="tl-terms-h">${list.map(w => { const on = facts.includes(fold(w)); return `<button class="chip-btn${on ? " on" : ""}" type="button" data-tl="term" data-w="${esc(w)}" aria-pressed="${on}">${esc(w)}</button>`; }).join("")}</div></div>`;
}
function factsHtml(out, e, task) {
  const f = String(e.facts || "").trim();
  if (!out && !f && !tl.factsMsg) return "";
  const state = factsState(out, f, task), bad = tl.factsMsg === "tl.more.empty" || tl.factsMsg === "tl.more.old";
  return `<section class="tl-more" aria-labelledby="tl-more-l">
      <label class="tl-label" id="tl-more-l" for="tl-facts">${esc(t("tl.more"))}</label>
      <p class="tl-hint" id="tl-facts-hint">${esc(t("tl.more.hint"))}</p>
      ${termsHtml(out, e)}
      <textarea id="tl-facts" data-tl="facts" rows="3" maxlength="${MAX_FACTS}" aria-describedby="tl-facts-hint tl-facts-state" placeholder="${esc(t("tl.more.ph"))}">${esc(e.facts || "")}</textarea>
      <p class="tl-hint${state === "tl.more.used" ? " tl-ok" : ""}" id="tl-facts-state"${state ? "" : " hidden"}>${state ? esc(t(state)) : ""}</p>
      <div class="row">${out ? `<button class="btn sm" type="button" data-tl="regen"${tl.busy ? " disabled" : ""}>${esc(t(DOC_TASKS.has(task) ? "tl.more.go.doc" : "tl.more.go"))}</button>` : ""}<button class="btn ghost sm" type="button" data-tl="tocv">${esc(t("tl.more.tocv"))}</button></div>
      ${tl.confirm === "regen" ? loseHtml() : ""}
      ${tl.factsMsg ? `<p class="${bad ? "tl-err" : "tl-hint tl-ok"}" role="${bad ? "alert" : "status"}">${esc(t(tl.factsMsg))}</p>` : ""}
    </section>`;
}
function appliedHtml(id) {
  const st = apps[id]?.status;
  if (tl.marked) return `<p class="tl-hint tl-ok" role="status">${esc(t("tl.marked"))}</p>`;
  if (!tl.askApplied || ["Applied", "Interview", "Offer"].includes(st)) return "";
  return `<div class="row tl-ask"><span>${esc(t("tl.markq"))}</span><button class="btn sm" type="button" data-tl="mark">${esc(t("tl.mark"))}</button></div>`;
}
function tailorHtml() {
  const job = tl, e = tlEntry(job.id), task = tl.task, out = e.out[task];
  // An answer saved before sentence traces existed is checked again once, so it gets one too
  if (out && out.check && !traceOf(out) && !tl.editing) {
    const rv = reviewText(out.text, { task, outLang: out.lang });
    if (rv) { out.check = rv.check; out.trace = rv.trace; if (rv.impact) out.impact = rv.impact; saveTailor(); }
  }
  const ann = out ? annotate(out) : null, stale = staleOf(out, e);
  const code = store.get("jf-code", "");
  const outLang = e.lang || tl.lang || lang;
  return `<div class="tl-head">
      <div><div class="tl-eyebrow">${esc(t("tl.eyebrow"))}</div><h2 id="tl-title">${esc(job.title)}</h2><div class="tl-sub">${esc([job.employer, job.muni].filter(Boolean).join(" · "))} · <a href="${esc(job.url)}" target="_blank" rel="noopener">${esc(t("readad"))}</a></div>
        ${applyHtml(job, false) ? `<div class="tl-headapply">${applyHtml(job, false)}</div>` : ""}</div>
      <button class="tl-close" type="button" data-tl="close" aria-label="${esc(t("tl.close"))}">×</button>
    </div>
    <div class="tl-body">
      <div class="tl-grid">
        <section class="tl-box"><label class="tl-label" for="tl-ad">${esc(t("tl.ad"))}</label>
          <textarea id="tl-ad" data-tl="ad" rows="12" placeholder="${esc(t(tl.adText === undefined && e.ad == null ? "tl.ad.loading" : "tl.ad.ph"))}">${esc(e.ad ?? tl.adText ?? "")}</textarea>
          <p class="tl-hint">${esc(job.src !== "pb" ? t("tl.ad.hintlinks", { site: job.source || t("othersite") }) : tl.refetching ? t("tl.ad.loading") : adFails.has(job.id) && e.ad == null ? t("tl.ad.fail") : t("tl.ad.hint"))}</p>
          ${job.src === "pb" && adFails.has(job.id) && e.ad == null && !tl.refetching ? `<div><button class="btn ghost sm" type="button" data-tl="refetch">${esc(t("tl.ad.retry"))}</button></div>` : ""}</section>
        <section class="tl-box"><label class="tl-label" for="tl-cv">${esc(t("tl.cv"))}</label>
          <textarea id="tl-cv" data-tl="cv" rows="12" placeholder="${esc(t("tl.cv.ph"))}">${esc(store.get("jf-cv", ""))}</textarea>
          <div class="row"><button class="btn ghost sm" type="button" data-tl="load">${esc(t("tl.load"))}</button><input type="file" id="tl-file" accept=".docx,.txt,.md,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden><span class="tl-hint" id="tl-cvmsg">${esc(t("tl.cv.hint"))}</span></div></section>
      </div>
      <div class="row tl-opts">
        <label class="tl-inline">${esc(t("tl.code"))}<input type="text" id="tl-code" data-tl="code" value="${esc(code)}" autocomplete="off" spellcheck="false" placeholder="ABCDE-FGHJK"></label>
        <label class="tl-inline">${esc(t("tl.lang"))}<select id="tl-lang" data-tl="lang"><option value="sv"${outLang === "sv" ? " selected" : ""}>Svenska</option><option value="en"${outLang === "en" ? " selected" : ""}>English</option></select></label>
        <label class="tl-inline grow">${esc(t("tl.extra"))}<input type="text" id="tl-extra" data-tl="extra" value="${esc(e.extra || "")}" maxlength="2000" placeholder="${esc(t("tl.extra.ph"))}"></label>
      </div>
      ${code ? "" : `<p class="tl-hint">${t("tl.code.hint", { who: ABOUT.author ? (ABOUT.linkedin ? `<a href="${esc(ABOUT.linkedin)}" target="_blank" rel="noopener">${esc(ABOUT.author)}</a>` : esc(ABOUT.author)) : esc(t("tl.code.who")) })}</p>`}
      <div class="tl-tasks" role="tablist" aria-label="${esc(t("tl.what"))}">${TASKS.map(k => `<button type="button" role="tab" class="tl-task" data-tl="task" data-task="${k}" aria-selected="${k === task}" tabindex="${k === task ? 0 : -1}">${esc(t("tl.t." + k))}${e.out[k] ? ' <span class="tl-dot" aria-hidden="true">●</span>' : ""}</button>`).join("")}</div>
      <section class="tl-result" role="tabpanel" aria-live="polite">
        <p class="tl-desc">${esc(t("tl.d." + task))}</p>
        ${out ? "" : factsHtml(null, e, task)}
        <div class="row"><button class="btn" type="button" data-tl="go"${tl.busy ? " disabled" : ""}>${esc(tl.busy ? t("tl.busy") : out ? t("tl.again") : t("tl.go"))}</button><span class="tl-status" id="tl-status">${esc(tl.status || "")}</span></div>
        ${tl.confirm === "go" ? loseHtml() : ""}
        ${out ? "" : `<p class="tl-hint">${esc(t("ai.before"))}</p>`}
        ${tl.error ? `<p class="tl-err" role="alert">${tl.error}</p>` : ""}
        ${adWarnHtml()}
        ${out ? `${aiNoteHtml(task === "match" ? "ai.match" : task === "interview" ? "ai.interview" : "ai.write", t("tl.t." + task))}
          ${out.cut ? `<p class="tl-err" role="alert">${esc(t("tl.cut"))}</p>` : ""}
          ${out.excerpt ? `<p class="tl-hint tl-fill">${esc(t("xc.made"))}</p>` : ""}
          ${out.adTrimmed ? `<p class="tl-hint tl-fill">${esc(t("xc.trimmed", { n: fmtCount(+out.adTrimmed.to || MAX_AD) }))}</p>` : ""}
          ${stale ? `<div class="tl-stale" role="status"><p>${esc(t(stale === "cv" ? "tl.stale.cv" : "tl.stale.ad"))}</p><button class="btn sm" type="button" data-tl="restale"${tl.busy ? " disabled" : ""}>${esc(t("tl.stale.go"))}</button></div>` : ""}
          ${licenceHtml(e)}
          ${tl.editing ? factCheckHtml(out.check, out.edited, out.fixed) + styleHtml(out.style) : checkSumHtml(out, ann)}
          ${tl.editing ? `<div class="tl-edit"><label class="tl-label" for="tl-edit">${esc(t("tl.edit.label"))}</label>
            <textarea id="tl-edit" data-tl="edit-text" rows="22" lang="${out.lang === "en" ? "en" : "sv"}">${esc(tl.editDraft ?? out.text)}</textarea>
            <p class="tl-hint">${esc(t("tl.edit.hint"))}</p>
            <div class="row"><button class="btn sm" type="button" data-tl="save">${esc(t("tl.edit.save"))}</button><button class="btn ghost sm" type="button" data-tl="cancel">${esc(t("tl.edit.cancel"))}</button></div></div>`
          : `<div class="tl-out${tl.sources ? " show-src" : ""}" tabindex="-1">${mdHtml(out.text, ann, tl.sources)}</div>
          <div class="row">${DOC_TASKS.has(task) ? `<button class="btn sm" type="button" data-tl="pdf">${esc(t("tl.pdfdl"))}</button>` : ""}<button class="btn ghost sm" type="button" data-tl="word">${esc(t("tl.word"))}</button><button class="btn ghost sm" type="button" data-tl="edit">${esc(t("tl.edit"))}</button><button class="btn ghost sm" type="button" data-tl="copy">${esc(t("copy"))}</button><button class="btn ghost sm" type="button" data-tl="plain" aria-expanded="${tl.plain ? "true" : "false"}">${esc(t("pt.btn"))}</button>${applyHtml(job, true)}
          <span class="tl-hint">${esc(t("tl.made", { date: fmtDate(localDay(new Date(out.at))) }))}${out.edited ? ` · ${esc(t("tl.edited", { date: fmtDate(localDay(new Date(out.edited))) }))}` : ""}</span></div>
          ${DOC_TASKS.has(task) && /\[[^\]\n]{2,60}\]/.test(out.text) ? `<p class="tl-hint tl-fill">${esc(t("tl.fill"))}</p>` : ""}
          ${tl.pdfLost ? `<p class="tl-hint" role="status">${esc(t("tl.pdflost", { n: tl.pdfLost }))}</p>` : ""}
          ${embedded && !tl.plain ? `<p class="tl-hint">${esc(t("pt.embedded"))}</p>` : ""}
          ${plainHtml(out, ann)}
          <div class="tl-checks" id="tl-checks" tabindex="-1">${factCheckHtml(out.check, out.edited, out.fixed)}${styleHtml(out.style)}${evidenceHtml(out, ann, task)}${quarantineHtml(out, ann)}</div>`}
          ${tl.editing ? "" : factsHtml(out, e, task)}
          ${appliedHtml(job.id)}` : appliedHtml(job.id)}
      </section>
      <p class="tl-hint tl-privacy">${esc(t("tl.privacy"))}</p>
    </div>`;
}
function flushTailor() {
  if (!tl) return;
  if (tl.editing) { const ta = $("tl-edit"); if (ta) tl.editDraft = ta.value; }
  for (const k of ["cv", "code", "ad", "extra", "facts", "lang"]) { clearTimeout(tlTimers[k]); const el = $("tl-" + k); if (el) saveField(k, el.value); }
}
function drawTailor(focusSel) {
  flushTailor();
  const d = $("tailor"), act = document.activeElement, keepId = d.contains(act) ? act.id : null, sel = keepId ? [act.selectionStart, act.selectionEnd] : null;
  d.innerHTML = tailorHtml();
  const el = focusSel ? d.querySelector(focusSel) : keepId ? $(keepId) : null;
  if (el) { el.focus(); if (sel && el.setSelectionRange && sel[0] != null) try { el.setSelectionRange(sel[0], sel[1]); } catch {} }
}
async function openTailor(id, from) {
  const job = jobFor(id); if (!job) return;
  tl = { ...job, task: tailorStore[id]?.lastTask || "match", busy: false, status: "", error: "", from, editing: false, editDraft: null, pdfLost: 0 };
  const d = $("tailor");
  drawTailor();
  if (!d.open) d.showModal();
  d.querySelector(".tl-close").focus();
  const adText = await loadFullAd(job);
  if (!tl || tl.id !== id) return;
  tl.adText = adText; tl.lang = guessLang(adText || job.title);
  const ta = $("tl-ad"); if (ta) { ta.placeholder = t("tl.ad.ph"); if (!ta.value && tlEntry(id).ad == null) ta.value = adText; }
  if (!tlEntry(id).lang) { const s = $("tl-lang"); if (s) s.value = tl.lang; }
  if (adFails.has(id)) drawTailor();   // shows that only an extract came through, with a button to fetch the ad again
}
function closeTailor() {
  if (tl?.ctrl) tl.ctrl.abort();
  const d = $("tailor"); if (d.open) d.close();
}
const TL_ERRORS = { bad_code: "tl.e.code", limit_reached: "tl.e.limit", cv_too_short: "tl.e.cv", ad_too_short: "tl.e.ad", too_long: "tl.e.long", origin_not_allowed: "tl.e.origin", bad_json: "tl.e.other", bad_task: "tl.e.other" };
async function generate() {
  if (!tl || tl.busy) return;
  const id = tl.id, task = tl.task, e = tlEntry(id);
  const cv = ($("tl-cv")?.value || "").trim(), ad = ($("tl-ad")?.value || "").trim(), code = ($("tl-code")?.value || "").trim(), outLang = $("tl-lang")?.value || lang, extra = ($("tl-extra")?.value || "").trim();
  const factsRaw = ($("tl-facts")?.value ?? e.facts ?? "").slice(0, MAX_FACTS), facts = factsRaw.trim();
  tl.confirm = ""; tl.factsMsg = "";
  const stop = (k, sel, v) => { tl.error = esc(t(k, v)); drawTailor(sel); };
  if (!code) return stop("tl.e.nocode", "#tl-code");
  if (cv.length < 200) return stop("tl.e.cv", "#tl-cv");
  if (ad.length < MIN_AD) return stop("tl.e.ad", "#tl-ad");
  // Only the listing's extract (an ad on another site, or a fetch that failed), a very short ad, or one longer than the
  // server reads: say so and offer the visible excerpt, once per panel
  const snippet = String(tl.snippet || "").trim(), fromListing = (tl.src !== "pb" || adFails.has(id)) && Boolean(snippet) && ad === snippet;
  if (!tl.adOk && (ad.length > MAX_AD || ad.length < FULL_AD || fromListing)) {
    tl.adWarn = ad.length > MAX_AD ? "long" : "short"; tl.adWarnLen = ad.length; tl.adWarnWhy = fromListing && tl.src !== "pb" ? "links" : ""; tl.error = "";
    return drawTailor('[data-tl="excerpt"]');
  }
  const excerpt = ad.length <= MAX_AD && (ad.length < FULL_AD || fromListing), cutFrom = tl.adCutFrom || 0;
  store.set("jf-cv", cv); store.set("jf-code", code); e.ad = ad; e.extra = extra; e.lang = outLang; if (factsRaw || e.facts) e.facts = factsRaw; saveTailor();
  tl.busy = true; tl.error = ""; tl.adWarn = ""; tl.status = t("tl.wait", { s: 0 }); tl.editing = false; tl.editDraft = null; tl.pdfLost = 0; tl.plain = false; tl.plainMsg = "";
  drawTailor('[data-tl="go"]');
  const started = Date.now(), tick = setInterval(() => { if (tl?.id === id && tl.busy) { tl.status = t("tl.wait", { s: Math.round((Date.now() - started) / 1000) }); const s = $("tl-status"); if (s) s.textContent = tl.status; } }, 1000);
  const ctrl = new AbortController(); tl.ctrl = ctrl;
  const timer = setTimeout(() => ctrl.abort(), TAILOR_TIMEOUT);
  let msg = "";
  try {
    const r = await fetch(ABOUT.tailor, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ code, task, lang: outLang, cv, extra, ...(facts ? { facts } : {}), job: { title: tl.title, employer: tl.employer, text: ad }, ...(excerpt || cutFrom ? { excerpt: true } : {}) }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.text) {
      // The server says it read the additions; one from before they existed ignores them, and the panel says so
      const usedFacts = Boolean(facts && j.facts === true);
      if (facts && !usedFacts) tl.factsMsg = "tl.more.old";
      const o = { text: j.text, at: new Date().toISOString(), model: j.model || "", lang: outLang, cvH: tlHash(facts ? `${cv}\n\n${facts}` : cv), adH: tlHash(ad), ...(usedFacts ? { facts } : {}), ...(j.cut ? { cut: true } : {}), ...(+j.fixed > 0 ? { fixed: Math.min(99, +j.fixed) } : {}), ...(cleanStyle(j.style) ? { style: cleanStyle(j.style) } : {}), ...(cleanCheck(j.check) ? { check: cleanCheck(j.check) } : {}),
        ...(typeof j.trace === "string" ? { trace: j.trace } : {}), ...(cleanImpact(j.impact) ? { impact: cleanImpact(j.impact) } : {}),
        ...(excerpt ? { excerpt: true } : {}), ...(j.adTrimmed ? { adTrimmed: { from: +j.adTrimmed.from || 0, to: +j.adTrimmed.to || 0 } } : cutFrom ? { adTrimmed: { from: cutFrom, to: ad.length } } : {}) };
      // A server from before the trace: the same code works it out here
      if (!traceOf(o)) { delete o.trace; const rv = reviewText(o.text, { task, outLang, ad }); if (rv) { o.check = rv.check; o.trace = rv.trace; if (rv.impact) o.impact = rv.impact; } }
      e.out[task] = o;
      e.lastTask = task; e.lang = outLang;
      saveTailor();
      if (!apps[id]?.status) setStatus(id, "Saved");
      renderStats(); renderApps();
      const art = document.querySelector(`#list article.role[data-ad="${CSS.escape(id)}"]`)?.closest("article.co"); if (art) rerenderCompany(art.dataset.id);
    } else msg = t(TL_ERRORS[j.error] || "tl.e.service", { perHour: j.perHour ?? "", perDay: j.perDay ?? "" });
  } catch (err) {
    msg = err.name === "AbortError" ? (tl?.id === id && $("tailor").open ? t("tl.e.timeout") : "") : embedded ? t("e.embedded") : t("tl.e.network");
  } finally {
    clearTimeout(timer); clearInterval(tick);
    if (tl && tl.id === id) { tl.busy = false; tl.ctrl = null; tl.status = ""; tl.error = esc(msg); if ($("tailor").open) drawTailor(msg ? null : ".ai-note"); }
  }
}
// A short fingerprint of a text, to tell whether the CV or the ad has changed since an answer was made
const tlHash = s => { s = String(s || "").trim(); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
// "cv" or "ad" when the answer was made from another version of it than the one in the panel now, "" otherwise.
// Answers saved before 1.8 have no fingerprints and are never called out of date.
function staleOf(o, e) {
  if (!o || !o.cvH) return "";
  if (tlHash(cvWithFacts(e)) !== o.cvH) return "cv";
  const ad = e.ad ?? tl.adText ?? "";
  return o.adH && ad && tlHash(ad) !== o.adH ? "ad" : "";
}
// The ad asks for a licence or a certificate from an authority and the CV doesn't mention one (see licenceGap in
// server/factcheck.js). Said in code, whatever the AI wrote.
function licenceHtml(e) {
  const m = checks(), gap = m?.licenceGap ? m.licenceGap(cvWithFacts(e), e.ad ?? tl.adText ?? "") : null;
  return gap ? `<p class="tl-licence" role="note"><b>${esc(t("lic.title", { asked: gap.asked }))}</b> ${esc(t("lic.text"))}</p>` : "";
}
const slugify = s => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
function onTailorClick(e) {
  const el = e.target.closest("[data-tl]"); if (!el || !tl) return;
  const k = el.dataset.tl;
  if (k === "close") closeTailor();
  else if (k === "task") { flushTailor(); saveEdit(); tl.task = el.dataset.task; tl.error = ""; tl.confirm = ""; tl.factsMsg = ""; tl.pdfLost = 0; tl.plain = false; tl.plainMsg = ""; tlEntry(tl.id).lastTask = tl.task; saveTailor(); drawTailor(`[data-task="${tl.task}"]`); }
  else if (k === "excerpt") {
    // A long ad is cut at a paragraph here, in the ad box, so what is sent is what the person sees
    const ta = $("tl-ad");
    if (tl.adWarn === "long" && ta) { tl.adCutFrom = ta.value.trim().length; ta.value = trimmedAd(ta.value); saveField("ad", ta.value); }
    tl.adOk = true; tl.adWarn = ""; generate();
  }
  else if (k === "sources") { tl.sources = !tl.sources; drawTailor('[data-tl="sources"]'); }
  else if (k === "keep") {
    const o = tlEntry(tl.id).out[tl.task], key = el.dataset.k; if (!o || !key) return;
    const keep = new Set(Array.isArray(o.keep) ? o.keep.map(String) : []);
    if (keep.has(key)) keep.delete(key); else keep.add(key);
    o.keep = [...keep]; if (!o.keep.length) delete o.keep; saveTailor();
    drawTailor(`[data-tl="keep"][data-k="${CSS.escape(key)}"]`);
  }
  else if (k === "plain") {
    tl.plain = !tl.plain; tl.plainMsg = "";
    drawTailor(tl.plain ? "#tl-plain" : '[data-tl="plain"]');
    if (tl.plain) $("tl-plain")?.select();
  }
  else if (k === "selectall") { const ta = $("tl-plain"); if (ta) { ta.focus(); ta.select(); } }
  else if (k === "txt") {
    const o = tlEntry(tl.id).out[tl.task]; if (!o) return;
    download(new Blob([plainText(sendText(o)) + "\n"], { type: "text/plain;charset=utf-8" }), docName(o, "txt"));
  }
  else if (k === "edit") { tl.confirm = ""; tl.editing = true; tl.editDraft = null; tl.pdfLost = 0; drawTailor("#tl-edit"); }
  else if (k === "save") { flushTailor(); saveEdit(); drawTailor(".fc"); }
  else if (k === "cancel") { tl.editing = false; tl.editDraft = null; drawTailor('[data-tl="edit"]'); }
  else if (k === "pdf") {
    const o = tlEntry(tl.id).out[tl.task]; if (!o) return;
    const name = cvName(tlEntry(tl.id).out.cv?.text || "");
    const title = tl.task === "cv" ? `CV – ${name || tl.title}` : `${o.lang === "en" ? "Cover letter" : "Personligt brev"} – ${tl.employer || tl.title}`;
    const pdf = pdfBlob(sendText(o), { title, author: name, lang: o.lang, letter: tl.task === "letter" });
    download(pdf.blob, docName(o, "pdf"));
    if (pdf.lost !== tl.pdfLost) { tl.pdfLost = pdf.lost; drawTailor('[data-tl="pdf"]'); }
  }
  else if (k === "term") {
    // Adds "- term: " to what your CV leaves out, with the cursor after it, unless the term is there already
    const ta = $("tl-facts"); if (!ta) return;
    const w = el.dataset.w;
    if (!fold(ta.value).includes(fold(w))) { ta.value = (ta.value.trim() ? ta.value.replace(/\s*$/, "\n") : "") + `- ${w}: `; saveField("facts", ta.value); }
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    el.classList.add("on"); el.setAttribute("aria-pressed", "true");
  }
  else if (k === "tochecks") { e.preventDefault(); const c = $("tl-checks"); if (c) { c.scrollIntoView({ block: "start" }); c.focus({ preventScroll: true }); } }
  else if (k === "go" || k === "regen" || k === "restale") {
    flushTailor();
    if (wouldLose(tlEntry(tl.id).out[tl.task])) { tl.confirm = k === "restale" ? "go" : k; drawTailor('[data-tl="replace"]'); }
    else generate();
  }
  else if (k === "replace") generate();
  else if (k === "noreplace") { const from = tl.confirm || "go"; tl.confirm = ""; drawTailor(`[data-tl="${from}"]`); }
  else if (k === "tocv") {
    // Moved into the saved CV, so every job and the Mentor read it, and taken out of the box so it isn't sent twice
    flushTailor();
    const e = tlEntry(tl.id), f = String(e.facts || "").trim();
    if (!f) { tl.factsMsg = "tl.more.empty"; return drawTailor("#tl-facts"); }
    const cvEl = $("tl-cv"), cv = (cvEl ? cvEl.value : store.get("jf-cv", "")).replace(/\s+$/, ""), next = cv ? `${cv}\n\n${f}` : f;
    store.set("jf-cv", next); if (cvEl) cvEl.value = next;
    const fEl = $("tl-facts"); if (fEl) fEl.value = "";
    e.facts = ""; saveTailor(); tl.factsMsg = "tl.more.added";
    drawTailor('[data-tl="tocv"]');
  }
  else if (k === "refetch") refetchAd();
  else if (k === "load") $("tl-file").click();
  else if (k === "apply") { if (!["Applied", "Interview", "Offer"].includes(apps[tl.id]?.status)) { tl.askApplied = true; setTimeout(() => { if (tl) drawTailor('[data-tl="mark"]'); }, 0); } }
  else if (k === "mark") {
    setStatus(tl.id, "Applied"); tl.askApplied = false; tl.marked = true;
    renderStats(); renderApps();
    const art = document.querySelector(`#list article.role[data-ad="${CSS.escape(tl.id)}"]`)?.closest("article.co"); if (art) rerenderCompany(art.dataset.id);
    drawTailor(".tl-close");
  }
  else if (k === "copy") {
    const o = tlEntry(tl.id).out[tl.task]; if (!o) return;
    // When the browser won't let the page copy, the whole text is shown, selected, to copy by hand
    copyText(plainText(sendText(o)), el).then(ok => { if (!ok && tl) { tl.plain = true; tl.plainMsg = "pt.copyfail"; drawTailor("#tl-plain"); $("tl-plain")?.select(); } });
  }
  else if (k === "word") {
    const o = tlEntry(tl.id).out[tl.task]; if (!o) return;
    const title = DOC_TASKS.has(tl.task) ? "" : `${t("tl.t." + tl.task)}: ${tl.title}${tl.employer ? `, ${tl.employer}` : ""}`;
    download(docxBlob(sendText(o), title, o.lang), docName(o, "docx"));
  }
}
const tlTimers = {};
function saveField(k, v) {
  if (k === "cv") { if (v !== store.get("jf-cv", "")) store.set("jf-cv", v); return; }
  if (k === "code") { if (v.trim() !== store.get("jf-code", "")) store.set("jf-code", v.trim()); return; }
  if (!tl) return;
  const e = tlEntry(tl.id);
  if (k === "ad") { if (v === (e.ad ?? tl.adText ?? "")) return; e.ad = v; }
  else if (k === "extra") { if (v === (e.extra || "")) return; e.extra = v; }
  else if (k === "facts") { v = v.slice(0, MAX_FACTS); if (v === (e.facts || "")) return; e.facts = v; }
  else if (k === "lang") { if (v === (e.lang || tl.lang || lang)) return; e.lang = v; }
  saveTailor();
}
function onTailorInput(e) {
  const el = e.target, k = el.dataset.tl;
  if (k === "edit-text" && tl) { tl.editDraft = el.value; return; }
  if (!["cv", "code", "ad", "extra", "facts", "lang"].includes(k) || !tl) return;
  if (k === "ad") { tl.adOk = false; tl.adCutFrom = 0; }   // a changed ad is looked at again before it's sent
  if (k === "facts") {
    const s = $("tl-facts-state"), key = factsState(tlEntry(tl.id).out[tl.task], el.value.trim(), tl.task);
    if (s) { s.hidden = !key; s.textContent = key ? t(key) : ""; s.className = "tl-hint" + (key === "tl.more.used" ? " tl-ok" : ""); }
  }
  clearTimeout(tlTimers[k]);
  tlTimers[k] = setTimeout(() => saveField(k, el.value), k === "lang" ? 0 : 400);
}
async function onTailorFile(e) {
  const f = e.target.files[0]; if (!f) return;
  const msg = $("tl-cvmsg");
  try {
    const text = /\.docx$/i.test(f.name) ? await docxText(await f.arrayBuffer()) : /\.pdf$/i.test(f.name) ? null : await f.text();
    if (text === null) { msg.textContent = t("tl.pdf"); return; }
    $("tl-cv").value = text; store.set("jf-cv", text); msg.textContent = t("tl.loaded", { name: f.name });
  } catch { msg.textContent = t("tl.loadfail"); }
  e.target.value = "";
}
function initTailor() {
  const d = $("tailor");
  let downOnBackdrop = false;
  d.addEventListener("mousedown", e => { downOnBackdrop = e.target === d; });
  d.addEventListener("click", e => { if (e.target === d) { if (downOnBackdrop) closeTailor(); } else onTailorClick(e); });
  d.addEventListener("input", onTailorInput);
  d.addEventListener("change", e => { if (e.target.id === "tl-file") onTailorFile(e); else onTailorInput(e); });
  d.addEventListener("close", () => {
    flushTailor(); saveEdit();   // closing the panel keeps what was typed in Edit text
    if (tl?.ctrl) tl.ctrl.abort();
    const id = tl?.id, from = tl?.from; tl = null; d.innerHTML = "";
    const back = id && document.querySelector(`${from === "apps" ? "#apps" : "#list"} [data-tailor="${CSS.escape(id)}"]`); if (back) back.focus();
  });
  for (const where of ["list", "apps"]) $(where).addEventListener("click", onTranslateClick);
  for (const where of ["list", "apps"]) $(where).addEventListener("click", e => {
    const b = e.target.closest("[data-tailor]"); if (!b) return;
    if (b.dataset.task && TASKS.includes(b.dataset.task)) { tlEntry(b.dataset.tailor).lastTask = b.dataset.task; saveTailor(); }   // "Interview prep" opens on that task
    openTailor(b.dataset.tailor, where);
  });
  d.addEventListener("keydown", e => {
    const tab = e.target.closest?.(".tl-task"); if (!tab || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault(); const i = TASKS.indexOf(tab.dataset.task), next = TASKS[(i + (e.key === "ArrowRight" ? 1 : TASKS.length - 1)) % TASKS.length];
    d.querySelector(`[data-task="${next}"]`).click();
  });
}
