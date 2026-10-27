"use strict";
/*
  Style check for step 2, carried over from Job Tailor (JMAWD/ai-cv-tools). The prompt asks the model to write like a
  person, but instructions about punctuation and rhythm are followed unreliably, so this is the guarantee rather than
  the request. Plain code, like factcheck.js, and the browser runs the same file again after the person edits a text.

    stripDashes(text)   Em dashes and en dashes used as punctuation are one of the clearest signs a text was machine
                        written, so the tailored CV and the cover letter have them taken out before anyone sees them.
                        A dash between words becomes a comma. Date ranges are protected: "2016\u20132018" becomes
                        "2016-2018", and "2018 \u2013 nu" or "mars 2019 \u2013 februari 2021" keep a plain spaced hyphen.
    styleCheck(text)    What's still there after cleaning: jobs that are all about the same length (a real CV is
                        lopsided), buzzwords that are in neither the CV nor the ad, and dashes the person typed in
                        themselves. It reports, it doesn't change anything.
*/

const MONTH = "(?:jan(?:uari|uary)?|feb(?:ruari|ruary)?|mar(?:s|ch)?|apr(?:il)?|maj|may|jun[ei]?|jul[iy]?|aug(?:usti|ust)?|sep(?:t|tember)?|o[kc]t(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const OPEN_END = "(?:nu|idag|i dag|pågående|tills vidare|present|now|current|today|ongoing)";
const YEAR = "(?:19|20)\\d\\d";
// A date range: a year, a dash, then a year, an optional month and a year, or an open end ("nu", "present")
const DATE_RANGE = new RegExp(`(${YEAR})\\s*[\\u2013\\u2014-]\\s*((?:${MONTH}\\s+)?${YEAR}|${OPEN_END})(?![\\p{L}\\d])`, "giu");

function stripDashes(text) {
  if (!text) return text;
  let s = String(text);
  // Protect the date ranges first. Two bare years close up ("2016-2018"); a month or an open end keeps the spaces.
  const ranges = [];
  s = s.replace(DATE_RANGE, (m, a, b) => {
    ranges.push(/^\d{4}$/.test(b) ? `${a}-${b}` : `${a} - ${b}`);
    return `\u0000R${ranges.length - 1}\u0000`;
  });
  // Other number ranges ("3–5 years", "20–30 %") are ranges too, and become a plain hyphen
  s = s.replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, "$1-$2");
  // A dash between spaces is doing the job of a comma, so use one. So is an unspaced em dash between words.
  s = s.replace(/[ \t]+[\u2013\u2014][ \t]+/g, ", ");
  s = s.replace(/\u2014/g, ", ");
  // A remaining en dash between letters is a hyphen ("co–operative"), and any other en dash too
  s = s.replace(/(\p{L})\u2013(\p{L})/gu, "$1-$2");
  s = s.replace(/\u2013/g, "-");
  // Tidy what the substitution can leave behind
  s = s.replace(/,[ \t]*,/g, ",");
  s = s.replace(/,[ \t]*([.;:!?)])/g, "$1");
  s = s.replace(/\([ \t]*,[ \t]*/g, "(");
  s = s.replace(/[ \t]+,/g, ",");
  // A line that began with a dash should not start with a comma; keep any Markdown marker in front of it
  s = s.replace(/^([ \t]*(?:#{1,6}[ \t]+|[-*•][ \t]+|\d+[.)][ \t]+)?),[ \t]*/gm, "$1");
  return s.replace(/\u0000R(\d+)\u0000/g, (m, i) => ranges[Number(i)]);
}

// Words that make a CV or letter sound machine written. Only flagged when neither the CV nor the ad uses them,
// since mirroring the employer's own wording is fine.
const BUZZWORDS = ["leverage", "leveraged", "leveraging", "results-driven", "results-oriented", "passionate", "dynamic", "spearheaded", "spearheading",
  "synergy", "synergies", "cutting-edge", "seamless", "seamlessly", "proven track record", "go-getter", "self-starter", "detail-oriented", "delve", "tapestry",
  "game-changer", "best-in-class", "world-class", "thrive in", "drivande", "resultatinriktad", "resultatorienterad", "lösningsorienterad", "brinner för",
  "passionerad", "dynamisk", "dynamiska", "synergi", "synergier", "spjutspets", "världsklass",
  // filler that machine-written Swedish and English lean on
  "säkerställa", "säkerställde", "säkerställer", "perfekt match", "bidra till", "spännande utmaning", "aligns with", "align with", "ensure", "ensured", "ensuring", "eager to",
  "exactly the kind of", "learn and grow", "at the intersection of"];
const fold = s => String(s || "").normalize("NFC").toLowerCase();
const hasWord = (text, w) => new RegExp(`(?<![\\p{L}\\d])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "iu").test(text);

// The jobs under the experience heading, as text blocks: each "### …" heading and everything up to the next heading.
// Headings under education, courses or certificates are not jobs.
function roleBlocks(text) {
  const blocks = []; let section = "", cur = null;
  for (const line of String(text || "").split(/\r?\n/)) {
    const h = line.match(/^\s*(#{1,6})\s+(.*)/);
    if (h && h[1].length <= 2) { section = fold(h[2]); cur = null; continue; }
    if (h) {
      cur = /utbildning|education|kurs|course|certifi|språk|language|övrigt|other/.test(section) ? null : { lines: [line.trim()], bullets: 0 };
      if (cur) blocks.push(cur);
      continue;
    }
    if (!cur || !line.trim()) continue;
    cur.lines.push(line.trim());
    if (/^\s*(?:[-*•]|\d+[.)])\s+/.test(line)) cur.bullets++;
  }
  return blocks.map(b => ({ length: b.lines.join("\n").length, bullets: b.bullets }));
}
// Coefficient of variation: standard deviation over the mean, so it behaves the same for a short CV and a long one
function variation(lengths) {
  if (lengths.length < 2) return null;
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (!mean) return null;
  return Math.sqrt(lengths.reduce((a, n) => a + (n - mean) ** 2, 0) / lengths.length) / mean;
}
const UNIFORM = 0.25;   // below this the jobs are suspiciously even (Job Tailor's threshold)

/**
 * @param {string} text   the answer (Markdown)
 * @param {object} src    { cv, ad, task }
 * @returns {{ even: boolean, words: string[], dashes: number }}
 */
function styleCheck(text, { cv = "", ad = "", task = "cv" } = {}) {
  const out = String(text || "");
  const blocks = task === "cv" ? roleBlocks(out) : [];
  const v = variation(blocks.map(b => b.length));
  const sameBullets = blocks.length >= 3 && blocks[0].bullets > 0 && blocks.every(b => b.bullets === blocks[0].bullets);
  // With only two jobs, different numbers of bullets is already uneven
  const twoDiffer = blocks.length === 2 && blocks[0].bullets !== blocks[1].bullets;
  const source = [cv, ad].join("\n");
  const words = BUZZWORDS.filter(w => hasWord(out, w) && !hasWord(source, w));
  // Dashes still used as punctuation (only possible after the person's own edits, since answers are cleaned).
  // Date ranges and number ranges don't count.
  const rest = out.replace(DATE_RANGE, "").replace(/\d\s*[\u2013\u2014]\s*\d/g, "");
  const dashes = (rest.match(/[ \t][\u2013\u2014](?=[ \t])|\u2014/g) || []).length;
  return { even: (v !== null && v < UNIFORM && !twoDiffer) || sameBullets, words, dashes, order: wordOrderSlips(out).slice(0, 5), echoes: task === "cv" ? achievementEchoes(out).echoes.slice(0, 6) : [] };
}

// The tailored CV's form, made consistent in code so the PDF always looks the same, whatever the model did:
//   lines under a job become bullet points ("- "), and a long paragraph is split into one bullet per sentence;
//   the contact line under the name loses a separator left at its start or end ("Malmö ·");
//   blank lines between the bullets of one job go.
// Only sections that hold jobs are touched; education, skills and languages are left as written.
const NOT_JOBS = /resultat|achievement|accomplishment|highlight|utbildning|education|kurs|course|certifi|språk|language|kunskap|kompetens|skill|verktyg|tool|teknik|technolog|övrigt|other|intress|interest|referen|körkort|licen|profil|profile|sammanfattning|summary/i;
const ABBREV = /(?:t\.ex|bl\.a|m\.m|m\.fl|e\.g|i\.e|ca|inkl|resp|etc|osv|dvs|nr|st)\.$/i;
function sentencesOf(text) {
  const parts = text.split(/(?<=[.!?])\s+(?=[\p{Lu}\d])/u), out = [];
  for (const p of parts) { if (out.length && ABBREV.test(out[out.length - 1])) out[out.length - 1] += " " + p; else out.push(p); }
  return out.map(x => x.trim()).filter(Boolean);
}
function tidyCv(md) {
  const lines = String(md || "").replace(/\r/g, "").split("\n"), out = [];
  let section = "", inJob = false, afterName = false;
  for (const line of lines) {
    const h = line.match(/^\s*(#{1,6})\s+(.*)/);
    if (h) {
      afterName = h[1].length === 1;   // the contact line is the line right under the name, never under a later heading
      if (h[1].length <= 2) { section = h[2]; inJob = false; }
      else inJob = !NOT_JOBS.test(section);
      // Every range on a heading written the same way, so the years line up in the PDF: "2016 - 2018", "2018 - nu"
      out.push(h[1].length >= 3 ? line.replace(/\b((?:19|20)\d\d)\s*-\s*((?:19|20)\d\d)\b/g, "$1 - $2") : line); continue;
    }
    if (afterName && line.trim()) {
      afterName = false;
      out.push(line.replace(/^[\s·|,;•-]+|[\s·|,;•-]+$/g, "").replace(/\s*·\s*(?:·\s*)+/g, " · "));
      continue;
    }
    if (!inJob || !line.trim()) { out.push(line); continue; }
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    const text = (item ? item[1] : line).trim();
    const parts = text.length > 140 ? sentencesOf(text) : [text];
    // One sentence, no full stop, so every bullet ends the same way; a bullet of several sentences keeps its stops
    for (const part of parts) out.push("- " + (sentencesOf(part).length > 1 || ABBREV.test(part) ? part : part.replace(/\.$/, "")));
  }
  // No blank lines between the bullets of one job
  return dropEchoes(out.filter((l, i) => !(l.trim() === "" && /^- /.test(out[i - 1] || "") && /^- /.test(out[i + 1] || ""))).join("\n"));
}

// Key achievements: 3 to 6 points at the top of the CV, each a result the CV states. The same result may also sit
// under its job, but not in the same words: the top says what came of it, the bullet says how. Checked in code.
//   A bullet under a job that is all but contained in an achievement adds nothing, so it is taken out.
//   A bullet that shares most of an achievement's words but says more is left, and the style check names the echo.
//   More than six achievements are cut to the first six.
const ACHIEVE = /resultat|achievement|accomplishment|highlight/i;
const ECHO_STOP = new Set(("och med för att som den det har hade var från till hos vid inom under efter genom samt eller även över mot där "
  + "the and for with from into was were has had our their his her its over under after through within across about than").split(" "));
const echoWords = s => new Set(fold(s).replace(/\*\*|__/g, "").split(/[^\p{L}\d]+/u).filter(w => w && (w.length >= 3 || /\d/.test(w)) && !ECHO_STOP.has(w)).map(w => w.slice(0, 6)));
const ITEM = /^\s*(?:[-*•]|\d+[.)])\s+(.*)/;
function cvParts(md) {
  const lines = String(md || "").split("\n"), points = [], bullets = [];
  let section = "", inJob = false;
  lines.forEach((line, i) => {
    const h = line.match(/^\s*(#{1,6})\s+(.*)/);
    if (h) { if (h[1].length <= 2) { section = h[2]; inJob = false; } else inJob = !NOT_JOBS.test(section); return; }
    const item = line.match(ITEM);
    if (!item) return;
    if (ACHIEVE.test(section)) points.push({ i, text: item[1].trim(), words: echoWords(item[1]) });
    else if (inJob) bullets.push({ i, text: item[1].trim(), words: echoWords(item[1]) });
  });
  return { lines, points, bullets };
}
const shared = (a, b) => [...a].filter(w => b.has(w)).length;
function achievementEchoes(md) {
  const { lines, points, bullets } = cvParts(md), drop = new Set(), echoes = [];
  for (const p of points) {
    let echoed = false;
    for (const b of bullets) {
      const n = shared(p.words, b.words);
      if (b.words.size >= 3 && n / b.words.size >= 0.8) drop.add(b.i);
      else if (n >= 4 && n / Math.min(p.words.size, b.words.size) >= 0.6) echoed = true;
    }
    if (echoed) echoes.push(p.text);
  }
  // Anything past the sixth achievement
  points.slice(6).forEach(p => drop.add(p.i));
  return { lines, drop, echoes };
}
function dropEchoes(md) {
  const { lines, drop } = achievementEchoes(md);
  return drop.size ? lines.filter((_, i) => !drop.has(i)).join("\n") : md;
}

// The contact line under the name keeps only what the CV has. An email, phone number or link the CV doesn't have was
// made up, and is removed in code; so is a place the CV never names. A model has done exactly that in a live test.
const digits = s => String(s).replace(/\D/g, "");
function keepContact(md, cv) {
  const lines = String(md || "").split("\n"), src = String(cv || "").toLowerCase(), srcDigits = digits(cv);
  const i = lines.findIndex(l => /^\s*#\s/.test(l));
  if (i < 0) return md;
  const j = lines.findIndex((l, k) => k > i && l.trim());
  if (j < 0 || /^\s*(#|[-*•]\s)/.test(lines[j])) return md;
  const items = lines[j].split(/\s*[·|]\s*/).map(x => x.trim()).filter(Boolean);
  const looksContact = items.some(x => /@|\d{5,}|\d{2,4}[ -]\d{2,3}|linkedin|github|https?:|www\./i.test(x));
  if (!looksContact && items.length > 1 && !items.every(x => x.length < 40)) return md;   // a sentence, not a contact line
  const kept = items.filter(x => {
    if (/@/.test(x)) return src.includes(x.toLowerCase());
    if (/\d{2,}[\d -]{4,}/.test(x) && digits(x).length >= 7) return srcDigits.includes(digits(x)) || srcDigits.includes(digits(x).replace(/^46/, "0"));
    if (/linkedin|github|https?:|www\./i.test(x)) return src.includes(x.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""));
    return src.includes(x.toLowerCase());
  });
  if (kept.length === items.length) return md;
  if (kept.length) lines[j] = kept.join(" · "); else lines.splice(j, 1);
  return lines.join("\n");
}

// Swedish main clauses put the verb second: "Jag berättar gärna mer", not "Jag gärna berättar mer". A model that writes
// Swedish with English habits gets this wrong, and a native reader notices at once, so the answer is put right in code
// like the dashes. Only a sentence that starts with its subject is touched: after "att", "som" or "när" the adverb
// goes first ("att jag gärna berättar") and that is correct.
const V2_ADV = "gärna|också|även|inte|aldrig|alltid|ofta|redan|verkligen|särskilt";
const V2 = new RegExp(`(^|[.!?]\\s+|\\n[ \\t]*(?:[-*•][ \\t]+)?)(Jag|Vi|Du|Hon|Han|Ni|De)\\s+(${V2_ADV})\\s+(\\p{Ll}+(?:ar|er|ir|or|ur|yr|år|ade|de|te))(?![\\p{L}])`, "gu");
const fixWordOrder = text => String(text || "").replace(V2, (m, pre, subj, adv, verb) => `${pre}${subj} ${verb} ${adv}`);
const wordOrderSlips = text => [...String(text || "").matchAll(V2)].map(m => `${m[2]} ${m[3]} ${m[4]}`);
module.exports = { stripDashes, styleCheck, tidyCv, dropEchoes, achievementEchoes, keepContact, fixWordOrder, wordOrderSlips, _test: { roleBlocks, variation, UNIFORM, sentencesOf } };
