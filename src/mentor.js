/* ---------- Mentor: reads the CV once and suggests roles and what to learn next ----------
   The AI reads the CV (task "mentor" on the tailoring server) and answers with a pool of roles and courses as JSON.
   The four answers below re-rank that pool here in the browser, so changing an answer needs no new AI call.
   Open-ad counts, and how often a course's skill is named in ads, come straight from Platsbanken.
   Career stage comes only from experience and seniority. Age is never estimated or used. */
const MT_H = { under5: 18, y5to10: 36, y10plus: 72, unsure: 24 };   // time frame -> months a course may take to pay off
const MT_DIRS = ["deeper", "lead", "change", "advise"];
const MT_T = { t1: 1, t3: 3, t7: 7, t10: 10 };                       // weekly learning time -> hours
const MT_B = { employer: Infinity, self: 25000, free: 0 };             // who pays -> highest course cost in SEK
const MT_Q = [["horizon", Object.keys(MT_H), "mt.h."], ["dir", [...MT_DIRS, "any"], "mt.d."], ["time", Object.keys(MT_T), "mt.t."], ["budget", Object.keys(MT_B), "mt.b."]];
const MENTOR_TIMEOUT = 125000;
const MT_DEFAULTS = { horizon: "unsure", dir: "any", time: "t3", budget: "employer" };
let mentor = store.get("jf-mentor", null);   // { at, lang, cvHash, data, counts: { loc, at, roles: { title -> open ads }, demand: { course -> { p, n, role } } } }
let mtAns = { ...MT_DEFAULTS, ...store.get("jf-mentor-ans", {}) };
for (const [k, opts] of MT_Q) if (!opts.includes(mtAns[k])) mtAns[k] = MT_DEFAULTS[k];
const mt = { busy: false, status: "", error: "", editing: false, cvMsg: "", codeBad: false, codeDraft: null, counting: false, countFailedFor: "" };
const mtTimers = {};

const numLoc = () => (lang === "sv" ? "sv-SE" : "en-GB");
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const mtHash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const mtCv = () => (store.get("jf-cv", "") || "");
function mtDur(m) {
  if (m < 2.5) { const w = Math.max(1, Math.round(m * 4.33)); return w === 1 ? t("mt.week1") : t("mt.weeks", { n: w }); }
  if (m < 18) return t("mt.months", { n: Math.round(m) });
  const y = Math.round(m / 6) / 2;
  return y === 1 ? t("mt.year1") : t("mt.yearsd", { n: y.toLocaleString(numLoc()) });
}
const mtSek = n => t("mt.cost", { n: Math.round(n).toLocaleString(numLoc()) });

/* ---------- Checking what the AI sent before anything is shown ---------- */
function cleanMentor(d) {
  const str = (v, n = 400) => typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "";
  const num = (v, lo, hi, def) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : def; };
  const arr = (v, n) => Array.isArray(v) ? v.slice(0, n) : [];
  const dirs = v => arr(v, 4).filter(x => MT_DIRS.includes(x));
  const roles = arr(d.roles, 12).filter(r => r && typeof r === "object").map(r => ({
    title: str(r.title, 120), tier: ["direct", "stretch", "pivot"].includes(r.tier) ? r.tier : "stretch", dirs: dirs(r.directions),
    match: Math.round(num(r.match, 0, 100, 50)), why: str(r.why), gaps: arr(r.gaps, 3).map(g => str(g, 80)).filter(Boolean),
    gapMonths: num(r.gap_months, 0, 120, 0), search: str(r.search, 60) || str(r.title, 60) })).filter(r => r.title);
  const courses = arr(d.courses, 16).filter(c => c && typeof c === "object").map(c => {
    const prio = {};
    if (c.priority && typeof c.priority === "object") for (const k of MT_DIRS) { if (c.priority[k] != null) prio[k] = num(c.priority[k], 1, 10, 5); }
    else if (c.priority != null) for (const k of MT_DIRS) prio[k] = num(c.priority, 1, 10, 5);
    return { name: str(c.name, 140), provider: str(c.provider, 160), format: ["self", "class", "program"].includes(c.format) ? c.format : "self",
      hours: num(c.hours, 0, 3000, 20), days: num(c.days, 0, 60, 0), months: num(c.months, 0, 60, 0), hpw: num(c.hours_per_week, 0, 60, 0),
      cost: Math.round(num(c.cost_sek, 0, 500000, 0)), ramp: num(c.ramp_months, 0, 60, 0), dirs: dirs(c.directions), prio,
      why: str(c.why), skill: str(c.skill, 60), forRole: str(c.for_role, 120) };
  }).filter(c => c.name);
  return { name: str(d.name, 60), years: Math.round(num(d.years, 0, 60, 0)), stage: ["early", "established", "senior"].includes(d.stage) ? d.stage : "established",
    stageReason: str(d.stage_reason), history: arr(d.history, 4).filter(h => h && typeof h === "object").map(h => ({ title: str(h.title, 120), org: str(h.org, 120), years: str(h.years, 30) })).filter(h => h.title),
    education: str(d.education, 200), certs: str(d.certs, 200), domains: str(d.domains, 200), skills: arr(d.skills, 8).map(s => str(s, 60)).filter(Boolean),
    opener: str(d.opener, 600), notes: Object.fromEntries(MT_DIRS.map(k => [k, str(d.direction_notes?.[k], 600)])), roles, courses };
}
// A saved or restored result is only used if it has the shape this version writes
const validMentor = m => !!(m && typeof m === "object" && m.data && Array.isArray(m.data.roles) && Array.isArray(m.data.courses) && m.data.roles.every(r => r && typeof r.title === "string" && Array.isArray(r.gaps) && Array.isArray(r.dirs))
  && m.data.courses.every(c => c && typeof c.name === "string" && Array.isArray(c.dirs) && c.prio && typeof c.prio === "object") && Array.isArray(m.data.history) && Array.isArray(m.data.skills) && m.data.notes);
if (mentor && !validMentor(mentor)) mentor = null;

/* ---------- The four answers re-rank the pool ---------- */
// With a direction picked, a course ranks by its score for that direction. With "Not sure yet" it ranks by the directions
// the person's direct-fit roles already point to, so courses for another track don't come first.
function mtPrio(c, d) {
  if (mtAns.dir !== "any") return c.prio[mtAns.dir] ?? 5;
  const vals = Object.values(c.prio), home = [...new Set(d.roles.filter(r => r.tier === "direct").flatMap(r => r.dirs))];
  const fit = home.map(k => c.prio[k]).filter(v => v != null);
  if (fit.length) return Math.max(...fit);
  return (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 5) - (home.length ? 4 : 0);
}
function mtCourse(c, d) {
  const dir = mtAns.dir;
  if (dir !== "any" && c.dirs.length && !c.dirs.includes(dir)) return null;
  const h = MT_T[mtAns.time], perMonth = h * 4.33, pace = t("mt.tp." + mtAns.time);
  let completion, timeMsg = "";
  if (c.format === "program") {
    completion = c.months || Math.max(1, c.hours / Math.max(1, c.hpw || 10) / 4.33);
    if (c.hpw && h < c.hpw * 0.8) timeMsg = t("mt.r.prog", { h: Math.round(c.hpw), d: mtDur(completion), pace });
  } else if (c.format === "class") {
    const prepM = Math.max(0, c.hours - Math.max(1, c.days) * 7.5) / perMonth;
    completion = 1 + prepM;
    if (prepM > 18) timeMsg = t("mt.r.class", { pace, d: mtDur(prepM) });
  } else {
    completion = c.hours / perMonth;
    if (completion > 18) timeMsg = t("mt.r.self", { pace, d: mtDur(completion) });
  }
  const payoff = completion + c.ramp, reasons = [];
  if (timeMsg) reasons.push(timeMsg);
  if (payoff > MT_H[mtAns.horizon]) reasons.push(timeMsg ? t("mt.r.late") : t("mt.r.horizon", { d: mtDur(payoff) }));
  if (c.cost > MT_B[mtAns.budget]) reasons.push(cap(t(mtAns.budget === "free" ? "mt.r.free" : "mt.r.selfpay", { c: t("mt.costabout", { n: c.cost.toLocaleString(numLoc()) }) })));
  return { c, completion, reasons, prio: mtPrio(c, d), quick: completion <= 2.5 && c.ramp <= 1 };
}
function mtCourses(d) {
  const all = d.courses.map(c => mtCourse(c, d)).filter(Boolean).sort((a, b) => b.prio - a.prio || a.c.cost - b.c.cost);
  return { shown: all.filter(x => !x.reasons.length).slice(0, 6), skipped: all.filter(x => x.reasons.length) };
}
function mtRoles(d) {
  const dir = mtAns.dir, byMatch = (a, b) => b.match - a.match;
  const direct = d.roles.filter(r => r.tier === "direct").sort(byMatch);
  const st = d.roles.filter(r => r.tier === "stretch").sort(byMatch);
  let stretch = dir === "any" ? st.slice(0, 3) : st.filter(r => r.dirs.includes(dir)).slice(0, 3);
  if (!stretch.length) stretch = st.slice(0, 1);
  const pv = d.roles.filter(r => r.tier === "pivot").sort(byMatch);
  let pivot = dir === "any" ? pv.slice(0, 2) : dir === "change" ? pv : pv.filter(r => r.dirs.includes(dir)), maybe = false;
  if (!pivot.length) { pivot = pv.slice(0, 1); maybe = true; }
  return { direct, stretch, pivot, maybe };
}

/* ---------- Open ads from Platsbanken, in the place of the last search ---------- */
function mtPlace() {
  const g = results?.geo, p = results?.params;
  if (!g || !p) return { loc: `country=${SE_ID}`, label: t("allswe") };
  return { loc: locationParam(g, p.radius), label: placeLabel(g) + (hasRadius(g, p) ? ` + ${p.radius} km` : "") };
}
// Words that turn up in most Swedish ads whatever the job, so how often they're named says nothing about a skill
const MT_GENERIC = new Set(["utbildning", "utbildningar", "erfarenhet", "ledarskap", "ledare", "kommunikation", "samarbete", "ansvar", "kvalitet",
  "teknik", "projekt", "projektledning", "kunskap", "kunskaper", "kompetens", "engelska", "svenska", "korkort", "b-korkort", "service", "konsult",
  "education", "experience", "leadership", "communication", "teamwork", "training", "quality", "management", "project", "english", "swedish",
  "driving licence", "driving license", "consulting"]);
const mtRoleFor = (d, c) => { const f = fold(c.forRole); return f ? d.roles.find(r => fold(r.title) === f) || d.roles.find(r => fold(r.title).includes(f) || f.includes(fold(r.title))) : null; };
const mtCountsHere = () => { const c = mentor?.counts; return c && c.loc === mtPlace().loc ? c : null; };
async function mtCount() {
  if (!mentor || mt.counting) return;
  const { loc } = mtPlace(), cur = mentor.counts;
  if ((cur && cur.loc === loc && Date.now() - new Date(cur.at) < 864e5) || mt.countFailedFor === loc) return;
  mt.counting = true; renderMentorMain();
  const d = mentor.data, sampled = new Set(d.courses.map(c => mtRoleFor(d, c)).filter(Boolean)), texts = new Map(), roles = {};
  try {
    await pool(d.roles, 3, async r => {
      const q = encodeURIComponent(/\s/.test(r.search) ? `"${r.search}"` : r.search), n = sampled.has(r) ? 60 : 1;
      const j = await getJSON(`${JS_API}/search?q=${q}&${loc}&limit=${n}`, 2);
      roles[fold(r.title)] = +j.total?.value || 0;
      if (n > 1) texts.set(r, (j.hits || []).map(h => fold(`${h.headline || ""} ${h.description?.text || ""}`)));
    });
    // Roles with no ads here get the count for all of Sweden, so a suggestion isn't written off because of the place
    const national = {}, countryLoc = `country=${SE_ID}`;
    if (loc !== countryLoc) await pool(d.roles.filter(r => roles[fold(r.title)] === 0), 3, async r => {
      const q = encodeURIComponent(/\s/.test(r.search) ? `"${r.search}"` : r.search);
      national[fold(r.title)] = +(await getJSON(`${JS_API}/search?q=${q}&${countryLoc}&limit=1`, 2)).total?.value || 0;
    });
    const demand = {};
    for (const c of d.courses) {
      const r = mtRoleFor(d, c), list = r && texts.get(r), skill = fold(c.skill).trim();
      if (!list || list.length < 10 || !skill || MT_GENERIC.has(skill) || skill === fold(r.search).trim()) continue;
      const re = termRe(c.skill);
      demand[fold(c.name)] = { p: Math.round(100 * list.filter(x => re.test(x)).length / list.length), n: list.length, role: r.title };
    }
    if (mentor && mentor.data === d) { mentor.counts = { loc, at: new Date().toISOString(), roles, national, demand }; store.set("jf-mentor", mentor); }
  } catch (e) { console.warn("Open-ad counts could not be loaded", e); mt.countFailedFor = loc; }
  mt.counting = false; renderMentorMain();
}

/* ---------- Drawing the tab ---------- */
function mtCodeWho() {
  return ABOUT.author ? (ABOUT.linkedin ? `<a href="${esc(ABOUT.linkedin)}" target="_blank" rel="noopener">${esc(ABOUT.author)}</a>` : esc(ABOUT.author)) : esc(t("tl.code.who"));
}
function mtCvCard() {
  const cv = mtCv().trim(), editing = mt.editing || !cv;
  const changed = mentor && mentor.cvHash !== mtHash(cv);
  return `<section class="card mt-card" aria-labelledby="mt-cv-label">
    <div class="sec-head"><h3 id="mt-cv-label">${esc(t("mt.cv"))}</h3>${editing ? "" : `<button class="linkbtn" type="button" data-mt="edit">${esc(t("mt.cv.edit"))}</button>`}</div>
    ${editing ? `<textarea id="mt-cv" rows="10" aria-labelledby="mt-cv-label" placeholder="${esc(t("tl.cv.ph"))}">${esc(mtCv())}</textarea>`
      : `<p class="mt-cv-sum">${esc(t("mt.cv.sum", { n: cv.length.toLocaleString(numLoc()), start: cv.replace(/\s+/g, " ").slice(0, 52) + (cv.length > 52 ? "…" : "") }))}</p>`}
    <div class="row"><button class="btn ghost sm" type="button" data-mt="load">${esc(t("tl.load"))}</button>${editing && cv ? `<button class="btn ghost sm" type="button" data-mt="done">${esc(t("mt.cv.done"))}</button>` : ""}
      <input type="file" id="mt-file" accept=".docx,.txt,.md,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></div>
    <p class="tl-hint" id="mt-cvmsg">${esc(mt.cvMsg || t("mt.cv.shared"))}</p>
    ${changed ? `<p class="mt-flag">${esc(t("mt.cv.changed"))}</p>` : ""}
  </section>`;
}
function mtReadCard(d) {
  const fact = (k, v) => v ? `<div><dt>${esc(t(k))}</dt><dd>${v}</dd></div>` : "";
  return `<section class="card mt-card" aria-labelledby="mt-read">
    <div class="sec-head"><h3 id="mt-read">${esc(t("mt.read"))}</h3></div>
    <div class="mt-stage"><span class="label">${esc(t("mt.stage"))}</span><b>${esc(t("mt.stage." + d.stage))}</b><span>${esc([d.stageReason, t("mt.noage")].filter(Boolean).join(" "))}</span></div>
    <dl class="mt-facts">
      ${fact("mt.exp", esc(tn(d.years, "mt.yr1", "mt.yrN")))}
      ${fact("mt.roles", d.history.length ? `<ul class="mt-history">${d.history.map(h => `<li>${esc([h.title, h.org].filter(Boolean).join(", "))} <span class="mono">${esc(h.years)}</span></li>`).join("")}</ul>` : "")}
      ${fact("mt.edu", esc(d.education))}
      ${fact("mt.certs", esc(d.certs || t("mt.none")))}
      ${fact("mt.domains", esc(d.domains))}
      ${fact("mt.skills", d.skills.length ? `<div class="mt-tags">${d.skills.map(s => `<span class="chip cat">${esc(s)}</span>`).join("")}</div>` : "")}
    </dl>
    <div><button class="linkbtn" type="button" data-mt="edit">${esc(t("mt.wrong"))}</button></div>
  </section>`;
}
function mtQuestions() {
  return `<section class="card mt-card mt-qs-card" aria-labelledby="mt-q">
    <div class="sec-head"><h3 id="mt-q">${esc(t("mt.q.title"))}</h3></div>
    <p class="tl-hint">${esc(t("mt.q.hint"))}</p>
    <form class="mt-qs" id="mt-qs" novalidate>${MT_Q.map(([k, opts, p]) => `<fieldset><legend>${esc(t("mt.q." + k))}</legend><div class="mt-opts">${opts.map(v =>
      `<input class="mt-in" type="radio" id="mt-${k}-${v}" name="mt-${k}" value="${v}"${mtAns[k] === v ? " checked" : ""}><label class="mt-opt" for="mt-${k}-${v}">${esc(t(p + v))}</label>`).join("")}</div></fieldset>`).join("")}</form>
  </section>`;
}
function mtGoCard() {
  const code = store.get("jf-code", ""), showCode = !code || mt.codeBad || mt.codeDraft !== null, has = !!mentor;
  return `<section class="card mt-card mt-go" aria-label="${esc(t(has ? "mt.again" : "mt.go"))}">
    ${showCode ? `<label class="tl-inline">${esc(t("tl.code"))}<input type="text" id="mt-code" value="${esc(mt.codeDraft ?? code)}" autocomplete="off" spellcheck="false" placeholder="ABCDE-FGHJK"></label>
      ${code && !mt.codeBad ? "" : `<p class="tl-hint">${t("tl.code.hint", { who: mtCodeWho() })}</p>`}` : ""}
    <div class="row"><button class="btn" type="button" data-mt="go"${mt.busy ? " disabled" : ""}>${esc(mt.busy ? t("mt.busy") : t(has ? "mt.again" : "mt.go"))}</button><span class="tl-status" id="mt-status">${esc(mt.status)}</span></div>
    ${mt.error ? `<p class="tl-err" role="alert">${esc(mt.error)}</p>` : ""}
    ${has ? `<p class="tl-hint">${esc(t("mt.made", { date: fmtDate(localDay(new Date(mentor.at))) }))}</p>` : ""}
    ${has && mentor.lang !== lang ? `<p class="mt-flag">${esc(t("mt.otherlang"))}</p>` : ""}
    ${has && (store.get("jf-backup-time", "") || (store.get("jf-backup-at", "") ? store.get("jf-backup-at") + "T23:59:59" : "")) < mentor.at ? `<p class="tl-hint">${esc(t("mt.bk"))} <button class="linkbtn" type="button" data-mt="backup">${esc(t("bk.copy"))}</button></p>` : ""}
    <p class="tl-hint">${esc(t("mt.privacy"))}</p>
  </section>`;
}
function mtRoleCard(r, tier) {
  const badges = [], counts = mtCountsHere(), n = counts ? counts.roles[fold(r.title)] : undefined;
  if (tier !== "direct" && mtAns.dir !== "any" && r.dirs.includes(mtAns.dir)) badges.push(`<span class="mt-badge fit">${esc(t("mt.fit"))}</span>`);
  if (r.gapMonths > MT_H[mtAns.horizon]) badges.push(`<span class="mt-badge long">${esc(cap(t("mt.long", { d: mtDur(r.gapMonths) })))}</span>`);
  const nat = n === 0 ? counts.national?.[fold(r.title)] || 0 : 0;
  const open = mt.counting && !counts ? "…" : n == null ? "" : n ? tn(n, "mt.open1", "mt.openN", { n: n.toLocaleString(numLoc()) })
    : nat ? t("mt.open0.nat", { n: nat.toLocaleString(numLoc()) }) : t("mt.open0");
  return `<article class="mt-role t-${tier}">
    <div class="mt-role-top"><h4>${esc(r.title)}</h4>
      <div class="mt-match" title="${esc(t("mt.match"))}"><span>${r.match}%</span><span class="mt-meter" aria-hidden="true"><i style="width:${r.match}%"></i></span></div></div>
    ${badges.length ? `<div class="mt-badges">${badges.join("")}</div>` : ""}
    ${r.why ? `<p class="mt-why">${esc(r.why)}</p>` : ""}
    <div class="mt-gaps"><span class="label">${esc(t("mt.gaps"))}</span>${r.gaps.length ? r.gaps.map(g => `<span class="chip cat">${esc(g)}</span>`).join("") : `<span class="mt-muted">${esc(t("mt.nogaps"))}</span>`}</div>
    <div class="mt-role-foot"><span class="mono mt-open">${esc(open)}</span><button class="btn sm" type="button" data-mt="search" data-q="${esc(r.search)}"${nat ? ' data-all="1"' : ""}>${esc(t(nat ? "mt.search.all" : "mt.search"))}</button></div>
  </article>`;
}
function mtTier(tier, sub, roles) {
  if (!roles.length) return "";
  return `<div class="mt-tier t-${tier}"><h3 class="mt-tier-title"><span class="mt-pill">${esc(t("mt.tier." + tier))}</span>${esc(sub)}</h3>
    <div class="mt-role-grid">${roles.map(r => mtRoleCard(r, tier)).join("")}</div></div>`;
}
function mtEffort(x) {
  const c = x.c;
  if (c.format === "program") return t("mt.eff.prog", { h: Math.round(c.hpw || 10), d: mtDur(x.completion) });
  if (c.format === "class") { const prep = Math.round(Math.max(0, c.hours - Math.max(1, c.days) * 7.5)); return tn(Math.max(1, Math.round(c.days)), "mt.eff.class1", "mt.eff.class") + (prep ? t("mt.eff.prep", { h: prep }) : ""); }
  return t("mt.eff.self", { h: Math.round(c.hours), d: mtDur(x.completion), pace: t("mt.tp." + mtAns.time) });
}
function mtCourseItem(x) {
  const c = x.c, counts = mtCountsHere(), dm = counts && counts.demand[fold(c.name)];
  const demand = dm ? (dm.p >= 3 ? t("mt.demand", { p: dm.p, n: dm.n, role: dm.role }) : t("mt.demand.rare", { role: dm.role })) : "";
  return `<li class="mt-course">
    <div class="mt-course-head"><h4>${esc(c.name)}</h4><div class="mt-course-tags">${x.quick ? `<span class="mt-quick">${esc(t("mt.quick"))}</span>` : ""}<span class="mt-cost">${esc(c.cost ? mtSek(c.cost) : t("mt.free"))}</span></div></div>
    <div class="mt-course-meta">${c.provider ? `<span>${esc(c.provider)}</span>` : ""}<span>${esc(mtEffort(x))}</span></div>
    ${c.why ? `<p>${esc(c.why)}</p>` : ""}
    ${demand ? `<div class="mono mt-demand">${esc(demand)}</div>` : ""}
  </li>`;
}
function mtMainHtml() {
  if (!mentor) {
    return `<section class="card mt-placeholder" aria-labelledby="mt-ph"><h2 id="mt-ph">${esc(t(mt.busy ? "mt.busy" : "mt.ph.title"))}</h2>
      <ul>${["mt.ph.1", "mt.ph.2", "mt.ph.3"].map(k => `<li>${esc(t(k))}</li>`).join("")}</ul>
      ${mtCv().trim() ? "" : `<p class="tl-hint">${esc(t("mt.needcv"))}</p>`}</section>`;
  }
  const d = mentor.data, r = mtRoles(d), cs = mtCourses(d), place = mtPlace();
  const adjust = [t("mt.hl." + mtAns.horizon), mtAns.time === "t1" ? t("mt.tl.t1") : "", mtAns.budget !== "employer" ? t("mt.bl." + mtAns.budget) : ""].filter(Boolean).join(" ");
  const note = [d.opener, mtAns.dir === "any" ? t("mt.dl.any") : d.notes[mtAns.dir]].filter(Boolean).join(" ");
  const counts = mtCountsHere(), failed = !counts && !mt.counting && mt.countFailedFor === place.loc;
  const where = mt.counting && !counts ? esc(t("mt.counting")) : counts ? esc(`${t("mt.where", { place: place.label })} · ${t("mt.counted", { ago: agoText(counts.at) })}`)
    : failed ? `${esc(t("mt.countfail"))} <button class="linkbtn" type="button" data-mt="recount">${esc(t("err.retry"))}</button>` : "";
  return `<section class="mt-note" aria-labelledby="mt-you">
      <div class="mt-note-head"><span class="mt-mark" aria-hidden="true">M</span><div><div class="mt-you" id="mt-you">${esc(t("mt.you"))}</div><div class="mt-sub">${esc(d.name ? t("mt.for", { name: d.name }) : t("mt.foryou"))}</div></div></div>
      <p class="mt-note-text">${esc(note)}</p>
      <p class="mt-adjust"><b>${esc(t("mt.adjusted"))}</b> ${esc(adjust)}</p>
    </section>
    ${aiNoteHtml("ai.mentor", t("tab.mentor"), "ai.title.mt")}
    <section aria-labelledby="mt-roles-h">
      <div class="mt-block-head"><h2 id="mt-roles-h" tabindex="-1">${esc(t("mt.roles.title"))}</h2><p>${where}</p></div>
      ${mtTier("direct", t("mt.sub.direct"), r.direct)}
      ${mtTier("stretch", t("mt.sub.stretch"), r.stretch)}
      ${mtTier("pivot", t(r.maybe ? "mt.sub.maybe" : "mt.sub.pivot"), r.pivot)}
    </section>
    <section aria-labelledby="mt-learn-h">
      <div class="mt-block-head"><h2 id="mt-learn-h">${esc(t("mt.learn.title"))}</h2><p>${esc(t("mt.learn.sub"))}</p></div>
      ${cs.shown.length ? `<ul class="mt-courses">${cs.shown.map(mtCourseItem).join("")}</ul>` : `<div class="mt-courses"><p class="mt-none">${esc(t("mt.learn.none"))}</p></div>`}
      ${cs.skipped.length ? `<details class="mt-skipped"><summary>${esc(t("mt.skipped", { n: cs.skipped.length }))}</summary>
        <ul>${cs.skipped.map(x => `<li><strong>${esc(x.c.name)}</strong><span>${esc(x.reasons.join(" "))}</span></li>`).join("")}</ul></details>` : ""}
      <p class="tl-hint mt-check">${esc(t("mt.check"))}</p>
    </section>
    <section class="mt-how" aria-labelledby="mt-how-h">
      <h2 id="mt-how-h">${esc(t("mt.how"))}</h2>
      <dl>${[["cv", ""], ["ans", ""], ["ads", ""], ["never", " class=\"never\""]].map(([k, cls]) => `<div${cls}><dt>${esc(t("mt.how." + k))}</dt><dd>${esc(t("mt.how." + k + ".d"))}</dd></div>`).join("")}</dl>
    </section>`;
}
// Redraws one part, keeping whatever was focused or being typed
function mtDraw(id, html, focusSel) {
  const box = $(id); if (!box) return;
  const act = document.activeElement, keep = box.contains(act) && act.id ? { id: act.id, s: act.selectionStart, e: act.selectionEnd } : null;
  box.innerHTML = html;
  const el = focusSel ? box.querySelector(focusSel) : keep ? $(keep.id) : null;
  if (el) { el.focus(); if (keep && el.setSelectionRange && keep.s != null) try { el.setSelectionRange(keep.s, keep.e); } catch {} }
}
function renderMentorSide(focusSel) {
  mtDraw("mt-side", mtCvCard() + mtGoCard() + (mentor ? mtReadCard(mentor.data) : "") + mtQuestions(), focusSel);
}
function renderMentorMain(flash) {
  $("mentor")?.classList.toggle("has-advice", !!mentor);
  mtDraw("mt-main", mtMainHtml());
  if (flash) { const n = document.querySelector("#mt-main .mt-note"); if (n) { n.classList.remove("flash"); void n.offsetWidth; n.classList.add("flash"); } }
}
function renderMentor() { if (!ABOUT.tailor) return; renderMentorSide(); renderMentorMain(); }

/* ---------- Asking the server ---------- */
const MT_ERRORS = { ...TL_ERRORS, ai_bad_format: "mt.e.format", bad_task: "mt.e.server" };
async function getAdvice() {
  if (mt.busy) return;
  mtSaveCv();
  const cv = mtCv().trim(), code = (($("mt-code") ? $("mt-code").value : store.get("jf-code", "")) || "").trim();
  mt.error = "";
  if (cv.length < 200) { mt.error = t("tl.e.cv"); mt.editing = true; return renderMentorSide("#mt-cv"); }
  if (!code) { mt.error = t("tl.e.nocode"); mt.codeDraft = ""; return renderMentorSide("#mt-code"); }
  store.set("jf-code", code); mt.codeDraft = null;
  mt.busy = true; mt.codeBad = false; mt.editing = false; mt.status = t("mt.wait", { s: 0 });
  renderMentor();
  const started = Date.now(), tick = setInterval(() => { mt.status = t("mt.wait", { s: Math.round((Date.now() - started) / 1000) }); const s = $("mt-status"); if (s) s.textContent = mt.status; }, 1000);
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), MENTOR_TIMEOUT);
  try {
    const r = await fetch(ABOUT.tailor, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal, body: JSON.stringify({ code, task: "mentor", lang, cv }) });
    const j = await r.json().catch(() => ({}));
    const data = r.ok && j.data && typeof j.data === "object" ? cleanMentor(j.data) : null;
    if (data && data.roles.length && data.courses.length) {
      mentor = { at: new Date().toISOString(), lang, cvHash: mtHash(cv), data, counts: null };
      mt.countFailedFor = "";
      if (!store.set("jf-mentor", mentor)) mt.error = t("blocked");
    } else {
      if (j.error === "bad_code") mt.codeBad = true;
      mt.error = t(r.ok ? "mt.e.format" : MT_ERRORS[j.error] || "tl.e.service", { perHour: j.perHour ?? "", perDay: j.perDay ?? "" });
    }
  } catch (err) {
    mt.error = err.name === "AbortError" ? t("tl.e.timeout") : embedded ? t("e.embedded") : t("tl.e.network");
  } finally {
    clearTimeout(timer); clearInterval(tick);
    mt.busy = false; mt.status = "";
    renderMentorSide(mt.codeBad ? "#mt-code" : mt.error ? null : undefined);
    renderMentorMain(!mt.error);
    if (!mt.error) { const h = $("mt-you"); if (h && window.innerWidth < 980) h.scrollIntoView({ block: "start" }); }
    mtCount();
  }
}

/* ---------- From a suggested role to the job ads ---------- */
function mtSearch(q, all) {
  selectTab("res");
  if (all) { $("place").value = ""; syncRadius(); }
  terms.splice(0, terms.length, q); setAlts(); kwBox.draw(); showHint({ kind: "" });
  window.scrollTo(0, 0);
  runSearch();
}

/* ---------- Events ---------- */
function mtSaveCv() { const el = $("mt-cv"); if (el && el.value !== mtCv()) store.set("jf-cv", el.value); }
async function mtLoadFile(e) {
  const f = e.target.files[0]; if (!f) return;
  try {
    const text = /\.docx$/i.test(f.name) ? await docxText(await f.arrayBuffer()) : /\.pdf$/i.test(f.name) ? null : await f.text();
    if (text === null) mt.cvMsg = t("tl.pdf");
    else { store.set("jf-cv", text); mt.cvMsg = t("tl.loaded", { name: f.name }); mt.editing = true; }
  } catch { mt.cvMsg = t("tl.loadfail"); }
  e.target.value = "";
  renderMentorSide("#mt-cv"); renderMentorMain();
}
function initMentor() {
  const m = $("mentor");
  if (!ABOUT.tailor || !m) return;
  m.innerHTML = `<div class="mt-side" id="mt-side"></div><div class="mt-main" id="mt-main" aria-live="polite"></div>`;
  m.addEventListener("click", e => {
    const b = e.target.closest("[data-mt]"); if (!b) return;
    const k = b.dataset.mt;
    if (k === "edit") { mt.editing = true; mt.cvMsg = ""; renderMentorSide("#mt-cv"); }
    else if (k === "done") { mtSaveCv(); mt.editing = false; mt.cvMsg = ""; renderMentorSide('[data-mt="edit"]'); renderMentorMain(); }
    else if (k === "load") $("mt-file").click();
    else if (k === "go") getAdvice();
    else if (k === "search") mtSearch(b.dataset.q, b.dataset.all === "1");
    else if (k === "recount") { mt.countFailedFor = ""; mtCount(); document.querySelector("#mt-roles-h")?.focus(); }
    else if (k === "backup") { downloadBackup(); renderMentorSide(); }
  });
  m.addEventListener("input", e => {
    if (e.target.id === "mt-cv") { clearTimeout(mtTimers.cv); mtTimers.cv = setTimeout(mtSaveCv, 400); }
    else if (e.target.id === "mt-code") mt.codeDraft = e.target.value;
  });
  m.addEventListener("change", e => {
    if (e.target.id === "mt-file") return mtLoadFile(e);
    const k = (e.target.name || "").replace(/^mt-/, "");
    if (e.target.type === "radio" && k in mtAns) { mtAns[k] = e.target.value; store.set("jf-mentor-ans", mtAns); renderMentorMain(true); }
  });
  m.addEventListener("submit", e => e.preventDefault());
}
