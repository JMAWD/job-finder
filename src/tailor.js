/* ---------- Step 2: tailor an application to one job ----------
   Opens a panel over the list with the full ad, the person's CV and four things the AI can write.
   Platsbanken ads can also be translated inline; translation sends only the ad text, without a CV.
   The CV and access code are kept in this browser. Translation sends only the ad text; Generate sends the CV,
   ad and any extra wishes to the tailoring server, which forwards them to an AI model hosted in the EU. */
const TASKS = ["match", "cv", "letter", "interview"];
const TAILOR_TIMEOUT = 110000;
let tl = null;   // the open job: { id, title, employer, muni, url, src, task, busy, ctrl }
let tailorStore = store.get("jf-tailor", {});   // ad id -> { ad, extra, out: { task: { text, at, model, lang, check } } }
const saveTailor = () => store.set("jf-tailor", tailorStore);
const tlEntry = id => tailorStore[id] || (tailorStore[id] = { out: {} });
const fullAds = new Map(), adFails = new Set();   // ads fetched in full, and Platsbanken ads that couldn't be fetched this time
const translations = new Map();   // translated ads stay in memory for this page view; never saved with application data

const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;   // a "---" divider line, left out everywhere
// Small Markdown reader for the AI's answers: headings, lists, bold, italics. Everything is escaped first.
function mdHtml(text) {
  const out = []; let list = null;
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*(\S[^*]*?)\*(?=[\s).,;:!?]|$)/g, "$1<i>$2</i>");
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const l of esc(text).split("\n")) {
    if (RULE.test(l)) { close(); continue; }
    const h = l.match(/^\s*#{1,6}\s+(.*)/), ul = l.match(/^\s*[-*•]\s+(.*)/), ol = l.match(/^\s*\d+[.)]\s+(.*)/);
    if (h) { close(); out.push(`<h4>${inline(h[1])}</h4>`); }
    else if (ul || ol) { const tag = ul ? "ul" : "ol"; if (list !== tag) { close(); out.push(`<${tag}>`); list = tag; } out.push(`<li>${inline((ul || ol)[1])}</li>`); }
    else if (!l.trim()) close();
    else { close(); out.push(`<p>${inline(l)}</p>`); }
  }
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
function zipStore(files) {   // files: [[name, Uint8Array]] stored without compression
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
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
function docxBlob(md, title, textLang) {
  const x = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const runs = (s, base = "") => s.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(part => {
    const bold = /^\*\*.*\*\*$/.test(part), txt = bold ? part.slice(2, -2) : part;
    return `<w:r><w:rPr>${base}${bold ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${x(txt)}</w:t></w:r>`;
  }).join("");
  const paras = [`<w:p><w:pPr><w:spacing w:after="200"/></w:pPr>${runs(title, '<w:b/><w:sz w:val="32"/>')}</w:p>`];
  for (const line of md.split("\n")) {
    const h = line.match(/^\s*#{1,6}\s+(.*)/), ul = line.match(/^\s*[-*•]\s+(.*)/), ol = line.match(/^\s*(\d+)[.)]\s+(.*)/);
    if (!line.trim() || RULE.test(line)) continue;
    if (h) paras.push(`<w:p><w:pPr><w:spacing w:before="240" w:after="80"/><w:keepNext/></w:pPr>${runs(h[1], '<w:b/><w:sz w:val="26"/>')}</w:p>`);
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
    const text = (h.description?.text || "").trim();
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
  const result = state.text ? `<p class="translation-note">${esc(t("tr.note"))}</p><div class="translation-text" lang="${langAttr}">${mdHtml(state.text)}</div>` : "";
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
      state.text = data.text.trim(); store.set("jf-code", code);
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
function factCheckHtml(check) {
  if (!check || !Array.isArray(check.issues)) return "";
  if (!check.issues.length) return `<p class="fc fc-ok" role="status">${esc(t("fc.ok"))}</p>`;
  return `<section class="fc fc-warn" role="alert"><p><b>${esc(check.issues.length === 1 ? t("fc.warn1") : t("fc.warn", { n: check.issues.length }))}</b></p>
    <ul>${check.issues.map(i => `<li><span class="fc-kind">${esc(t("fc.k." + i.kind))}</span>${esc(i.text)}</li>`).join("")}</ul>
    <p class="tl-hint">${esc(t("fc.how"))}</p></section>`;
}
function appliedHtml(id) {
  const st = apps[id]?.status;
  if (tl.marked) return `<p class="tl-hint tl-ok" role="status">${esc(t("tl.marked"))}</p>`;
  if (!tl.askApplied || ["Applied", "Interview", "Offer"].includes(st)) return "";
  return `<div class="row tl-ask"><span>${esc(t("tl.markq"))}</span><button class="btn sm" type="button" data-tl="mark">${esc(t("tl.mark"))}</button></div>`;
}
function tailorHtml() {
  const job = tl, e = tlEntry(job.id), task = tl.task, out = e.out[task];
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
        <div class="row"><button class="btn" type="button" data-tl="go"${tl.busy ? " disabled" : ""}>${esc(tl.busy ? t("tl.busy") : out ? t("tl.again") : t("tl.go"))}</button><span class="tl-status" id="tl-status">${esc(tl.status || "")}</span></div>
        ${out ? "" : `<p class="tl-hint">${esc(t("ai.before"))}</p>`}
        ${tl.error ? `<p class="tl-err" role="alert">${tl.error}</p>` : ""}
        ${out ? `${aiNoteHtml(task === "match" ? "ai.match" : task === "interview" ? "ai.interview" : "ai.write", t("tl.t." + task))}
          ${factCheckHtml(out.check)}
          <div class="tl-out" tabindex="-1">${mdHtml(out.text)}</div>
          <div class="row"><button class="btn ghost sm" type="button" data-tl="copy">${esc(t("copy"))}</button><button class="btn ghost sm" type="button" data-tl="word">${esc(t("tl.word"))}</button>${applyHtml(job, true)}
          <span class="tl-hint">${esc(t("tl.made", { date: fmtDate(localDay(new Date(out.at))) }))}</span></div>
          ${appliedHtml(job.id)}` : appliedHtml(job.id)}
      </section>
      <p class="tl-hint tl-privacy">${esc(t("tl.privacy"))}</p>
    </div>`;
}
function flushTailor() {
  if (!tl) return;
  for (const k of ["cv", "code", "ad", "extra", "lang"]) { clearTimeout(tlTimers[k]); const el = $("tl-" + k); if (el) saveField(k, el.value); }
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
  tl = { ...job, task: tailorStore[id]?.lastTask || "match", busy: false, status: "", error: "", from };
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
  const stop = (k, sel, v) => { tl.error = esc(t(k, v)); drawTailor(sel); };
  if (!code) return stop("tl.e.nocode", "#tl-code");
  if (cv.length < 200) return stop("tl.e.cv", "#tl-cv");
  if (ad.length < 100) return stop("tl.e.ad", "#tl-ad");
  store.set("jf-cv", cv); store.set("jf-code", code); e.ad = ad; e.extra = extra; e.lang = outLang; saveTailor();
  tl.busy = true; tl.error = ""; tl.status = t("tl.wait", { s: 0 });
  drawTailor('[data-tl="go"]');
  const started = Date.now(), tick = setInterval(() => { if (tl?.id === id && tl.busy) { tl.status = t("tl.wait", { s: Math.round((Date.now() - started) / 1000) }); const s = $("tl-status"); if (s) s.textContent = tl.status; } }, 1000);
  const ctrl = new AbortController(); tl.ctrl = ctrl;
  const timer = setTimeout(() => ctrl.abort(), TAILOR_TIMEOUT);
  let msg = "";
  try {
    const r = await fetch(ABOUT.tailor, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ code, task, lang: outLang, cv, extra, job: { title: tl.title, employer: tl.employer, text: ad } }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.text) {
      e.out[task] = { text: j.text, at: new Date().toISOString(), model: j.model || "", lang: outLang, ...(j.check && Array.isArray(j.check.issues) ? { check: { ok: !!j.check.ok, issues: j.check.issues.slice(0, 30).map(i => ({ kind: String(i.kind), text: String(i.text).slice(0, 200) })) } } : {}) };
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
const slugify = s => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
function onTailorClick(e) {
  const el = e.target.closest("[data-tl]"); if (!el || !tl) return;
  const k = el.dataset.tl;
  if (k === "close") closeTailor();
  else if (k === "task") { tl.task = el.dataset.task; tl.error = ""; tlEntry(tl.id).lastTask = tl.task; saveTailor(); drawTailor(`[data-task="${tl.task}"]`); }
  else if (k === "go") generate();
  else if (k === "refetch") refetchAd();
  else if (k === "load") $("tl-file").click();
  else if (k === "apply") { if (!["Applied", "Interview", "Offer"].includes(apps[tl.id]?.status)) { tl.askApplied = true; setTimeout(() => { if (tl) drawTailor('[data-tl="mark"]'); }, 0); } }
  else if (k === "mark") {
    setStatus(tl.id, "Applied"); tl.askApplied = false; tl.marked = true;
    renderStats(); renderApps();
    const art = document.querySelector(`#list article.role[data-ad="${CSS.escape(tl.id)}"]`)?.closest("article.co"); if (art) rerenderCompany(art.dataset.id);
    drawTailor(".tl-close");
  }
  else if (k === "copy") { const o = tlEntry(tl.id).out[tl.task]; if (o) copyText(plainText(o.text), el); }
  else if (k === "word") {
    const o = tlEntry(tl.id).out[tl.task]; if (!o) return;
    const title = `${t("tl.t." + tl.task)}: ${tl.title}${tl.employer ? `, ${tl.employer}` : ""}`;
    const url = URL.createObjectURL(docxBlob(o.text, title, o.lang)), link = document.createElement("a");
    link.href = url; link.download = `${slugify(t("tl.t." + tl.task))}-${slugify(tl.employer || "")}-${slugify(tl.title)}.docx`.replace(/-+/g, "-");
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
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
  else if (k === "lang") { if (v === (e.lang || tl.lang || lang)) return; e.lang = v; }
  saveTailor();
}
function onTailorInput(e) {
  const el = e.target, k = el.dataset.tl; if (!["cv", "code", "ad", "extra", "lang"].includes(k) || !tl) return;
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
    flushTailor();
    if (tl?.ctrl) tl.ctrl.abort();
    const id = tl?.id, from = tl?.from; tl = null; d.innerHTML = "";
    const back = id && document.querySelector(`${from === "apps" ? "#apps" : "#list"} [data-tailor="${CSS.escape(id)}"]`); if (back) back.focus();
  });
  for (const where of ["list", "apps"]) $(where).addEventListener("click", onTranslateClick);
  for (const where of ["list", "apps"]) $(where).addEventListener("click", e => { const b = e.target.closest("[data-tailor]"); if (b) openTailor(b.dataset.tailor, where); });
  d.addEventListener("keydown", e => {
    const tab = e.target.closest?.(".tl-task"); if (!tab || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault(); const i = TASKS.indexOf(tab.dataset.task), next = TASKS[(i + (e.key === "ArrowRight" ? 1 : TASKS.length - 1)) % TASKS.length];
    d.querySelector(`[data-task="${next}"]`).click();
  });
}
