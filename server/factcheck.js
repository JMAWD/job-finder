"use strict";
/*
  Fact check for step 2: reads a text the AI wrote (tailored CV, cover letter, match check, interview prep) and lists every
  employer, job title and date in it that the person's own CV doesn't back up.

  It is plain code, not a second AI call, so the model can't argue its way past it. It runs on every answer the server
  returns, and the same function is used by the property tests (server/factcheck.test.js) and the eval (server/eval/run.mjs).

  What it looks at:
    dates      every year (and month + year) must appear in the CV, the ad or the person's own wishes. This year and next
               year are allowed, since a letter may say when the person can start.
    role lines headings, bold lines and short dated lines such as "### Kvalitetsingenjör, Volvo Cars (2019–2023)".
               Each title and employer on a dated line must be in the CV, and the years must be the ones the CV gives
               for that employer. The ad's own title and employer are allowed only on undated lines (a heading about
               the job being applied for), never as a past role.
    employers  names after "at / på / hos / vid / för …" must be in the CV or the ad. After "worked at / arbetat på …"
               they must be in the CV.
    titles     "worked as / years as / arbetat som / år som …" must be followed by a title that is in the CV.
    degrees    a degree on a role line (### BSc Mechanical Engineering, Chalmers (2013–2016)) may be translated, but its
               level must be one the CV has: an MSc or an MBA is flagged when the CV only has a bachelor's degree. The
               school next to it must be in the CV, and its years must be the ones the CV gives for that school.

  Words are compared without case or accents, legal suffixes (AB, Inc, Ltd …) are ignored, and Swedish endings are
  tolerated ("kvalitetsingenjören" matches "kvalitetsingenjör"). English and Swedish titles from src/titles.txt
  (copied to titles.json by build.py) count as the same title, so an English CV for a Swedish CV is not flagged.
  Places with an English and a Swedish name (Gothenburg and Göteborg) count as the same place.
  It does not judge skills, figures or wording; those are covered by the prompt and by reading the result.
*/

let TITLES = [];
try { TITLES = require("./titles.json"); } catch { /* the checker still works, it just can't match translated titles */ }

const fold = s => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LEGAL = new Set(["ab", "publ", "inc", "ltd", "llc", "gmbh", "oy", "oyj", "as", "asa", "plc", "corp", "co", "kb", "hb", "bv", "nv", "sa", "srl", "spa", "group", "koncernen", "sverige", "sweden", "nordic", "nordics"]);
const FILL = new Set(["the", "a", "an", "of", "and", "och", "en", "ett", "&", "i", "in", "som", "as", "at", "pa", "hos", "vid", "for", "with", "med", "inom", "till", "to"]);
const tokens = s => fold(s).replace(/[^a-z0-9+#&]+/g, " ").trim().split(/\s+/).filter(Boolean);
const core = s => tokens(s).filter(t => !LEGAL.has(t) && !FILL.has(t));
// Same word, allowing Swedish and English endings: kvalitetsingenjör / kvalitetsingenjören, engineer / engineers
const sameWord = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 3);

// Is every word of the phrase in the source, next to each other and in order?
function inSource(phrase, src) {
  const p = core(phrase);
  if (!p.length) return true;
  outer: for (let i = 0; i + p.length <= src.length; i++) {
    for (let j = 0; j < p.length; j++) if (!sameWord(p[j], src[i + j])) continue outer;
    return true;
  }
  return false;
}
// English title words and the Swedish word parts they become, so "Production Technician" matches "Produktionstekniker".
// Every English word has to translate, so "Senior Quality Engineer" does not match "Kvalitetsingenjör".
const WORD_SV = { engineer: ["ingenjor"], technician: ["tekniker"], manager: ["chef", "ansvarig"], leader: ["ledare"], lead: ["ledare"], head: ["chef"],
  developer: ["utvecklare"], analyst: ["analytiker"], consultant: ["konsult"], coordinator: ["koordinator", "samordnare"], specialist: ["specialist"],
  designer: ["designer"], architect: ["arkitekt"], assistant: ["assistent"], administrator: ["administrator"], buyer: ["inkopare"], planner: ["planerare"],
  operator: ["operator"], mechanic: ["mekaniker"], teacher: ["larare"], nurse: ["sjukskoterska"], researcher: ["forskare"], scientist: ["forskare"],
  tester: ["testare"], advisor: ["radgivare"], adviser: ["radgivare"], supervisor: ["arbetsledare"], salesperson: ["saljare"], seller: ["saljare"], owner: ["agare"],
  quality: ["kvalitet"], production: ["produktion"], project: ["projekt"], product: ["produkt"], process: ["process"], test: ["test"], software: ["mjukvaru", "system"],
  system: ["system"], systems: ["system"], sales: ["salj", "forsaljnings"], purchasing: ["inkops"], service: ["service"], maintenance: ["underhalls"], design: ["design", "konstruktions"],
  development: ["utvecklings"], electrical: ["el"], mechanical: ["maskin", "mekanik"], construction: ["bygg"], site: ["plats"], logistics: ["logistik"], supply: ["forsorjnings"],
  supplier: ["leverantors"], customer: ["kund"], support: ["support"], it: ["it"], data: ["data"], finance: ["ekonomi"], economics: ["ekonomi"], hr: ["hr", "personal"],
  marketing: ["marknads"], communications: ["kommunikations"], communication: ["kommunikations"], safety: ["sakerhets"], security: ["sakerhets"], environmental: ["miljo"],
  environment: ["miljo"], business: ["affars"], account: ["kund"], key: ["key"], line: ["linje"], shift: ["skift"], team: ["team", "grupp"], group: ["grupp"],
  department: ["avdelnings"], office: ["kontors"], store: ["butiks"], warehouse: ["lager"], workshop: ["verkstads"], school: ["skol"], automation: ["automations"], embedded: ["inbyggda"],
  verification: ["verifierings"], validation: ["validerings"], calculation: ["kalkyl"], cost: ["kostnads"], controller: ["controller"], accountant: ["redovisningsekonom", "ekonom"],
  electrician: ["elektriker"], carpenter: ["snickare"], driver: ["forare", "chauffor"], welder: ["svetsare"], machinist: ["maskinoperator"], cook: ["kock"], chef: ["kock"] };
function translations(words) {
  let out = [""];
  for (const w of words) {
    const sv = WORD_SV[w];
    if (!sv || !sv.length) return [];
    out = out.flatMap(o => sv.flatMap(s => o ? [o + s, o + "s" + s, o + "-" + s] : [s]));
  }
  return out;
}
const enMatches = (en, svWord) => translations(en).some(c => sameWord(c, svWord));

// The phrase, or a translation of it, is in the source. "senior" and "junior" only count if the source has them too.
function titleInSource(phrase, src) {
  if (inSource(phrase, src)) return true;
  const words = core(phrase);
  if (words.length && words.length <= 3) {
    if (src.some(t => enMatches(words, t))) return true;                    // English title, Swedish CV
    if (words.length === 1)                                                   // Swedish title, English CV
      for (let n = 1; n <= 3; n++) for (let i = 0; i + n <= src.length; i++) if (enMatches(src.slice(i, i + n), words[0])) return true;
  }
  const p = core(phrase).join(" ");
  for (const [en, sv] of TITLES) {
    const all = [...en, ...sv];
    if (!all.some(w => core(w).join(" ") === p)) continue;
    if (all.some(w => inSource(w, src))) return true;
  }
  return false;
}

// Places whose English and Swedish names differ, so "Göteborg" in a Swedish CV made from an English one isn't flagged
const PLACES = [["goteborg", "gothenburg"], ["kopenhamn", "copenhagen", "kobenhavn"], ["helsingfors", "helsinki"], ["abo", "turku"], ["skane", "scania"],
  ["munchen", "munich"], ["koln", "cologne"], ["wien", "vienna"], ["prag", "prague"], ["warszawa", "warsaw"], ["rom", "rome"], ["bryssel", "brussels"],
  ["lissabon", "lisbon"], ["moskva", "moscow"], ["aten", "athens"], ["geneve", "geneva"], ["haag", "hague"], ["antwerpen", "antwerp"], ["nurnberg", "nuremberg"],
  ["tyskland", "germany"], ["norge", "norway"], ["danmark", "denmark"], ["frankrike", "france"], ["spanien", "spain"], ["italien", "italy"], ["polen", "poland"],
  ["nederlanderna", "netherlands"], ["storbritannien", "united kingdom", "uk"], ["usa", "united states", "us"], ["kina", "china"], ["indien", "india"]];
const PLACE_OF = new Map(PLACES.flatMap(g => g.map(n => [n, g])));
const nameInSource = (phrase, src) => inSource(phrase, src) || (PLACE_OF.get(core(phrase).join(" ")) || []).some(n => inSource(n, src));

// Degree words by level, in English and Swedish. A degree may be translated, but its level must be one the CV has.
const DEGREE = { bachelor: ["bsc", "ba", "beng", "bba", "bachelor", "bachelors", "kandidat", "kandidatexamen", "hogskoleingenjor", "hogskoleingenjorsexamen", "hogskoleexamen"],
  master: ["msc", "ma", "meng", "master", "masters", "magister", "magisterexamen", "masterexamen", "civilingenjor", "civilingenjorsexamen", "civilekonom", "civilekonomexamen"],
  mba: ["mba", "emba"], doctor: ["phd", "doctorate", "doctoral", "doktor", "doktorsexamen", "licentiate", "licentiat", "licentiatexamen"],
  yh: ["yh", "yrkeshogskola", "yrkeshogskoleexamen", "yrkeshogskoleutbildning"] };
const LEVEL_OF = new Map(Object.entries(DEGREE).flatMap(([level, ws]) => ws.map(w => [w, level])));
// The degree levels a phrase names. "Scrum Master" and "master data" are work, not degrees.
const NOT_DEGREE = /(?:scrum\s+master|master\s+data|master\s+planner|master\s+scheduler)/gi;
const degreeLevels = s => new Set(tokens(String(s || "").replace(NOT_DEGREE, " ")).map(w => LEVEL_OF.get(w)).filter(Boolean));

const MONTHS = { jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, mars: 3, march: 3, apr: 4, april: 4, maj: 5, may: 5,
  jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, aug: 8, augusti: 8, august: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const YEAR = /(?<![\d.,])(19[5-9]\d|20[0-4]\d)(?![\d.,]*\d)/g;
const MONTH_YEAR = /\b(jan(?:uari|uary)?|feb(?:ruari|ruary)?|mar(?:s|ch)?|apr(?:il)?|maj|may|jun[ei]?|jul[iy]?|aug(?:usti|ust)?|sep(?:t|tember)?|o[kc]t(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(19[5-9]\d|20[0-4]\d)\b|\b(19[5-9]\d|20[0-4]\d)-(0[1-9]|1[0-2])\b|\b(0?[1-9]|1[0-2])\/(19[5-9]\d|20[0-4]\d)\b/gi;
// Whole words, also for Swedish letters (\b in JavaScript only knows a-z)
const words = list => `(?<![\\p{L}\\d])(?:${list.join("|")})(?![\\p{L}\\d])`;
const OPEN = new RegExp(words(["present", "now", "current", "today", "ongoing", "nu", "idag", "i dag", "pågående", "nuvarande", "tills vidare"]), "iu");
const RANGE = /(19[5-9]\d|20[0-4]\d)\s*(?:–|—|-|to|till)\s*((?:19[5-9]\d|20[0-4]\d)|present|now|current|today|ongoing|nu|idag|pågående|nuvarande)?/i;

const years = s => new Set([...fold(s).matchAll(YEAR)].map(m => m[1]));
function monthYears(s) {
  const out = new Set();
  for (const m of fold(s).matchAll(MONTH_YEAR)) {
    if (m[1]) out.add(`${m[2]}-${MONTHS[m[1].replace(/\.$/, "")] || MONTHS[m[1].slice(0, 3)]}`);
    else if (m[3]) out.add(`${m[3]}-${+m[4]}`);
    else out.add(`${m[6]}-${+m[5]}`);
  }
  return out;
}

// Words that end a job title, in English and Swedish (Swedish titles are compounds, so the end of the word counts)
const TITLE_END = /(engineer|ingenjor|manager|chef|ledare|leader|lead|head|director|direktor|tekniker|technician|analyst|analytiker|specialist|konsult|consultant|developer|utvecklare|designer|coordinator|koordinator|samordnare|officer|assistant|assistent|administrator|administrator|architect|arkitekt|owner|agare|saljare|salesperson|representative|scientist|forskare|researcher|larare|teacher|nurse|skoterska|operator|montor|mekaniker|mechanic|buyer|inkopare|planner|planerare|controller|ekonom|accountant|revisor|auditor|intern|praktikant|trainee|advisor|radgivare|strateg|strategist|tester|testare|programmer|programmerare|handlaggare|officer|supervisor|arbetsledare|foreman|expert|partner|founder|grundare|vd|ceo|cto|cfo|coo|cio|president|support|agent|writer|skribent|redaktor|editor|journalist|lakare|doctor|pedagog|kock|chef|electrician|elektriker|snickare|carpenter|driver|forare|chauffor|ombud|mentor|coach|instructor|instruktor|scrum master|product owner|produktagare)$/;
const TITLE_START = /^(?:senior |junior |lead |principal |chief |vice )?(?:head|chief|director|manager|vp|vice president|lead|chef|ansvarig) (?:of|for|over|för|av|i)\s/;
const isTitle = s => { const t = core(s), all = tokens(s).join(" "); return t.length > 0 && t.length <= 6 && (TITLE_END.test(t.join(" ")) || TITLE_START.test(all + " ")); };
// Section words the AI uses in its own headings; a heading made only of these is not a role
const GENERIC = new Set(["profile", "profil", "profiltext", "summary", "sammanfattning", "new", "ny", "skills", "kompetenser", "nyckelkompetenser", "key", "kunskaper",
  "experience", "erfarenhet", "erfarenheter", "rewritten", "omskrivna", "bullet", "points", "punkter", "education", "utbildning", "what", "vad", "cut", "shorten", "ta", "bort",
  "korta", "kortas", "could", "be", "kan", "match", "matches", "matchar", "missing", "saknas", "weak", "svagt", "verdict", "bedomning", "samlad", "overall", "questions", "fragor",
  "likely", "troliga", "hardest", "svaraste", "ask", "stalla", "words", "ord", "terms", "begrepp", "cover", "letter", "personligt", "brev", "relevant", "most", "mest", "roles",
  "roller", "tjanster", "work", "arbete", "history", "historik", "employment", "anstallningar", "role", "roll", "tjanst", "dear", "hej", "kind", "regards", "halsningar", "vanliga",
  "interview", "intervju", "prep", "forberedelse", "tips", "strengths", "styrkor", "gaps", "luckor", "background", "bakgrund", "career", "karriar", "current", "nuvarande", "previous", "tidigare"]);
const isGeneric = s => { const t = core(s).filter(w => !/^\d+$/.test(w)); return !t.length || t.every(w => GENERIC.has(w)); };
// A name: every word starts with a capital letter or digit, or it is all capitals, or it has a legal suffix.
// Swedish school names keep the institution word in lower case ("Linköpings universitet"), so those words don't count.
const INSTITUTION = new Set(["universitet", "universitetet", "hogskola", "hogskolan", "tekniska", "folkhogskola", "yrkeshogskola", "gymnasium", "gymnasiet"]);
const isNameLike = s => {
  const w = s.replace(/[()[\]"“”'’]/g, " ").trim().split(/\s+/).filter(x => x && !FILL.has(fold(x)) && !INSTITUTION.has(fold(x)));
  return w.length > 0 && w.length <= 6 && w.every(x => /^[\p{Lu}\d]/u.test(x));
};
// Capitalised words that are not employers
const NOT_EMPLOYER = new Set(["i", "jag", "we", "vi", "you", "du", "ni", "my", "min", "mitt", "your", "ditt", "linkedin", "teams", "zoom", "sweden", "sverige", "europe", "europa",
  "eu", "monday", "tuesday", "wednesday", "thursday", "friday", "mandag", "tisdag", "onsdag", "torsdag", "fredag", "the", "this", "that", "den", "det", "denna", "detta", "er", "era",
  "markdown", "cv", "ai", "excel", "word", "office", "powerpoint", "python", "sql", "java"]);

// "worked at" needs the employer in the CV; plain "at" also accepts the ad. Each word may start with a capital letter.
const anyCase = w => w.split(" ").map(x => `[${x[0].toUpperCase()}${x[0]}]${x.slice(1)}`).join(" ");
const WORKED_AT = ["worked at", "worked for", "working at", "employed at", "employed by", "arbetat på", "arbetat hos", "arbetade på", "arbetade hos", "arbetat för",
  "arbetade för", "jobbat på", "jobbat hos", "jobbade på", "jobbade hos", "anställd på", "anställd hos", "anställd vid", "anställd av"];
const AT = ["at", "på", "hos", "vid", "för", "for", "with", "from", "från", "inom"];
const EMPLOYER_AFTER = new RegExp(`(?:^|[\\s(])(${[...WORKED_AT, ...AT].map(anyCase).join("|")})\\s+((?:[\\p{Lu}\\d][\\p{L}\\d&'’.+-]*)(?:\\s+(?:[\\p{Lu}\\d][\\p{L}\\d&'’.+-]*|&|of|och|and|de|la))*)`, "gu");

const plain = line => line.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`~]/g, "").replace(/^\s*(?:#{1,6}\s+|>\s*|[-+•]\s+|\d+[.)]\s+)+/, "").trim();
const SPLIT = new RegExp(`\\s*(?:,|;|\\||·|•|–|—|\\s-\\s|@|\\(|\\)|:|\\/|${words(["at", "på", "hos", "vid", "for", "för", "with", "inom"])})\\s*`, "iu");
const OPEN_ALL = new RegExp(OPEN.source, "giu"), SINCE = new RegExp(words(["sedan", "since", "from", "från", "until", "till", "to"]), "giu");
const stripDates = s => s.replace(MONTH_YEAR, " ").replace(/(19[5-9]\d|20[0-4]\d)/g, " ").replace(OPEN_ALL, " ").replace(SINCE, " ");

// The candidate role text on a line: a heading, a bold lead, or a short line with a year range
function roleSegments(raw) {
  const segs = [];
  const heading = /^\s*#{1,6}\s+/.test(raw);
  if (heading) segs.push(plain(raw));
  for (const m of raw.matchAll(/\*\*([^*]+)\*\*|__([^_]+)__/g)) segs.push((m[1] || m[2]).trim());
  const p = plain(raw);
  if (!heading && RANGE.test(p) && p.split(/\s+/).length <= 14) segs.push(p);
  return [...new Set(segs)].filter(s => s.split(/\s+/).length <= 14);
}

/**
 * Check an AI answer against the CV.
 * @param {string} output   the AI's text (Markdown)
 * @param {object} src      { cv, ad, title, employer, extra, year }
 * @returns {{ ok: boolean, issues: { kind: "employer"|"title"|"school"|"degree"|"date"|"dates", text: string, line: string }[] }}
 */
function factCheck(output, { cv = "", ad = "", title = "", employer = "", extra = "", year = new Date().getFullYear() } = {}) {
  const cvTok = core(cv), allTok = core([cv, ad, title, employer, extra].join("\n"));
  const jobTok = core([title, employer].join("\n"));
  const okYears = new Set([...years([cv, ad, title, extra].join("\n")), String(year), String(year + 1)]);
  const srcMonths = monthYears([cv, ad, extra].join("\n"));
  const cvLines = cv.split(/\r?\n/), cvLevels = degreeLevels(cv);
  const issues = [], seen = new Set();
  const flag = (kind, text, line) => {
    text = text.replace(/\s+/g, " ").trim().replace(/^[^\p{L}\d]+|[^\p{L}\d.+#&)]+$/gu, "");
    const key = kind + ":" + core(text).join(" ");
    if (!text || seen.has(key)) return;
    seen.add(key); issues.push({ kind, text, line: line.trim().slice(0, 200) });
  };

  for (const raw of String(output || "").split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const line = plain(raw);

    // Dates
    for (const y of years(line)) if (!okYears.has(y)) flag("date", y, raw);
    for (const my of monthYears(line)) {
      const [y] = my.split("-");
      if (okYears.has(y) && !srcMonths.has(my) && +y < year) flag("date", line.match(new RegExp(`[^\\s]*\\s*${y}`))?.[0] || my, raw);
    }

    // Role lines: titles and employers next to each other, often with dates
    for (const seg of roleSegments(raw)) {
      const dated = RANGE.test(seg) || years(seg).size > 0 || OPEN.test(seg);
      const parts = stripDates(seg).split(SPLIT).map(s => s.trim()).filter(s => /\p{L}/u.test(s) && !isGeneric(s));
      if (!dated && parts.length < 2) continue;
      const found = [], school = parts.some(part => degreeLevels(part).size);   // names next to a degree are schools
      for (const part of parts) {
        const levels = degreeLevels(part);
        if (levels.size) {                                     // a degree: translated is fine, a higher level is not
          if (!inSource(part, cvTok) && ![...levels].every(l => cvLevels.has(l))) flag("degree", part, raw);
          continue;
        }
        const title = isTitle(part), name = isNameLike(part);
        if (!title && !name) continue;
        if (title ? titleInSource(part, cvTok) : nameInSource(part, cvTok)) { found.push({ part, title }); continue; }
        if (!dated && inSource(part, jobTok)) continue;        // a heading about the job being applied for
        flag(title ? "title" : school ? "school" : "employer", part, raw);
      }
      // The dates on a role line must be the ones the CV gives for that employer or title
      if (dated && found.length) {
        const near = new Set(), lines = [];
        // Tie the dates to the employer when the line names one the CV has, otherwise to the title
        const anchor = found.find(f => !f.title) || found[0];
        cvLines.forEach((l, i) => { if (anchor.title ? titleInSource(anchor.part, core(l)) : nameInSource(anchor.part, core(l))) lines.push(i); });
        for (const i of lines) for (let j = Math.max(0, i - 2); j <= Math.min(cvLines.length - 1, i + 2); j++) near.add(j);
        const nearText = [...near].map(i => cvLines[i]).join("\n");
        if (lines.length) {
          const nearYears = years(nearText);
          for (const y of years(seg)) if (okYears.has(y) && !nearYears.has(y)) flag("dates", `${anchor.part} ${y}`, raw);
          if (OPEN.test(seg) && !OPEN.test(nearText) && nearYears.size) flag("dates", `${anchor.part} ${seg.match(OPEN)[0]}`, raw);
        }
      }
    }

    // Employers after a preposition (the name itself must start with a capital letter, so no "i" flag here)
    for (const m of line.split(/(?<=[.!?])\s+/).flatMap(sentence => [...sentence.matchAll(EMPLOYER_AFTER)])) {
      const prep = fold(m[1]), name = m[2].replace(/[.'’-]+$/, "");
      const words = core(name);
      if (!words.length || (words.length === 1 && NOT_EMPLOYER.has(words[0])) || words.every(w => /^\d+$/.test(w))) continue;
      if (isTitle(name)) continue;                          // "for Quality Engineer" is a title, checked below
      const worked = prep.includes(" ");
      if (worked ? !inSource(name, cvTok) : !inSource(name, allTok)) flag("employer", name, raw);
    }

    // Titles after "worked as", "years as", "arbetat som" …
    for (const m of line.matchAll(/(?<![\p{L}])(?:worked|working|served|serving|employed|years?|tenure|time|my (?:current |previous |last |former )?role|arbetat|arbetade|jobbat|jobbade|anställd|verksam|år|åren|tiden|min (?:nuvarande |tidigare |senaste )?roll)\s+(?:as|som)\s+(?:an?\s+|en\s+|ett\s+)?([\p{L}-]+(?:\s+[\p{L}-]+){0,3})/giu)) {
      const words = m[1].split(/\s+/);
      const stop = words.findIndex(w => /^(at|på|hos|vid|i|in|inom|with|med|för|for|and|och|where|där|since|sedan|during|under|på)$/i.test(w));
      const t = (stop === -1 ? words : words.slice(0, stop)).join(" ");
      if (t && isTitle(t) && !titleInSource(t, cvTok)) flag("title", t, raw);
    }
  }
  const order = ["employer", "title", "school", "degree", "dates", "date"];
  issues.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));   // stable, so lines keep their order within a kind
  return { ok: issues.length === 0, issues };
}

module.exports = { factCheck, _test: { inSource, titleInSource, tokens, isTitle, isNameLike, isGeneric, degreeLevels } };
