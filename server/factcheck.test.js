"use strict";
// node --test   Property tests for the fact check: faithful answers must pass, answers with one invented fact must not.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { factCheck } = require("./factcheck.js");

// A small seeded random generator, so a failure can be repeated with the same seed
function rng(seed) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const int = (a, b) => a + Math.floor(next() * (b - a + 1));
  const pick = a => a[int(0, a.length - 1)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return { next, int, pick, shuffle };
}

// Made-up employers. The CV draws from the first list; invented facts come from the second, so they never overlap.
const EMPLOYERS = ["Nordvik Automotive", "Svea Bearings", "Lindqvist Elektronik", "Hallberg Logistik", "Bergsjö Pharma", "Ekström Bygg", "Torslanda Plast",
  "Kvarnby Software", "Mälarstrand Energi", "Fjällbo Foods", "Österlind Medical", "Granhammar Steel", "Sundvall Retail", "Vikinge Marine", "Åkerlund Data"];
const FAKE_EMPLOYERS = ["Siemens Energy", "Bosch Rexroth", "Pinewood Analytics", "Kronborg Systems", "Delta Forge", "Halvarsson Teknik", "Morningside Labs", "Rydberg Consulting"];
// Titles as [Swedish, English]; the English one is how an English answer may write it
const TITLES = [["Kvalitetsingenjör", "Quality Engineer"], ["Produktionstekniker", "Production Technician"], ["Projektledare", "Project Manager"],
  ["Systemutvecklare", "Software Developer"], ["Inköpare", "Buyer"], ["Logistikkoordinator", "Logistics Coordinator"], ["Testingenjör", "Test Engineer"],
  ["Processingenjör", "Process Engineer"], ["Underhållstekniker", "Maintenance Technician"], ["Säljare", "Salesperson"]];
const FAKE_TITLES = [["Driftchef", "Operations Director"], ["Inköpschef", "Head of Procurement"], ["Teamledare", "Team Leader"], ["Arkitekt", "Architect"],
  ["Platschef", "Site Director"], ["Forskare", "Research Scientist"]];
const CITIES = ["Göteborg", "Borås", "Trollhättan", "Jönköping", "Västerås", "Linköping"];
const NAMES = ["Eva Lind", "Ahmed Rahimi", "Maria Ekholm", "Jonas Berg", "Sara Nilsson", "Daniel Moore", "Priya Natarajan", "Erik Johansson"];
const SKILLS = ["FMEA", "8D", "Python", "SAP", "Lean", "PPAP", "SQL", "Excel", "ISO 9001", "Six Sigma"];
// What the ad asks for that the CV never has, so a claims check can tell when an answer borrows it
const AD_ONLY = [["IATF 16949", "IATF"], ["Kafka", "Kafka"], ["PRINCE2", "PRINCE2"], ["Snowflake", "Snowflake"], ["Teamcenter", "Teamcenter"], ["felträdsanalys", "felträdsanalys"]];
const YEAR = 2026;

function makeCase(r) {
  const n = r.int(2, 4), emps = r.shuffle(EMPLOYERS).slice(0, n), titles = r.shuffle(TITLES).slice(0, n);
  let end = r.int(2019, 2025);
  const roles = emps.map((e, i) => {
    const current = i === 0 && r.next() < 0.5;
    const to = current ? null : end, from = (to || end) - r.int(1, 5);
    end = from - r.int(0, 1);
    return { employer: e, sv: titles[i][0], en: titles[i][1], from, to, city: r.pick(CITIES) };
  });
  const eduTo = roles[roles.length - 1].from - r.int(0, 1), eduFrom = eduTo - 3;
  const english = r.next() < 0.3;
  const skills = r.shuffle(SKILLS).slice(0, 4);
  const name = r.pick(NAMES), home = r.pick(CITIES), email = name.toLowerCase().replace(" ", ".") + "@example.com";
  const lines = [name, `${home} · ${email}`, "", english ? "Experienced engineer focused on " + skills.join(", ") + "." : "Erfaren ingenjör med fokus på " + skills.join(", ") + ".", "", english ? "Experience" : "Erfarenhet"];
  const layout = r.int(0, 2);
  for (const ro of roles) {
    const title = english ? ro.en : ro.sv, span = `${ro.from} – ${ro.to || (english ? "present" : "nu")}`;
    if (layout === 0) lines.push(`${title}, ${ro.employer}, ${ro.city}`, span);
    else if (layout === 1) lines.push(`${span}  ${title}, ${ro.employer}`);
    else lines.push(`${ro.employer} (${span})`, title);
    lines.push(`- ${english ? "Worked with" : "Arbetade med"} ${r.pick(skills)}`, "");
  }
  lines.push(english ? "Education" : "Utbildning", `${english ? "BSc Engineering" : "Högskoleingenjör"}, Chalmers, ${eduFrom}–${eduTo}`);
  const adEmployer = "Acme " + r.pick(["Robotics", "Nordic", "Industri", "Vehicles"]);
  const adTitle = r.pick(TITLES)[r.next() < 0.5 ? 0 : 1];
  const want = r.pick(AD_ONLY);
  const ad = `${adEmployer} söker en ${adTitle.toLowerCase()} som kan ${skills[0]} och vill utveckla vår produktion. Meriterande är ${want[0]}. Start i januari ${YEAR + 1}.`;
  return { want, roles, english, skills, name, home, email, layout, edu: { from: eduFrom, to: eduTo }, src: { cv: lines.join("\n"), ad, title: adTitle, employer: adEmployer, extra: "", year: YEAR } };
}

// The whole tailored CV, the way the CV task now asks for it: name, contact line, profile, skills, every role, education
function wholeCv(r, c, en, T, span) {
  const out = [`# ${c.name}`, r.next() < 0.5 ? `${c.home} · ${c.email}` : `${c.email} · ${c.home}`, "",
    en ? "## Profile" : "## Profil",
    en ? `${T(c.roles[0])} with experience of ${c.skills.slice(0, 2).join(" and ")}.` : `${T(c.roles[0])} med erfarenhet av ${c.skills.slice(0, 2).join(" och ")}.`, "",
    en ? "## Key skills" : "## Nyckelkompetenser", ...r.shuffle(c.skills).map(s => `- ${s}`), "", en ? "## Experience" : "## Erfarenhet"];
  for (const ro of c.roles) {
    const fmt = r.int(0, 2);
    if (fmt === 0) out.push(`### ${T(ro)}, ${ro.employer} (${span(ro)})`);
    else if (fmt === 1) out.push(c.layout === 0 ? `### ${T(ro)}, ${ro.employer}, ${ro.city} (${span(ro)})` : `### ${T(ro)} | ${ro.employer} | ${span(ro)}`);   // only the first layout has towns
    else out.push(`### ${T(ro)} · ${ro.employer} · ${span(ro)}`);
    for (let i = r.int(1, 3); i > 0; i--) out.push(`- ${en ? "Drove improvements with" : "Drev förbättringar med"} ${r.pick(c.skills)}`);
    out.push("");
  }
  // The degree in the answer's language: a translation of the CV's degree, never a higher one
  out.push(en ? "## Education" : "## Utbildning", `### ${en ? r.pick(["BSc Engineering", "BSc in Mechanical Engineering", "Bachelor of Science in Engineering"]) : "Högskoleingenjör"}, Chalmers (${c.edu.from}–${c.edu.to})`,
    "", en ? "## Languages" : "## Språk", en ? "- Swedish and English" : "- Svenska och engelska");
  return out;
}

// An answer that only uses facts from the CV, written in one of the ways the model writes them
function faithful(r, c) {
  const en = r.next() < 0.5;   // the answer's language, which may differ from the CV's
  const T = ro => (en ? ro.en : ro.sv);
  const span = ro => `${ro.from}–${ro.to || (en ? r.pick(["present", "now"]) : r.pick(["nu", "idag"]))}`;
  if (r.next() < 0.4) return { text: wholeCv(r, c, en, T, span).join("\n"), en, whole: true };
  const out = [en ? "## 1. Profile summary" : "## 1. Ny profiltext",
    en ? `${T(c.roles[0])} with experience of ${c.skills.slice(0, 2).join(" and ")}, ready to bring it to ${c.src.employer}.`
       : `${T(c.roles[0])} med erfarenhet av ${c.skills.slice(0, 2).join(" och ")}, redo att bidra hos ${c.src.employer}.`,
    "", en ? "## 2. Key skills" : "## 2. Nyckelkompetenser", ...c.skills.map(s => `- **${s}**`), "", en ? "## 3. Rewritten bullet points" : "## 3. Omskrivna punkter"];
  for (const ro of r.shuffle(c.roles).slice(0, r.int(1, c.roles.length))) {
    const fmt = r.int(0, 4);
    if (fmt === 0) out.push(`### ${T(ro)}, ${ro.employer} (${span(ro)})`);
    else if (fmt === 1) out.push(`**${T(ro)}** · ${ro.employer} · ${span(ro)}`);
    else if (fmt === 2) out.push(`### ${T(ro)} | ${ro.employer} | ${span(ro)}`);
    else if (fmt === 3) out.push(`- ${span(ro)}: ${T(ro)} ${en ? "at" : "på"} ${ro.employer}`);
    else out.push(`### ${ro.employer} – ${T(ro)}`);
    out.push(`- ${en ? "Drove improvements with" : "Drev förbättringar med"} ${r.pick(c.skills)}`);
  }
  const ro = r.pick(c.roles);
  out.push("", en ? `I have worked as a ${T(ro).toLowerCase()} at ${ro.employer}, and I would like to start at ${c.src.employer} in January ${YEAR + 1}.`
                  : `Jag har arbetat som ${T(ro).toLowerCase()} på ${ro.employer} och vill gärna börja hos ${c.src.employer} i januari ${YEAR + 1}.`);
  out.push(en ? `### Why ${c.src.employer}` : `### Varför ${c.src.employer}`);
  return { text: out.join("\n"), en };
}

// The same answer with exactly one invented fact. Returns the text and what must be flagged.
function poison(r, c, base) {
  const en = base.en, roles = c.roles, ro = r.pick(roles);
  const cvYears = new Set(c.src.cv.match(/\b(19|20)\d\d\b/g));
  const freshYear = () => { for (;;) { const y = r.int(1995, 2025); if (!cvYears.has(String(y)) && !c.src.ad.includes(String(y))) return y; } };
  const fakeEmp = r.pick(FAKE_EMPLOYERS), fakeTitle = r.pick(FAKE_TITLES)[en ? 1 : 0], T = en ? ro.en : ro.sv;
  const other = roles.find(x => x !== ro && x.from !== ro.from && (x.to || 0) !== (ro.to || 0) && ![ro.from, ro.to].includes(x.from));
  const kinds = [
    () => ({ line: `### ${T}, ${fakeEmp} (${ro.from}–${ro.to || YEAR})`, expect: fakeEmp }),
    () => ({ line: `### ${fakeTitle}, ${ro.employer} (${ro.from}–${ro.to || YEAR})`, expect: fakeTitle }),
    () => ({ line: `### Senior ${T}, ${ro.employer} (${ro.from}–${ro.to || YEAR})`, expect: "Senior" }),
    () => { const y = freshYear(); return { line: `### ${T}, ${ro.employer} (${y}–${ro.to || YEAR})`, expect: String(y) }; },
    () => other ? { line: `### ${T}, ${ro.employer} (${other.from}–${ro.to || YEAR})`, expect: String(other.from) } : { line: `**${fakeTitle}** · ${ro.employer} · ${ro.from}–${ro.to || YEAR}`, expect: fakeTitle },
    () => ({ line: `### ${en ? c.src.title : c.src.title}, ${c.src.employer} (${ro.from}–${ro.to || YEAR})`, expect: c.src.employer }),
    () => ({ line: en ? `I have worked as a ${fakeTitle.toLowerCase()} for several years.` : `Jag har arbetat som ${fakeTitle.toLowerCase()} i flera år.`, expect: fakeTitle.toLowerCase() }),
    () => ({ line: en ? `During my years at ${fakeEmp} I led audits.` : `Under mina år hos ${fakeEmp} ledde jag revisioner.`, expect: fakeEmp }),
    () => ({ line: en ? `I worked at ${c.src.employer} on a summer project.` : `Jag arbetade på ${c.src.employer} under ett sommarprojekt.`, expect: c.src.employer }),
    () => { const y = freshYear(); return { line: en ? `Certified in ${c.skills[0]} in ${y}.` : `Certifierad i ${c.skills[0]} ${y}.`, expect: String(y) }; },
    () => ({ line: `### ${en ? r.pick(["MSc Engineering", "Master of Science in Engineering", "MBA"]) : r.pick(["Civilingenjör", "Masterexamen", "MBA"])}, Chalmers (${c.edu.from}–${c.edu.to})`, expect: en ? "M" : r.pick(["C", "M"]) }),
    () => ({ line: `### ${en ? "BSc Engineering" : "Högskoleingenjör"}, ${r.pick(["KTH", "Linköpings universitet", "Uppsala University"])} (${c.edu.from}–${c.edu.to})`, expect: "", school: true }),
  ];
  const k = r.int(0, kinds.length - 1), made = kinds[k]();
  const line = made.line;
  // The upgraded degree or invented school is what must be flagged; take its name from the line itself
  const expect = made.school ? line.match(/, ([^(]+) \(/)[1] : made.expect === "M" || made.expect === "C" ? line.slice(4, line.indexOf(",")) : made.expect;
  const lines = base.text.split("\n"), at = r.int(1, lines.length);
  lines.splice(at, 0, line);
  return { text: lines.join("\n"), expect, kind: k, line };
}

const RUNS = +process.env.FACTCHECK_RUNS || 500;

test(`faithful answers pass (${RUNS} random CVs)`, () => {
  for (let seed = 1; seed <= RUNS; seed++) {
    const r = rng(seed), c = makeCase(r), a = faithful(r, c), res = factCheck(a.text, c.src);
    assert.deepEqual(res.issues, [], `seed ${seed} flagged a fact that is in the CV\n--- CV ---\n${c.src.cv}\n--- answer ---\n${a.text}`);
  }
});

test(`an answer with one invented employer, title or date is caught (${RUNS} random CVs)`, () => {
  for (let seed = 1; seed <= RUNS; seed++) {
    const r = rng(seed * 7919), c = makeCase(r), base = faithful(r, c), p = poison(r, c, base), res = factCheck(p.text, c.src);
    const hit = res.issues.some(i => i.text.toLowerCase().includes(p.expect.toLowerCase()) || i.line.toLowerCase().includes(p.expect.toLowerCase()));
    assert.ok(hit, `seed ${seed} (kind ${p.kind}) missed "${p.expect}" in: ${p.line}\nflagged: ${JSON.stringify(res.issues)}\n--- CV ---\n${c.src.cv}`);
  }
});

test(`a whole CV that only uses the CV passes the claims check, and one borrowed skill or figure is caught (${RUNS} random CVs)`, () => {
  for (let seed = 1; seed <= RUNS; seed++) {
    const r = rng(seed * 104729), c = makeCase(r), en = r.next() < 0.5;
    const T = ro => (en ? ro.en : ro.sv), span = ro => `${ro.from}–${ro.to || (en ? "present" : "nu")}`;
    const text = wholeCv(r, c, en, T, span).join("\n"), src = { ...c.src, task: "cv", lang: en ? "en" : "sv" };
    assert.deepEqual(factCheck(text, src).issues.filter(i => i.kind === "claim" || i.kind === "figure"), [], `seed ${seed} flagged a claim the CV backs\n--- CV ---\n${c.src.cv}\n--- ad ---\n${c.src.ad}\n--- answer ---\n${text}`);
    const lines = text.split("\n"), kind = r.int(0, 2);
    const at = lines.findIndex(l => /^- /.test(l));
    const added = kind === 0 ? `- ${c.want[0]}` : kind === 1 ? `- ${en ? "Worked with" : "Arbetade med"} ${c.want[0]} ${en ? "in production" : "i produktionen"}` : `- ${en ? "Cut downtime by" : "Minskade stoppen med"} 37 %`;
    lines.splice(at + 1, 0, added);
    const issues = factCheck(lines.join("\n"), src).issues, expect = kind === 2 ? "37" : c.want[1];
    // An ordinary word (not a name like Kafka) is only checked when the answer is in the CV's language
    if (kind < 2 && c.want[1] === "felträdsanalys" && c.english !== en) continue;
    assert.ok(issues.some(i => (i.kind === "claim" || i.kind === "figure") && i.text.toLowerCase().includes(expect.toLowerCase())), `seed ${seed} missed "${expect}" in: ${added}\nflagged: ${JSON.stringify(issues)}`);
  }
});

test("real answers from the live model: the claims borrowed from the ad are caught", () => {
  const cases = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, "eval", "cases.json"), "utf8")).map(c => [c.id, c]));
  const real = JSON.parse(fs.readFileSync(path.join(__dirname, "eval", "real-r1.json"), "utf8"));
  for (const r of real) {
    const c = cases[r.id], issues = factCheck(r.text, { cv: c.cv, ad: c.job.text, title: c.job.title, employer: c.job.employer, year: 2026, task: r.task, lang: r.lang }).issues;
    for (const e of r.expect || []) assert.ok(issues.some(i => i.text.toLowerCase().includes(e.toLowerCase().split(" ")[0])), `${r.id} ${r.task}: missed "${e}"\n${JSON.stringify(issues)}`);
  }
  // The match check and interview prep talk about the ad by design, so they get no claims check
  const c = cases["nurse-sv"];
  assert.deepEqual(factCheck("Annonsen vill ha telefonrådgivning och erfarenhet av diabetes och astma.", { cv: c.cv, ad: c.job.text, year: 2026, task: "match" }).issues, []);
});

test("counted years must match the CV, the ad's title is not the person's, and languages count", () => {
  const cv = "Mats Bergqvist\nUnderhållsingenjör, Westra Komponenter AB, 2019 - nu\n- Grundorsaksanalyser (5 varför)\nSpråk: svenska";
  const src = { cv, ad: "Vi söker en teknisk artist med mycket god engelska.", title: "Teknisk artist", employer: "Volvia", year: 2026, task: "cv", lang: "sv" };
  const t = s => factCheck(s, src).issues.map(i => i.kind + ":" + i.text);
  assert.ok(t("## Profil\nUnderhållsingenjör med fem års erfarenhet.").includes("figure:fem"), "5 varför doesn't back five years");
  assert.deepEqual(t("## Profil\nAnvänder 5 varför vid haverier."), []);
  assert.ok(t("## Profil\nTeknisk artist med erfarenhet av underhåll.").some(x => /teknisk|artist/i.test(x)), "the ad's title is not the person's");
  assert.ok(t("## Språk\nMycket god engelska").some(x => /engelska/.test(x)));
  assert.deepEqual(t("## Språk\nSvenska"), []);
  // A letter's own clause is read even when the same sentence ends on the job
  const letter = { ...src, task: "letter", ad: "Meriterande är elbehörighet.", title: "Underhållsingenjör" };
  assert.ok(factCheck("Hej!\n\nMin bakgrund som underhållsingenjör, tillsammans med elbehörigheten, ger mig det rollen kräver.\n\nMats", letter).issues.some(i => /elbehörighet/.test(i.text)));
});

test("in a letter, a wish about the new job is not a claim", () => {
  const src = { cv: "Maria Ekholm\nDistriktssköterska, Hemsjukvården, 2015 – 2019\n- Omvårdnad av 25 patienter i hemmet", ad: "Vårdcentralen söker en sjuksköterska för telefonrådgivning och patienter med diabetes.", employer: "Mälarstrand Vård", title: "Sjuksköterska", year: 2026, task: "letter", lang: "sv" };
  assert.deepEqual(factCheck("Hej!\n\nJag skulle gärna arbeta med telefonrådgivning och patienter med diabetes hos er.\n\nVänliga hälsningar\nMaria", src).issues, []);
  assert.ok(factCheck("Hej!\n\nJag har arbetat med telefonrådgivning och diabetes i många år.\n\nVänliga hälsningar\nMaria", src).issues.some(i => /telefonrådgivning/.test(i.text)));
});

test("in a letter only the person's own sentences are read, and the employer may be named", () => {
  const c = { cv: "Sara Holm\nInköpare, Sundvall Retail AB, 2020 – nu\n- Förhandlade ramavtal med åtta leverantörer\n- SAP MM", ad: "Halvarsson Home söker en inköpare som driver hållbarhetsarbetet och kan Amfori BSCI.", title: "Inköpare", employer: "Halvarsson Home", year: 2026, task: "letter", lang: "sv" };
  assert.deepEqual(factCheck("Hej!\n\nNi söker någon som driver hållbarhetsarbetet och kan Amfori BSCI. Jag har förhandlat ramavtal med åtta leverantörer på Sundvall Retail och vill gärna göra det hos Halvarsson Home.\n\nVänliga hälsningar\nSara Holm", c).issues, []);
  const bad = factCheck("Hej!\n\nJag har lett hållbarhetsarbetet enligt Amfori BSCI på Sundvall Retail i tolv år.\n\nVänliga hälsningar\nSara Holm", c).issues.map(i => i.text);
  assert.ok(bad.some(t => /hållbarhetsarbetet/.test(t)) && bad.some(t => /Amfori/.test(t)) && bad.includes("tolv"), JSON.stringify(bad));
});

test("rewording, order and markup don't change the result", () => {
  const r = rng(42), c = makeCase(r), a = faithful(r, c);
  const variants = [a.text.toUpperCase().replace(/^#+/gm, "#"), a.text.split("\n").reverse().join("\n"), a.text.replace(/\*\*/g, "").replace(/^### /gm, "**").replace(/\n/g, "  \n")];
  for (const v of variants) assert.ok(factCheck(v, c.src).issues.every(i => i.kind !== "employer" && i.kind !== "date"), v);
});

test("a whole tailored CV passes, with translated degrees and place names, and an upgraded degree is caught", () => {
  const cv = `Daniel Moore\nStockholm · daniel.moore@example.com\n\nExperience\nProject Coordinator — Vikinge Marine, Gothenburg (2017 – 2021)\n- Coordinated retrofit projects\n\nEducation\nBSc Electrical Engineering, University of Strathclyde, 2011 – 2015\nScrum Master course, 2019`;
  const src = { cv, ad: "Vi söker en projektledare.", title: "Projektledare", employer: "Northwind Grid", year: 2026 };
  const sv = "# Daniel Moore\nStockholm · daniel.moore@example.com\n\n## Erfarenhet\n### Projektkoordinator, Vikinge Marine, Göteborg (2017 – 2021)\n- Samordnade ombyggnadsprojekt\n\n## Utbildning\n### Kandidatexamen i elektroteknik, University of Strathclyde (2011 – 2015)\n### Scrum Master, kurs (2019)";
  assert.deepEqual(factCheck(sv, src).issues, [], sv);
  for (const [line, text] of [["### Civilingenjör i elektroteknik, University of Strathclyde (2011 – 2015)", "Civilingenjör"], ["### MBA, University of Strathclyde (2011 – 2015)", "MBA"],
    ["### PhD Electrical Engineering, University of Strathclyde (2011 – 2015)", "PhD"], ["### BSc Electrical Engineering, University of Glasgow (2011 – 2015)", "Glasgow"]]) {
    const i = factCheck(sv + "\n" + line, src).issues;
    assert.ok(i.some(x => x.text.includes(text)), `${line}\n${JSON.stringify(i)}`);
  }
  assert.ok(factCheck("### MSc Electrical Engineering, University of Strathclyde (2011 – 2015)", src).issues.some(x => x.kind === "degree"));
});

test("worked examples in Swedish and English", () => {
  const cv = `Kvalitetsingenjör, Nordvik Automotive AB, Göteborg\n2018 – nu\n- Ledde FMEA\n\nProduktionstekniker, Svea Bearings\n2016–2018\n\nHögskoleingenjör, Chalmers, 2013–2016`;
  const src = { cv, ad: "Acme Robotics söker en kvalitetsingenjör. Start januari 2027.", title: "Kvalitetsingenjör", employer: "Acme Robotics", year: 2026 };
  const ok = s => assert.deepEqual(factCheck(s, src).issues, [], s);
  const bad = (s, kind, text) => { const i = factCheck(s, src).issues; assert.ok(i.some(x => x.kind === kind && x.text.includes(text)), `${s}\n${JSON.stringify(i)}`); };
  ok("### Kvalitetsingenjör, Nordvik Automotive (2018–nu)\n- Ledde FMEA");
  ok("### Quality Engineer · Nordvik Automotive · 2018–present\n### Production Technician, Svea Bearings, 2016–2018");
  ok("Jag vill gärna arbeta hos Acme Robotics från januari 2027.");
  ok("## Varför Acme Robotics\nSom kvalitetsingenjören på Nordvik Automotive AB har jag ...");
  bad("### Senior Quality Engineer, Nordvik Automotive (2018–present)", "title", "Senior");
  bad("### Kvalitetsingenjör, Nordvik Automotive (2015–nu)", "date", "2015");
  bad("### Kvalitetsingenjör, Nordvik Automotive (2016–nu)", "dates", "2016");
  bad("### Produktionstekniker, Svea Bearings (2016–nu)", "dates", "nu");
  bad("### Kvalitetsingenjör, Acme Robotics (2016–2018)", "employer", "Acme Robotics");
  bad("Jag har arbetat som driftchef i tre år.", "title", "driftchef");
  bad("I worked at Volvo Cars on brake systems.", "employer", "Volvo Cars");
  bad("Under min tid hos Siemens Energy ledde jag revisioner.", "employer", "Siemens Energy");
  bad("Anställd sedan mars 2018 på Nordvik.", "date", "mars 2018");
});

test("titles.json matches src/titles.txt (run python3 build.py after editing titles.txt)", () => {
  const txt = fs.readFileSync(path.join(__dirname, "..", "src", "titles.txt"), "utf8");
  const want = txt.split(/\r?\n/).filter(l => l.trim() && !l.trimStart().startsWith("#")).map(l => l.split("|").map(side => side.split(",").map(w => w.trim()).filter(Boolean)));
  assert.deepEqual(require("./titles.json"), want);
});
