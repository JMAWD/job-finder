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
  "passionerad", "dynamisk", "dynamiska", "synergi", "synergier", "spjutspets", "världsklass"];
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
  const sameBullets = blocks.length >= 3 && blocks.every(b => b.bullets === blocks[0].bullets);
  const source = [cv, ad].join("\n");
  const words = BUZZWORDS.filter(w => hasWord(out, w) && !hasWord(source, w));
  // Dashes still used as punctuation (only possible after the person's own edits, since answers are cleaned).
  // Date ranges and number ranges don't count.
  const rest = out.replace(DATE_RANGE, "").replace(/\d\s*[\u2013\u2014]\s*\d/g, "");
  const dashes = (rest.match(/[ \t][\u2013\u2014](?=[ \t])|\u2014/g) || []).length;
  return { even: (v !== null && v < UNIFORM) || sameBullets, words, dashes };
}

module.exports = { stripDashes, styleCheck, _test: { roleBlocks, variation, UNIFORM } };
