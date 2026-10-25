"use strict";
/*
  What happens to a written answer between the model and the person. The server (handler.js) and the eval
  (eval/run.mjs) both use it, so the eval measures exactly what people get.

  1. Clean in code. Swedish answers get main-clause word order put right ("Jag berättar gärna"). The CV and letter
     lose dashes used as punctuation, the CV gets one form (tidyCv), and any email, phone number or link in the
     contact line that the CV doesn't have is removed.
  2. Fact check (factcheck.js): employers, titles, schools, degrees and dates, and in the CV and letter also words and
     figures taken from the ad.
  3. If the CV or letter has anything flagged, the model gets one go at taking exactly those things out. In the live
     tests the model kept borrowing from the ad even when told not to, so this turns the check from a warning into a
     correction. The new version is kept only if it has fewer flags and, for a CV, still has every job.
  4. Style check (style.js) on what is left.
  5. Review (factcheck.js): where each sentence comes from, as one letter per sentence, and for a CV the keyword match
     kept apart from the evidence. The panel leaves unsupported sentences out of every download until the person keeps
     them.
*/
const { factCheck, review } = require("./factcheck.js");
const { stripDashes, styleCheck, tidyCv, keepContact, fixWordOrder } = require("./style.js");
const { repairPrompt, OPTIONS, withFacts } = require("./prompts.js");

const SENT = new Set(["cv", "letter"]);   // the texts that go to the employer
function clean(text, { task, cv, lang }) {
  // Swedish word order is put right in every answer ("Jag gärna berättar" becomes "Jag berättar gärna")
  if (lang === "sv") text = fixWordOrder(text);
  if (!SENT.has(task)) return text;
  let t = stripDashes(text);
  if (task === "cv") t = tidyCv(t);
  return keepContact(t, cv);
}
const jobHeadings = t => (String(t || "").match(/^\s*###\s/gm) || []).length;

/**
 * @param {object} a     { text, task, lang, cv, facts, ad, job: { title, employer }, extra, year }; facts is what the
 *                       person added that the CV leaves out, and every check reads it as part of the CV
 * @param {function} ask (messages, options) => Promise<{ text, error, cut, tokens }>: one more model call, or null for none
 * @returns {Promise<{ text, check, style, fixed, repairTokens, trace, counts, impact }>}
 */
async function finish({ text, task, lang, cv: cvOnly = "", facts = "", ad = "", job = {}, extra = "", year = new Date().getFullYear() }, ask) {
  const cv = cvOnly && facts ? `${cvOnly}\n\n${facts}` : cvOnly;
  const src = { cv, ad, title: job.title || "", employer: job.employer || "", extra, year, task, lang };
  const checked = Boolean(cv && ad);
  let out = clean(text, { task, cv, lang }), check = checked ? factCheck(out, src) : null, fixed = 0, repairTokens = null;
  if (check && check.issues.length && SENT.has(task) && ask) {
    const r = await ask(repairPrompt(lang, task, { cv: withFacts(cvOnly, facts, lang), ad, text: out, issues: check.issues }), OPTIONS[task]);
    repairTokens = r && r.tokens || null;
    if (r && r.text && !r.error && !r.cut) {
      const t2 = clean(r.text, { task, cv, lang }), c2 = factCheck(t2, src);
      // Every job must still be there, except one whose heading was itself flagged (an invented employer or title)
      const flaggedJobs = new Set(check.issues.map(i => i.line).filter(l => /^\s*###\s/.test(l))).size;
      // A corrected letter keeps at least three quarters of its words: one cut down to a few lines is worse than one
      // with a flag the person can fix
      const words = t => String(t).split(/\s+/).filter(Boolean).length;
      const keepsShape = task === "cv" ? jobHeadings(t2) >= jobHeadings(out) - flaggedJobs : words(t2) >= words(out) * 0.75;
      if (c2.issues.length < check.issues.length && keepsShape) {
        fixed = check.issues.length - c2.issues.length; out = t2; check = c2;
      }
    }
  }
  const style = SENT.has(task) ? styleCheck(out, { cv, ad, task }) : null;
  const rv = checked ? review(out, src) : null;
  return { text: out, check, style, fixed, repairTokens, trace: rv ? rv.trace : null, counts: rv ? rv.counts : null, impact: rv ? rv.impact : null };
}

module.exports = { finish, clean };
