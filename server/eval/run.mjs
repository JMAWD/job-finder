// Fact-check eval: runs the real step 2 prompts against the real model for every made-up CV and ad in cases.json,
// checks each answer with factcheck.js and writes a report of everything it flagged.
//
//   cd server && AI_KEY=... node eval/run.mjs
//
// Settings (environment variables):
//   AI_KEY        an IAM API secret key that is allowed to use Scaleway Generative APIs (required)
//   AI_MODEL      default mistral-medium-3.5-128b, the same default as the server
//   AI_BASE_URL   default https://api.scaleway.ai/v1
//   EVAL_RUNS     answers per case, task and language, default 3
//   EVAL_TASKS    default cv,letter,match,interview
//   EVAL_LANGS    default sv,en (each case is answered in both, so translated titles are tested too)
//
// Writes eval/results/<date>-<model>.json (every answer and what was flagged) and eval/results/latest.md (the summary).
// A flag is not automatically an invention: read the list in latest.md, mark the false alarms, and report both numbers.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { PROMPTS, OPTIONS } = require("../prompts.js");
const { factCheck } = require("../factcheck.js");
const { stripDashes, styleCheck } = require("../style.js");
const here = path.dirname(fileURLToPath(import.meta.url));

// The same room to write as the server gives each task (prompts.js OPTIONS), so a whole CV isn't cut short here either
export async function callModel(messages, { model, baseUrl, key, task }) {
  const r = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: OPTIONS[task]?.temperature ?? 0.4, max_tokens: OPTIONS[task]?.maxTokens ?? 2500 }),
  });
  if (!r.ok) throw new Error(`model answered ${r.status}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || "";
}

export async function runEval({ cases, tasks, langs, runs, ask, year = new Date().getFullYear(), log = () => {} }) {
  const jobs = [];
  for (const c of cases) for (const task of tasks) for (const lang of langs) for (let run = 1; run <= runs; run++) jobs.push({ c, task, lang, run });
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const { c, task, lang, run } = jobs[next++];
      let text = "", error = "";
      for (let attempt = 1; attempt <= 3 && !text; attempt++) {
        try { text = await ask(PROMPTS[task](lang, { cv: c.cv, job: c.job, extra: "" }), task); error = ""; }
        catch (e) { error = String(e.message || e); await new Promise(r => setTimeout(r, 2000 * attempt)); }
      }
      // The same clean-up and style check the server runs on a CV or letter before anyone sees it
      const sent = text && (task === "cv" || task === "letter");
      if (sent) text = stripDashes(text);
      const check = text ? factCheck(text, { cv: c.cv, ad: c.job.text, title: c.job.title, employer: c.job.employer, extra: "", year }) : null;
      const style = sent ? styleCheck(text, { cv: c.cv, ad: c.job.text, task }) : null;
      results.push({ case: c.id, task, lang, run, text, error, issues: check ? check.issues : [], ...(style ? { style } : {}) });
      log(`${results.length}/${jobs.length} ${c.id} ${task} ${lang} #${run}: ${error ? "error " + error : check.issues.length ? check.issues.length + " flagged" : "clean"}`);
    }
  };
  await Promise.all([worker(), worker()]);
  return results;
}

export function summarise(results, { model = "", date = new Date().toISOString().slice(0, 10) } = {}) {
  const done = results.filter(r => !r.error);
  const flagged = done.filter(r => r.issues.length);
  const byKind = {}, byTask = {};
  for (const r of done) {
    byTask[r.task] ??= { answers: 0, flagged: 0 };
    byTask[r.task].answers++; if (r.issues.length) byTask[r.task].flagged++;
    for (const i of r.issues) byKind[i.kind] = (byKind[i.kind] || 0) + 1;
  }
  const pct = (a, b) => b ? `${Math.round(1000 * a / b) / 10} %` : "–";
  const lines = [
    `# Fact-check eval, ${date}`, "",
    `Model: ${model || "unknown"}. ${done.length} answers checked${results.length > done.length ? `, ${results.length - done.length} failed to come back` : ""}.`, "",
    `**Answers with nothing flagged: ${done.length - flagged.length} of ${done.length} (${pct(done.length - flagged.length, done.length)}).**`, "",
    "| Task | Answers | With a flag |", "|---|---|---|",
    ...Object.entries(byTask).map(([t, v]) => `| ${t} | ${v.answers} | ${v.flagged} (${pct(v.flagged, v.answers)}) |`), "",
    `Style check: ${done.filter(r => r.task === "cv" && r.style?.even).length} of ${done.filter(r => r.task === "cv").length} tailored CVs had jobs of even length; ${done.filter(r => r.style?.words?.length).length} CVs or letters used a buzzword (${[...new Set(done.flatMap(r => r.style?.words || []))].join(", ") || "none"}).`, "",
    "| Kind | Flags |", "|---|---|",
    ...(Object.keys(byKind).length ? Object.entries(byKind).map(([k, n]) => `| ${k} | ${n} |`) : ["| none | 0 |"]), "",
    "## Everything that was flagged", "",
    "Mark each one as a real invention or a false alarm before quoting the numbers.", "",
  ];
  for (const r of flagged) for (const i of r.issues) lines.push(`- [ ] **${r.case}** · ${r.task} · ${r.lang} #${r.run} · ${i.kind}: \`${i.text}\` · line: ${i.line.replace(/\|/g, "\\|")}`);
  if (!flagged.length) lines.push("Nothing was flagged.");
  return { text: lines.join("\n") + "\n", answers: done.length, flagged: flagged.length, byKind, byTask };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const key = (process.env.AI_KEY || "").trim();
  if (!key) { console.error("Set AI_KEY to a Scaleway Generative APIs key first."); process.exit(1); }
  const model = process.env.AI_MODEL || "mistral-medium-3.5-128b", baseUrl = process.env.AI_BASE_URL || "https://api.scaleway.ai/v1";
  const list = (k, d) => (process.env[k] || d).split(",").map(s => s.trim()).filter(Boolean);
  const cases = JSON.parse(fs.readFileSync(path.join(here, "cases.json"), "utf8"));
  const results = await runEval({ cases, tasks: list("EVAL_TASKS", "cv,letter,match,interview"), langs: list("EVAL_LANGS", "sv,en"), runs: +process.env.EVAL_RUNS || 3,
    ask: (messages, task) => callModel(messages, { model, baseUrl, key, task }), log: m => console.log(m) });
  const date = new Date().toISOString().slice(0, 10), out = path.join(here, "results");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `${date}-${model.replace(/[^\w.-]+/g, "_")}.json`), JSON.stringify({ model, date, results }, null, 1));
  const s = summarise(results, { model, date });
  fs.writeFileSync(path.join(out, "latest.md"), s.text);
  console.log("\n" + s.text);
}
