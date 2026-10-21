/* ---------- Fairs and events in your field ----------
   Trade fairs, conferences, congresses and job fairs that fit the last search, shown above the employers in Find jobs.
   The app reads four public calendars straight from the browser: Stockholmsmässan, Kistamässan, Malmömässan and Visit
   Sweden's open data (only for job fairs). It downloads each calendar whole and does the matching here, so no search
   words are sent to them. An event fits when it mentions one of the keywords, or when it belongs to the same area of work
   as most of the ads the search found (Platsbanken's occupation fields, matched to the venues' categories and a short
   word list for each area). Calendars are kept in the browser for 12 hours. A calendar that can't be reached is left out,
   with a line saying so, and tried again after half an hour. Nothing that fits means no panel. No AI. */
Object.assign(I18N, {
  "ev.title": ["Fairs and events in your field", "Mässor och evenemang inom ditt område"],
  "ev.sub": ["Trade fairs, conferences and job fairs where you can meet people who do the kind of work you're searching for. The people on the stands are often there to sell rather than to recruit, so go to talk and make contacts.",
    "Fackmässor, konferenser och jobbmässor där du kan träffa folk som jobbar med det du söker. De som står i montrarna är oftast där för att sälja snarare än för att rekrytera, så gå dit för att prata och knyta kontakter."],
  "ev.hide": ["Hide", "Dölj"], "ev.show": ["Show", "Visa"],
  "ev.more1": ["Show 1 more", "Visa 1 till"], "ev.moreN": ["Show {n} more", "Visa {n} till"], "ev.less": ["Show fewer", "Visa färre"],
  "ev.loading": ["Checking the venue calendars for fairs in your field…", "Kollar mässkalendrarna efter mässor inom ditt område…"],
  "ev.k.trade": ["Trade fair", "Fackmässa"], "ev.k.conf": ["Conference", "Konferens"], "ev.k.congress": ["Congress", "Kongress"],
  "ev.k.jobfair": ["Job fair", "Jobbmässa"], "ev.k.event": ["Event", "Evenemang"], "ev.k.public": ["Public fair", "Publikmässa"],
  "ev.why.kw": ["Mentions \"{w}\"", "Nämner \"{w}\""], "ev.why.field": ["Your field: {f}", "Ditt område: {f}"], "ev.why.jobfair": ["Employers meet job seekers", "Arbetsgivare möter arbetssökande"],
  "ev.near": ["near you", "nära dig"], "ev.km": ["{n} km away", "{n} km bort"],
  "ev.foot": ["From the calendars of {list}. Check the organiser's site for dates, prices and who can attend.",
    "Från kalendrarna hos {list}. Kolla arrangörens webbplats för datum, pris och vem som får komma."],
  "ev.fail": ["Couldn't reach {list} just now, so some events may be missing.", "Kunde inte nå {list} just nu, så vissa evenemang kan saknas."],
});

const EV_TTL = 12 * 36e5, EV_RETRY = 30 * 6e4, EV_SHOW = 4, EV_JOBFAIR_KM = 100, EV_NEAR_KM = 60, EV_AHEAD_DAYS = 400;
const EV_SOURCES = { sm: "Stockholmsmässan", kista: "Kistamässan", malmo: "Malmömässan", vs: "Visit Sweden" };
// Where the venues are, for the distance to the searched place. Stockholmsmässan also lists a few events held elsewhere.
const EV_VENUES = {
  stockholmsmassan: { city: "Stockholm", lat: 59.2816, lon: 18.0003 }, kistamassan: { city: "Kista", lat: 59.4027, lon: 17.9455 },
  malmomassan: { city: "Malmö", lat: 55.5638, lon: 12.9767 }, abymassan: { city: "Mölndal", lat: 57.6227, lon: 12.0136 },
  "stockholm city": { city: "Stockholm", lat: 59.3326, lon: 18.0649 },
};
// Areas of work. fields are Platsbanken's occupation fields, cats are Stockholmsmässan's categories, words are matched in an
// event's name and description (a * ends a word that may go on, like tillverk* for tillverkning), and caps are short
// abbreviations matched in capitals only, so "IT" counts but the English word "it" doesn't.
const EV_TOPICS = {
  it: { label: ["IT and tech", "IT och tech"], fields: ["Data/IT"], cats: ["IT", "Gaming"], caps: ["IT", "AI"],
    words: "tech* data* digital* cyber* software developer* utvecklar* systemutveckl* programm* cloud moln* devops .net saas fintech* informationssakerhet*" },
  industry: { label: ["Industry and engineering", "Industri och teknik"], fields: ["Industriell tillverkning", "Installation, drift, underhåll", "Yrken med teknisk inriktning"], cats: ["Industri"],
    words: "industri* industry industrial automation* automations* produktion* production manufactur* tillverk* underhall* maintenance process* plast* battery batteri* energi* energy mining gruv* bergdag* metall* svets* robot* elkraft* kraftvarme*" },
  build: { label: ["Construction and property", "Bygg och fastighet"], fields: ["Bygg och anläggning", "Hantverk"], cats: ["Bygg och Fastighet"],
    words: "bygg* fastighet* construction anlaggning* vvs installation* arkitekt* grundlaggning* infrastruktur* samhallsbygg* vatten* water" },
  health: { label: ["Health and care", "Vård och hälsa"], fields: ["Hälso- och sjukvård", "Yrken med social inriktning"], cats: ["Hälsa & Medicin"],
    words: "halsa* halso* health* medicin* medical sjukvard* sjukskot* vardgivare* omvardnad* vardcentral* lakar* socionom* tandvard* odontolog* lakemedel* pharma* life science e-halsa* omsorg* psykolog* hemtjanst*" },
  teaching: { label: ["Education", "Utbildning"], fields: ["Pedagogik"], cats: ["Utbildning"], words: "larare* skol* pedagog* education teacher* forskol* rektor* lardag* larkraft" },
  food: { label: ["Food and hospitality", "Mat och restaurang"], fields: ["Hotell, restaurang, storhushåll"], cats: ["Mat & Dryck"],
    words: "food* livsmedel* restaurang* dryck* drink* kock* hotell* storkok* agro*" },
  design: { label: ["Design and media", "Design och media"], fields: ["Kultur, media, design"], cats: ["Inredning"], words: "design* inredning* interior* furniture mobel* media* kommunikation*" },
  sales: { label: ["Sales and retail", "Handel och försäljning"], fields: ["Försäljning, inköp, marknadsföring"], cats: [],
    words: "retail* handel* butik* marknadsforing* marketing* salj* sales inkop* procurement upphandling* e-handel*" },
  office: { label: ["Leadership, HR and finance", "Ledning, HR och ekonomi"], fields: ["Administration, ekonomi, juridik", "Chefer och verksamhetsledare"], cats: [], caps: ["HR"],
    words: "personal ledarskap* leadership chef* ekonomi* finance* redovisning* juridik* jurist* upphandling* offentlig* public sector" },
  security: { label: ["Security and defence", "Säkerhet och försvar"], fields: ["Säkerhet och bevakning", "Militära yrken"], cats: [],
    words: "sakerhet* security defen* forsvar* totalforsvar* homeland skydd* samhallssakerhet* beredskap*" },
  transport: { label: ["Transport and logistics", "Transport och logistik"], fields: ["Transport, distribution, lager"], cats: [],
    words: "logistik* logistics transport* lager* rail* train* jarnvag* fordon* truck*" },
  nature: { label: ["Nature and science", "Natur och vetenskap"], fields: ["Naturbruk", "Naturvetenskap"], cats: [],
    words: "agro* lantbruk* jordbruk* skog* forest* miljo* environment* laborator* labdays biotech* kemi* chemistry science" },
  facility: { label: ["Cleaning and facilities", "Städ och fastighetsservice"], fields: ["Sanering och renhållning"], cats: [], words: "clean* stadning* facility* fastighetsservice* renhallning* avfall*" },
  beauty: { label: ["Beauty and wellness", "Skönhet och friskvård"], fields: ["Kropps- och skönhetsvård"], cats: [], words: "skonhet* beauty* frisor* estetisk* aesthetic* spa" },
};
for (const T of Object.values(EV_TOPICS)) {
  T.cats = T.cats.map(fold);
  T.re = new RegExp("(?:^|[^a-z0-9])(?:" + T.words.split(/\s+/).map(w => w.endsWith("*") ? escRe(fold(w.slice(0, -1))) : escRe(fold(w)) + "(?![a-z0-9])").join("|") + ")");
  T.capsRe = T.caps ? new RegExp(`(^|[^A-Za-z0-9])(${T.caps.join("|")})($|[^A-Za-z0-9])`) : null;
}
// Fairs for school pupils and students choosing what to study, and big fan events, aren't for people looking for work
const EV_SKIP = /gymnasiemassan|studentmassa|comic con|dreamhack/;
const EV_JOBFAIR = /jobbmassa|rekryteringsmassa|rekryteringstraff|karriarmassa|karriardag|arbetsmarknadsdag|job fair|career fair|jobbtorg/;

// Text from the calendars can hold HTML tags and entities like &amp;. DOMParser reads them as plain text without running anything.
const deHtml = s => s ? (new DOMParser().parseFromString(String(s), "text/html").body.textContent || "").replace(/\s+/g, " ").trim() : "";
// An exhibition centre's own calendar is mostly fairs, so its events count as trade fairs unless the name says otherwise
function evKind(type, title, otherwise = "event") {
  const f = fold(title), k = fold(type);
  if (EV_JOBFAIR.test(f)) return "jobfair";
  if (k) return k.includes("fack") ? "trade" : k.includes("publik") ? "public" : k.includes("konferens") ? "conf" : k.includes("kongress") ? "congress" : "event";
  if (/kongress|congress/.test(f)) return "congress";
  if (/conference|konferens|summit|forum|dagarna|dagen\b|days?\b/.test(f)) return "conf";
  if (/massa|massor|massan|expo\b|fair\b|messe/.test(f)) return "trade";
  return otherwise;
}
async function evFetch(url) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { accept: "application/json" }, signal: ctrl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return { r, json: await r.json() };
  } finally { clearTimeout(timer); }
}
const evText = s => deHtml(s).slice(0, 400);

// Stockholmsmässan's calendar (The Events Calendar for WordPress), with a category and a type for each event
async function evStockholm() {
  const out = [];
  let url = `https://stockholmsmassan.se/wp-json/tribe/events/v1/events?per_page=50&start_date=${today()}`;
  for (let page = 0; url && page < 4; page++) {
    const { json } = await evFetch(url);
    for (const e of json.events || []) {
      if (e.hide_from_listings) continue;
      const venue = deHtml(e.venue?.venue) || "Stockholmsmässan", v = EV_VENUES[fold(venue)] || { city: venue }, title = deHtml(e.title);
      out.push({ id: "sm" + e.id, src: "sm", title, url: e.url, start: (e.start_date || "").slice(0, 10), end: (e.end_date || e.start_date || "").slice(0, 10),
        venue, city: v.city, lat: v.lat, lon: v.lon, cats: (e.categories || []).map(c => deHtml(c.name)),
        kind: evKind((e.tags || []).map(x => deHtml(x.name)).join(" "), title), text: evText(e.excerpt || e.description) });
    }
    url = json.next_rest_url && /^https:\/\/stockholmsmassan\.se\//.test(json.next_rest_url) ? json.next_rest_url : "";
  }
  return out;
}
// Kistamässan and Malmömässan run the same WordPress setup, with each event's dates in meta_box and no categories
async function evWordpress(src, host, venueKey, venue) {
  const out = [], v = EV_VENUES[venueKey];
  for (let page = 1; page <= 4; page++) {
    const { r, json } = await evFetch(`https://${host}/wp-json/wp/v2/event_type?per_page=100&page=${page}&_fields=id,title,link,excerpt,meta_box`);
    for (const e of json) {
      const m = e.meta_box || {}, title = deHtml(e.title?.rendered), start = (m.event_start_date_min || "").slice(0, 10);
      if (!start || m.hide_from_archive === "1" || m.is_cancelled === "1") continue;
      out.push({ id: src + e.id, src, title, url: e.link, start, end: (m.event_end_date_max || start).slice(0, 10), venue, city: v.city, lat: v.lat, lon: v.lon,
        cats: [], kind: evKind("", title, "trade"), text: evText(e.excerpt?.rendered) });
    }
    if (page >= +(r.headers.get("x-wp-totalpages") || 1)) break;
  }
  return out;
}
// Visit Sweden's open data (the national tourism API) has events from all over Sweden. Only job fairs are asked for, by name.
const VS_QUERY = "public:true AND rdfType:http\\://schema.org/Event AND (jobbmässa OR jobbmässan OR rekryteringsmässa OR rekryteringsträff OR karriärmässa OR arbetsmarknadsdag OR arbetsmarknadsdagar OR jobbtorg)";
async function evVisitSweden() {
  const { json } = await evFetch(`https://data.visitsweden.com/store/search?type=solr&query=${encodeURIComponent(VS_QUERY)}&limit=100&rdfFormat=application/ld+json`);
  const val = x => Array.isArray(x) ? val(x.find(y => y?.["@language"] === "sv") ?? x[0]) : x && typeof x === "object" ? (x["@value"] ?? x["@id"] ?? "") : (x ?? "");
  const out = [];
  for (const c of json.resource?.children || []) {
    const g = c.metadata?.["@graph"] || [], e = g.find(n => [].concat(n["@type"]).includes("schema:Event"));
    if (!e) continue;
    const start = String(val(e["schema:startDate"])).slice(0, 10); if (!start) continue;
    const geo = g.find(n => n["@id"] && n["@id"] === val(e["schema:geo"])) || {}, place = g.find(n => n["schema:addressLocality"]);
    const lat = +val(geo["schema:latitude"]), lon = +val(geo["schema:longitude"]), title = deHtml(val(e["schema:name"]));
    out.push({ id: "vs" + (c.entryId || e["@id"]), src: "vs", title, url: String(val(e["schema:url"])) || "", start, end: String(val(e["schema:endDate"]) || start).slice(0, 10),
      venue: "", city: place ? deHtml(val(place["schema:addressLocality"])) : "", lat: lat || undefined, lon: lon || undefined, cats: [], kind: "jobfair", text: evText(val(e["schema:description"])) });
  }
  return out;
}
const EV_FETCH = { sm: evStockholm, kista: () => evWordpress("kista", "www.kistamassan.se", "kistamassan", "Kistamässan"),
  malmo: () => evWordpress("malmo", "www.malmomassan.se", "malmomassan", "Malmömässan"), vs: evVisitSweden };

/* ---------- Keeping the calendars ---------- */
let evCache = store.get("jf-events", {});   // source -> { at, items, failAt }
let evLoading = null, evMore = false;
function loadEvents() {
  if (evLoading) return evLoading;
  const now = Date.now(), due = Object.keys(EV_SOURCES).filter(s => {
    const c = evCache[s];
    return !c || (c.failAt && c.failAt >= (c.at || 0) ? now - c.failAt > EV_RETRY : now - (c.at || 0) > EV_TTL);
  });
  if (!due.length) return Promise.resolve();
  evLoading = Promise.all(due.map(async s => {
    try {
      const keep = today(), items = (await EV_FETCH[s]()).filter(e => e.end >= keep && e.title && /^https?:\/\//.test(e.url));
      evCache[s] = { at: Date.now(), items };
    } catch (e) { console.warn(`Couldn't read the ${EV_SOURCES[s]} calendar`, e); evCache[s] = { ...(evCache[s] || {}), failAt: Date.now() }; }
  })).then(() => { store.set("jf-events", evCache); evLoading = null; renderEvents(); });
  return evLoading;
}
// A source counts as failed when its last attempt failed, even if older events from it are still kept
const evFailed = () => Object.keys(EV_SOURCES).filter(s => evCache[s]?.failAt && evCache[s].failAt >= (evCache[s].at || 0));

/* ---------- Matching events to the search ---------- */
function evKm(a, b) {
  const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r;
  return Math.round(Math.sqrt(x * x + y * y) * 6371);
}
function evInterest() {
  if (!results?.params) return null;
  const p = results.params, words = allWords(p).filter(w => w.trim()).map(w => ({ w, re: termRe(w) }));
  const n = new Map();
  for (const a of results.ads || []) if (a.field) n.set(a.field, (n.get(a.field) || 0) + 1);
  const total = [...n.values()].reduce((x, y) => x + y, 0), top = [...n.entries()].sort((a, b) => b[1] - a[1]);
  // The field with the most ads, and any other field with at least a fifth of them
  const fields = top.filter(([, c], i) => i === 0 || c / total >= .2).map(([f]) => f);
  const topics = Object.keys(EV_TOPICS).filter(k => EV_TOPICS[k].fields.some(f => fields.includes(f)) || words.some(x => EV_TOPICS[k].re.test(fold(x.w)) || EV_TOPICS[k].capsRe?.test(x.w)));
  return { words, topics, geo: results.geo || { mode: "all" } };
}
// An event is in an area of work by the venue's own category when it has one that means something here, otherwise by its
// name. Descriptions are left out for this, because they mention all sorts (a healthcare fair's text talks about digital
// tools and the public sector), but they still count for the person's own keywords.
const EV_CATS = new Set(Object.values(EV_TOPICS).flatMap(T => T.cats));
function evInTopic(e, k) {
  const T = EV_TOPICS[k], cats = e.cats.map(fold).filter(c => EV_CATS.has(c));
  return cats.length ? cats.some(c => T.cats.includes(c)) : T.re.test(fold(e.title)) || !!T.capsRe?.test(e.title);
}
function evList(I) {
  const now = today(), last = addDays(EV_AHEAD_DAYS), seen = new Set(), out = [];
  const here = I.geo.lat ? { lat: I.geo.lat, lon: I.geo.lon } : null;
  for (const s of Object.keys(EV_SOURCES)) for (const e of evCache[s]?.items || []) {
    const name = fold(e.title), dup = name + "|" + e.start;
    if (e.end < now || e.start > last || EV_SKIP.test(name) || seen.has(dup)) continue;
    const km = here && e.lat ? evKm(here, e) : null, hay = fold(e.title + " " + e.text);
    let why = null;
    if (e.kind === "jobfair") {
      if (I.geo.mode !== "all" && !(km !== null && km <= EV_JOBFAIR_KM)) continue;
      const kw = I.words.find(x => x.re.test(hay));
      why = kw ? t("ev.why.kw", { w: kw.w }) : t("ev.why.jobfair");
    } else {
      const kw = I.words.find(x => x.re.test(e.kind === "public" ? name : hay));
      if (e.kind === "public" && !kw) continue;   // fairs for the general public only when their name has a keyword
      const tp = kw ? null : I.topics.find(k => evInTopic(e, k));
      if (!kw && !tp) continue;
      why = kw ? t("ev.why.kw", { w: kw.w }) : t("ev.why.field", { f: EV_TOPICS[tp].label[L()] });
    }
    seen.add(dup); out.push({ ...e, km, why });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "sv"));
}

/* ---------- The panel ---------- */
function evDates(e) {
  const [y1, m1, d1] = e.start.split("-").map(Number), [y2, m2, d2] = (e.end || e.start).split("-").map(Number), M = MONTHS[L()];
  if (e.end <= e.start) return `${d1} ${M[m1 - 1]} ${y1}`;
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${M[m1 - 1]} ${y1}`;
  return y1 === y2 ? `${d1} ${M[m1 - 1]} – ${d2} ${M[m2 - 1]} ${y1}` : `${d1} ${M[m1 - 1]} ${y1} – ${d2} ${M[m2 - 1]} ${y2}`;
}
function evItemHtml(e) {
  const [, m, d] = e.start.split("-").map(Number);
  const where = [e.venue, e.city && !fold(e.venue).includes(fold(e.city)) ? e.city : ""].filter(Boolean).join(", ");
  const dist = e.km === null ? "" : e.km <= EV_NEAR_KM ? t("ev.near") : t("ev.km", { n: e.km });
  return `<li class="ev"><div class="ev-day" aria-hidden="true"><b>${d}</b><span>${esc(MONTHS[L()][m - 1])}</span></div>
    <div class="ev-main"><a class="ev-name" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>
      <div class="ev-meta"><span class="kind">${esc(t("ev.k." + e.kind))}</span><span>${esc([evDates(e), where, dist].filter(Boolean).join(" · "))}</span></div>
      <div class="ev-why">${esc(e.why)}</div></div></li>`;
}
function renderEvents() {
  const el = $("events"); if (!el) return;
  const I = evInterest();
  if (!I) { el.hidden = true; el.innerHTML = ""; return; }
  loadEvents();
  const has = Object.keys(EV_SOURCES).some(s => evCache[s]?.items), list = evList(I), failed = evFailed();
  const shut = !!store.get("jf-ev-hide", false), shown = evMore ? list : list.slice(0, EV_SHOW), rest = list.length - shown.length;
  const names = Object.keys(EV_SOURCES).filter(s => !failed.includes(s)).map(s => EV_SOURCES[s]);
  // Nothing that fits is shown as no panel at all, rather than a box saying so above every search
  if (!list.length && !(evLoading && !has)) { el.hidden = true; el.innerHTML = ""; return; }
  let body;
  if (!list.length) body = `<p class="ev-sub">${esc(t("ev.loading"))}</p>`;
  else body = `<p class="ev-sub">${esc(t("ev.sub"))}</p><ul class="ev-list">${shown.map(evItemHtml).join("")}</ul>
    ${rest > 0 ? `<button class="linkbtn" type="button" data-ev="more">${esc(tn(rest, "ev.more1", "ev.moreN"))}</button>`
      : evMore && list.length > EV_SHOW ? `<button class="linkbtn" type="button" data-ev="less">${esc(t("ev.less"))}</button>` : ""}`;
  const foot = [names.length ? t("ev.foot", { list: joinList(names) }) : "", failed.length ? t("ev.fail", { list: joinList(failed.map(s => EV_SOURCES[s])) }) : ""].filter(Boolean).join(" ");
  el.hidden = false;
  el.innerHTML = `<div class="ev-head"><h2 id="ev-title">${esc(t("ev.title"))}${list.length ? ` <span class="ev-n">${list.length}</span>` : ""}</h2>
    <button class="linkbtn" type="button" data-ev="toggle" aria-expanded="${!shut}" aria-controls="ev-body">${esc(t(shut ? "ev.show" : "ev.hide"))}</button></div>
    <div class="ev-body" id="ev-body"${shut ? " hidden" : ""}>${body}${foot ? `<p class="ev-foot">${esc(foot)}</p>` : ""}</div>`;
}
function initEvents() {
  const el = $("events"); if (!el) return;
  el.addEventListener("click", e => {
    const b = e.target.closest("button[data-ev]"); if (!b) return;
    const act = b.dataset.ev;
    if (act === "toggle") store.set("jf-ev-hide", !store.get("jf-ev-hide", false));
    else { evMore = act === "more"; }
    const focusAt = act === "toggle" ? '[data-ev="toggle"]' : null, nth = act === "more" ? EV_SHOW : -1;
    renderEvents();
    if (focusAt) el.querySelector(focusAt)?.focus();
    else if (nth >= 0) el.querySelectorAll(".ev-name")[nth]?.focus();   // after Show more, to the first event that wasn't shown
    else el.querySelector('[data-ev="toggle"]')?.focus();
  });
}
