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
const sameWord = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 3)
  || (Math.min(a.length, b.length) >= 3 && (a === b + "s" || b === a + "s"));   // a genitive: "Mälarstrand Vårds" is Mälarstrand Vård

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

/* ---------- Claims borrowed from the ad (tailored CV and cover letter only) ----------
   The model's most common slip is to take what the ad asks for and write it into the person's CV: a standard, a tool,
   a patient group, a steering group, a figure. The employer, title and date checks above can't see that, so this looks
   at it directly. A word the ad uses that the CV doesn't, showing up in the CV or letter as the person's own, is listed.
   So is a figure (a number or a number word) that the CV doesn't have. Like the rest, it only reports.

   Named things (ISO, PPAP, Snowflake, Kafka, PCI DSS) are checked in any language. Ordinary words (kroniska,
   kodgranskning, production) are only checked when the answer is in the same language as the CV, since a translated CV
   uses words the original can't have. In a letter, only the person's own sentences are read ("I led", "jag har"),
   not the ones about the job ("your programme", "tjänsten"). */

// Words that say nothing on their own: function words, and the words every ad and CV use
const COMMON = new Set(`och att som det den detta denna dessa har hade ska kan kunna vill med mot utan till från efter innan under över genom inom hos vid för fram eller
samt även också inte mycket mer mest många flera andra annat annan alla allt varje vara varit blir blev bli finns fanns gärna minst cirka både bara sedan redan
vår vårt våra ert era din ditt dina ditt sin sitt sina deras dess hans hennes vilka vilken vilket vars där här hur när vad varför
the and for with that this these those from into onto over under within without about after before during between through while
have has had will would should could must can may our your their its his her they them you we who which what where when how why
also very more most many much other others such each every any some all both only just than then there here been being are was were
erfarenhet erfarenheter erfaren erfarna experience experienced arbete arbeta arbetar arbetat arbetade work works worked working
jobb jobbet jobba tjänst tjänsten tjänster roll rollen role position positions company companies företag företaget bolag bolaget
team teamet teams kollegor kollega colleagues colleague kunder kund kunden customers customer clients client
ansvar ansvara ansvarar ansvarade ansvarig responsible responsibility responsibilities uppgifter tasks
kunskap kunskaper kunnig knowledge skills skill förmåga ability kompetens kompetenser competence
söker söka sökande looking seeking apply ansökan application ansök
krav kräver requirements required require meriterande merit plus advantage önskvärt preferred
god goda gott bra stark starka strong good great excellent mycket utmärkt
person personer people individ dig själv yourself someone
utveckla utvecklar utveckling develop development utvecklas
år åren year years månad månader month months vecka veckor week weeks dag dagar day days
heltid deltid fulltime full-time parttime part-time tillsvidare permanent anställning employment start tillträde
ny nya nytt new egen eget egna own hel hela whole entire
stor stora stort large small liten små big
vi oss man en ett ni du jag mig min mitt mina i på av om
januari februari mars april maj juni juli augusti september oktober november december january february march may june july august october
måndag tisdag onsdag torsdag fredag monday tuesday wednesday thursday friday
leda leder ledde lett driva driver drev drivit bygga bygger byggde skapa skapar skapade planera planerar planerade stödja stötta hjälpa hjälper
använda använder använde hantera hanterar hanterade samarbeta samarbetar genomföra genomför genomförde göra gör gjorde ta tar tog
lead leads leading led manage manages managing managed build builds building built create creates creating created use uses using used
make makes making made help helps helping helped support supports supporting supported handle handles handling handled deliver delivers delivering delivered
plan plans planning planned run runs running ran take takes taking took get gets getting got bring brings bringing brought join joins joining joined`.split(/\s+/).map(w => fold(w)));
const ACRONYM = /^[A-ZÅÄÖ0-9][A-ZÅÄÖ0-9&+#./-]*[A-ZÅÄÖ0-9+#]$/;
const guessLangOf = text => {
  const f = " " + fold(text).replace(/[^a-z ]+/g, " ") + " ";
  const sv = (f.match(/ (och|att|som|for|med|ar|har|pa|till|av|det) /g) || []).length, en = (f.match(/ (and|the|to|with|for|is|are|of|in|on) /g) || []).length;
  return en > sv * 1.3 ? "en" : "sv";
};
const stemOf = w => w.length >= 7 ? w.slice(0, Math.max(5, w.length - 3)) : w;
// English endings and irregular past forms, so "leading" is "leads" and "built" is "building"
const IRREGULAR = { built: "build", led: "lead", ran: "run", made: "make", wrote: "write", taught: "teach", brought: "bring", held: "hold", sold: "sell",
  bought: "buy", began: "begin", grew: "grow", drove: "drive", spoke: "speak", chose: "choose", gave: "give", took: "take", kept: "keep", met: "meet", sent: "send", spent: "spend" };
const enStem = w => { w = IRREGULAR[w] || w; for (const end of ["ments", "ment", "ings", "ing", "ers", "er", "ed", "es", "s"]) if (w.endsWith(end) && w.length - end.length >= 4) return w.slice(0, -end.length); return w; };
// The words of a text, each with whether it is a named thing (an acronym, a word with digits, or a capitalised word
// in the middle of a sentence)
function wordsOf(text) {
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    let first = true;
    for (const m of line.matchAll(/[\p{L}\d][\p{L}\d+#&]*(?:[./-][\p{L}\d+#&]+)*/gu)) {
      const raw = m[0], w = fold(raw).replace(/[^a-z0-9+#&./-]/g, "");
      const before = line.slice(0, m.index).trim();
      const sentenceStart = first || /[.!?:•]$/.test(before) || /^[-*#\d.)\s]*$/.test(before);
      first = false;
      if (!w) continue;
      const named = (raw.length >= 2 && ACRONYM.test(raw) && /[A-ZÅÄÖ]/.test(raw)) || (/\d/.test(raw) && /\p{L}/u.test(raw)) || (/^\p{Lu}/u.test(raw) && !sentenceStart) || /\p{Ll}\p{Lu}/u.test(raw);
      out.push({ raw, w, named });
    }
  }
  return out;
}
// Is the word backed by the source text? Exact, a Swedish or English ending, or the stem inside a compound.
function backed(w, srcWords, srcText) {
  if (srcWords.has(w)) return true;
  const st = enStem(w);
  for (const s of srcWords) if (sameWord(s, w) || (st.length >= 4 && enStem(s) === st)) return true;
  if (w.length >= 7 && srcText.includes(stemOf(w))) return true;
  // A Swedish compound made of parts the CV has: "specialistutbildning" from "specialist..." and "utbildning"
  if (w.length >= 10) for (let i = 5; i <= w.length - 4; i++) {
    const head = w.slice(0, i), tail = w.slice(i).replace(/^s(?=[a-z]{4})/, "");
    if (srcText.includes(head) && (srcText.includes(tail) || COMMON.has(tail))) return true;
  }
  return false;
}

const NUMBER_WORDS = { tva: 2, tre: 3, fyra: 4, fem: 5, sex: 6, sju: 7, atta: 8, nio: 9, tio: 10, elva: 11, tolv: 12, femton: 15, tjugo: 20, trettio: 30,
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30 };
// The figures in a text: standalone numbers (not years, not parts of 8D or Office 365-style names) and number words.
// A figure followed by "år" or "years" is a count of years, which must match a count of years in the CV: "under fem år"
// is not backed by "5 varför".
const YEARS_AFTER = /^\s*(?:hela\s+|full\s+)?(?:ar|ars|aren|year|years)(?![a-z])/;
function figures(text) {
  const out = [], f = fold(text);
  for (const m of String(text || "").matchAll(/(?<![\p{L}\d.,-])(\d{1,3}(?:[ \u00a0]\d{3})+|\d+(?:[.,]\d+)?)(?![\p{L}\d]|[.,]\d)/gu)) {
    const raw = m[1], n = Number(raw.replace(/[ \u00a0]/g, "").replace(",", "."));
    if (/^(19|20)\d\d$/.test(raw)) continue;   // years are the date check's job
    out.push({ raw, n, years: YEARS_AFTER.test(f.slice(m.index + m[0].length, m.index + m[0].length + 14)) });
  }
  for (const m of f.matchAll(/(?<![a-z])(tva|tre|fyra|fem|sex|sju|atta|nio|tio|elva|tolv|femton|tjugo|trettio|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty)(?![a-z])/g))
    out.push({ raw: m[1], n: NUMBER_WORDS[m[1]], years: YEARS_AFTER.test(f.slice(m.index + m[0].length, m.index + m[0].length + 14)) });
  return out;
}
// In a letter, the person's own sentences: first person, and not about the employer or the job
const MINE = /(?<![\p{L}])(jag|mig|min|mitt|mina|i|i'm|i've|i'd|my|me)(?![\p{L}])/iu;
const THEIRS = /(?<![\p{L}])(ni|er|ert|era|du|dig|din|ditt|dina|rollen|tjänsten|jobbet|you|your|yours|the role|this role|the position|the job)(?![\p{L}])/iu;

function claimCheck(output, { cv = "", ad = "", title = "", employer = "", extra = "", task = "", lang = "" } = {}) {
  if (task !== "cv" && task !== "letter") return [];
  // The employer may be named, and so may anything the person wrote in their wishes. The ad's job title may not be
  // used for the person: calling a visualiser a "technical artist" because the ad says so is a claim too.
  const own = [cv, extra, employer].join("\n"), cvText = fold(own), cvWords = new Set(tokens(own));
  const sameLang = guessLangOf(cv) === (lang || guessLangOf(output));
  // Words the ad uses and the CV doesn't
  const adOnly = new Map();
  const adText = String(ad || "").split(/\r?\n/).filter(l => !(/\p{L}{3}/u.test(l) && l === l.toUpperCase())).join("\n");   // all-caps headings are not terms
  for (const { raw, w, named } of wordsOf(adText)) {
    if (COMMON.has(w) || (!named && w.length < 5) || /^\d+$/.test(w)) continue;
    if (!named && !sameLang) continue;
    if (backed(w, cvWords, cvText)) continue;
    if (!adOnly.has(w)) adOnly.set(w, { raw, named, acronym: raw.length >= 2 && raw === raw.toUpperCase() && /\p{Lu}/u.test(raw) });
  }
  const cvF = figures(cv), cvFigures = new Set(cvF.map(f => f.n)), cvYears = new Set(cvF.filter(f => f.years).map(f => f.n)), adFigures = new Set(figures(ad).map(f => f.n));
  const issues = [], seen = new Set();
  const lines = String(output || "").split(/\r?\n/);
  let nameSeen = false;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    if (/^\s*#\s/.test(raw)) { nameSeen = true; continue; }
    // The contact line under the name has phone numbers and addresses, not claims
    if (nameSeen && /@|\d{3}[ -]?\d{2,3}[ -]?\d{2}|linkedin|github|·/i.test(raw) && !/^\s*[-*#]/.test(raw)) { nameSeen = false; continue; }
    nameSeen = false;
    const empTok = core(employer);
    const aboutThem = s => THEIRS.test(s) || (empTok.length && inSource(employer, core(s)));
    // In a letter: the person's own sentences, and in them the parts that aren't about the employer or the job
    const sentences = task === "letter" ? raw.split(/(?<=[.!?])\s+/).filter(s => MINE.test(s)).flatMap(s => s.split(/\s*[,;:]\s*/)).filter(s => s && !aboutThem(s)) : [raw];
    for (const s of sentences) {
      const ws = wordsOf(s);
      let run = null;
      const flush = () => {
        if (!run) return;
        const key = "claim:" + run.keys.join(" ");
        if (!run.keys.every(k => seen.has("claim:" + k)) && !seen.has(key)) { seen.add(key); run.keys.forEach(k => seen.add("claim:" + k)); issues.push({ kind: "claim", text: run.words.join(" "), line: raw.trim().slice(0, 200) }); }
        run = null;
      };
      ws.forEach(({ raw: word, w }, i) => {
        let term = null;
        for (const [t, info] of adOnly) {
          const hit = info.acronym ? word === info.raw : (w === t || sameWord(w, t) || (t.length >= 5 && w.length > t.length && w.startsWith(stemOf(t))));
          if (hit && !backed(w, cvWords, cvText)) { term = { t, shown: info.named ? info.raw : word }; break; }
        }
        if (!term) { if (!COMMON.has(w) || (run && run.gap)) flush(); else if (run) run.gap = true; return; }
        if (run && run.gap) flush();
        run = run || { keys: [], words: [] };
        run.keys.push(term.t); run.words.push(term.shown); run.gap = false;
      });
      flush();
      for (const f of figures(s.replace(/^\s*(?:#{1,6}\s*)?\d+[.)]\s+/, ""))) {   // "## 1." and "2)" are numbering, not figures
        if (f.years ? cvYears.has(f.n) : (cvFigures.has(f.n) || (task === "letter" && adFigures.has(f.n)))) continue;
        const key = "figure:" + f.n;
        if (!seen.has(key)) { seen.add(key); issues.push({ kind: "figure", text: f.raw, line: raw.trim().slice(0, 200) }); }
      }
    }
  }
  return issues;
}

/**
 * Check an AI answer against the CV.
 * @param {string} output   the AI's text (Markdown)
 * @param {object} src      { cv, ad, title, employer, extra, year, task, lang }; task "cv" or "letter" adds the claims check
 * @returns {{ ok: boolean, issues: { kind: "employer"|"title"|"school"|"degree"|"date"|"dates"|"claim"|"figure", text: string, line: string }[] }}
 */
function factCheck(output, { cv = "", ad = "", title = "", employer = "", extra = "", year = new Date().getFullYear(), task = "", lang = "" } = {}) {
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
  for (const i of claimCheck(output, { cv, ad, title, employer, extra, task, lang })) {
    const key = i.kind + ":" + core(i.text).join(" ");
    if (!seen.has(key)) { seen.add(key); issues.push(i); }
  }
  const order = ["employer", "title", "school", "degree", "dates", "date", "claim", "figure"];
  issues.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));   // stable, so lines keep their order within a kind
  return { ok: issues.length === 0, issues };
}

module.exports = { factCheck, _test: { inSource, titleInSource, tokens, isTitle, isNameLike, isGeneric, degreeLevels, claimCheck, figures } };
