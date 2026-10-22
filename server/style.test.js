"use strict";
// node --test   The dash clean-up and the style check (style.js), with Job Tailor's own cases carried over
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { stripDashes, styleCheck } = require("./style.js");
const { factCheck } = require("./factcheck.js");

const EM = "\u2014", EN = "\u2013";

test("dashes used as punctuation become commas (Job Tailor's cases)", () => {
  for (const [input, want] of [
    [`Led the team ${EM} which shipped four titles.`, "Led the team, which shipped four titles."],
    [`Built tooling${EM}adopted studio-wide.`, "Built tooling, adopted studio-wide."],
    [`Maya, Unreal ${EN} Python`, "Maya, Unreal, Python"],
    [`co${EN}operative work`, "co-operative work"],
    [`Prior Studio (2020${EN}2024)`, "Prior Studio (2020-2024)"],
    [`Worked 2019 ${EM} 2023 on pipeline`, "Worked 2019-2023 on pipeline"],
    ["State-of-the-art rendering", "State-of-the-art rendering"],
    [`- Built a shader tool ${EM} used by everyone`, "- Built a shader tool, used by everyone"],
    [`${EM} Leading with a dash`, "Leading with a dash"],
  ]) assert.equal(stripDashes(input), want);
  assert.equal(stripDashes(`He did it ${EM} . Odd input`).indexOf(", ."), -1);
});

test("Swedish date ranges, open ends and number ranges are kept as ranges", () => {
  for (const [input, want] of [
    [`### Kvalitetsingenjör, Nordvik Automotive AB (2018 ${EN} nu)`, "### Kvalitetsingenjör, Nordvik Automotive AB (2018 - nu)"],
    [`### Sjuksköterska, Akutmottagningen (mars 2019 ${EN} nu)`, "### Sjuksköterska, Akutmottagningen (mars 2019 - nu)"],
    [`### Distriktssköterska (augusti 2015 ${EN} februari 2019)`, "### Distriktssköterska (augusti 2015 - februari 2019)"],
    [`### Quality Engineer, Nordvik (2018${EN}present)`, "### Quality Engineer, Nordvik (2018 - present)"],
    [`Skyddsombud 2019 ${EN} 2021`, "Skyddsombud 2019-2021"],
    [`3${EN}5 års erfarenhet`, "3-5 års erfarenhet"],
    [`Jag vill gärna börja hos er ${EN} helst i mars.`, "Jag vill gärna börja hos er, helst i mars."],
    [`## Erfarenhet ${EM} urval`, "## Erfarenhet, urval"],
  ]) assert.equal(stripDashes(input), want);
});

test("cleaning never adds, drops or moves a year, and leaves no long dash", () => {
  const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "eval", "fixtures.json"), "utf8"));
  const years = s => (s.match(/(?:19|20)\d\d/g) || []).join(",");
  for (const f of fixtures) {
    const out = stripDashes(f.text);
    assert.equal(years(out), years(f.text), f.case);
    assert.doesNotMatch(out, /[\u2013\u2014]/, f.case);
  }
});

test("a cleaned whole CV still passes the fact check, and an invented job is still caught", () => {
  const cases = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, "eval", "cases.json"), "utf8")).map(c => [c.id, c]));
  const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "eval", "fixtures.json"), "utf8")).filter(f => f.task === "cv" && f.text.startsWith("# "));
  assert.ok(fixtures.length >= 5);
  for (const f of fixtures) {
    const c = cases[f.case], src = { cv: c.cv, ad: c.job.text, title: c.job.title, employer: c.job.employer, year: 2026 };
    const issues = factCheck(stripDashes(f.text), src).issues;
    if (f.clean) assert.deepEqual(issues, [], `${f.case} ${f.lang}`); else assert.ok(issues.length >= 3, `${f.case} ${f.lang}`);
  }
});

test("jobs of even length are noticed, a lopsided CV is not", () => {
  const job = (title, n, words = 6) => [`### ${title}, Acme (2018 - 2020)`, ...Array.from({ length: n }, (_, i) => `- ${"ord ".repeat(words).trim()} ${i}`)].join("\n");
  const even = ["## Erfarenhet", job("Kvalitetsingenjör", 3), job("Produktionstekniker", 3), job("Montör", 3)].join("\n");
  assert.equal(styleCheck(even).even, true);
  const lopsided = ["## Erfarenhet", job("Kvalitetsingenjör", 5, 12), job("Produktionstekniker", 2), job("Montör", 0)].join("\n");
  assert.equal(styleCheck(lopsided).even, false);
  // Education and other sections are not jobs
  const withEducation = lopsided + "\n\n## Utbildning\n### Högskoleingenjör, Chalmers (2013 - 2016)\n### Gymnasieexamen, Hvitfeldtska (2010 - 2013)";
  assert.equal(styleCheck(withEducation).even, false);
  // The same number of bullets in every job counts as even, whatever their length
  const sameCount = ["## Experience", job("Engineer", 2, 3), job("Technician", 2, 14), job("Operator", 2, 25)].join("\n");
  assert.equal(styleCheck(sameCount).even, true);
  // A letter has no jobs to compare
  assert.equal(styleCheck(even, { task: "letter" }).even, false);
});

test("buzzwords are flagged only when neither the CV nor the ad uses them", () => {
  const text = "Jag är resultatinriktad och drivande, och har lett FMEA. Leveraged synergies across teams.";
  assert.deepEqual(styleCheck(text, { cv: "Erfaren kvalitetsingenjör", ad: "Vi söker en drivande ingenjör" }).words.sort(), ["leveraged", "resultatinriktad", "synergies"]);
  assert.deepEqual(styleCheck("Dynamics and dynamical systems", {}).words, []);   // whole words only
});

test("dashes the person typed in are counted, ranges are not", () => {
  assert.equal(styleCheck(`Jag vill börja ${EN} helst i mars ${EM} om det går. (2018${EN}2020) och 3${EN}5 år.`, { task: "letter" }).dashes, 2);
  assert.equal(styleCheck(stripDashes(`Jag vill börja ${EN} helst i mars.`), { task: "letter" }).dashes, 0);
});
