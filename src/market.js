/* ---------- Market: how the job market looks for your field ----------
   Everything here comes from data/market.json, which market.py fills on the 1st of every month and build.py puts in the
   page, so the tab makes no requests of its own. The figures for Sweden come from the sweden-labour-data package (SCB,
   Arbetsförmedlingen, Konjunkturinstitutet, ManpowerGroup, Sveriges Ingenjörer, Cinode), each with the date it was compiled.
   The figures for each field and county are Platsbanken ad counts: ads published in the three full months before the 1st,
   against the same months a year earlier. Platsbanken's archive covers some years much more fully than others, so raw
   counts can't be compared across years. Instead a field's change is divided by the change for all ads, which cancels out
   the archive's coverage, and applied to Arbetsförmedlingen's official change in new job postings. No AI.
   After a few rejections, a pop-up says what the figures mean for the person and points to the Mentor. */
const MK = /*__MARKET__*/;
const MK_FIELDS = /*__FIELDS__*/;   // [Swedish label, JobTech id] for all 21 occupation fields, from the package

Object.assign(I18N, {
  "tab.market": ["Market", "Marknad"],
  "mk.eyebrow": ["Market analysis · open data", "Marknadsanalys · öppna data"], "mk.h1": ["How's the job market?", "Hur ser jobbmarknaden ut?"],
  "mk.lede": ["See how many employers are advertising in your field compared with a year ago, and what the latest figures for Sweden say. Worked out from Platsbanken and official statistics on the 1st of every month, with no AI.",
    "Se hur många arbetsgivare som annonserar inom ditt yrkesområde jämfört med för ett år sedan, och vad de senaste siffrorna för Sverige säger. Räknat fram ur Platsbanken och officiell statistik den 1:a varje månad, utan AI."],
  "mk.field": ["Your field", "Ditt yrkesområde"], "mk.allfields": ["All fields", "Alla yrkesområden"], "mk.where": ["Where", "Var"], "mk.sweden": ["All of Sweden", "Hela Sverige"],
  "mk.guessed": ["Picked from your searches and applications. Change it if it isn't right.", "Valt utifrån dina sökningar och ansökningar. Ändra om det inte stämmer."],
  "mk.choose": ["Pick your field to see how it compares with the rest of the job market.", "Välj ditt yrkesområde för att se hur det står sig mot resten av jobbmarknaden."],
  "mk.mood.tough": ["A tough market", "En tuff marknad"], "mk.mood.slow": ["Slower than last year", "Lugnare än i fjol"],
  "mk.mood.steady": ["About the same as last year", "Ungefär som i fjol"], "mk.mood.busy": ["Busier than last year", "Fler jobb än i fjol"],
  "mk.nocounts": ["The figures for each field are counted on Platsbanken on the 1st of every month and aren't in yet.", "Siffrorna för varje yrkesområde räknas i Platsbanken den 1:a varje månad och har inte kommit in än."],
  "mk.last3": ["the last three full months", "de tre senaste hela månaderna"],
  "mk.in": ["in {place}", "i {place}"],
  "mk.s.down.f": ["There were about {p} fewer {field} ads {where} from {months} than a year earlier.", "Det kom ungefär {p} färre annonser inom {field} {where} under {months} än ett år tidigare."],
  "mk.s.up.f": ["There were about {p} more {field} ads {where} from {months} than a year earlier.", "Det kom ungefär {p} fler annonser inom {field} {where} under {months} än ett år tidigare."],
  "mk.s.same.f": ["There were about as many {field} ads {where} from {months} as a year earlier.", "Det kom ungefär lika många annonser inom {field} {where} under {months} som ett år tidigare."],
  "mk.s.down.a": ["There were about {p} fewer job ads {where} from {months} than a year earlier.", "Det kom ungefär {p} färre jobbannonser {where} under {months} än ett år tidigare."],
  "mk.s.up.a": ["There were about {p} more job ads {where} from {months} than a year earlier.", "Det kom ungefär {p} fler jobbannonser {where} under {months} än ett år tidigare."],
  "mk.s.same.a": ["There were about as many job ads {where} from {months} as a year earlier.", "Det kom ungefär lika många jobbannonser {where} under {months} som ett år tidigare."],
  "mk.s.nat.down": ["Across Sweden, Arbetsförmedlingen got {p} fewer new job postings in {month} than a year earlier.", "I hela Sverige fick Arbetsförmedlingen in {p} färre nya lediga jobb i {month} än ett år tidigare."],
  "mk.s.nat.up": ["Across Sweden, Arbetsförmedlingen got {p} more new job postings in {month} than a year earlier.", "I hela Sverige fick Arbetsförmedlingen in {p} fler nya lediga jobb i {month} än ett år tidigare."],
  "mk.vs.worse": ["That's weaker than the job market as a whole, where new postings {chg} in {month}.", "Det är svagare än jobbmarknaden i stort, där nya lediga jobb {chg} i {month}."],
  "mk.vs.better": ["That's stronger than the job market as a whole, where new postings {chg} in {month}.", "Det är starkare än jobbmarknaden i stort, där nya lediga jobb {chg} i {month}."],
  "mk.vs.same": ["That's in line with the job market as a whole, where new postings {chg} in {month}.", "Det följer jobbmarknaden i stort, där nya lediga jobb {chg} i {month}."],
  "mk.fell": ["fell {p}", "minskade med {p}"], "mk.rose": ["rose {p}", "ökade med {p}"],
  "mk.small": ["There are too few {what} {where} to compare with last year, so this goes by {wider}.", "Det finns för få {what} {where} för att jämföra med i fjol, så det här utgår från {wider}."],
  "mk.small.ads": ["ads", "annonser"], "mk.small.fads": ["{field} ads", "annonser inom {field}"],
  "mk.wider.f": ["{field} in all of Sweden", "{field} i hela Sverige"], "mk.wider.nat": ["the figures for all of Sweden", "siffrorna för hela Sverige"],
  "mk.wider.place": ["all job ads in {place}", "alla jobbannonser i {place}"],
  "mk.rough": ["That's based on {n} ads, so treat it as a rough guide: a few employers can move it a lot.", "Det bygger på {n} annonser, så se det som en grov fingervisning: några få arbetsgivare kan flytta det mycket."],
  "mk.t.open": ["Open ads on {date}", "Lediga jobb den {date}"], "mk.t.change": ["Ads compared with a year earlier", "Annonser jämfört med ett år tidigare"],
  "mk.t.about": ["About, {months}", "Ungefär, {months}"], "mk.t.share": ["Share of all job ads", "Andel av alla jobbannonser"], "mk.t.sharein": ["Share of job ads in {place}", "Andel av jobbannonserna i {place}"],
  "mk.t.share.sub": ["{prev} a year earlier", "{prev} ett år tidigare"], "mk.t.na": ["Not enough ads to tell", "För få annonser för att säga"],
  "mk.cmp.title": ["Compared with a year earlier", "Jämfört med ett år tidigare"],
  "mk.cmp.sub": ["Estimated change in job ads from {months}. All of Sweden is Arbetsförmedlingen's change in new postings in {month}.", "Uppskattad förändring i antalet jobbannonser under {months}. Hela Sverige är Arbetsförmedlingens förändring i nya lediga jobb i {month}."],
  "mk.cmp.all": ["All fields, {place}", "Alla yrkesområden, {place}"], "mk.cmp.sweden": ["All fields, all of Sweden", "Alla yrkesområden, hela Sverige"],
  "mk.nat.title": ["Across Sweden", "Hela Sverige"], "mk.nat.sub": ["The latest official figures", "De senaste officiella siffrorna"],
  "mk.n.postings": ["New job postings", "Nya lediga jobb"], "mk.n.postings.sub": ["At Arbetsförmedlingen, {month}", "Hos Arbetsförmedlingen, {month}"],
  "mk.n.unemp": ["Unemployment", "Arbetslöshet"], "mk.n.unemp.sub": ["{month}, seasonally adjusted (SCB)", "{month}, säsongsrensad (SCB)"],
  "mk.n.notices": ["Given notice of redundancy", "Varslade om uppsägning"], "mk.n.notices.sub": ["People, {month}", "Personer, {month}"],
  "mk.n.openings": ["Job openings", "Lediga jobb"], "mk.n.openings.sub": ["Whole economy, {q} (SCB)", "Hela ekonomin, {q} (SCB)"],
  "mk.n.yago": ["{v} on a year earlier", "{v} mot ett år tidigare"],
  "mk.c.unemp": ["Unemployment by year", "Arbetslöshet per år"], "mk.c.unemp.sub": ["SCB, with Konjunkturinstitutet's forecast from {y}", "SCB, med Konjunkturinstitutets prognos från {y}"],
  "mk.c.actual": ["Actual", "Utfall"], "mk.c.forecast": ["Forecast", "Prognos"],
  "mk.c.notices": ["Redundancy notices each month", "Varsel varje månad"], "mk.c.notices.sub": ["People given notice, Arbetsförmedlingen", "Personer som varslats, Arbetsförmedlingen"],
  "mk.c.month": ["Each month", "Varje månad"], "mk.c.trend": ["Trend", "Trend"],
  "mk.c.outlook": ["Employers' hiring plans for {q}", "Arbetsgivarnas anställningsplaner för {q}"],
  "mk.c.outlook.sub": ["ManpowerGroup: the share of employers planning to hire minus the share planning to cut. Yours are highlighted.", "ManpowerGroup: andelen arbetsgivare som planerar att anställa minus andelen som planerar att minska. Dina är markerade."],
  "mk.c.prev": ["{v} the quarter before", "{v} kvartalet innan"],
  "mk.c.ki": ["Konjunkturinstitutet's business survey, {month}: hiring plans for all businesses at {v}, against {prev} a year earlier.", "Konjunkturinstitutets barometer, {month}: anställningsplanerna för hela näringslivet låg på {v}, mot {prev} ett år tidigare."],
  "mk.table": ["Show as a table", "Visa som tabell"], "mk.th.year": ["Year", "År"], "mk.th.month": ["Month", "Månad"], "mk.th.rate": ["Unemployment", "Arbetslöshet"], "mk.th.kind": ["Kind", "Typ"],
  "mk.th.notices": ["Notices", "Varsel"], "mk.th.trend": ["Trend", "Trend"],
  "mk.sec.title": ["More on {field}", "Mer om {field}"], "mk.sec.sub": ["Figures for the industries closest to your field", "Siffror för de branscher som ligger närmast ditt yrkesområde"],
  "mk.sec.emp": ["{n} people work in {sector}, {chg} on a year earlier ({q}, SCB).", "{n} personer arbetar inom {sector}, {chg} mot ett år tidigare ({q}, SCB)."],
  "mk.sec.outlook": ["ManpowerGroup's hiring outlook for {group} is {v} for {q}, against {prev} the quarter before.", "ManpowerGroups anställningsutsikter för {group} ligger på {v} för {q}, mot {prev} kvartalet innan."],
  "mk.sec.outlook1": ["ManpowerGroup's hiring outlook for {group} is {v} for {q}.", "ManpowerGroups anställningsutsikter för {group} ligger på {v} för {q}."],
  "mk.sec.ki": ["Hiring plans in {sector} were {v} in {month}, against {prev} a year earlier (Konjunkturinstitutet).", "Anställningsplanerna inom {sector} låg på {v} i {month}, mot {prev} ett år tidigare (Konjunkturinstitutet)."],
  "mk.sec.eng": ["Unemployment among Sveriges Ingenjörer's members was {v} in {month}, down from a peak of {peak} in {pm}. For everyone it was {all}.", "Arbetslösheten bland Sveriges Ingenjörers medlemmar var {v} i {month}, ned från toppen på {peak} i {pm}. För alla var den {all}."],
  "mk.sec.eng1": ["Unemployment among Sveriges Ingenjörer's members was {v} in {month}. For everyone it was {all}.", "Arbetslösheten bland Sveriges Ingenjörers medlemmar var {v} i {month}. För alla var den {all}."],
  "mk.sec.cons": ["{n} of 25 listed Nordic consultancies added staff in {q}, and the typical firm's revenue changed by {g} on a year earlier (Cinode).", "{n} av 25 börsnoterade nordiska konsultbolag ökade personalen under {q}, och det typiska bolagets intäkter förändrades med {g} mot ett år tidigare (Cinode)."],
  "mk.do.title": ["What you can do", "Vad du kan göra"],
  "mk.do.tough": ["When there are fewer jobs, each one gets more applicants. It helps to aim where you're a strong match and to make that easy to see.", "När jobben är färre får varje jobb fler sökande. Det hjälper att sikta där du matchar väl och att göra det lätt att se."],
  "mk.do.ok": ["Employers in your field are hiring. Applying where you match well, and making that easy to see, gets the most out of it.", "Arbetsgivarna inom ditt yrkesområde anställer. Sök där du matchar väl, och gör det lätt att se, så får du ut mest av det."],
  "mk.do.mentor": ["The Mentor reads your CV and suggests roles you match well and skills employers ask for.", "Mentorn läser ditt CV och föreslår jobb du matchar väl och kunskaper som arbetsgivare efterfrågar."],
  "mk.do.tailor": ["Tailor my application rewrites your CV and cover letter for each ad, so it's clear why you fit.", "Anpassa min ansökan skriver om ditt CV och personliga brev för varje annons, så att det syns varför du passar."],
  "mk.do.find": ["Search Find jobs in a wider area, or with a related job title, to find more openings.", "Sök i Hitta jobb i ett större område, eller på en närliggande yrkestitel, för att hitta fler lediga jobb."],
  "mk.how": ["How these numbers are made", "Så tas siffrorna fram"],
  "mk.how.field": ["Your field", "Ditt yrkesområde"],
  "mk.how.field.d": ["Counted on Platsbanken on the 1st of every month: ads published from {months}, both those still open and those in the archive, against the same months a year earlier. The archive covers some years more fully than others, so the app compares your field with all ads rather than raw counts, and applies the difference to Arbetsförmedlingen's official change in new postings.",
    "Räknat i Platsbanken den 1:a varje månad: annonser publicerade under {months}, både de som är öppna och de i arkivet, mot samma månader ett år tidigare. Arkivet täcker vissa år bättre än andra, så appen jämför ditt yrkesområde med alla annonser i stället för med råa antal, och tillämpar skillnaden på Arbetsförmedlingens officiella förändring i nya lediga jobb."],
  "mk.how.sweden": ["Sweden", "Sverige"],
  "mk.how.sweden.d": ["The latest releases from SCB, Arbetsförmedlingen, Konjunkturinstitutet, ManpowerGroup, Sveriges Ingenjörer and Cinode, each with the date it was compiled.", "De senaste siffrorna från SCB, Arbetsförmedlingen, Konjunkturinstitutet, ManpowerGroup, Sveriges Ingenjörer och Cinode, med datum för när de sammanställdes."],
  "mk.how.you": ["Your data", "Dina uppgifter"],
  "mk.how.you.d": ["Nothing about you leaves your browser. The counts are the same for anyone who picks the same field and place.", "Inget om dig lämnar webbläsaren. Siffrorna är desamma för alla som väljer samma yrkesområde och plats."],
  "mk.src": ["Sources", "Källor"], "mk.compiled": ["compiled {date}", "sammanställt {date}"], "mk.counted": ["counted {date}", "räknat {date}"],
  "mk.s.live": ["Platsbanken, through JobTech's open APIs", "Platsbanken, via JobTechs öppna API:er"],
  "mk.s.national_now": ["SCB's labour force survey and Arbetsförmedlingen's monthly statistics", "SCB:s arbetskraftsundersökning och Arbetsförmedlingens månadsstatistik"],
  "mk.s.national_yearly": ["SCB, and Konjunkturinstitutet's forecast", "SCB, och Konjunkturinstitutets prognos"],
  "mk.s.hiring_outlook": ["ManpowerGroup Employment Outlook Survey", "ManpowerGroups arbetsmarknadsbarometer"],
  "mk.s.hiring_plans": ["Konjunkturinstitutet's business survey, via Ekonomifakta", "Konjunkturinstitutets konjunkturbarometer, via Ekonomifakta"],
  "mk.s.redundancies": ["Arbetsförmedlingen's redundancy notices, via Ekonomifakta", "Arbetsförmedlingens varselstatistik, via Ekonomifakta"],
  "mk.s.engineers": ["Sveriges Ingenjörer's reports and member survey", "Sveriges Ingenjörers rapporter och medlemsundersökning"],
  "mk.s.consulting": ["Cinode's reports on listed Nordic consultancies", "Cinodes rapporter om börsnoterade nordiska konsultbolag"],
  "mk.s.tech_employment": ["SCB, people employed by industry", "SCB, sysselsatta per bransch"],
  "mk.s.job_openings": ["SCB, job openings", "SCB, lediga jobb"],
  "foot.market": ["<b>Market.</b> The Market tab shows how many job ads there were in your field compared with a year earlier, next to the latest official figures for Sweden. The ads are counted on Platsbanken on the 1st of every month and built into the page, so the tab sends nothing anywhere. It goes by your searches to pick your field.",
    "<b>Marknaden.</b> Fliken Marknaden visar hur många jobbannonser det fanns inom ditt yrkesområde jämfört med ett år tidigare, bredvid de senaste officiella siffrorna för Sverige. Annonserna räknas i Platsbanken den 1:a varje månad och byggs in i sidan, så fliken skickar ingenting någonstans. Den utgår från dina sökningar för att välja yrkesområde."],

  // The pop-up after a few rejections
  "ng.eyebrow": ["A word on the market", "Ett ord om marknaden"],
  "ng.h.tough": ["It's a tough market right now", "Det är en tuff marknad just nu"], "ng.h.slow": ["The market has slowed down", "Marknaden har saktat in"],
  "ng.h.ok": ["No's are part of every job search", "Avslag hör till varje jobbsökande"],
  "ng.ack": ["You've marked {n} applications as rejected. That's hard to take, so here's what the figures say about the market right now.", "Du har markerat {n} ansökningar som avslag. Det är tungt, så här är vad siffrorna säger om marknaden just nu."],
  "ng.unemp": ["Unemployment in Sweden is {u}.", "Arbetslösheten i Sverige är {u}."],
  "ng.why.tough": ["With fewer openings and more people applying for each one, even strong candidates hear no more often than usual.", "Med färre lediga jobb och fler som söker varje jobb får även starka kandidater nej oftare än vanligt."],
  "ng.why.slow": ["With fewer openings, there's more competition for each one.", "Med färre lediga jobb blir det mer konkurrens om varje jobb."],
  "ng.why.ok": ["Employers are still hiring, so a few no's are normal. It often comes down to how clearly your CV matches each ad.", "Arbetsgivarna anställer fortfarande, så några nej är normalt. Ofta handlar det om hur tydligt ditt CV matchar varje annons."],
  "ng.hope": ["Konjunkturinstitutet expects unemployment to ease to {f} in {y}.", "Konjunkturinstitutet räknar med att arbetslösheten sjunker till {f} under {y}."],
  "ng.mentor": ["While it's tight, it pays to put your effort where you stand out. The Mentor reads your CV and suggests roles you match well and skills employers ask for, so you can become a stronger candidate.",
    "När det är trångt lönar det sig att lägga krutet där du sticker ut. Mentorn läser ditt CV och föreslår jobb du matchar väl och kunskaper som arbetsgivare efterfrågar, så att du blir en starkare kandidat."],
  "ng.mentor.ok": ["The Mentor reads your CV and suggests roles you match well and skills employers in your field ask for. It can show where a small change makes you stand out.",
    "Mentorn läser ditt CV och föreslår jobb du matchar väl och kunskaper som arbetsgivare inom ditt yrkesområde efterfrågar. Den kan visa var en liten förändring gör att du sticker ut."],
  "ng.nomentor": ["The Market tab shows how your field compares with the rest of the job market.", "Fliken Marknaden visar hur ditt yrkesområde står sig mot resten av jobbmarknaden."],
  "ng.go.mentor": ["Get ideas from the Mentor", "Få idéer av Mentorn"], "ng.go.market": ["See the market for {field}", "Se marknaden för {field}"], "ng.go.marketall": ["See the job market", "Se jobbmarknaden"],
  "ng.later": ["Not now", "Inte nu"],
  "ng.src": ["From Platsbanken ({months}) and official statistics ({month}).", "Från Platsbanken ({months}) och officiell statistik ({month})."],
  "ng.src.nat": ["From official statistics ({month}).", "Från officiell statistik ({month})."],
});

/* ---------- Fields, places and formatting ---------- */
const MK_EN = { "X82t_awd_Qyc": "Administration, finance and law", "j7Cq_ZJe_GkT": "Construction and civil engineering", "bh3H_Y3h_5eD": "Managers and executives",
  "apaJ_2ja_LuF": "IT", "RPTn_bxG_ExZ": "Sales, purchasing and marketing", "PaxQ_o1G_wWH": "Crafts and trades", "ScKy_FHB_7wT": "Hotels, restaurants and catering",
  "NYW6_mP6_vwf": "Health care", "wTEr_CBC_bqh": "Manufacturing and production", "yhCP_AqT_tns": "Installation, operations and maintenance",
  "Uuf1_GMh_Uvw": "Hair and beauty", "9puE_nYg_crq": "Culture, media and design", "bH5L_uXD_ZAX": "Military", "VuuL_7CH_adj": "Farming, forestry and animal care",
  "kJeN_wmw_9wX": "Natural sciences", "MVqp_eS8_kDZ": "Teaching and childcare", "whao_Q6A_ScE": "Cleaning and waste", "E7hm_BLq_fqZ": "Security",
  "ASGV_zcE_bWf": "Transport, distribution and warehouse", "GazW_2TU_kJw": "Social work and care", "6Hq3_tKo_V57": "Engineering and technical work" };
// Where an industry figure lines up with a field: ManpowerGroup's groups, SCB's employment by industry, Konjunkturinstitutet's sectors
const MK_LINKS = {
  "apaJ_2ja_LuF": { outlook: "IT and tech", scb: "Information and communication", ki: "Services", consulting: true },
  "6Hq3_tKo_V57": { engineers: true, scb: "Professional and technical services", consulting: true },
  "wTEr_CBC_bqh": { outlook: "Manufacturing, automotive and defence", scb: "Manufacturing", ki: "Manufacturing" },
  "X82t_awd_Qyc": { scb: "Professional and technical services", ki: "Services" },
  "RPTn_bxG_ExZ": { ki: "Services" }, "ScKy_FHB_7wT": { ki: "Services" }, "ASGV_zcE_bWf": { ki: "Services" },
};
const MK_NAMES = {   // the package's English labels, in both languages ([sentence form, label form])
  "IT and tech": ["IT and tech", "IT och teknik"], "Services and consulting": ["Services and consulting", "Tjänster och konsulter"],
  "Manufacturing, automotive and defence": ["Manufacturing, automotive and defence", "Tillverkning, fordon och försvar"], "All employers": ["All employers", "Alla arbetsgivare"],
  "Stockholm and Uppsala": ["Stockholm and Uppsala", "Stockholm och Uppsala"], "Västra Götaland": ["Västra Götaland", "Västra Götaland"], "Skåne and Blekinge": ["Skåne and Blekinge", "Skåne och Blekinge"],
  "Information and communication": ["information and communication", "information och kommunikation"], "Manufacturing": ["manufacturing", "tillverkningen"],
  "Professional and technical services": ["professional and technical services", "företagstjänster"], "Services": ["services", "tjänstesektorn"], "All businesses": ["all businesses", "hela näringslivet"],
};
const mkName = k => (MK_NAMES[k] || [k, k])[L()];
const MK_OUTLOOK_REGION = { "Stockholm": "Stockholm and Uppsala", "Uppsala": "Stockholm and Uppsala", "Västra Götaland": "Västra Götaland", "Skåne": "Skåne and Blekinge", "Blekinge": "Skåne and Blekinge" };
const MK_MONTHS = [["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"]];
const MK_FIELD_IDS = new Set(MK_FIELDS.map(f => f[1]));
const fieldName = id => { const f = MK_FIELDS.find(x => x[1] === id); return f ? (L() ? f[0] : MK_EN[id] || f[0]) : ""; };
// An ad's or a saved application's field: its JobTech id, or its Swedish label looked up in the list
const mkFieldOf = x => x && MK_FIELD_IDS.has(x.fieldId) ? x.fieldId : ((MK_FIELDS.find(f => fold(f[0]) === fold(x?.field)) || [])[1] || "");
const mkNum = n => Math.round(n).toLocaleString(numLoc());
const mkPct = (x, signed) => { const n = Math.round(Math.abs(x) * 100); return (signed && n ? (x < 0 ? "−" : "+") : "") + n + (L() ? " %" : "%"); };
const mkRate = v => (+v).toLocaleString(numLoc(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + (L() ? " %" : "%");
const mkSigned = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toLocaleString(numLoc());
function mkYm(s) {
  let m = /^(\d{4})-(\d{2})/.exec(s || ""); if (m) return { y: +m[1], m: +m[2] - 1 };
  m = /^([A-Za-z]{3})[a-z]* (\d{4})$/.exec(s || ""); if (!m) return null;
  const i = MONTHS[0].findIndex(x => fold(x) === fold(m[1])); return i < 0 ? null : { y: +m[2], m: i };
}
const mkMonth = s => { const p = mkYm(s); return p ? `${MK_MONTHS[L()][p.m]} ${p.y}` : s || ""; };
const mkShortMonth = s => { const p = mkYm(s); return p ? `${MONTHS[L()][p.m]} ${p.y}` : s || ""; };
const mkQuarter = s => { const m = /^(\d{4}) Q([1-4])$/.exec(s || ""); return !m ? s || "" : L() ? `${m[2]}:${+m[2] < 3 ? "a" : "e"} kvartalet ${m[1]}` : `Q${m[2]} ${m[1]}`; };
const mkRows = id => MK?.[id]?.rows || [];
const mkDate = d => fmtDate(String(d || "").slice(0, 10));

/* ---------- The months the counts cover: the three full months before the 1st they were counted, and a year earlier ---------- */
function mkWin(w) {
  const d = x => new Date(x + "T12:00:00"), start = d(w.from), end = d(w.to), name = x => MK_MONTHS[L()][x.getMonth()];
  const label = () => start.getFullYear() === end.getFullYear() ? (L() ? `${name(start)}–${name(end)} ${end.getFullYear()}` : `${name(start)} to ${name(end)} ${end.getFullYear()}`)
    : (L() ? `${name(start)} ${start.getFullYear()}–${name(end)} ${end.getFullYear()}` : `${name(start)} ${start.getFullYear()} to ${name(end)} ${end.getFullYear()}`);
  return { ...w, label };
}

/* ---------- The official national figures from the package ---------- */
function mkNational() {
  const now = mkRows("national_now"), find = k => now.find(r => r.metric === k);
  const post = find("New job postings"), unemp = find("Unemployment, seasonally adjusted"), reg = find("Registered unemployed"), notice = find("Redundancy notices");
  const year = new Date().getFullYear(), fc = mkRows("national_yearly").find(r => r.kind === "forecast" && r.year === year + 1);
  return { post, unemp, reg, notice, change: post && post.year_ago ? post.value / post.year_ago - 1 : null, month: post?.period || "", forecast: fc || null };
}

/* ---------- This month's counts, made on the 1st by market.py ---------- */
// Below these the year-on-year comparison is too noisy to show (counting noise alone moves it by about ±18% at 200 against 300),
// and below MK_ROUGH ads it's shown with a note that it's a rough guide
const MK_SMALL_NOW = 200, MK_SMALL_PREV = 300, MK_ROUGH = 600;
const MK_REGIONS = MK?.regions || [];   // [county, JobTech id] for the 21 counties counted with every field
const mkRegionName = id => (MK_REGIONS.find(r => r[1] === id) || [])[0] || "";
// The field in the place, the wider slices around it and all of Sweden. Each slice's change on a year earlier is its own
// change divided by the change for all of Sweden (which cancels out the archive's coverage), times the official change.
function mkSummary(field, region) {
  const c = MK?.counts; if (!c || !c.n || !c.window) return null;
  const nat = mkNational(), slices = [];
  for (const [f, r] of [[field, region], [field, ""], ["", region], ["", ""]]) if (!slices.some(s => s.field === f && s.region === r)) slices.push({ field: f, region: r });
  for (const s of slices) {
    const v = c.n[s.field + "|" + s.region] || [];
    [s.hist, s.live, s.prev, s.open] = v;   // closed ads in the archive, ads still open, the same months a year earlier, all open ads on the 1st
    s.known = v.length === 4 && v.slice(0, 3).every(x => x != null);
    s.now = s.known ? s.hist + s.live : null;
  }
  const all = slices[slices.length - 1], allRatio = all.known && all.prev ? all.now / all.prev : 0;
  for (const s of slices) {
    s.small = !s.known || s.now < MK_SMALL_NOW || s.prev < MK_SMALL_PREV || !allRatio;
    s.rel = s.small ? null : (s.now / s.prev) / allRatio;
    s.est = s.rel == null || nat.change == null ? null : (1 + nat.change) * s.rel - 1;
    // A field in a county is a share of that county's ads; anything else is a share of all of Sweden's
    const base = s.field && s.region ? slices.find(x => !x.field && x.region === s.region) : all;
    s.shareIn = base === all ? "" : s.region;
    s.share = s.known && base?.known && base.now ? s.now / base.now : null; s.sharePrev = s.known && base?.known && base.prev ? s.prev / base.prev : null;
  }
  all.est = nat.change;   // all of Sweden is the official figure itself
  // The figure the verdict goes by: the slice asked for, or the nearest wider one with enough ads
  const basis = slices.find(s => s.est != null) || null;
  return { field, region, w: mkWin(c.window), on: c.on, slices, main: slices[0], basis, all, nat };
}
const mkMood = e => e == null ? null : e <= -0.15 ? "tough" : e <= -0.05 ? "slow" : e < 0.05 ? "steady" : "busy";

/* ---------- Which field and place ---------- */
let mkPick = store.get("jf-market", {});   // { field, region } picked in the tab; missing = follow the searches
// The field the person's applications are in, or failing that the one most of their search results are in
function mkGuess(only) {
  const fromApps = Object.values(apps).filter(x => only ? x.status === only : x.status && x.status !== "Not interested")
    .map(x => mkFieldOf(x.snap) || mkFieldOf(results?.ads.find(a => a.url === x.snap?.url))).filter(Boolean);
  if (fromApps.length) return mode(fromApps);
  return only ? "" : mode((results?.ads || []).map(mkFieldOf).filter(Boolean)) || "";
}
// A county's short name ("Västra Götaland"), for ManpowerGroup's regions
const mkShort = label => (Object.entries(COUNTY_FULL).find(([, f]) => f === label) || [])[0] || "";
// The county of the last search, short name
function mkSearchCounty() {
  const g = results?.geo; if (!g) return "";
  return g.mode === "county" ? mkShort(g.label) : (MUNIS.find(([m]) => fold(m) === fold(g.muni || g.label)) || [])[1] || "";
}
function mkSel() {
  const guess = mkGuess();
  const field = mkPick.field !== undefined && (mkPick.field === "" || MK_FIELD_IDS.has(mkPick.field)) ? mkPick.field : guess;
  const region = mkPick.region && MK_REGIONS.some(r => r[1] === mkPick.region) ? mkPick.region : "";
  return { field, region, guessed: mkPick.field === undefined && !!guess };
}
const mkPlaceName = region => region ? mkRegionName(region) : t("mk.sweden");
const mkCurrent = () => { const { field, region } = mkSel(); return mkSummary(field, region); };

/* ---------- The tab ---------- */
function showMarket() { mkFillControls(); renderMarket(); }
function mkFillControls() {
  const fs = $("mk-field"), ps = $("mk-place"); if (!fs || !ps) return;
  const { field, region } = mkSel();
  fs.innerHTML = `<option value="">${esc(t("mk.allfields"))}</option>` + MK_FIELDS.map(([, id]) => [id, fieldName(id)]).sort((a, b) => a[1].localeCompare(b[1], lang))
    .map(([id, n]) => `<option value="${esc(id)}"${id === field ? " selected" : ""}>${esc(n)}</option>`).join("");
  ps.innerHTML = `<option value="">${esc(t("mk.sweden"))}</option>` + [...MK_REGIONS].sort((a, b) => a[0].localeCompare(b[0], "sv"))
    .map(([n, id]) => `<option value="${esc(id)}"${id === region ? " selected" : ""}>${esc(n)}</option>`).join("");
  ps.disabled = !MK_REGIONS.length || !MK?.counts;
}
function mkTile(label, value, sub) {
  return `<div class="mk-tile"><span class="label">${esc(label)}</span><b>${esc(value)}</b>${sub ? `<span class="mk-sub">${esc(cap(sub))}</span>` : ""}</div>`;
}
// Bars that go left for a fall and right for a rise, from one baseline, each with its value at the end. rows: { label, v, main, note }
function mkBars(rows, fmt) {
  const neg = Math.max(0, ...rows.map(r => -r.v)), pos = Math.max(0, ...rows.map(r => r.v)), span = Math.max(neg, pos) || 1;
  // Each side gets room in proportion to its largest bar (at least a quarter when it has any), as shares of 100fr
  const a = neg ? Math.max(neg, span * 0.25) : 0, b = pos ? Math.max(pos, span * 0.25) : 0;
  const cols = `${(a / (a + b) * 100).toFixed(2)}fr ${(b / (a + b) * 100).toFixed(2)}fr`;
  return `<div class="mk-bars">${rows.map(r => {
    const frac = Math.abs(r.v) / (r.v < 0 ? neg : pos || 1), bar = `<i class="mk-fill" style="width: calc((100% - 56px) * ${frac.toFixed(3)})"></i>`, val = `<span class="mk-val">${esc(fmt(r.v))}</span>`;
    return `<div class="mk-bar${r.main ? " main" : ""}"><span class="mk-bar-label">${esc(r.label)}${r.note ? ` <span class="mk-sub">${esc(r.note)}</span>` : ""}</span>
      <div class="mk-track" style="grid-template-columns: ${cols}">
        <div class="mk-half neg">${r.v < 0 ? val + bar : ""}</div><div class="mk-half pos">${r.v >= 0 ? bar + val : ""}</div></div></div>`;
  }).join("")}</div>`;
}
function mkTable(head, rows) {
  return `<details class="mk-table"><summary>${esc(t("mk.table"))}</summary><table><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`).join("")}</tr>`).join("")}</tbody></table></details>`;
}
// The verdict for the chosen field and place
function mkSentence(s, sum) {
  const nat = sum.nat;
  if (!s.field && !s.region) return nat.change == null ? "" : t(nat.change < 0 ? "mk.s.nat.down" : "mk.s.nat.up", { p: mkPct(nat.change), month: mkMonth(nat.month) });
  const where = t("mk.in", { place: s.region ? mkRegionName(s.region) : L() ? "Sverige" : "Sweden" });
  const kind = Math.abs(s.est) < 0.03 ? "same" : s.est < 0 ? "down" : "up";
  return t(`mk.s.${kind}.${s.field ? "f" : "a"}`, { p: mkPct(s.est), field: fieldName(s.field), where, months: sum.w.label() });
}
function mkVersus(s, sum) {
  const nat = sum.nat;
  if ((!s.field && !s.region) || s.rel == null || nat.change == null) return "";
  const k = s.rel <= 0.95 ? "worse" : s.rel >= 1.05 ? "better" : "same";
  return t("mk.vs." + k, { chg: t(nat.change < 0 ? "mk.fell" : "mk.rose", { p: mkPct(nat.change) }), month: mkMonth(nat.month) });
}
function mkVerdictHtml() {
  const sum = mkCurrent(), nat = mkNational();
  if (!sum) {   // before the first monthly count: the figures for Sweden only
    const natMood = mkMood(nat.change);
    return `<section class="mk-verdict" aria-labelledby="mk-verdict-h">
      ${natMood ? `<span class="mk-mood m-${natMood}">${esc(t("mk.sweden"))}</span>` : ""}
      <h2 id="mk-verdict-h">${esc(natMood ? t("mk.mood." + natMood) : t("mk.t.na"))}</h2>
      ${nat.change != null ? `<p>${esc(t(nat.change < 0 ? "mk.s.nat.down" : "mk.s.nat.up", { p: mkPct(nat.change), month: mkMonth(nat.month) }))}</p>` : ""}
      <p class="mk-sub">${esc(t("mk.nocounts"))}</p>
    </section>`;
  }
  const s = sum.main, b = sum.basis, mood = mkMood(b?.est), place = mkPlaceName(sum.region);
  const lines = [];
  if (s.est != null || (!s.field && !s.region)) { lines.push(mkSentence(s, sum)); lines.push(mkVersus(s, sum)); if (s.est != null && s.now < MK_ROUGH) lines.push(t("mk.rough", { n: mkNum(s.now) })); }
  else if (b) {
    const wider = b.field ? t("mk.wider.f", { field: fieldName(b.field) }) : b.region ? t("mk.wider.place", { place: mkRegionName(b.region) }) : t("mk.wider.nat");
    lines.push(t("mk.small", { what: s.field ? t("mk.small.fads", { field: fieldName(s.field) }) : t("mk.small.ads"), where: t("mk.in", { place }), wider }));
    lines.push(mkSentence(b, sum));
  }
  const tiles = [mkTile(t("mk.t.open", { date: mkDate(sum.on) }), s.open != null ? mkNum(s.open) : "–", [s.field ? fieldName(s.field) : t("mk.allfields"), s.region ? place : t("allswe")].join(", "))];
  if (s.field || s.region) {
    tiles.push(mkTile(t("mk.t.change"), s.est != null ? mkPct(s.est, true) : "–", s.est != null ? t("mk.t.about", { months: sum.w.label() }) : t("mk.t.na")));
    if (s.share != null && s.sharePrev != null && !s.small) tiles.push(mkTile(s.shareIn ? t("mk.t.sharein", { place: mkRegionName(s.shareIn) }) : t("mk.t.share"), mkRate(s.share * 100), t("mk.t.share.sub", { prev: mkRate(s.sharePrev * 100) })));
  } else if (nat.change != null) tiles.push(mkTile(t("mk.n.postings"), mkPct(nat.change, true), t("mk.n.postings.sub", { month: mkMonth(nat.month) })));
  return `<section class="mk-verdict" aria-labelledby="mk-verdict-h">
    <span class="mk-mood${mood ? " m-" + mood : ""}">${esc([s.field ? fieldName(s.field) : t("mk.allfields"), place].join(" · "))}</span>
    <h2 id="mk-verdict-h">${esc(mood ? t("mk.mood." + mood) : t("mk.t.na"))}</h2>
    ${lines.filter(Boolean).map(l => `<p>${esc(l)}</p>`).join("")}
    <div class="mk-tiles">${tiles.join("")}</div>
  </section>`;
}
function mkCompareHtml() {
  const sum = mkCurrent(); if (!sum || !sum.main.field && !sum.main.region) return "";
  const nat = sum.nat, rows = [];
  for (const s of sum.slices) {
    if (s.est == null) continue;
    const place = s.region ? mkRegionName(s.region) : t("allswe");
    if (!s.field && !s.region) rows.push({ label: t("mk.cmp.sweden"), v: s.est });
    else rows.push({ label: s.field ? `${fieldName(s.field)}, ${place}` : t("mk.cmp.all", { place }), v: s.est, main: s === sum.main });
  }
  if (rows.length < 2) return "";
  return `<section class="mk-card" aria-labelledby="mk-cmp-h"><h3 id="mk-cmp-h">${esc(t("mk.cmp.title"))}</h3>
    <p class="mk-sub">${esc(t("mk.cmp.sub", { months: sum.w.label(), month: mkMonth(nat.month) }))}</p>${mkBars(rows, v => mkPct(v, true))}</section>`;
}
// Unemployment by year, the forecast years lighter
function mkUnempChart() {
  const rows = mkRows("national_yearly"); if (!rows.length) return "";
  const max = Math.max(10, Math.ceil(Math.max(...rows.map(r => r.value)) / 5) * 5), fc0 = rows.find(r => r.kind === "forecast");
  const lastActual = [...rows].reverse().find(r => r.kind === "actual"), next = rows.find(r => r.kind === "forecast" && r.year === new Date().getFullYear() + 1);
  const cols = rows.map(r => {
    const tip = `${r.year} · ${t(r.kind === "forecast" ? "mk.c.forecast" : "mk.c.actual")}`, cap = r === lastActual || r === next;
    return `<div class="mk-hit" data-v="${esc(mkRate(r.value))}" data-l="${esc(tip)}"><i class="mk-col${r.kind === "forecast" ? " fc" : ""}" style="height: ${(r.value / max * 100).toFixed(1)}%">${cap ? `<span class="mk-cap">${esc(mkRate(r.value))}</span>` : ""}</i></div>`;
  }).join("");
  return `<section class="mk-card" aria-labelledby="mk-un-h"><h3 id="mk-un-h">${esc(t("mk.c.unemp"))}</h3><p class="mk-sub">${esc(t("mk.c.unemp.sub", { y: fc0?.year || "" }))}</p>
    <div class="mk-legend"><span><i class="mk-key"></i>${esc(t("mk.c.actual"))}</span><span><i class="mk-key fc"></i>${esc(t("mk.c.forecast"))}</span></div>
    <div class="mk-chart" tabindex="0" role="img" aria-label="${esc(t("mk.c.unemp") + ": " + rows.map(r => `${r.year} ${mkRate(r.value)}`).join(", "))}">
      <div class="mk-yaxis" aria-hidden="true"><span>${esc(mkRate(max).replace(/[.,]0/, ""))}</span><span>${esc(mkRate(max / 2).replace(/[.,]0/, ""))}</span><span>0</span></div>
      <div class="mk-plot"><i class="mk-gl" style="bottom: 50%"></i><i class="mk-gl" style="bottom: 100%"></i><div class="mk-colrow">${cols}</div></div>
      <div class="mk-xaxis" aria-hidden="true">${rows.map(r => `<span>’${String(r.year).slice(2)}</span>`).join("")}</div>
    </div>
    ${mkTable([t("mk.th.year"), t("mk.th.rate"), t("mk.th.kind")], rows.map(r => [r.year, mkRate(r.value), t(r.kind === "forecast" ? "mk.c.forecast" : "mk.c.actual")]))}</section>`;
}
// Redundancy notices: each month as thin columns, the trend as a line
function mkNoticeChart() {
  const rows = mkRows("redundancies"); if (rows.length < 3) return "";
  const n = rows.length, max = Math.ceil(Math.max(...rows.map(r => Math.max(r.notices, r.notices_trend))) / 2000) * 2000;
  const x = i => (i + 0.5) / n * 100, y = v => 100 - v / max * 100, last = rows[n - 1];
  const pts = rows.map((r, i) => `${x(i).toFixed(2)},${y(r.notices_trend).toFixed(2)}`).join(" ");
  const bars = rows.map((r, i) => `<rect x="${(x(i) - 100 / n * 0.3).toFixed(2)}" y="${y(r.notices).toFixed(2)}" width="${(100 / n * 0.6).toFixed(2)}" height="${(100 - y(r.notices)).toFixed(2)}" rx="0.6"/>`).join("");
  const hits = rows.map(r => `<div class="mk-hit" data-v="${esc(mkNum(r.notices))}" data-l="${esc(`${mkShortMonth(r.month)} · ${t("mk.c.trend").toLowerCase()} ${mkNum(r.notices_trend)}`)}"></div>`).join("");
  const ticks = [0, Math.floor((n - 1) / 2), n - 1];
  return `<section class="mk-card" aria-labelledby="mk-no-h"><h3 id="mk-no-h">${esc(t("mk.c.notices"))}</h3><p class="mk-sub">${esc(t("mk.c.notices.sub"))}</p>
    <div class="mk-legend"><span><i class="mk-key ctx"></i>${esc(t("mk.c.month"))}</span><span><i class="mk-key line"></i>${esc(t("mk.c.trend"))}</span></div>
    <div class="mk-chart" tabindex="0" role="img" aria-label="${esc(`${t("mk.c.notices")}: ${mkShortMonth(rows[0].month)} ${mkNum(rows[0].notices)}, ${mkShortMonth(last.month)} ${mkNum(last.notices)}, ${t("mk.c.trend").toLowerCase()} ${mkNum(last.notices_trend)}`)}">
      <div class="mk-yaxis" aria-hidden="true"><span>${esc(mkNum(max))}</span><span>${esc(mkNum(max / 2))}</span><span>0</span></div>
      <div class="mk-plot"><i class="mk-gl" style="bottom: 50%"></i><i class="mk-gl" style="bottom: 100%"></i>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g class="mk-raw">${bars}</g><polyline class="mk-line" points="${pts}" vector-effect="non-scaling-stroke"/></svg>
        <i class="mk-dot" style="left: ${x(n - 1).toFixed(2)}%; bottom: ${(100 - y(last.notices_trend)).toFixed(2)}%"></i>
        <span class="mk-endlabel" style="right: calc(${(100 - x(n - 1)).toFixed(2)}% + 8px); bottom: ${(100 - y(last.notices_trend)).toFixed(2)}%">${esc(mkNum(last.notices_trend))}</span>
        <i class="mk-cross" hidden></i><div class="mk-colrow mk-hits">${hits}</div></div>
      <div class="mk-xaxis spread" aria-hidden="true">${ticks.map(i => `<span>${esc(mkShortMonth(rows[i].month))}</span>`).join("")}</div>
    </div>
    ${mkTable([t("mk.th.month"), t("mk.th.notices"), t("mk.th.trend")], rows.map(r => [mkShortMonth(r.month), mkNum(r.notices), mkNum(r.notices_trend)]))}</section>`;
}
function mkOutlookHtml() {
  const d = MK?.hiring_outlook, rows = d?.rows || []; if (!rows.length) return "";
  const { field, region: rid } = mkSel(), link = MK_LINKS[field] || {}, region = MK_OUTLOOK_REGION[rid ? mkShort(mkRegionName(rid)) : mkSearchCounty()];
  const mine = new Set([link.outlook, region].filter(Boolean)); if (!mine.size) mine.add("All employers");
  const q = mkQuarter(d.period), plans = mkRows("hiring_plans").filter(r => r.sector === "All businesses"), kiNow = plans[plans.length - 1], kiPrev = plans[0];
  const bars = rows.map(r => ({ label: mkName(r.group), v: r.value, main: mine.has(r.group), note: r.previous != null ? t("mk.c.prev", { v: mkSigned(r.previous) }) : "" }));
  return `<section class="mk-card" aria-labelledby="mk-out-h"><h3 id="mk-out-h">${esc(t("mk.c.outlook", { q }))}</h3><p class="mk-sub">${esc(t("mk.c.outlook.sub"))}</p>
    ${mkBars(bars, mkSigned)}
    ${kiNow && kiPrev && kiNow !== kiPrev ? `<p class="mk-sub">${esc(t("mk.c.ki", { month: mkMonth(kiNow.month), v: mkSigned(kiNow.net_balance), prev: mkSigned(kiPrev.net_balance) }))}</p>` : ""}</section>`;
}
function mkNationalHtml() {
  const nat = mkNational(), tiles = [], open = mkRows("job_openings"), notices = mkRows("redundancies");
  if (nat.post) tiles.push(mkTile(t("mk.n.postings"), mkNum(nat.post.value), t("mk.n.postings.sub", { month: mkMonth(nat.post.period) }) + (nat.change != null ? " · " + t("mk.n.yago", { v: mkPct(nat.change, true) }) : "")));
  if (nat.unemp) tiles.push(mkTile(t("mk.n.unemp"), mkRate(nat.unemp.value), t("mk.n.unemp.sub", { month: mkMonth(nat.unemp.period) })));
  if (nat.notice) tiles.push(mkTile(t("mk.n.notices"), mkNum(nat.notice.value), t("mk.n.notices.sub", { month: mkMonth(nat.notice.period) }) + (nat.notice.year_ago ? " · " + t("mk.n.yago", { v: mkPct(nat.notice.value / nat.notice.year_ago - 1, true) }) : "")));
  if (open.length >= 5) { const a = open[open.length - 1], b = open[open.length - 5]; tiles.push(mkTile(t("mk.n.openings"), mkNum(a.openings_sa), t("mk.n.openings.sub", { q: mkQuarter(a.quarter) }) + " · " + t("mk.n.yago", { v: mkPct(a.openings_sa / b.openings_sa - 1, true) }))); }
  return `<section aria-labelledby="mk-nat-h"><div class="mt-block-head"><h2 id="mk-nat-h">${esc(t("mk.nat.title"))}</h2><p>${esc(t("mk.nat.sub"))}</p></div>
    <div class="mk-tiles">${tiles.join("")}</div>
    <div class="mk-grid">${mkUnempChart()}${notices.length ? mkNoticeChart() : ""}</div>
    ${mkOutlookHtml()}</section>`;
}
// Industry figures that line up with the chosen field
function mkSectorHtml() {
  const { field } = mkSel(), link = MK_LINKS[field]; if (!link) return "";
  const notes = [];
  if (link.scb) {
    const r = mkRows("tech_employment").filter(x => x.sector === link.scb);
    if (r.length >= 5) { const a = r[r.length - 1], b = r[r.length - 5]; notes.push(t("mk.sec.emp", { n: mkNum(Math.round(a.thousands * 10) * 100), sector: mkName(link.scb), chg: mkPct(a.thousands / b.thousands - 1, true), q: mkQuarter(a.quarter) })); }
  }
  if (link.outlook) {
    const o = mkRows("hiring_outlook").find(x => x.group === link.outlook), q = mkQuarter(MK.hiring_outlook.period);
    if (o) notes.push(t(o.previous != null ? "mk.sec.outlook" : "mk.sec.outlook1", { group: mkName(o.group), v: mkSigned(o.value), prev: mkSigned(o.previous ?? 0), q }));
  }
  if (link.ki) {
    const r = mkRows("hiring_plans").filter(x => x.sector === link.ki);
    if (r.length > 1) notes.push(t("mk.sec.ki", { sector: mkName(link.ki), v: mkSigned(r[r.length - 1].net_balance), month: mkMonth(r[r.length - 1].month), prev: mkSigned(r[0].net_balance) }));
  }
  if (link.engineers) {
    const u = mkRows("engineers").filter(x => x.measure === "unemployment" && x.date).sort((a, b) => a.date.localeCompare(b.date)), last = u[u.length - 1];
    const everyone = mkRows("engineers").find(x => x.measure.startsWith("compare") && x.label === "Everyone"), peak = u.reduce((p, x) => x.value > p.value ? x : p, u[0] || {});
    if (last && everyone) notes.push(t(peak.value > last.value ? "mk.sec.eng" : "mk.sec.eng1", { v: mkRate(last.value), month: mkMonth(last.date), peak: mkRate(peak.value), pm: mkMonth(peak.date), all: mkRate(everyone.value) }));
  }
  if (link.consulting) {
    const c = mkRows("consulting").filter(x => x.firms_adding_staff != null), last = c[c.length - 1];
    if (last) notes.push(t("mk.sec.cons", { n: last.firms_adding_staff, q: mkQuarter(last.quarter.replace(/^Q(\d) (\d{4})$/, "$2 Q$1")), g: (last.median_growth < 0 ? "−" : last.median_growth > 0 ? "+" : "") + mkRate(Math.abs(last.median_growth)) }));
  }
  if (!notes.length) return "";
  return `<section class="mk-card" aria-labelledby="mk-sec-h"><h3 id="mk-sec-h">${esc(t("mk.sec.title", { field: fieldName(field) }))}</h3><p class="mk-sub">${esc(t("mk.sec.sub"))}</p>
    <ul class="mk-notes">${notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></section>`;
}
function mkDoHtml() {
  const mood = mkMood(mkCurrent()?.basis?.est ?? mkNational().change), tough = mood === "tough" || mood === "slow";
  const items = [];
  if (ABOUT.tailor) items.push(`<li><span>${esc(t("mk.do.mentor"))}</span><button class="btn sm" type="button" data-mk="mentor">${esc(t("empty.mentor.go"))}</button></li>`);
  if (ABOUT.tailor) items.push(`<li><span>${esc(t("mk.do.tailor"))}</span></li>`);
  items.push(`<li><span>${esc(t("mk.do.find"))}</span><button class="btn ghost sm" type="button" data-mk="find">${esc(t("tab.res"))}</button></li>`);
  return `<section class="mk-do" aria-labelledby="mk-do-h"><h2 id="mk-do-h">${esc(t("mk.do.title"))}</h2><p>${esc(t(tough ? "mk.do.tough" : "mk.do.ok"))}</p><ul>${items.join("")}</ul></section>`;
}
function mkHowHtml() {
  const sum = mkCurrent(), srcs = ["national_now", "national_yearly", "redundancies", "job_openings", "hiring_outlook", "hiring_plans", "tech_employment", "engineers", "consulting"].filter(id => MK?.[id]);
  return `<section class="mt-how" aria-labelledby="mk-how-h"><h2 id="mk-how-h">${esc(t("mk.how"))}</h2>
    <dl>${[["field", { months: sum ? sum.w.label() : t("mk.last3") }], ["sweden", {}], ["you", {}]].map(([k, v]) => `<div><dt>${esc(t("mk.how." + k))}</dt><dd>${esc(t("mk.how." + k + ".d", v))}</dd></div>`).join("")}</dl>
    <h3 class="mk-src-h">${esc(t("mk.src"))}</h3>
    <ul class="mk-src">${sum ? `<li>${esc(t("mk.s.live"))}, ${esc(t("mk.counted", { date: mkDate(sum.on) }))}</li>` : ""}
      ${srcs.map(id => `<li>${esc(t("mk.s." + id))}, ${esc(t("mk.compiled", { date: mkDate(MK[id].as_of) }))}</li>`).join("")}</ul></section>`;
}
function marketLang() { mkFillControls(); renderMarket(); drawNudge(); }
function renderMarket() {
  const box = $("mk-body"); if (!box) return;
  const { guessed, field } = mkSel();
  const hint = $("mk-hint"); if (hint) hint.textContent = guessed ? t("mk.guessed") : field ? "" : t("mk.choose");
  box.innerHTML = mkVerdictHtml() + mkCompareHtml() + mkSectorHtml() + mkNationalHtml() + mkDoHtml() + mkHowHtml();
}

/* ---------- Hover and keyboard on the charts: one tooltip for the whole tab ---------- */
function mkTipAt(el) {
  const tip = $("mk-tip"); if (!tip || !el) return;
  tip.replaceChildren(Object.assign(document.createElement("b"), { textContent: el.dataset.v }), Object.assign(document.createElement("span"), { textContent: el.dataset.l }));
  tip.hidden = false;
  const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + "px";
  tip.style.top = Math.max(8, r.top - th - 8) + "px";
  const chart = el.closest(".mk-chart");
  chart?.querySelectorAll(".mk-hit.on").forEach(h => h.classList.remove("on")); el.classList.add("on");
  const cross = chart?.querySelector(".mk-cross"), plot = chart?.querySelector(".mk-plot");
  if (cross && plot) { const p = plot.getBoundingClientRect(); cross.hidden = false; cross.style.left = (r.left + r.width / 2 - p.left) + "px"; }
}
function mkTipOff() {
  const tip = $("mk-tip"); if (tip) tip.hidden = true;
  document.querySelectorAll("#market .mk-hit.on").forEach(h => h.classList.remove("on"));
  document.querySelectorAll("#market .mk-cross").forEach(c => { c.hidden = true; });
}

/* ---------- The pop-up after a few rejections ---------- */
// After the third rejection, then after every three more, at most once every two weeks
const NUDGE_AT = 3, NUDGE_EVERY = 3, NUDGE_GAP = 14;
let ng = null;   // { n, field, sum }
function maybeNudge() {
  const n = Object.values(apps).filter(x => x.status === "Rejected").length, last = store.get("jf-nudge", null);
  if (n < NUDGE_AT || (last && (n < last.n + NUDGE_EVERY || -daysTo(last.on) < NUDGE_GAP))) return;
  store.set("jf-nudge", { n, on: today() });
  openNudge(n);
}
function openNudge(n) {
  const field = mkGuess("Rejected") || mkSel().field;
  ng = { n, field, sum: mkSummary(field, "") };
  const d = $("nudge"); if (!d || d.open) return;
  drawNudge(); d.showModal();
  d.querySelector(".ng-go")?.focus();
}
function drawNudge() {
  const d = $("nudge"); if (!d || !ng) return;
  const nat = mkNational(), s = ng.sum?.basis && ng.sum.basis.field ? ng.sum.basis : null;
  const mood = mkMood(s ? s.est : nat.change), tough = mood === "tough" || mood === "slow";
  const data = [];
  if (s) data.push(mkSentence(s, ng.sum));
  else if (nat.change != null) data.push(t(nat.change < 0 ? "mk.s.nat.down" : "mk.s.nat.up", { p: mkPct(nat.change), month: mkMonth(nat.month) }));
  if (nat.unemp) data.push(t("ng.unemp", { u: mkRate(nat.unemp.value) }));
  data.push(t(mood === "tough" ? "ng.why.tough" : mood === "slow" ? "ng.why.slow" : "ng.why.ok"));
  if (tough && nat.forecast && nat.unemp && nat.forecast.value < nat.unemp.value) data.push(t("ng.hope", { f: mkRate(nat.forecast.value), y: nat.forecast.year }));
  const fname = ng.field ? fieldName(ng.field) : "";
  const src = s ? t("ng.src", { months: ng.sum.w.label(), month: mkMonth(nat.month) }) : t("ng.src.nat", { month: mkMonth(nat.month) });
  d.innerHTML = `<form method="dialog" class="ng">
    <div class="ng-head"><span class="label">${esc(t("ng.eyebrow"))}</span><button class="ng-x" value="close" aria-label="${esc(t("tl.close"))}">×</button></div>
    <h2 id="ng-title">${esc(t(mood === "tough" ? "ng.h.tough" : mood === "slow" ? "ng.h.slow" : "ng.h.ok"))}</h2>
    <p>${esc(t("ng.ack", { n: ng.n }))}</p>
    <div class="ng-data${tough ? " tough" : ""}">${data.map(x => `<p>${esc(x)}</p>`).join("")}</div>
    <p>${esc(t(ABOUT.tailor ? (tough ? "ng.mentor" : "ng.mentor.ok") : "ng.nomentor"))}</p>
    <div class="row">${ABOUT.tailor ? `<button class="btn ng-go" type="button" data-ng="mentor">${esc(t("ng.go.mentor"))}</button>` : ""}
      <button class="btn ${ABOUT.tailor ? "ghost" : "ng-go"}" type="button" data-ng="market">${esc(fname ? t("ng.go.market", { field: fname }) : t("ng.go.marketall"))}</button>
      <button class="btn ghost" value="close">${esc(t("ng.later"))}</button></div>
    <p class="tl-hint">${esc(src)}</p>
  </form>`;
}

/* ---------- Events ---------- */
function initMarket() {
  const m = $("market"); if (!m) return;
  m.innerHTML = `<div class="mk-controls"><label class="field"><span class="label" data-t="mk.field">${esc(t("mk.field"))}</span><select id="mk-field"></select></label>
      <label class="field"><span class="label" data-t="mk.where">${esc(t("mk.where"))}</span><select id="mk-place"></select></label><p class="mk-hint" id="mk-hint"></p></div>
    <p class="mk-live" id="mk-live" aria-live="polite"></p><div class="mk" id="mk-body"></div><div class="mk-tip" id="mk-tip" role="tooltip" hidden></div>`;
  m.addEventListener("change", e => {
    if (e.target.id === "mk-field") mkPick.field = e.target.value;
    else if (e.target.id === "mk-place") mkPick.region = e.target.value;
    else return;
    store.set("jf-market", mkPick); renderMarket();
    const live = $("mk-live"); if (live) live.textContent = $("mk-verdict-h")?.textContent || "";
  });
  m.addEventListener("click", e => {
    const b = e.target.closest("[data-mk]"); if (!b) return;
    if (b.dataset.mk === "mentor") { selectTab("mentor", true); }
    else if (b.dataset.mk === "find") { selectTab("res"); $("place").focus(); }
  });
  m.addEventListener("pointerover", e => { const h = e.target.closest(".mk-hit"); if (h) mkTipAt(h); });
  m.addEventListener("pointerout", e => { if (!e.relatedTarget || !e.relatedTarget.closest?.(".mk-hit")) mkTipOff(); });
  // A chart takes focus as a whole; the arrow keys step through its marks, with the same tooltip as hovering
  m.addEventListener("keydown", e => {
    const c = e.target.closest?.(".mk-chart"); if (!c || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const hits = [...c.querySelectorAll(".mk-hit")], i = hits.findIndex(h => h.classList.contains("on"));
    const k = e.key === "Home" ? 0 : e.key === "End" ? hits.length - 1 : i < 0 ? (e.key === "ArrowLeft" ? hits.length - 1 : 0) : Math.max(0, Math.min(hits.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)));
    mkTipAt(hits[k]);
  });
  m.addEventListener("focusout", e => { if (e.target.closest?.(".mk-chart")) mkTipOff(); });
  addEventListener("scroll", () => { const on = document.querySelector("#market .mk-hit.on"); if (on && !$("mk-tip").hidden) mkTipAt(on); }, { passive: true });
  const d = $("nudge");
  d.addEventListener("click", e => {
    const b = e.target.closest("[data-ng]"); if (!b) return;
    d.close();
    if (b.dataset.ng === "mentor") selectTab("mentor", true);
    else { if (ng?.field) { mkPick.field = ng.field; mkPick.region = ""; store.set("jf-market", mkPick); } selectTab("market", true); }
  });
}
