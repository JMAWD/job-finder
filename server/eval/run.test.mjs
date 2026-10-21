// node --test   The eval's own plumbing, with a stand-in for the model, plus answers written the way the model writes them.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { createRequire } from "node:module";
import { runEval, summarise } from "./run.mjs";

const require = createRequire(import.meta.url);
const { factCheck } = require("../factcheck.js");
const cases = JSON.parse(fs.readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
const fixtures = JSON.parse(fs.readFileSync(new URL("./fixtures.json", import.meta.url), "utf8"));
const byId = Object.fromEntries(cases.map(c => [c.id, c]));
const src = c => ({ cv: c.cv, ad: c.job.text, title: c.job.title, employer: c.job.employer, year: 2026 });

test("every eval CV and ad passes a check against itself", () => {
  for (const c of cases) {
    assert.deepEqual(factCheck(c.cv, src(c)).issues, [], c.id + " CV");
    assert.deepEqual(factCheck(c.job.text, src(c)).issues, [], c.id + " ad");
  }
});

test("answers written the way the model writes them: honest ones pass, invented ones are caught", () => {
  for (const f of fixtures) {
    const issues = factCheck(f.text, src(byId[f.case])).issues;
    if (f.clean) assert.deepEqual(issues, [], `${f.case} ${f.task} ${f.lang}`);
    else assert.ok(issues.length >= 3, `${f.case} ${f.task} ${f.lang}: ${JSON.stringify(issues)}`);
  }
});

test("the eval runs every case, task, language and run, and counts what was flagged", async () => {
  let calls = 0;
  const ask = async messages => {
    calls++;
    if (calls === 2) throw new Error("model answered 503");   // retried
    const isEn = /You help a job seeker/.test(messages[0].content);
    return calls % 4 === 0 ? (isEn ? "### Senior Quality Engineer, Bosch Rexroth (2009 – present)" : "### Senior kvalitetsingenjör, Bosch Rexroth (2009 – nu)") : "## Profil\n- FMEA";
  };
  const results = await runEval({ cases: cases.slice(0, 2), tasks: ["cv", "letter"], langs: ["sv", "en"], runs: 2, ask, year: 2026 });
  assert.equal(results.length, 2 * 2 * 2 * 2);
  assert.ok(results.every(r => !r.error));
  const s = summarise(results, { model: "fake", date: "2026-10-21" });
  assert.equal(s.answers, 16);
  assert.ok(s.flagged >= 3 && s.flagged <= 5, String(s.flagged));
  assert.equal(s.byKind.employer, s.flagged);
  assert.match(s.text, /Answers with nothing flagged: \d+ of 16/);
  assert.match(s.text, /- \[ \] \*\*quality-sv\*\*.*employer: `Bosch Rexroth`/);
});
