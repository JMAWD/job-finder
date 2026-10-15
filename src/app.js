"use strict";
/* ---------- Settings filled in by the build ---------- */
const ABOUT = /*__ABOUT__*/;   // { author, linkedin, github, repo, version, tailor }  (tailor = the tailoring server address, empty turns step 2 off)
const MUNIS = /*__MUNIS__*/;   // [municipality, county] for every Swedish municipality

/* ---------- Words in both languages ---------- */
const I18N = {
  "eyebrow": ["Job Finder · live job ads", "Job Finder · lediga jobb just nu"],
  "h1": ["Find who's hiring", "Hitta vem som anställer"],
  "lede": ["Pick a place and add the words that describe the work you want, like a job title, a skill or a method. The app searches Platsbanken and other job sites, groups the ads by employer and keeps track of where you've applied.",
    "Välj en ort och skriv orden som beskriver jobbet du vill ha, till exempel en yrkestitel, en kunskap eller en metod. Appen söker i Platsbanken och på andra jobbsajter, grupperar annonserna per arbetsgivare och håller koll på var du har sökt."],
  "country": ["Country", "Land"], "place": ["City or county", "Ort eller län"],
  "place.ph": ["e.g. Göteborg or Skåne län, empty for the whole country", "t.ex. Göteborg eller Skåne län, tomt för hela landet"],
  "distance": ["Distance", "Avstånd"], "r0": ["Only this municipality", "Bara den här kommunen"], "r10": ["Within 10 km", "Inom 10 km"], "r25": ["Within 25 km", "Inom 25 km"], "r50": ["Within 50 km", "Inom 50 km"], "r100": ["Within 100 km", "Inom 100 km"],
  "published": ["Published", "Publicerad"], "anytime": ["Any time", "När som helst"], "d1": ["Last 24 hours", "Senaste dygnet"], "d7": ["Last 7 days", "Senaste 7 dagarna"], "d30": ["Last 30 days", "Senaste 30 dagarna"],
  "keywords": ["Keywords", "Sökord"], "kw.ph": ["Type a word and press Enter, e.g. software engineer, FMEA, undersköterska", "Skriv ett ord och tryck Enter, t.ex. undersköterska, Python, FMEA"],
  "exclude": ["Leave out ads with", "Uteslut annonser med"], "ex.ph": ["e.g. senior, säljare", "t.ex. senior, säljare"],
  "o.links": ["Include other job sites", "Ta med andra jobbsajter"], "o.remote": ["Remote work possible", "Distansarbete möjligt"], "o.noexp": ["No experience needed", "Ingen erfarenhet krävs"],
  "search": ["Search", "Sök"],
  "s.co": ["employers", "arbetsgivare"], "s.op": ["matching roles", "matchande jobb"], "s.new": ["new since your last search", "nya sedan din senaste sökning"], "s.app": ["roles you're tracking", "jobb du följer"],
  "tabs.label": ["Views", "Vyer"], "tab.res": ["Employers", "Arbetsgivare"], "tab.app": ["My applications", "Mina ansökningar"],
  "filters.label": ["Filter the results", "Filtrera resultaten"], "filter": ["Filter", "Filtrera"], "filter.ph": ["Employer, role, place or contact", "Arbetsgivare, jobb, ort eller kontakt"],
  "field": ["Field", "Yrkesområde"], "allfields": ["All fields", "Alla yrkesområden"], "employment": ["Employment", "Anställning"], "any": ["Any", "Alla"], "perm": ["Permanent", "Tillsvidare"], "temp": ["Temporary", "Tidsbegränsad"],
  "sort": ["Sort", "Sortera"], "sort.roles": ["Most matching roles", "Flest matchande jobb"], "sort.newest": ["Newest ad", "Nyaste annonsen"], "sort.deadline": ["Closing soonest", "Sista ansökningsdag först"], "sort.name": ["A–Z", "A–Ö"],
  "showonly": ["Show only", "Visa bara"], "f.all": ["Ads with every keyword", "Annonser med alla sökord"], "f.new": ["New since last search", "Nya sedan senaste sökningen"], "f.direct": ["Employers hiring directly", "Arbetsgivare som anställer direkt"], "f.hidden": ["Show employers I've hidden", "Visa dolda arbetsgivare"],
  "expand": ["Expand all", "Öppna alla"], "collapse": ["Collapse all", "Stäng alla"], "expand.confirm": ["Open all {n}? Click again", "Öppna alla {n}? Klicka igen"], "export": ["Export CSV", "Exportera CSV"],
  "how": ["How this works", "Så fungerar det"],
  "foot.sources": ["<b>Sources.</b> Sweden: live ads on Platsbanken (Arbetsförmedlingen) and other Swedish job sites collected by JobTech, such as The Hub and Ledigajobb. Each search goes straight from your browser to those open services. More countries can be added later.",
    "<b>Källor.</b> Sverige: aktuella annonser i Platsbanken (Arbetsförmedlingen) och från andra svenska jobbsajter som JobTech samlar in, till exempel The Hub och Ledigajobb. Varje sökning går direkt från din webbläsare till de öppna tjänsterna. Fler länder kan läggas till senare."],
  "foot.keywords": ["<b>Keywords.</b> Each keyword is searched on its own and the results are combined, so an ad shows up if it matches any of them. Write a phrase like software engineer as it is and it's searched as a phrase. The green tags on a role show which of your keywords appear in the ad. A grey tag means Platsbanken matched the ad on a related word instead, for example a synonym or the occupation. Turn on Ads with every keyword to keep only ads that mention all of them.",
    "<b>Sökord.</b> Varje sökord söks för sig och resultaten slås ihop, så en annons visas om den matchar något av dem. Skriv en fras som undersköterska natt som den är, så söks den som en fras. De gröna etiketterna på ett jobb visar vilka av dina sökord som finns i annonsen. En grå etikett betyder att Platsbanken matchade annonsen på ett närliggande ord, till exempel en synonym eller yrket. Slå på Annonser med alla sökord för att bara behålla annonser som nämner alla."],
  "foot.place": ["<b>Place.</b> Pick a municipality and a distance, or a whole county. Distance is measured from the centre of the place you pick, so neighbouring municipalities are included.",
    "<b>Ort.</b> Välj en kommun och ett avstånd, eller ett helt län. Avståndet räknas från mitten av orten du väljer, så närliggande kommuner kommer med."],
  "foot.history": ["<b>Hiring history.</b> When you open an employer, the app checks Platsbanken's archive for the past two years. It shows how often they've advertised similar roles, which tells you whether this kind of job comes up there regularly.",
    "<b>Tidigare annonser.</b> När du öppnar en arbetsgivare kollar appen Platsbankens arkiv för de senaste två åren. Där ser du hur ofta de har annonserat liknande jobb, och alltså om den sortens jobb brukar dyka upp hos dem."],
  "foot.data": ["<b>Your data.</b> Saved roles, statuses, notes and contacts you add stay in the browser you use. Nobody else sees them and they aren't sent anywhere. Download a copy now and then to keep them safe.",
    "<b>Dina uppgifter.</b> Sparade jobb, statusar, anteckningar och kontakter du lägger till stannar i webbläsaren du använder. Ingen annan ser dem och de skickas ingenstans. Ladda ner en kopia ibland så att de inte försvinner."],
  "foot.backup": ["Back up or restore your saved data", "Säkerhetskopiera eller läs in dina sparade uppgifter"],
  "about": ["About Job Finder", "Om Job Finder"],
  "about.indep": ["Job Finder is a free, independent tool. It is not made by, affiliated with or endorsed by Arbetsförmedlingen. Job ads come from Arbetsförmedlingen's open data, published through <a href=\"https://jobtechdev.se\" target=\"_blank\" rel=\"noopener\">JobTech Dev</a>. Always check the original ad before you apply.",
    "Job Finder är ett gratis och fristående verktyg. Det är inte gjort av, kopplat till eller godkänt av Arbetsförmedlingen. Annonserna kommer från Arbetsförmedlingens öppna data, som publiceras via <a href=\"https://jobtechdev.se\" target=\"_blank\" rel=\"noopener\">JobTech Dev</a>. Kontrollera alltid originalannonsen innan du söker."],
  "about.privacy": ["<b>Privacy.</b> No account, no cookies, no tracking. The only things that leave your browser are your searches and employer logos, which go directly to Arbetsförmedlingen's open job ad services. Everything you save stays on your device.",
    "<b>Integritet.</b> Inget konto, inga kakor, ingen spårning. Det enda som lämnar din webbläsare är dina sökningar och arbetsgivarnas logotyper, som hämtas direkt från Arbetsförmedlingens öppna annonstjänster. Allt du sparar stannar på din enhet."],
  "credit": ["Made by {name}.", "Gjord av {name}."], "credit.code": ["Source code on GitHub", "Källkoden på GitHub"], "version": ["Version {v}", "Version {v}"],

  // Step 2: tailoring an application
  "about.privacy.ai": ["<b>Privacy.</b> No account, no cookies, no tracking. Your searches and employer logos go directly to Arbetsförmedlingen's open job ad services. Your CV and a job ad leave your browser only when you press Generate in step 2: they go to the Job Finder server and on to an AI model hosted by Scaleway in Paris, which writes the answer. The server keeps no copy. Everything you save stays on your device.",
    "<b>Integritet.</b> Inget konto, inga kakor, ingen spårning. Dina sökningar och arbetsgivarnas logotyper hämtas direkt från Arbetsförmedlingens öppna annonstjänster. Ditt CV och en annons lämnar webbläsaren bara när du trycker på Skapa i steg 2: då skickas de till Job Finders server och vidare till en AI-modell hos Scaleway i Paris, som skriver svaret. Servern sparar ingen kopia. Allt du sparar stannar på din enhet."],
  "tl.open": ["Tailor my application", "Anpassa min ansökan"],
  "tl.eyebrow": ["Step 2 · tailor your application", "Steg 2 · anpassa din ansökan"], "tl.close": ["Close", "Stäng"],
  "tl.ad": ["The job ad", "Annonsen"], "tl.ad.ph": ["Paste the full job ad here", "Klistra in hela annonsen här"], "tl.ad.loading": ["Fetching the full ad…", "Hämtar hela annonsen…"],
  "tl.ad.hint": ["Fetched from Platsbanken. You can edit it, for example to cut parts that don't matter.", "Hämtad från Platsbanken. Du kan ändra i den, till exempel stryka delar som inte spelar roll."],
  "tl.ad.hintlinks": ["This ad is on {site}, so only a short extract is shown. Open the ad and paste the full text here for a much better result.", "Annonsen ligger på {site}, så här syns bara ett kort utdrag. Öppna annonsen och klistra in hela texten här för ett mycket bättre resultat."],
  "tl.cv": ["Your CV", "Ditt CV"], "tl.cv.ph": ["Paste your CV as text, or load a Word file", "Klistra in ditt CV som text, eller hämta en Word-fil"],
  "tl.cv.hint": ["Kept in this browser and reused for every job.", "Sparas i den här webbläsaren och används för alla jobb."],
  "tl.load": ["Load from file", "Hämta från fil"],
  "tl.loaded": ["Loaded {name}. Check that the text looks right.", "Hämtade {name}. Kontrollera att texten ser rätt ut."],
  "tl.loadfail": ["Couldn't read that file. Open it in Word, select all, copy and paste it here.", "Kunde inte läsa filen. Öppna den i Word, markera allt, kopiera och klistra in här."],
  "tl.pdf": ["PDF files can't be read here. Open the PDF, select all the text, copy and paste it here, or save the CV as a Word file.", "PDF-filer går inte att läsa här. Öppna PDF:en, markera all text, kopiera och klistra in här, eller spara CV:t som Word-fil."],
  "tl.code": ["Access code", "Åtkomstkod"], "tl.lang": ["Write in", "Skriv på"],
  "tl.code.hint": ["The AI step is a free beta. Ask {who} for an access code.", "AI-steget är en gratis beta. Be {who} om en åtkomstkod."],
  "tl.code.who": ["the person who shared Job Finder with you", "den som delade Job Finder med dig"],
  "tl.extra": ["Anything to add? (optional)", "Något att lägga till? (valfritt)"],
  "tl.extra.ph": ["e.g. keep it short, mention that I can start in March", "t.ex. håll det kort, nämn att jag kan börja i mars"],
  "tl.what": ["What to write", "Vad ska skrivas"],
  "tl.t.match": ["Match check", "Matchning"], "tl.t.cv": ["Tailored CV", "Anpassat CV"], "tl.t.letter": ["Cover letter", "Personligt brev"], "tl.t.interview": ["Interview prep", "Intervjuförberedelse"],
  "tl.d.match": ["How well your CV fits this ad, what's missing, and which words from the ad to use where they're true.", "Hur väl ditt CV passar annonsen, vad som saknas och vilka ord från annonsen du kan använda där de stämmer."],
  "tl.d.cv": ["A new profile text, key skills and rewritten bullet points aimed at this job. Copy the parts you like into your own CV.", "En ny profiltext, nyckelkompetenser och omskrivna punkter riktade mot jobbet. Kopiera det du gillar till ditt eget CV."],
  "tl.d.letter": ["A cover letter of 250–350 words built only on what's in your CV.", "Ett personligt brev på 250–350 ord som bara bygger på det som står i ditt CV."],
  "tl.d.interview": ["Likely questions with points for your answers, the hardest ones for you, and questions to ask them.", "Troliga frågor med stödpunkter för dina svar, de svåraste för just dig och frågor att ställa till dem."],
  "tl.go": ["Generate", "Skapa"], "tl.again": ["Generate again", "Skapa igen"], "tl.busy": ["Writing…", "Skriver…"],
  "tl.wait": ["Usually 20–60 seconds · {s} s", "Brukar ta 20–60 sekunder · {s} s"],
  "tl.word": ["Download as Word", "Ladda ner som Word"], "tl.made": ["Made {date}", "Skapad {date}"],
  "tl.check": ["Read it through before you use it. The AI is told never to invent anything, but it can still get details wrong.", "Läs igenom innan du använder det. AI:n är instruerad att aldrig hitta på något, men den kan ändå få detaljer fel."],
  "tl.privacy": ["When you press Generate, your CV, the ad and your wishes are sent to the Job Finder server and on to an AI model hosted by Scaleway in Paris. The server keeps no copy. Your CV and the answers are saved only in this browser.",
    "När du trycker på Skapa skickas ditt CV, annonsen och dina önskemål till Job Finders server och vidare till en AI-modell hos Scaleway i Paris. Servern sparar ingen kopia. Ditt CV och svaren sparas bara i den här webbläsaren."],
  "tl.e.nocode": ["Enter your access code first.", "Skriv in din åtkomstkod först."],
  "tl.e.code": ["That access code wasn't accepted. Check it, or ask for a new one.", "Åtkomstkoden godkändes inte. Kontrollera den eller be om en ny."],
  "tl.e.limit": ["Your code has reached its limit ({perHour} an hour, {perDay} a day). Try again later.", "Din kod har nått sin gräns ({perHour} i timmen, {perDay} per dag). Försök igen senare."],
  "tl.e.cv": ["Your CV needs at least 200 characters. Paste the whole CV.", "Ditt CV behöver minst 200 tecken. Klistra in hela CV:t."],
  "tl.e.ad": ["The ad needs at least 100 characters. Paste the full ad text.", "Annonsen behöver minst 100 tecken. Klistra in hela annonstexten."],
  "tl.e.long": ["The CV or the ad is longer than 20,000 characters. Shorten it and try again.", "CV:t eller annonsen är längre än 20 000 tecken. Korta ner och försök igen."],
  "tl.e.origin": ["The tailoring server doesn't accept requests from this page yet. Tell the person who gave you the code.", "Servern tar inte emot anrop från den här sidan än. Säg till den som gav dig koden."],
  "tl.e.service": ["The AI service couldn't answer right now. Try again in a minute.", "AI-tjänsten kunde inte svara just nu. Försök igen om en minut."],
  "tl.e.timeout": ["It took too long to get an answer. Try again.", "Det tog för lång tid att få svar. Försök igen."],
  "tl.e.network": ["Couldn't reach the tailoring server. Check your connection and try again.", "Kunde inte nå servern. Kontrollera din uppkoppling och försök igen."],
  "tl.e.other": ["Something went wrong with the request. Try again.", "Något gick fel med förfrågan. Försök igen."],

  // Search messages
  "need.input": ["Add at least one keyword or a place, otherwise the search covers every job ad in the country.", "Lägg till minst ett sökord eller en ort, annars blir det alla jobbannonser i hela landet."],
  "p.place": ["Finding the place…", "Letar upp orten…"], "p.pb": ["Searching Platsbanken…", "Söker i Platsbanken…"], "p.pbn": ["Searching Platsbanken… {n} ads", "Söker i Platsbanken… {n} annonser"],
  "p.links": ["Checking other job sites…", "Kollar andra jobbsajter…"], "p.linksn": ["Checking other job sites… {n} ads", "Kollar andra jobbsajter… {n} annonser"],
  "found": ["Found {roles} at {emps} in {place}{around}.", "Hittade {roles} hos {emps} i {place}{around}."],
  "roles1": ["{n} matching role", "{n} matchande jobb"], "rolesN": ["{n} matching roles", "{n} matchande jobb"],
  "emps1": ["{n} employer", "{n} arbetsgivare"], "empsN": ["{n} employers", "{n} arbetsgivare"],
  "around": [" and {r} km around", " med omnejd ({r} km)"],
  "new0": [" None of them are new since your last search.", " Inga av dem är nya sedan din senaste sökning."],
  "new1": [" {n} of them is new since your last search.", " {n} av dem är ny sedan din senaste sökning."], "newN": [" {n} of them are new since your last search.", " {n} av dem är nya sedan din senaste sökning."],
  "links1": [" {n} comes from other job sites.", " {n} kommer från andra jobbsajter."], "linksN": [" {n} come from other job sites.", " {n} kommer från andra jobbsajter."],
  "links.fail": [" Other job sites couldn't be read this time, so only Platsbanken is shown.", " Andra jobbsajter gick inte att läsa den här gången, så bara Platsbanken visas."],
  "capped": [" Very broad keywords stop at {max} ads each ({list}), so add a word or narrow the place to see everything.", " Väldigt breda sökord stannar vid {max} annonser var ({list}). Lägg till ett ord eller välj en mindre ort för att se allt."],
  "nokw": ["(no keyword)", "(inget sökord)"],
  "nosave": [" Your browser blocked saving, so the results are lost when you close the page.", " Webbläsaren blockerade sparandet, så resultaten försvinner när du stänger sidan."],
  "unchanged": [" Your earlier results are unchanged.", " Dina tidigare resultat finns kvar."],
  "e.place": ["Couldn't find \"{place}\" in Platsbanken. Pick a municipality or county from the list, or leave the place empty to search the whole country.", "Hittade inte \"{place}\" i Platsbanken. Välj en kommun eller ett län i listan, eller lämna orten tom för att söka i hela landet."],
  "e.embedded": ["The search can't connect from inside this preview, because the app showing it blocks internet access. Download the file, open it in Chrome or Edge, and search there.", "Sökningen kan inte ansluta härifrån, eftersom appen som visar sidan stoppar internettrafik. Ladda ner filen, öppna den i Chrome eller Edge och sök där."],
  "e.offline": ["Your computer seems to be offline. Connect to the internet and try again.", "Datorn verkar vara offline. Anslut till internet och försök igen."],
  "e.network": ["Your browser couldn't reach Platsbanken's data service ({host}). If the file is open inside another app, open it in Chrome or Edge instead. On a work network the site may be blocked; try another network.", "Webbläsaren nådde inte Platsbankens datatjänst ({host}). Om filen är öppen i en annan app, öppna den i Chrome eller Edge i stället. På ett jobbnätverk kan tjänsten vara blockerad, så prova ett annat nätverk."],
  "e.http": ["Platsbanken's data service ({host}) answered with an error ({status}). Try again in a few minutes.", "Platsbankens datatjänst ({host}) svarade med ett fel ({status}). Försök igen om några minuter."],
  "e.other": ["The search hit an unexpected problem ({msg}).", "Sökningen stötte på ett oväntat problem ({msg})."],
  "allswe": ["all of Sweden", "hela Sverige"], "last": ["Last search {date} at {time}", "Senaste sökning {date} kl. {time}"],

  // Results
  "empty.title": ["Start with a search", "Börja med en sökning"],
  "empty.text": ["Pick a place, add one or more keywords and press Search. Keywords can be job titles, skills, tools or methods, for example \"barnskötare\", \"Python\", \"FMEA\" or \"lean\". The results stay here until you search again.",
    "Välj en ort, lägg till ett eller flera sökord och tryck Sök. Sökord kan vara yrkestitlar, kunskaper, verktyg eller metoder, till exempel \"barnskötare\", \"Python\", \"FMEA\" eller \"lean\". Resultaten ligger kvar här tills du söker igen."],
  "nomatch.title": ["Nothing matches these filters", "Inget matchar filtren"], "nomatch.text": ["Clear the filter box or the Show only options to see more.", "Töm filterrutan eller Visa bara-valen för att se fler."],
  "count.all": ["Showing {n} employer", "Visar {n} arbetsgivare"], "count.allN": ["Showing {n} employers", "Visar {n} arbetsgivare"], "count.some": ["Showing {v} of {n} employers", "Visar {v} av {n} arbetsgivare"],
  "note": ["Results for {terms} in {place}{radius}{ex}.", "Resultat för {terms} i {place}{radius}{ex}."], "note.all": ["all jobs", "alla jobb"], "note.ex": [", leaving out {ex}", ", utan {ex}"],
  "noname": ["Employer not named", "Arbetsgivare saknas"],
  "new": ["New", "Ny"], "newemp": ["New employer", "Ny arbetsgivare"], "tracking": ["Tracking {n}", "Du följer {n}"], "staffing": ["Staffing or recruitment", "Bemanning eller rekrytering"], "hiddenchip": ["Hidden", "Dold"],
  "co.roles1": ["{n} matching role", "{n} matchande jobb"], "co.rolesN": ["{n} matching roles", "{n} matchande jobb"], "co.newest": ["Newest {date}", "Nyaste {date}"], "co.closing": ["First deadline {date}", "Närmaste sista dag {date}"], "co.more": ["+{n} more", "+{n} till"],
  "showroles": ["Show roles at {name}", "Visa jobb hos {name}"],
  "posted": ["Posted {date}", "Publicerad {date}"], "applyby": ["Apply by {date}", "Sök senast {date}"], "atwp": ["at {name}", "hos {name}"], "onsite": ["On {site}", "På {site}"], "othersite": ["another job site", "en annan jobbsajt"],
  "recad": ["Recruiter's ad", "Rekryterarens annons"], "forclient": ["For one of their clients", "Åt en av deras kunder"], "noexp": ["No experience needed", "Ingen erfarenhet krävs"],
  "matches": ["Matches", "Matchar"], "loose.title": ["Platsbanken matched this ad on a related word", "Platsbanken matchade annonsen på ett närliggande ord"],
  "hist.n1": ["Advertised similar roles {n} time in the past 2 yrs", "Har annonserat liknande jobb {n} gång de senaste 2 åren"], "hist.nN": ["Advertised similar roles {n} times in the past 2 yrs", "Har annonserat liknande jobb {n} gånger de senaste 2 åren"],
  "hist.first": ["First ad of this kind from them in 2 yrs", "Deras första annons av det här slaget på 2 år"],
  "howapply": ["How to apply", "Så söker du"], "readad": ["Read the ad", "Läs annonsen"], "status": ["Status", "Status"], "notracked": ["No status", "Ingen status"],
  "note.ph": ["Notes: who you talked to, what you sent, next step…", "Anteckningar: vem du pratade med, vad du skickade, nästa steg…"], "note.aria": ["Notes for {title}", "Anteckningar för {title}"],
  "saved": ["Saved in this browser", "Sparat i den här webbläsaren"], "blocked": ["Your browser blocked saving.", "Webbläsaren blockerade sparandet."],
  "contactin": ["Contact in this ad:", "Kontakt i annonsen:"], "recruiter.lc": ["recruiter", "rekryterare"],
  "contacts": ["Contacts", "Kontakter"], "nocontacts": ["No contact person is named in these ads.", "Ingen kontaktperson nämns i de här annonserna."],
  "li.company": ["Find people at {name} on LinkedIn", "Hitta anställda hos {name} på LinkedIn"], "li.find": ["Find on LinkedIn", "Hitta på LinkedIn"], "li.add": ["Add link", "Lägg till länk"], "li.change": ["Change", "Ändra"], "li.profile": ["LinkedIn profile", "LinkedIn-profil"],
  "li.ph": ["Paste the LinkedIn profile link", "Klistra in länken till LinkedIn-profilen"], "li.aria": ["LinkedIn profile link for {n}", "Länk till LinkedIn-profil för {n}"], "li.bad": ["Needs a linkedin.com/in/… profile link", "Behöver en länk till linkedin.com/in/…"],
  "li.save": ["Save link", "Spara länk"], "cancel": ["Cancel", "Avbryt"], "addcontact": ["+ Add a contact", "+ Lägg till kontakt"], "savecontact": ["Save contact", "Spara kontakt"],
  "f.name": ["Name", "Namn"], "f.role": ["Role, e.g. Team lead", "Roll, t.ex. teamledare"], "f.email": ["Email", "E-post"], "f.phone": ["Phone", "Telefon"], "f.li": ["LinkedIn profile link", "Länk till LinkedIn-profil"], "f.needname": ["Name is needed", "Namn behövs"],
  "remove": ["Remove", "Ta bort"], "remove.confirm": ["Click again to remove", "Klicka igen för att ta bort"], "remove.aria": ["Remove {t}", "Ta bort {t}"],
  "namedon": ["Named on: {roles}", "Nämns i: {roles}"], "copy": ["Copy", "Kopiera"], "copied": ["Copied", "Kopierat"], "copyfail": ["Select and copy", "Markera och kopiera"],
  "employer": ["Employer", "Arbetsgivare"], "orgnr": ["Org nr", "Org.nr"], "hist.total": ["<b>{n}</b> Platsbanken ads in 2 yrs", "<b>{n}</b> annonser i Platsbanken på 2 år"],
  "hist.loading": ["Checking two years of Platsbanken ads…", "Kollar två års annonser i Platsbanken…"], "hist.failed": ["The 2-year history couldn't be loaded.", "Historiken för 2 år kunde inte hämtas."], "hist.later": ["History loads when you open the employer.", "Historiken hämtas när du öppnar arbetsgivaren."],
  "agency.fact": ["Staffing or recruitment firm. Its ads are usually for jobs at other companies.", "Bemannings- eller rekryteringsföretag. Annonserna gäller oftast jobb hos andra företag."],
  "hide": ["Hide this employer", "Dölj arbetsgivaren"], "unhide": ["Show this employer again", "Visa arbetsgivaren igen"],

  // Applications and backup
  "apps.empty.title": ["Nothing tracked yet", "Inget sparat än"],
  "apps.empty.text": ["Open an employer and set a role to Saved, Applied or another status. It shows up here and stays even when you search for something else.", "Öppna en arbetsgivare och ge ett jobb statusen Sparad, Sökt eller någon annan. Det hamnar här och ligger kvar även när du söker efter något annat."],
  "updated": ["Updated {date}", "Uppdaterad {date}"], "notlive": ["Not in your current results", "Finns inte i dina nuvarande resultat"], "contact": ["Contact:", "Kontakt:"], "role": ["Role", "Jobb"],
  "bk.title": ["Keep a copy of your data", "Spara en kopia av dina uppgifter"],
  "bk.text": ["Your applications, notes and contacts are saved only in this browser. Download a copy now and then, so you don't lose them if you clear your browser or switch computer. You can restore the copy here on any device.",
    "Dina ansökningar, anteckningar och kontakter sparas bara i den här webbläsaren. Ladda ner en kopia ibland, så att du inte förlorar dem om du rensar webbläsaren eller byter dator. Du kan läsa in kopian här på vilken enhet som helst."],
  "bk.download": ["Download my data", "Ladda ner mina uppgifter"], "bk.restore": ["Restore from a file", "Läs in från en fil"],
  "bk.last": ["Last copy downloaded {date}.", "Senaste kopian laddades ner {date}."], "bk.never": ["No copy downloaded yet.", "Ingen kopia nedladdad än."],
  "bk.ok": ["Restored {apps}, {contacts} and {hidden}. Anything you already had is kept.", "Läste in {apps}, {contacts} och {hidden}. Det du redan hade finns kvar."],
  "bk.apps1": ["{n} tracked role", "{n} jobb"], "bk.appsN": ["{n} tracked roles", "{n} jobb"], "bk.ppl1": ["{n} contact", "{n} kontakt"], "bk.pplN": ["{n} contacts", "{n} kontakter"],
  "bk.hid1": ["{n} hidden employer", "{n} dold arbetsgivare"], "bk.hidN": ["{n} hidden employers", "{n} dolda arbetsgivare"],
  "bk.notours": ["That file isn't a Job Finder backup.", "Filen är ingen säkerhetskopia från Job Finder."], "bk.unreadable": ["The file couldn't be read.", "Filen gick inte att läsa."],
  "bk.nostore": ["Your browser blocked saving, so the restored data is lost when you close the page.", "Webbläsaren blockerade sparandet, så det inlästa försvinner när du stänger sidan."],

  // Fixed labels
  "Sweden": ["Sweden", "Sverige"],
  "Saved": ["Saved", "Sparad"], "Applied": ["Applied", "Sökt"], "Interview": ["Interview", "Intervju"], "Offer": ["Offer", "Erbjudande"], "Rejected": ["Rejected", "Avslag"], "Not interested": ["Not interested", "Inte intresserad"],
  "k.manager": ["Hiring manager", "Rekryterande chef"], "k.hr": ["HR / recruitment", "HR / rekrytering"], "k.contact": ["Named in the ad", "Nämns i annonsen"], "k.inbox": ["Shared inbox", "Gemensam inkorg"], "k.recruiter": ["Recruiter", "Rekryterare"], "k.mine": ["Added by you", "Tillagd av dig"],
  "Full time": ["Full time", "Heltid"], "Part time": ["Part time", "Deltid"],
  "csv": [["Employer", "Org nr", "Role", "Your keywords in the ad", "Field", "Municipality", "Posted", "Apply by", "Employment", "Hours", "Source", "Ad link", "How to apply", "Contacts in the ad", "Contact emails", "Contact phones", "Your contacts", "Status", "Notes"],
    ["Arbetsgivare", "Org.nr", "Jobb", "Dina sökord i annonsen", "Yrkesområde", "Kommun", "Publicerad", "Sista ansökningsdag", "Anställning", "Omfattning", "Källa", "Länk till annonsen", "Så söker du", "Kontakter i annonsen", "E-post till kontakter", "Telefon till kontakter", "Dina kontakter", "Status", "Anteckningar"]],
};
let lang = (() => { try { const v = localStorage.getItem("jf-lang"); if (v) return JSON.parse(v); } catch {} return /^sv\b/i.test(navigator.language || "") ? "sv" : "en"; })();
const L = () => (lang === "sv" ? 1 : 0);
function t(k, v = {}) { const e = I18N[k]; const s = e ? e[L()] : k; return typeof s === "string" ? s.replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "") : s; }
const tn = (n, k1, kN, v = {}) => t(n === 1 ? k1 : kN, { n, ...v });

/* ---------- Places and sources ---------- */
const COUNTY_FULL = { "Blekinge": "Blekinge län", "Dalarna": "Dalarnas län", "Gotland": "Gotlands län", "Gävleborg": "Gävleborgs län", "Halland": "Hallands län",
  "Jämtland": "Jämtlands län", "Jönköping": "Jönköpings län", "Kalmar": "Kalmar län", "Kronoberg": "Kronobergs län", "Norrbotten": "Norrbottens län",
  "Skåne": "Skåne län", "Stockholm": "Stockholms län", "Södermanland": "Södermanlands län", "Uppsala": "Uppsala län", "Värmland": "Värmlands län",
  "Västerbotten": "Västerbottens län", "Västernorrland": "Västernorrlands län", "Västmanland": "Västmanlands län", "Västra Götaland": "Västra Götalands län",
  "Örebro": "Örebro län", "Östergötland": "Östergötlands län" };
// Each country plugs in its own sources. Sweden uses JobTech's open APIs, which answer requests from any web page.
const COUNTRIES = { SE: { label: "Sweden" } };
const JS_API = "https://jobsearch.api.jobtechdev.se", HS_API = "https://historical.api.jobtechdev.se", LINKS_API = "https://links.api.jobtechdev.se";
const SE_ID = "i46j_HmG_v64";
const MAX_PER_TERM = 500, MAX_LINKS_PER_TERM = 300;
const SITE_NAMES = { "thehub.io": "The Hub", "ingenjorsjobb.se": "Ingenjörsjobb", "ledigajobb.se": "Ledigajobb", "studentjob.se": "StudentJob", "intenso.se": "Intenso", "offentligajobb.se": "Offentliga jobb", "api.workmatch.io": "Workmatch", "jobbsafari.se": "Jobbsafari", "careerbuilder.se": "CareerBuilder", "monster.se": "Monster" };
const STATUSES = ["Saved", "Applied", "Interview", "Offer", "Rejected", "Not interested"];
const ACTIVE = new Set(["Saved", "Applied", "Interview", "Offer"]);
const MONTHS = [["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"]];
const DUR = { "Tills vidare": ["Permanent", "Tillsvidare"], "6 månader eller längre": ["6+ months", "6 månader eller längre"], "6 månader – upp till 12 månader": ["6–12 months", "6–12 månader"], "3 månader – upp till 6 månader": ["3–6 months", "3–6 månader"], "11 dagar – upp till 3 månader": ["Up to 3 months", "Upp till 3 månader"], "Upp till 10 dagar": ["Up to 10 days", "Upp till 10 dagar"] };
const HOURS = { "Heltid": "Full time", "Deltid": "Part time" };
const KIND_ORDER = { manager: 0, hr: 1, contact: 2, recruiter: 3, mine: 4, inbox: 5 };
// Staffing and recruitment firms posting on behalf of someone else
const STAFFING = /bemanning|rekryter|recruit|staffing|talent|academic work|adecco|randstad|manpower|proffice|poolia|uniflex|experis|jobandtalent|\bolsen\b|perido|dfind|bravura|clevry|novare|ework|keyman|\bhays\b|michael page|robert half|incluso|framtiden|personalkoncept|logent|level recruitment|wise professionals|square it|qlose|radeptus|mero rekrytering|roi rekrytering|jurek|lernia|studentconsulting|addilon/i;
const CLIENT_TEXT = /till vår kund|för kunds räkning|vår uppdragsgivare|för vår kunds räkning|our client|on behalf of (our|a) client|vår kund\b/i;
const UNION = /fack|union|saco|sveriges ingenjörer|akademiker|ledarna|\bSI\b|IF Metall|\bTCO\b|\bLO\b|Jusek|\bDIK\b|SRAT|arbetstagarorganisation|employee representative|facklig|skyddsombud|vårdförbundet|kommunal\b|vision\b/i;
const GENERIC_MAIL = /^(recruit|rekryt|jobs?|jobb|career|karriar|karriär|hr|info|hello|hej|talent|apply|ansok|work|people|careers|support|kontakt|contact|office|admin)/i;
const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+46|0)\s?\d{1,3}[\s\-]?\d{2,3}[\s\-]?\d{2}[\s\-]?\d{2,3}/;

/* ---------- Small helpers ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = d => { if (!d) return ""; const [y, m, dd] = d.split("-"); return `${+dd} ${MONTHS[L()][+m - 1]} ${y}`; };
const fmtOrg = o => o && o.length === 10 ? o.slice(0, 6) + "-" + o.slice(6) : (o || "");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isoDay = t => new Date(t).toISOString().slice(0, 10);
const localDay = d => isoDay(d - d.getTimezoneOffset() * 60000);
const today = () => localDay(new Date());
const daysTo = d => d ? Math.round((new Date(d + "T12:00:00") - new Date(today() + "T12:00:00")) / 864e5) : null;
const fold = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const termRe = t => new RegExp("(^|[^a-z0-9])" + fold(t).trim().split(/\s+/).map(escRe).join("[\\s\\-/]+") + "($|[^a-z0-9])");
const cleanTitle = s => (s || "").replace(/\s+/g, " ").trim();
const shortName = n => (n || "").replace(/\s+(i Sverige AB|Sverige AB|Sweden AB|AB \(publ\)|Aktiebolag|\(publ\)|AB|HB|KB)$/i, "").trim();
const normName = s => fold(shortName(s || "")).replace(/\b(aktiebolag|ab|publ|sverige|sweden|group|nordic)\b/g, "").replace(/[^a-z0-9]+/g, "");
const telHref = p => "tel:" + (p || "").replace(/[^\d+]/g, "");
const inboxName = e => { const l = (e || "").split("@")[0].replace(/[._-]+/g, " ").trim(); return l ? l[0].toUpperCase() + l.slice(1) : "Inbox"; };
const siteLabel = l => { try { const h = new URL(l.url).host.replace(/^www\./, ""); return SITE_NAMES[h] || h; } catch { return l.label || ""; } };
const adUrl = id => `https://arbetsformedlingen.se/platsbanken/annonser/${id}`;
const durLabel = d => (DUR[d] || [d, d])[L()];
const hoursLabel = h => HOURS[h] ? t(HOURS[h]) : h;
const kindLabel = k => t("k." + k);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const mode = a => { const m = new Map(); let best = null, n = 0; for (const x of a) { const c = (m.get(x) || 0) + 1; m.set(x, c); if (c > n) { n = c; best = x; } } return best; };

/* ---------- State ---------- */
let results = store.get("jf-results", null);   // the last search and its ads
let apps = store.get("jf-apps", {});           // ad id -> { status, note, updatedAt, snap }
let hidden = new Set(store.get("jf-hidden", []));
let people = store.get("jf-people", {});       // employer key -> contacts you added
let links = store.get("jf-links", {});         // employer key -> { contact key -> LinkedIn link }
let openIds = new Set(store.get("jf-open", []));
const hist = new Map(Object.entries(store.get("jf-hist", {})));
const histLoading = new Set();
const addingFor = new Set(), editingLi = new Set(), noteTimers = new Map();
let terms = [], excludes = [], searching = false, companies = [], backupMsg = null;

/* ---------- Static text in the chosen language ---------- */
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-t]").forEach(el => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll("[data-th]").forEach(el => { el.innerHTML = t(el.dataset.th); });
  document.querySelectorAll("[data-tp]").forEach(el => { el.placeholder = t(el.dataset.tp); });
  document.querySelectorAll("[data-ta]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.ta)); });
  document.querySelectorAll(".lang button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  const cur = $("country").value || "SE";
  $("country").innerHTML = Object.entries(COUNTRIES).map(([k, c]) => `<option value="${k}">${esc(t(c.label))}</option>`).join("");
  $("country").value = cur;
  const parts = [];
  if (ABOUT.author) parts.push(esc(t("credit", { name: ABOUT.author })));
  const out = [ABOUT.linkedin && `<a href="${esc(ABOUT.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>`, ABOUT.github && `<a href="${esc(ABOUT.github)}" target="_blank" rel="noopener">GitHub</a>`,
    ABOUT.repo && `<a href="${esc(ABOUT.repo)}" target="_blank" rel="noopener">${esc(t("credit.code"))}</a>`].filter(Boolean);
  if (out.length) parts.push(out.join(" · "));
  if (ABOUT.version) parts.push(esc(t("version", { v: ABOUT.version })));
  $("credit").innerHTML = parts.join(" · ");
  kwBox.draw(); exBox.draw();
}
document.querySelector(".lang").addEventListener("click", e => {
  const b = e.target.closest("button[data-lang]"); if (!b || b.dataset.lang === lang) return;
  lang = b.dataset.lang; store.set("jf-lang", lang); $("msg").textContent = ""; applyLang(); render(); if (tl) drawTailor();
});

/* ---------- Search form ---------- */
$("places").innerHTML = [...Object.values(COUNTY_FULL).sort((a, b) => a.localeCompare(b, "sv")).map(c => `<option value="${esc(c)}">`), ...MUNIS.map(([m, c]) => `<option value="${esc(m)}" label="${esc(COUNTY_FULL[c] || c)}">`)].join("");
function chipInput(boxId, inputId, list, cls) {
  const box = $(boxId), input = $(inputId);
  const draw = () => {
    box.querySelectorAll(".tok").forEach(n => n.remove());
    list.forEach((x, i) => input.insertAdjacentHTML("beforebegin", `<span class="tok ${cls}">${esc(x)}<button type="button" data-i="${i}" aria-label="${esc(t("remove.aria", { t: x }))}">×</button></span>`));
  };
  const add = v => { for (const part of v.split(/[,;\n]/)) { const x = part.trim().replace(/^"|"$/g, ""); if (x && !list.some(y => fold(y) === fold(x))) list.push(x); } input.value = ""; draw(); };
  input.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === ",") && input.value.trim()) { e.preventDefault(); add(input.value); }
    else if (e.key === "Backspace" && !input.value && list.length) { list.pop(); draw(); }
  });
  input.addEventListener("blur", () => { if (input.value.trim()) add(input.value); });
  input.addEventListener("paste", e => { const x = e.clipboardData?.getData("text") || ""; if (/[,;\n]/.test(x)) { e.preventDefault(); add(x); } });
  box.addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (b) { list.splice(+b.dataset.i, 1); draw(); input.focus(); } else if (e.target === box) input.focus(); });
  return { draw, flush: () => { if (input.value.trim()) add(input.value); } };
}
const kwBox = chipInput("kw-box", "kw-input", terms, "");
const exBox = chipInput("ex-box", "ex-input", excludes, "ex");
function placeKind(raw) {
  const k = fold(raw.trim().replace(/\s+/g, " "));
  if (!k || /^(hela )?(sverige|sweden)$/.test(k)) return { kind: "all" };
  const muni = MUNIS.find(([m]) => fold(m) === k || fold(m + " kommun") === k);
  if (muni && !/\blan\b/.test(k)) return { kind: "muni", name: muni[0], county: muni[1] };
  const cty = Object.entries(COUNTY_FULL).find(([s, f]) => fold(f) === k || fold(s) === k || fold(s + " lan") === k);
  if (cty) return { kind: "county", name: cty[1], short: cty[0] };
  return { kind: "place", name: raw.trim() };
}
function syncRadius() { const k = placeKind($("place").value).kind; $("radius").disabled = k === "all" || k === "county"; }
$("place").addEventListener("input", syncRadius);
function readParams() {
  kwBox.flush(); exBox.flush();
  return { country: $("country").value, place: $("place").value.trim(), radius: +$("radius").value, since: $("since").value,
    terms: terms.slice(), excludes: excludes.slice(), links: $("o-links").checked, remote: $("o-remote").checked, noexp: $("o-noexp").checked };
}
function fillForm(p) {
  if (!p) return;
  $("country").value = p.country || "SE"; $("place").value = p.place || ""; $("radius").value = String(p.radius ?? 25); $("since").value = p.since || "";
  terms.splice(0, terms.length, ...(p.terms || [])); excludes.splice(0, excludes.length, ...(p.excludes || [])); kwBox.draw(); exBox.draw();
  $("o-links").checked = p.links !== false; $("o-remote").checked = !!p.remote; $("o-noexp").checked = !!p.noexp; syncRadius();
}
const sigOf = p => JSON.stringify([p.country, fold(p.place), placeKind(p.place).kind === "county" || placeKind(p.place).kind === "all" ? 0 : p.radius, p.since,
  p.terms.map(fold).sort(), p.excludes.map(fold).sort(), p.links, p.remote, p.noexp]);

/* ---------- Network ---------- */
class FetchError extends Error { constructor(kind, status, url) { super(kind === "http" ? `HTTP ${status}` : "connection failed"); this.kind = kind; this.status = status; this.url = url; } }
class PlaceError extends Error {}
async function getJSON(url, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    let r;
    try { r = await fetch(url, { headers: { accept: "application/json" } }); }
    catch { last = new FetchError("network", 0, url); await sleep(600 * (i + 1)); continue; }
    if (r.ok) return await r.json();
    last = new FetchError("http", r.status, url);
    if (r.status !== 429 && r.status < 500) throw last;
    await sleep(600 * (i + 1));
  }
  throw last;
}
const embedded = (() => { try { return window.top !== window.self || !/^(file|https?):$/.test(location.protocol); } catch { return true; } })();
function searchError(e) {
  if (e instanceof PlaceError) return e.message;
  const host = e && e.url ? new URL(e.url).host : "jobsearch.api.jobtechdev.se";
  if (e && e.kind === "network") return embedded ? t("e.embedded") : navigator.onLine === false ? t("e.offline") : t("e.network", { host });
  if (e && e.kind === "http") return t("e.http", { host, status: e.status });
  return t("e.other", { msg: (e && e.message) || e });
}
async function pool(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const k = next++; await fn(items[k], k); } }));
}
const progress = m => { $("progress").textContent = m; };

/* ---------- Turning a typed place into search parameters ---------- */
// Platsbanken's own ads know where they are, so a quick location search gives the place's id and centre.
async function resolvePlace(raw) {
  const pk = placeKind(raw);
  if (pk.kind === "all") return { mode: "all", label: "" };
  const cache = store.get("jf-geo", {}), key = fold(pk.name);
  if (cache[key]) return cache[key];
  const term = pk.kind === "county" ? pk.short : pk.name;
  const j = await getJSON(`${JS_API}/search?q=${encodeURIComponent(/\s/.test(term) ? `"${term}"` : term)}&qfields=location&limit=100`);
  const was = j.hits.map(h => h.workplace_address || {});
  const coords = list => { const c = list.map(w => w.coordinates).filter(c => Array.isArray(c) && c[1] > 55 && c[1] < 69.5 && c[0] > 10.5 && c[0] < 24.5); return c.length ? { lat: median(c.map(x => x[1])), lon: median(c.map(x => x[0])) } : {}; };
  let geo = null;
  if (pk.kind === "county") {
    const m = was.filter(w => fold(w.region) === fold(pk.name) && w.region_concept_id);
    if (m.length) geo = { mode: "county", label: pk.name, regionId: mode(m.map(w => w.region_concept_id)) };
  } else {
    let m = was.filter(w => fold(w.municipality) === key && w.municipality_concept_id);
    if (!m.length) m = was.filter(w => fold(w.city) === key || fold(w.city).includes(key));
    if (m.length) {
      const muniId = mode(m.map(w => w.municipality_concept_id).filter(Boolean));
      const muni = (m.find(w => w.municipality_concept_id === muniId) || {}).municipality || "";
      geo = { mode: pk.kind === "muni" ? "muni" : "point", label: pk.name, muni, muniId, regionId: mode(m.map(w => w.region_concept_id).filter(Boolean)), ...coords(m) };
    }
  }
  if (!geo) throw new PlaceError(t("e.place", { place: raw.trim() }));
  cache[key] = geo; store.set("jf-geo", cache);
  return geo;
}
function locationParam(geo, radius) {
  if (geo.mode === "all") return `country=${SE_ID}`;
  if (geo.mode === "county") return `region=${geo.regionId}`;
  if ((radius > 0 || geo.mode === "point") && geo.lat) return `position=${geo.lat.toFixed(4)},${geo.lon.toFixed(4)}&position.radius=${radius || 10}`;
  return `municipality=${geo.muniId}`;
}
const placeLabel = geo => geo.mode === "all" ? t("allswe") : geo.label;
const hasRadius = (geo, p) => p.radius && (geo.mode === "muni" || geo.mode === "point");

/* ---------- Reading ads ---------- */
function classify(title) {
  if (/hiring manager|rekryterande chef|närmaste chef/i.test(title)) return "manager";
  if (/\bHR\b|\bTA\b/.test(title) || /rekryt|recruit|talent|people|personal|human resources/i.test(title)) return "hr";
  if (/chef|manager|head|lead|ansvarig|director|\bcto\b|\bceo\b|\bcoo\b|\bvd\b|founder|grundare|rektor|enhetschef/i.test(title)) return "manager";
  return "contact";
}
function adContacts(h, agency) {
  const arr = v => Array.isArray(v) ? v : (v && typeof v === "object" ? [v] : []);
  const out = [];
  for (const x of arr(h.application_contacts)) {
    if (!x || UNION.test(`${x.description || ""} ${x.contact_type || ""} ${x.name || ""}`)) continue;
    const n = (x.name || "").trim(), e = (x.email || "").trim(), p = (x.telephone || "").trim(), ti = (x.contact_type || x.description || "").trim();
    if (!n && !e && !p) continue;
    const generic = e && GENERIC_MAIL.test(e.split("@")[0]);
    out.push({ n: n || (generic ? inboxName(e) : e), t: ti, kind: agency ? "recruiter" : (generic && !n ? "inbox" : classify(ti)), e, p });
  }
  const text = (h.description?.text || "").replace(/\s+/g, " ");
  const seen = new Set(out.map(c => fold(c.e || c.n)));
  for (const e of new Set((text.match(EMAIL_RE) || []).map(s => s.replace(/[.,;:]+$/, "")))) {
    if (seen.has(fold(e))) continue;
    seen.add(fold(e));
    const k = text.indexOf(e), local = fold(e.split("@")[0]);
    if (GENERIC_MAIL.test(local)) { out.push({ n: inboxName(e), t: "", kind: "inbox", e, p: "" }); continue; }
    const names = [...text.slice(Math.max(0, k - 170), k).matchAll(/([A-ZÅÄÖÉ][a-zåäöéü]+(?:[ \-][A-ZÅÄÖÉ][a-zåäöéü]+){1,2})/g)].map(m => m[1]);
    let name = names.reverse().find(nm => fold(nm).split(/[ \-]/).some(part => part.length >= 3 && local.includes(part)));
    if (!name) continue;
    const words = name.split(" "), start = words.findIndex(w => fold(w).split("-").some(part => part.length >= 2 && local.includes(part)));
    if (start > 0) name = words.slice(start).join(" ");
    const ctx = text.slice(Math.max(0, k - 120), k), near = text.slice(Math.max(0, k - 90), k + e.length + 60).match(PHONE_RE);
    out.push({ n: name, t: "", kind: agency ? "recruiter" : classify(ctx.slice(Math.max(0, ctx.lastIndexOf(name) - 40))), e, p: near ? near[0].trim() : "" });
  }
  return out;
}
function fromPB(h) {
  const wa = h.workplace_address || {}, emp = h.employer || {}, desc = (h.description?.text || "").replace(/\s+/g, " ").trim();
  const agency = STAFFING.test(emp.name || "");
  return { id: String(h.id), src: "pb", title: cleanTitle(h.headline), employer: emp.name || "", workplace: emp.workplace || "", org: emp.organization_number || "", site: emp.url || "", logo: h.logo_url || "",
    muni: wa.municipality || "", muniId: wa.municipality_concept_id || "", region: wa.region || "", regionId: wa.region_concept_id || "",
    pub: (h.publication_date || "").slice(0, 10), deadline: (h.application_deadline || "").slice(0, 10), url: h.webpage_url || adUrl(h.id),
    apply: h.application_details?.url || "", applyEmail: h.application_details?.email || "",
    occ: h.occupation?.label || "", group: h.occupation_group?.label || "", groupId: h.occupation_group?.concept_id || "", field: h.occupation_field?.label || "",
    duration: h.duration?.label || "", hours: h.working_hours_type?.label || "", vacancies: h.number_of_vacancies || 1, exp: h.experience_required,
    agency, client: !agency && CLIENT_TEXT.test(desc), contacts: adContacts(h, agency), snippet: desc.slice(0, 500), _text: fold(`${h.headline} ${desc} ${emp.name || ""}`) };
}
function fromLinks(h) {
  const wa = (h.workplace_addresses || [])[0] || {}, link = (h.source_links || [])[0] || {}, emp = h.employer?.name || "", brief = (h.brief || "").replace(/\s+/g, " ").trim();
  return { id: "L:" + h.id, src: "links", title: cleanTitle(h.headline), employer: emp, workplace: "", org: "", site: "", logo: "",
    muni: wa.municipality || "", muniId: wa.municipality_concept_id || "", region: wa.region || "", regionId: wa.region_concept_id || "",
    pub: (h.publication_date || "").slice(0, 10), deadline: "", url: link.url || "", source: siteLabel(link), apply: "", applyEmail: "",
    occ: "", group: h.occupation_group?.label || "", groupId: h.occupation_group?.concept_id || "", field: h.occupation_field?.label || "",
    duration: "", hours: "", vacancies: 1, exp: null, agency: STAFFING.test(emp), client: CLIENT_TEXT.test(brief), contacts: [], snippet: brief.slice(0, 500), _text: fold(`${h.headline} ${brief} ${emp}`) };
}

/* ---------- The search ---------- */
async function runSearch() {
  if (searching) return;
  const p = readParams();
  $("msg").textContent = ""; $("msg").className = "msg";
  if (!p.terms.length && placeKind(p.place).kind === "all") { $("msg").textContent = t("need.input"); $("kw-input").focus(); return; }
  searching = true; $("go").disabled = true;
  try {
    progress(t("p.place"));
    const geo = await resolvePlace(p.place);
    const loc = locationParam(geo, p.radius);
    const extra = (p.since ? `&published-after=${p.since}` : "") + (p.remote ? "&remote=true" : "") + (p.noexp ? "&experience=false" : "");
    const exRes = p.excludes.map(termRe);
    const queries = p.terms.length ? p.terms : [""];
    const ads = new Map(), capped = [];
    progress(t("p.pb"));
    await pool(queries, 3, async q0 => {
      const q = q0 ? `q=${encodeURIComponent(/\s/.test(q0) ? `"${q0}"` : q0)}&` : "";
      let off = 0, total = 1;
      while (off < total && off < MAX_PER_TERM) {
        const j = await getJSON(`${JS_API}/search?${q}${loc}${extra}&limit=100&offset=${off}`);
        total = j.total.value; off += 100;
        for (const h of j.hits) {
          const a = ads.get(String(h.id)) || fromPB(h);
          (a._by || (a._by = new Set())).add(q0);
          ads.set(a.id, a);
        }
        progress(t("p.pbn", { n: ads.size }));
      }
      if (total > MAX_PER_TERM) capped.push(q0 || t("nokw"));
    });

    // Other job sites. They have no distance search, so they're read by county and kept when they're in the same places as the Platsbanken results.
    let linksOk = true, linksCount = 0;
    if (p.links) {
      try {
        const sinceDay = p.since ? isoDay(Date.now() - p.since * 60000) : "";
        const pbMunis = new Set([...ads.values()].map(a => a.muniId).filter(Boolean));
        if (geo.muniId) pbMunis.add(geo.muniId);
        const regions = geo.mode === "all" ? [""] : geo.mode === "county" ? [geo.regionId] : [...new Set([geo.regionId, ...[...ads.values()].map(a => a.regionId)].filter(Boolean))].slice(0, 4);
        const keep = h => {
          const wa = (h.workplace_addresses || [])[0];
          if (geo.mode === "all") return !wa || !wa.country || /sverige|sweden/i.test(wa.country);
          if (!wa) return false;
          if (geo.mode === "county") return wa.region_concept_id === geo.regionId;
          if (p.radius === 0 && geo.mode === "muni") return wa.municipality_concept_id === geo.muniId;
          return pbMunis.has(wa.municipality_concept_id);
        };
        progress(t("p.links"));
        await pool(queries.flatMap(q0 => regions.map(r => [q0, r])), 3, async ([q0, r]) => {
          const q = q0 ? `q=${encodeURIComponent(/\s/.test(q0) ? `"${q0}"` : q0)}&` : "";
          let off = 0, total = 1;
          while (off < total && off < MAX_LINKS_PER_TERM) {
            const j = await getJSON(`${LINKS_API}/joblinks?${q}${r ? `region=${r}&` : ""}limit=100&offset=${off}`, 3);
            total = j.total.value; off += 100;
            for (const h of j.hits) {
              if ((h.source_links || []).some(l => /arbetsformedlingen/.test(l.url || "")) || !keep(h)) continue;
              if (sinceDay && (h.publication_date || "").slice(0, 10) < sinceDay) continue;
              const a = ads.get("L:" + h.id) || fromLinks(h);
              (a._by || (a._by = new Set())).add(q0);
              ads.set(a.id, a);
            }
            progress(t("p.linksn", { n: [...ads.values()].filter(a => a.src === "links").length }));
          }
        });
      } catch (e) { linksOk = false; console.warn("Other job sites could not be read", e); }
    }

    // Leave out unwanted words and duplicates of Platsbanken ads, then note which keywords each ad really mentions
    const pbKeys = new Set([...ads.values()].filter(a => a.src === "pb").map(a => normName(a.employer) + "|" + fold(a.title)));
    const list = [];
    for (const a of ads.values()) {
      if (exRes.some(re => re.test(a._text))) continue;
      if (a.src === "links" && pbKeys.has(normName(a.employer) + "|" + fold(a.title))) continue;
      a.terms = p.terms.filter(x => termRe(x).test(a._text));
      a.loose = p.terms.filter(x => a._by.has(x) && !a.terms.includes(x));
      delete a._text; delete a._by;
      list.push(a);
      if (a.src === "links") linksCount++;
    }
    // "New" means not seen the last time this same search was run, even if other searches came in between
    const sig = sigOf(p), seen = store.get("jf-seen", {}), prev = seen[sig] || (results && results.sig === sig ? results.ads.map(a => a.id) : null);
    const prevIds = prev ? new Set(prev) : null;
    for (const a of list) a.isNew = prevIds ? !prevIds.has(a.id) : false;
    seen[sig] = list.map(a => a.id);
    store.set("jf-seen", Object.fromEntries(Object.keys(seen).slice(-20).map(k => [k, seen[k]])));
    results = { sig, at: new Date().toISOString(), params: p, geo, ads: list, linksOk, capped, rerun: !!prev };
    const saved = store.set("jf-results", results);
    store.set("jf-search", p);
    const newCount = list.filter(a => a.isNew).length, emps = buildCompanies(list).length;
    $("msg").textContent = t("found", { roles: tn(list.length, "roles1", "rolesN"), emps: tn(emps, "emps1", "empsN"), place: placeLabel(geo), around: hasRadius(geo, p) ? t("around", { r: p.radius }) : "" })
      + (prev ? (newCount ? tn(newCount, "new1", "newN") : t("new0")) : "")
      + (linksCount ? tn(linksCount, "links1", "linksN") : "")
      + (p.links && !linksOk ? t("links.fail") : "")
      + (capped.length ? t("capped", { max: MAX_PER_TERM, list: capped.join(", ") }) : "")
      + (saved ? "" : t("nosave"));
    openIds = new Set([...openIds].filter(k => list.some(a => companyKey(a) === k)));
    render();
  } catch (e) {
    console.error(e);
    $("msg").textContent = searchError(e) + (results ? t("unchanged") : ""); $("msg").className = "msg err";
  } finally {
    searching = false; $("go").disabled = false; progress("");
  }
}
$("search").addEventListener("submit", e => { e.preventDefault(); runSearch(); });

/* ---------- Employers ---------- */
const nameKeys = new Map();
function companyKey(a) { return a.org || nameKeys.get(normName(a.employer)) || "n:" + normName(a.employer); }
function buildCompanies(ads) {
  nameKeys.clear();
  for (const a of ads) if (a.org) nameKeys.set(normName(a.employer), a.org);
  const by = new Map();
  for (const a of ads) {
    const k = companyKey(a);
    if (!by.has(k)) by.set(k, { key: k, name: shortName(a.employer), org: a.org, site: a.site, logo: a.logo, agency: a.agency, ads: [] });
    const c = by.get(k);
    c.ads.push(a);
    if (!c.org && a.org) c.org = a.org; if (!c.site && a.site) c.site = a.site; if (!c.logo && a.logo) c.logo = a.logo;
  }
  for (const c of by.values()) {
    c.ads.sort((x, y) => (y.pub || "").localeCompare(x.pub || ""));
    c.munis = [...new Set(c.ads.map(a => a.muni).filter(Boolean))];
    const dls = c.ads.map(a => a.deadline).filter(d => d && d >= today()).sort();
    c.closing = dls[0] || "";
    c.isNew = !!results?.rerun && c.ads.every(a => a.isNew);
  }
  return [...by.values()];
}
const coName = c => c.name || t("noname");
function contactKey(p) { return ((p.e || p.p || p.n || "") + "").toLowerCase().replace(/\s+/g, ""); }
function companyContacts(c) {
  const map = new Map();
  for (const a of c.ads) for (const p of a.contacts || []) {
    const k = contactKey(p); if (!k) continue;
    if (!map.has(k)) map.set(k, { ...p, roles: [] });
    map.get(k).roles.push(a.title);
  }
  const list = [...map.values()];
  (people[c.key] || []).forEach((p, i) => list.push({ ...p, kind: "mine", idx: i, roles: [] }));
  const ln = links[c.key] || {};
  for (const p of list) if (!p.li && ln[contactKey(p)]) { p.li = ln[contactKey(p)]; p.liMine = true; }
  return list.sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9));
}
const liSearch = kw => "https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent(kw) + "&origin=GLOBAL_SEARCH_HEADER";
const plainName = n => (n || "").replace(/\s*\(.*?\)\s*/g, " ").trim();
const liCompanyUrl = c => liSearch(`"${plainName(c.name)}" AND (recruiter OR rekryterare OR "talent acquisition" OR HR OR chef OR manager OR "head of")`);
const liPersonUrl = (c, p) => liSearch(`"${p.n}" ${plainName(c.name)}`);
function normLi(s) {
  s = (s || "").trim();
  if (!/^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/in\/[^\s/?#]+/i.test(s)) return null;
  return s.replace(/^(?!https?:\/\/)/i, "https://").replace(/[?#].*$/, "").replace(/\/+$/, "");
}

/* ---------- Hiring history, fetched when an employer is opened ---------- */
async function loadHistory(org) {
  if (!org || histLoading.has(org)) return;
  const h = hist.get(org);
  if (h && (Date.now() - new Date(h.at)) < 7 * 864e5) return;
  histLoading.add(org);
  try {
    const from = isoDay(Date.now() - 730 * 864e5) + "T00:00:00", groups = {};
    let total = 0;
    for (let off = 0; off < 300; off += 100) {
      const j = await getJSON(`${HS_API}/search?employer=${org}&historical-from=${from}&limit=100&offset=${off}&sort=pubdate-desc`, 3);
      total = j.total.value;
      for (const x of j.hits) { const g = x.occupation_group?.concept_id || ""; (groups[g] || (groups[g] = [])).push((x.publication_date || "").slice(0, 10)); }
      if (off + 100 >= total) break;
    }
    hist.set(org, { at: new Date().toISOString(), total, groups });
  } catch (e) { hist.set(org, { at: new Date().toISOString(), failed: true }); }
  histLoading.delete(org);
  store.set("jf-hist", Object.fromEntries([...hist.entries()].slice(-150).filter(([, v]) => !v.failed)));
  rerenderCompany(companies.find(c => c.org === org)?.key);
}
function similarCount(a) {
  const h = a.org && hist.get(a.org);
  if (!h || h.failed || !a.groupId) return null;
  const cutoff = a.pub ? isoDay(new Date(a.pub) - 14 * 864e5) : today();
  return (h.groups[a.groupId] || []).filter(d => d && d <= cutoff).length;
}

/* ---------- Filtering and sorting ---------- */
const FILTERS = ["all", "new", "direct", "hidden"];
function loadPrefs() {
  const p = store.get("jf-prefs", {});
  if (p.sort) $("sort").value = p.sort; if (p.emp) $("emp").value = p.emp;
  for (const k of FILTERS) if (p[k] !== undefined) $("f-" + k).checked = p[k];
}
function savePrefs() { const p = { sort: $("sort").value, emp: $("emp").value }; for (const k of FILTERS) p[k] = $("f-" + k).checked; store.set("jf-prefs", p); }
const isPerm = a => a.duration === "Tills vidare";
function adVisible(a) {
  if ($("f-all").checked && results && a.terms.length < results.params.terms.length) return false;
  if ($("f-new").checked && !a.isNew) return false;
  if ($("f-direct").checked && (a.agency || a.client)) return false;
  const emp = $("emp").value;
  if (emp === "perm" && !isPerm(a)) return false;
  if (emp === "temp" && (!a.duration || isPerm(a))) return false;
  const fld = $("field").value;
  return !fld || a.field === fld;
}
function visible() {
  const q = fold($("q").value.trim()), showHidden = $("f-hidden").checked, list = [];
  for (const c of companies) {
    if (!showHidden && hidden.has(c.key)) continue;
    let ads = c.ads.filter(adVisible);
    if (q) {
      const head = fold([c.name, c.org, ...companyContacts(c).map(p => `${p.n} ${p.e || ""}`)].join(" "));
      if (!head.includes(q)) ads = ads.filter(a => fold(`${a.title} ${a.muni} ${a.occ} ${a.workplace}`).includes(q));
    }
    if (ads.length) list.push({ ...c, view: ads });
  }
  const sort = $("sort").value, byName = (a, b) => coName(a).localeCompare(coName(b), "sv");
  if (sort === "name") list.sort(byName);
  else if (sort === "newest") list.sort((a, b) => (b.view[0]?.pub || "").localeCompare(a.view[0]?.pub || "") || byName(a, b));
  else if (sort === "deadline") list.sort((a, b) => (a.closing || "9999").localeCompare(b.closing || "9999") || byName(a, b));
  else list.sort((a, b) => b.view.length - a.view.length || (b.view[0]?.pub || "").localeCompare(a.view[0]?.pub || "") || byName(a, b));
  return list;
}

/* ---------- Rendering ---------- */
const CHEVRON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function highlight(text, ts) {
  let s = esc(text);
  for (const x of ts) {
    const words = x.trim().split(/\s+/).map(w => escRe(esc(w)));
    s = s.replace(new RegExp("(^|[^\\p{L}\\p{N}])(" + words.join("[\\s\\-/]+") + ")(?=$|[^\\p{L}\\p{N}])", "giu"), "$1<mark>$2</mark>");
  }
  return s;
}
function snippetFor(a, ts) {
  const s = a.snippet || "";
  if (!ts.length) return s.slice(0, 260) + (s.length > 260 ? "…" : "");
  const f = fold(s); let at = -1;
  for (const x of ts) { const m = f.match(termRe(x)); if (m && (at < 0 || m.index < at)) at = m.index; }
  if (at < 160) return s.slice(0, 260) + (s.length > 260 ? "…" : "");
  const start = s.lastIndexOf(" ", at - 80);
  return "…" + s.slice(start + 1, start + 280) + (s.length > start + 280 ? "…" : "");
}
function kindTag(p) { return `<span class="kind ${["manager", "recruiter", "mine"].includes(p.kind) ? p.kind : ""}">${esc(kindLabel(p.kind))}</span>`; }
function personHtml(c, p) {
  const lines = [];
  if (p.e) lines.push(`<div class="p-line"><a href="mailto:${esc(p.e)}" title="${esc(p.e)}">${esc(p.e)}</a><button class="copy" type="button" data-act="copy" data-copy="${esc(p.e)}">${esc(t("copy"))}</button></div>`);
  if (p.p) lines.push(`<div class="p-line"><a href="${esc(telHref(p.p))}">${esc(p.p)}</a><button class="copy" type="button" data-act="copy" data-copy="${esc(p.p)}">${esc(t("copy"))}</button></div>`);
  const k = contactKey(p);
  if (editingLi.has(c.key + "|" + k)) lines.push(`<form class="liform" data-act="save-li" data-key="${esc(k)}" novalidate>
      <input type="url" name="li" value="${esc(p.liMine ? p.li : "")}" placeholder="${esc(t("li.ph"))}" aria-label="${esc(t("li.aria", { n: p.n }))}">
      <div class="row"><button class="btn sm" type="submit">${esc(t("li.save"))}</button><button class="btn ghost sm" type="button" data-act="cancel-li" data-key="${esc(k)}">${esc(t("cancel"))}</button></div></form>`);
  else if (p.li) lines.push(`<div class="p-line"><a href="${esc(p.li)}" target="_blank" rel="noopener">${esc(t("li.profile"))}</a>${p.liMine ? `<button class="linkbtn" type="button" data-act="edit-li" data-key="${esc(k)}">${esc(t("li.change"))}</button>` : ""}</div>`);
  else if (p.kind !== "inbox" && p.n) lines.push(`<div class="p-line"><a href="${esc(liPersonUrl(c, p))}" target="_blank" rel="noopener">${esc(t("li.find"))}</a><button class="linkbtn" type="button" data-act="edit-li" data-key="${esc(k)}">${esc(t("li.add"))}</button></div>`);
  const sub = [];
  if (p.t && !["k." + p.kind].some(k => I18N[k] && I18N[k].some(x => fold(x) === fold(p.t)))) sub.push(esc(p.t));
  if (p.roles && p.roles.length) sub.push(esc(t("namedon", { roles: p.roles.join(", ") })));
  const remove = p.kind === "mine" ? `<div class="p-line"><button class="linkbtn" type="button" data-act="remove-person" data-idx="${p.idx}">${esc(t("remove"))}</button></div>` : "";
  return `<div class="person"><div class="p-head"><span class="p-name">${esc(p.n)}</span>${kindTag(p)}</div>${sub.length ? `<div class="p-sub">${sub.join(" · ")}</div>` : ""}${lines.join("")}${remove}</div>`;
}
function sideHtml(c) {
  const ppl = companyContacts(c);
  const form = addingFor.has(c.key) ? `
    <form class="addform" data-act="save-person" novalidate>
      <input type="text" name="n" placeholder="${esc(t("f.name"))}" aria-label="${esc(t("f.name"))}" required>
      <input type="text" name="t" placeholder="${esc(t("f.role"))}" aria-label="${esc(t("f.role"))}">
      <input type="email" name="e" placeholder="${esc(t("f.email"))}" aria-label="${esc(t("f.email"))}">
      <input type="tel" name="p" placeholder="${esc(t("f.phone"))}" aria-label="${esc(t("f.phone"))}">
      <input type="url" name="li" placeholder="${esc(t("f.li"))}" aria-label="${esc(t("f.li"))}">
      <div class="row"><button class="btn sm" type="submit">${esc(t("savecontact"))}</button><button class="btn ghost sm" type="button" data-act="cancel-person">${esc(t("cancel"))}</button></div>
    </form>` : `<div><button class="linkbtn" type="button" data-act="add-person">${esc(t("addcontact"))}</button></div>`;
  const h = c.org && hist.get(c.org);
  const facts = [];
  if (c.org) facts.push(`<div>${esc(t("orgnr"))} <span class="mono">${esc(fmtOrg(c.org))}</span></div>`);
  if (c.site) facts.push(`<div><a href="${esc(c.site)}" target="_blank" rel="noopener">${esc(c.site.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a></div>`);
  if (c.org) facts.push(`<div>${histLoading.has(c.org) ? esc(t("hist.loading")) : h && !h.failed ? t("hist.total", { n: +h.total || 0 }) : h && h.failed ? esc(t("hist.failed")) : esc(t("hist.later"))}</div>`);
  if (c.agency) facts.push(`<div>${esc(t("agency.fact"))}</div>`);
  return `<aside class="side">
    <section class="card" aria-label="${esc(t("contacts"))}">
      <div class="sec-head"><h3>${esc(t("contacts"))}</h3><span class="label">${ppl.length || ""}</span></div>
      ${ppl.length ? ppl.map(p => personHtml(c, p)).join("") : `<p class="none">${esc(t("nocontacts"))}</p>`}
      <div class="li-find"><a href="${esc(liCompanyUrl(c))}" target="_blank" rel="noopener">${esc(t("li.company", { name: plainName(coName(c)) }))}</a></div>
      ${form}
    </section>
    <section class="card" aria-label="${esc(t("employer"))}">
      <div class="sec-head"><h3>${esc(t("employer"))}</h3></div>
      <div class="facts">${facts.join("")}</div>
      <div><button class="btn ghost sm" type="button" data-act="hide">${esc(t(hidden.has(c.key) ? "unhide" : "hide"))}</button></div>
    </section>
  </aside>`;
}
function deadlineHtml(d, quiet) {
  const n = daysTo(d), txt = esc(t("applyby", { date: fmtDate(d) }));
  return !quiet && n !== null && n <= 3 && n >= 0 ? `<span class="chip soon">${txt}</span>` : `<span>${txt}</span>`;
}
function metaHtml(a) {
  const m = [];
  if (a.isNew) m.push(`<span class="chip new">${esc(t("new"))}</span>`);
  if (a.field) m.push(`<span class="chip cat">${esc(a.field)}</span>`);
  m.push(`<span>${esc(t("posted", { date: fmtDate(a.pub) }))}</span>`);
  if (a.deadline) m.push(deadlineHtml(a.deadline));
  if (a.duration) m.push(`<span>${esc(durLabel(a.duration))}</span>`);
  if (a.hours) m.push(`<span>${esc(hoursLabel(a.hours))}</span>`);
  if (a.muni) m.push(`<span>${esc(a.muni)}</span>`);
  if (a.workplace && normName(a.workplace) !== normName(a.employer)) m.push(`<span>${esc(t("atwp", { name: shortName(a.workplace) }))}</span>`);
  if (a.src === "links") m.push(`<span class="chip src">${esc(t("onsite", { site: a.source || t("othersite") }))}</span>`);
  if (a.agency) m.push(`<span class="chip via">${esc(t("recad"))}</span>`);
  else if (a.client) m.push(`<span class="chip via">${esc(t("forclient"))}</span>`);
  if (a.exp === false) m.push(`<span>${esc(t("noexp"))}</span>`);
  return m.join("");
}
function statusSelect(id, s) {
  return `<select data-role="status" data-ad="${esc(id)}" data-s="${esc(s)}" aria-label="${esc(t("status"))}"><option value="">${esc(t("notracked"))}</option>${STATUSES.map(x => `<option value="${x}"${x === s ? " selected" : ""}>${esc(t(x))}</option>`).join("")}</select>`;
}
const tailorBtn = id => ABOUT.tailor ? `<button class="btn sm tl-btn" type="button" data-tailor="${esc(id)}">${esc(t("tl.open"))}${tailorStore[id] && Object.keys(tailorStore[id].out || {}).length ? ' <span class="tl-dot" aria-hidden="true">●</span>' : ""}</button>` : "";
function noteHtml(id, title, note) {
  return `<textarea data-role="note" data-ad="${esc(id)}" aria-label="${esc(t("note.aria", { title }))}" placeholder="${esc(t("note.ph"))}">${esc(note || "")}</textarea><span class="saved" data-saved="${esc(id)}"></span>`;
}
function roleHtml(c, a) {
  const ts = results?.params.terms || [];
  const matches = a.terms.map(x => `<span class="chip kw">${esc(x)}</span>`).concat(a.loose.map(x => `<span class="chip loose" title="${esc(t("loose.title"))}">${esc(x)}?</span>`));
  const n = similarCount(a);
  const histLine = a.src === "links" || n === null ? "" : `<div class="hist">${esc(n > 0 ? tn(n, "hist.n1", "hist.nN") : t("hist.first"))}</div>`;
  const app = apps[a.id] || {};
  const applyHref = a.apply || (a.applyEmail ? `mailto:${a.applyEmail}` : "");
  const contacts = (a.contacts || []).filter(p => p.kind !== "inbox");
  const ln = links[c.key] || {};
  return `<article class="role" data-ad="${esc(a.id)}">
    <div class="role-head"><a class="role-title" href="${esc(a.url || adUrl(a.id))}" target="_blank" rel="noopener">${esc(a.title)}<span class="ext" aria-hidden="true">↗</span></a></div>
    <div class="role-meta">${metaHtml(a)}</div>
    ${matches.length ? `<div class="matches">${esc(t("matches"))} ${matches.join("")}</div>` : ""}
    ${a.snippet ? `<p class="snippet">${highlight(snippetFor(a, ts), a.terms)}</p>` : ""}
    ${histLine}
    <div class="track">
      <div class="row">${statusSelect(a.id, app.status || "")}
        ${applyHref ? `<a class="btn ghost sm" href="${esc(applyHref)}" target="_blank" rel="noopener">${esc(t("howapply"))}</a>` : ""}
        <a class="btn ghost sm" href="${esc(a.url || adUrl(a.id))}" target="_blank" rel="noopener">${esc(t("readad"))}</a>${tailorBtn(a.id)}</div>
      ${app.status || app.note ? noteHtml(a.id, a.title, app.note) : ""}
    </div>
    ${contacts.length ? `<div class="role-contact">${esc(t("contactin"))} ${contacts.map(p => { const li = p.li || ln[contactKey(p)]; const role = p.t ? `, ${esc(p.t.toLowerCase())}` : p.kind === "recruiter" ? `, ${esc(t("recruiter.lc"))}` : ""; return `${li ? `<a href="${esc(li)}" target="_blank" rel="noopener"><b>${esc(p.n)}</b></a>` : `<b>${esc(p.n)}</b>`}${role}`; }).join("; ")}</div>` : ""}
  </article>`;
}
function companyHtml(c) {
  const isOpen = openIds.has(c.key), id = esc(c.key);
  const tracked = c.ads.filter(a => apps[a.id] && ACTIVE.has(apps[a.id].status)).length;
  const chips = [];
  if (c.isNew) chips.push(`<span class="chip new">${esc(t("newemp"))}</span>`);
  if (tracked) chips.push(`<span class="chip applied">${esc(t("tracking", { n: tracked }))}</span>`);
  if (c.agency) chips.push(`<span class="chip via">${esc(t("staffing"))}</span>`);
  if (hidden.has(c.key)) chips.push(`<span class="chip cat">${esc(t("hiddenchip"))}</span>`);
  const quick = [`<span><b>${esc(tn(c.view.length, "co.roles1", "co.rolesN"))}</b></span>`];
  if (c.munis.length) quick.push(`<span>${esc(c.munis.slice(0, 3).join(", "))}${c.munis.length > 3 ? ` +${c.munis.length - 3}` : ""}</span>`);
  quick.push(`<span>${esc(t("co.newest", { date: fmtDate(c.view[0]?.pub) }))}</span>`);
  if (c.closing) quick.push(`<span>${esc(t("co.closing", { date: fmtDate(c.closing) }))}</span>`);
  const preview = c.view.slice(0, 3).map(a => `<em>${esc(a.title)}</em>`).join(" · ") + (c.view.length > 3 ? ` · ${esc(t("co.more", { n: c.view.length - 3 }))}` : "");
  return `<article class="co${hidden.has(c.key) ? " hidden-co" : ""}" data-id="${id}">
    <div class="co-row">
      <button class="exp" type="button" data-act="toggle" aria-expanded="${isOpen}" aria-controls="pn-${id}" aria-label="${esc(t("showroles", { name: coName(c) }))}">${CHEVRON}</button>
      <div class="co-main" data-act="toggle">
        <h2>${c.logo ? `<img class="logo" src="${esc(c.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<span>${esc(coName(c))}</span>${chips.join("")}</h2>
        <div class="quick">${quick.join("")}</div>
        <div class="roles-preview">${preview}</div>
      </div>
    </div>
    <div class="panel" id="pn-${id}" ${isOpen ? "" : "hidden"}>${isOpen ? `<div class="roles">${c.view.map(a => roleHtml(c, a)).join("")}</div>${sideHtml(c)}` : ""}</div>
  </article>`;
}
function renderStats() {
  const has = !!results;
  $("stats").hidden = !has;
  const tracked = Object.values(apps).filter(x => ACTIVE.has(x.status)).length;
  $("n-app").textContent = Object.keys(apps).filter(k => apps[k].status).length || "";
  if (!has) { $("last-search").textContent = ""; return; }
  const vis = visible(), roles = vis.reduce((n, c) => n + c.view.length, 0);
  $("s-co").textContent = vis.length; $("s-op").textContent = roles;
  $("s-new").textContent = results.rerun ? results.ads.filter(a => a.isNew).length : "–";
  $("s-app").textContent = tracked;
  $("n-res").textContent = vis.length || "";
  const at = new Date(results.at);
  $("last-search").textContent = t("last", { date: fmtDate(localDay(at)), time: at.toLocaleTimeString(lang === "sv" ? "sv-SE" : [], { hour: "2-digit", minute: "2-digit" }) });
  return vis;
}
function fillFields() {
  const cur = $("field").value, fields = [...new Set((results?.ads || []).map(a => a.field).filter(Boolean))].sort((a, b) => a.localeCompare(b, "sv"));
  $("field").innerHTML = `<option value="">${esc(t("allfields"))}</option>` + fields.map(f => `<option${f === cur ? " selected" : ""}>${esc(f)}</option>`).join("");
}
function render() {
  companies = results ? buildCompanies(results.ads) : [];
  fillFields();
  const vis = renderStats() || [];
  if (!results) {
    $("list").innerHTML = `<div class="empty"><strong>${esc(t("empty.title"))}</strong>${esc(t("empty.text"))}</div>`;
    $("count").textContent = ""; $("note-bar").textContent = "";
  } else {
    $("list").innerHTML = vis.length ? vis.map(companyHtml).join("") : `<div class="empty"><strong>${esc(t("nomatch.title"))}</strong>${esc(t("nomatch.text"))}</div>`;
    const total = companies.filter(c => $("f-hidden").checked || !hidden.has(c.key)).length;
    $("count").textContent = vis.length === total ? tn(vis.length, "count.all", "count.allN") : t("count.some", { v: vis.length, n: total });
    const p = results.params, g = results.geo;
    $("note-bar").textContent = t("note", { terms: p.terms.length ? p.terms.map(x => `"${x}"`).join(", ") : t("note.all"), place: placeLabel(g),
      radius: hasRadius(g, p) ? ` + ${p.radius} km` : "", ex: p.excludes.length ? t("note.ex", { ex: p.excludes.join(", ") }) : "" });
  }
  $("expand-all").textContent = t(vis.length && vis.every(c => openIds.has(c.key)) ? "collapse" : "expand");
  renderApps();
  for (const c of vis) if (openIds.has(c.key) && c.org && !hist.has(c.org)) loadHistory(c.org);
}
// Redraws one employer. Keeps whatever the person was typing or had focused, since history can arrive mid-typing.
function rerenderCompany(key, focusSel) {
  if (!key) return;
  const find = () => [...document.querySelectorAll("article.co")].find(a => a.dataset.id === key);
  const art = find(), c = visible().find(x => x.key === key);
  if (!art || !c) return;
  let keep = null;
  const act = document.activeElement;
  if (!focusSel && act && art.contains(act) && act !== art) {
    if (act.dataset.role === "note") flushNote(act);
    const sel = act.id ? `#${CSS.escape(act.id)}` : act.dataset.role ? `[data-role="${act.dataset.role}"][data-ad="${CSS.escape(act.dataset.ad)}"]`
      : act.dataset.act ? `[data-act="${act.dataset.act}"]${act.dataset.key ? `[data-key="${CSS.escape(act.dataset.key)}"]` : ""}` : act.name ? `[name="${CSS.escape(act.name)}"]` : null;
    if (sel) keep = { sel, value: "value" in act && act.tagName !== "SELECT" ? act.value : null, start: act.selectionStart, end: act.selectionEnd };
  }
  art.outerHTML = companyHtml(c);
  const now = find();
  if (focusSel) { const el = now?.querySelector(focusSel); if (el) el.focus(); }
  else if (keep) {
    const el = now?.querySelector(keep.sel);
    if (el) { if (keep.value !== null && el.value !== keep.value) el.value = keep.value; el.focus(); try { if (keep.start != null) el.setSelectionRange(keep.start, keep.end); } catch {} }
  }
}
function setOpen(key, open) {
  if (open) openIds.add(key); else openIds.delete(key);
  store.set("jf-open", [...openIds]);
  rerenderCompany(key, "button.exp");
  const c = companies.find(x => x.key === key);
  if (open && c && c.org) loadHistory(c.org);
}

/* ---------- Applications tab and backup ---------- */
function snapOf(a) {
  const c = companies.find(x => x.ads.includes(a));
  return { title: a.title, company: c ? coName(c) : shortName(a.employer), companyKey: c ? c.key : companyKey(a), url: a.url || adUrl(a.id), apply: a.apply || (a.applyEmail ? `mailto:${a.applyEmail}` : ""),
    deadline: a.deadline, muni: a.muni, pub: a.pub, contacts: (a.contacts || []).filter(p => p.kind !== "inbox").slice(0, 3) };
}
function backupHtml() {
  const at = store.get("jf-backup-at", null);
  const msg = backupMsg ? `<p class="${backupMsg.ok ? "ok" : "err"}" role="status">${esc(backupMsg.text)}</p>` : "";
  return `<section class="backup" id="backup" aria-labelledby="bk-title">
    <h3 id="bk-title">${esc(t("bk.title"))}</h3>
    <p>${esc(t("bk.text"))}</p>
    <div class="row"><button class="btn sm" type="button" id="bk-down">${esc(t("bk.download"))}</button>
      <button class="btn ghost sm" type="button" id="bk-up">${esc(t("bk.restore"))}</button>
      <input type="file" id="bk-file" accept=".json,application/json" hidden></div>
    <p>${esc(at ? t("bk.last", { date: fmtDate(at) }) : t("bk.never"))}</p>${msg}
  </section>`;
}
function renderApps() {
  const entries = Object.entries(apps).filter(([, x]) => x.status);
  const order = ["Interview", "Offer", "Applied", "Saved", "Rejected", "Not interested"];
  const groups = entries.length ? order.map(s => {
    const list = entries.filter(([, x]) => x.status === s).sort((a, b) => (a[1].snap?.deadline || "9999").localeCompare(b[1].snap?.deadline || "9999"));
    if (!list.length) return "";
    return `<div class="app-group"><h3>${esc(t(s))} · ${list.length}</h3><div class="app-list">${list.map(([id, x]) => {
      const sn = x.snap || {}, live = results?.ads.some(a => a.id === id);
      return `<div class="app" data-ad="${esc(id)}">
        <div class="role-head"><a class="role-title" href="${esc(sn.url || adUrl(id))}" target="_blank" rel="noopener">${esc(sn.title || t("role"))}<span class="ext" aria-hidden="true">↗</span></a></div>
        <div class="role-meta"><b>${esc(sn.company || "")}</b>${sn.muni ? `<span>${esc(sn.muni)}</span>` : ""}${sn.deadline ? deadlineHtml(sn.deadline, ["Rejected", "Not interested"].includes(s)) : ""}<span>${esc(t("updated", { date: fmtDate(localDay(new Date(x.updatedAt || Date.now()))) }))}</span>${live ? "" : `<span>${esc(t("notlive"))}</span>`}</div>
        ${(sn.contacts || []).length ? `<div class="role-contact">${esc(t("contact"))} ${sn.contacts.map(p => `<b>${esc(p.n)}</b>${p.e ? ` <a href="mailto:${esc(p.e)}">${esc(p.e)}</a>` : ""}`).join("; ")}</div>` : ""}
        <div class="track"><div class="row">${statusSelect(id, s)}${sn.apply ? `<a class="btn ghost sm" href="${esc(sn.apply)}" target="_blank" rel="noopener">${esc(t("howapply"))}</a>` : ""}${tailorBtn(id)}</div>
          ${noteHtml(id, sn.title || t("role"), x.note)}</div>
      </div>`; }).join("")}</div></div>`;
  }).join("") : `<div class="empty"><strong>${esc(t("apps.empty.title"))}</strong>${esc(t("apps.empty.text"))}</div>`;
  $("apps").innerHTML = backupHtml() + groups;
}
function setStatus(id, status) {
  const prev = apps[id] || {}, a = results?.ads.find(x => x.id === id);
  if (!status && !prev.note) delete apps[id];
  else apps[id] = { ...prev, status, updatedAt: new Date().toISOString(), snap: a ? snapOf(a) : prev.snap };
  store.set("jf-apps", apps);
}
function downloadBlob(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type })), link = document.createElement("a");
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function downloadBackup() {
  const data = { apps, hidden: [...hidden], people, links, search: store.get("jf-search", null), seen: store.get("jf-seen", {}), prefs: store.get("jf-prefs", {}), lang, cv: store.get("jf-cv", ""), tailor: tailorStore };
  downloadBlob(JSON.stringify({ app: "job-finder", version: 1, exported: new Date().toISOString(), data }, null, 1), `job-finder-backup-${today()}.json`, "application/json");
  store.set("jf-backup-at", today()); backupMsg = null; renderApps();
}
function restoreBackup(file) {
  const reader = new FileReader();
  reader.onerror = () => { backupMsg = { ok: false, text: t("bk.unreadable") }; renderApps(); };
  reader.onload = () => {
    let b;
    try { b = JSON.parse(reader.result); } catch { backupMsg = { ok: false, text: t("bk.notours") }; return renderApps(); }
    if (!b || b.app !== "job-finder" || !b.data || typeof b.data !== "object") { backupMsg = { ok: false, text: t("bk.notours") }; return renderApps(); }
    const d = b.data, isObj = v => v && typeof v === "object" && !Array.isArray(v);
    let nApps = 0, nPeople = 0, nHidden = 0;
    if (isObj(d.apps)) for (const [id, x] of Object.entries(d.apps)) {
      if (!isObj(x) || (x.status && !STATUSES.includes(x.status))) continue;
      const cur = apps[id];
      if (!cur || (x.updatedAt || "") > (cur.updatedAt || "")) { apps[id] = { status: x.status || "", note: String(x.note || ""), updatedAt: x.updatedAt || "", snap: isObj(x.snap) ? x.snap : undefined }; nApps++; }
    }
    if (Array.isArray(d.hidden)) for (const k of d.hidden) if (typeof k === "string" && !hidden.has(k)) { hidden.add(k); nHidden++; }
    if (isObj(d.people)) for (const [k, list] of Object.entries(d.people)) {
      if (!Array.isArray(list)) continue;
      const cur = people[k] || [], keys = new Set(cur.map(contactKey));
      for (const p of list) if (isObj(p) && p.n && !keys.has(contactKey(p))) { cur.push({ n: String(p.n), t: String(p.t || ""), e: String(p.e || ""), p: String(p.p || ""), ...(normLi(p.li) ? { li: normLi(p.li) } : {}), added: p.added || today() }); keys.add(contactKey(p)); nPeople++; }
      people[k] = cur;
    }
    if (isObj(d.links)) for (const [k, m] of Object.entries(d.links)) if (isObj(m)) { links[k] = { ...m, ...(links[k] || {}) }; for (const [ck, u] of Object.entries(links[k])) if (!normLi(u)) delete links[k][ck]; }
    if (isObj(d.seen)) store.set("jf-seen", { ...d.seen, ...store.get("jf-seen", {}) });
    if (isObj(d.search) && !store.get("jf-search", null)) { store.set("jf-search", d.search); fillForm(d.search); }
    if (typeof d.cv === "string" && d.cv.trim() && !store.get("jf-cv", "").trim()) store.set("jf-cv", d.cv);
    if (isObj(d.tailor)) { for (const [id, x] of Object.entries(d.tailor)) if (isObj(x) && !tailorStore[id]) tailorStore[id] = { ad: typeof x.ad === "string" ? x.ad : undefined, extra: String(x.extra || ""), lang: x.lang === "en" ? "en" : x.lang === "sv" ? "sv" : undefined, lastTask: TASKS.includes(x.lastTask) ? x.lastTask : undefined, out: isObj(x.out) ? Object.fromEntries(Object.entries(x.out).filter(([k, o]) => TASKS.includes(k) && isObj(o) && typeof o.text === "string")) : {} }; saveTailor(); }
    const ok = [store.set("jf-apps", apps), store.set("jf-hidden", [...hidden]), store.set("jf-people", people), store.set("jf-links", links)].every(Boolean);
    backupMsg = { ok, text: ok ? t("bk.ok", { apps: tn(nApps, "bk.apps1", "bk.appsN"), contacts: tn(nPeople, "bk.ppl1", "bk.pplN"), hidden: tn(nHidden, "bk.hid1", "bk.hidN") }) : t("bk.nostore") };
    render();
  };
  reader.readAsText(file);
}
$("apps").addEventListener("click", e => {
  if (e.target.id === "bk-down") downloadBackup();
  else if (e.target.id === "bk-up") $("bk-file").click();
});
$("apps").addEventListener("change", e => { if (e.target.id === "bk-file" && e.target.files[0]) { restoreBackup(e.target.files[0]); e.target.value = ""; } });

/* ---------- Events ---------- */
async function copyText(text, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); try { ok = document.execCommand("copy"); } catch {} ta.remove();
  }
  if (btn) { const x = btn.textContent; btn.textContent = t(ok ? "copied" : "copyfail"); btn.classList.toggle("done", ok); setTimeout(() => { btn.textContent = x; btn.classList.remove("done"); }, 1400); }
}
$("list").addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el || e.target.closest("a")) return;
  const art = el.closest("article.co"), key = art?.dataset.id, act = el.dataset.act;
  if (act === "toggle") setOpen(key, !openIds.has(key));
  else if (act === "copy") copyText(el.dataset.copy, el);
  else if (act === "add-person") { addingFor.add(key); rerenderCompany(key, 'input[name="n"]'); }
  else if (act === "cancel-person") { addingFor.delete(key); rerenderCompany(key, 'button[data-act="add-person"]'); }
  else if (act === "remove-person") {
    if (el.dataset.armed !== "1") { el.dataset.armed = "1"; el.textContent = t("remove.confirm"); setTimeout(() => { if (el.isConnected) { el.dataset.armed = ""; el.textContent = t("remove"); } }, 4000); return; }
    const list = (people[key] || []).slice(); list.splice(+el.dataset.idx, 1); people[key] = list; store.set("jf-people", people); rerenderCompany(key);
  }
  else if (act === "edit-li") { editingLi.add(key + "|" + el.dataset.key); rerenderCompany(key, `form.liform[data-key="${CSS.escape(el.dataset.key)}"] input`); }
  else if (act === "cancel-li") { editingLi.delete(key + "|" + el.dataset.key); rerenderCompany(key); }
  else if (act === "hide") {
    if (hidden.has(key)) hidden.delete(key); else hidden.add(key);
    store.set("jf-hidden", [...hidden]);
    if (!hidden.has(key) || $("f-hidden").checked) rerenderCompany(key, 'button[data-act="hide"]'); else render();
  }
});
$("list").addEventListener("submit", e => {
  e.preventDefault();
  const form = e.target, key = form.closest("article.co").dataset.id;
  const bad = (input, msg) => { input.setAttribute("aria-invalid", "true"); input.value = ""; input.placeholder = msg; input.focus(); };
  if (form.dataset.act === "save-li") {
    const raw = form.elements.li.value.trim(), url = normLi(raw);
    if (raw && !url) return bad(form.elements.li, t("li.bad"));
    const ln = { ...(links[key] || {}) }; if (url) ln[form.dataset.key] = url; else delete ln[form.dataset.key];
    links[key] = ln; store.set("jf-links", links); editingLi.delete(key + "|" + form.dataset.key); rerenderCompany(key);
  } else if (form.dataset.act === "save-person") {
    const v = k => (form.elements[k].value || "").trim();
    if (!v("n")) return bad(form.elements.n, t("f.needname"));
    const li = normLi(v("li"));
    if (v("li") && !li) return bad(form.elements.li, t("li.bad"));
    people[key] = (people[key] || []).concat([{ n: v("n"), t: v("t"), e: v("e"), p: v("p"), ...(li ? { li } : {}), added: today() }]);
    store.set("jf-people", people); addingFor.delete(key); rerenderCompany(key);
  }
});
function onStatus(e) {
  const el = e.target; if (el.dataset.role !== "status") return;
  setStatus(el.dataset.ad, el.value);
  const art = el.closest("article.co");
  if (art) rerenderCompany(art.dataset.id, el.value ? `textarea[data-ad="${CSS.escape(el.dataset.ad)}"]` : `select[data-ad="${CSS.escape(el.dataset.ad)}"]`);
  renderStats(); renderApps();
}
function flushNote(el) {
  const id = el.dataset.ad;
  clearTimeout(noteTimers.get(id)); noteTimers.delete(id);
  const prev = apps[id] || {}, a = results?.ads.find(x => x.id === id);
  if ((prev.note || "") === el.value) return;
  apps[id] = { ...prev, note: el.value, updatedAt: new Date().toISOString(), snap: prev.snap || (a ? snapOf(a) : undefined) };
  if (!apps[id].status && !el.value) delete apps[id];
  const ok = store.set("jf-apps", apps);
  document.querySelectorAll(`[data-saved="${CSS.escape(id)}"]`).forEach(s => s.textContent = t(ok ? "saved" : "blocked"));
}
function onNote(e) {
  const el = e.target; if (el.dataset.role !== "note") return;
  clearTimeout(noteTimers.get(el.dataset.ad));
  noteTimers.set(el.dataset.ad, setTimeout(() => flushNote(el), 400));
}
for (const id of ["list", "apps"]) { $(id).addEventListener("change", onStatus); $(id).addEventListener("input", onNote); }
for (const id of ["q", "field", "emp", "sort", ...FILTERS.map(k => "f-" + k)]) $(id).addEventListener(id === "q" ? "input" : "change", () => { savePrefs(); render(); });
$("expand-all").addEventListener("click", () => {
  const b = $("expand-all"), vis = visible(), all = vis.length && vis.every(c => openIds.has(c.key));
  if (!all && vis.length > 40 && !b.dataset.armed) { b.dataset.armed = "1"; b.textContent = t("expand.confirm", { n: vis.length }); setTimeout(() => { delete b.dataset.armed; render(); }, 4000); return; }
  delete b.dataset.armed;
  for (const c of vis) if (all) openIds.delete(c.key); else openIds.add(c.key);
  store.set("jf-open", [...openIds]); render();
});
function selectTab(app, focus) {
  $("tab-res").setAttribute("aria-selected", String(!app)); $("tab-app").setAttribute("aria-selected", String(app));
  $("tab-res").tabIndex = app ? -1 : 0; $("tab-app").tabIndex = app ? 0 : -1;
  $("view-res").hidden = app; $("view-app").hidden = !app;
  if (app) renderApps();
  if (focus) $(app ? "tab-app" : "tab-res").focus();
}
$("tab-res").addEventListener("click", () => selectTab(false));
$("tab-app").addEventListener("click", () => selectTab(true));
document.querySelector(".tabs").addEventListener("keydown", e => {
  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); selectTab(e.key === "ArrowRight" || e.key === "End", true); }
});
$("goto-backup").addEventListener("click", () => { selectTab(true); $("backup")?.scrollIntoView({ block: "start" }); $("bk-down")?.focus(); });

/* ---------- CSV export ---------- */
function csvCell(v) { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
$("export").addEventListener("click", () => {
  const rows = [t("csv")];
  for (const c of visible()) {
    const mine = (people[c.key] || []).map(p => [p.n, p.t, p.e, p.p, p.li].filter(Boolean).join(", ")).join(" | ");
    for (const a of c.view) {
      const ps = a.contacts || [], app = apps[a.id] || {};
      rows.push([coName(c), fmtOrg(c.org), a.title, a.terms.join(", "), a.field, a.muni, a.pub, a.deadline, a.duration ? durLabel(a.duration) : "", a.hours ? hoursLabel(a.hours) : "",
        a.src === "links" ? (a.source || t("othersite")) : "Platsbanken", a.url, a.apply || a.applyEmail, ps.map(p => `${p.n} (${p.t || kindLabel(p.kind)})`).join(" | "),
        ps.map(p => p.e).filter(Boolean).join(" | "), ps.map(p => p.p).filter(Boolean).join(" | "), mine, app.status ? t(app.status) : "", app.note || ""]);
    }
  }
  downloadBlob("﻿" + rows.map(r => r.map(csvCell).join(",")).join("\r\n"), `job-finder-${today()}.csv`, "text/csv;charset=utf-8");
});

/*__TAILOR__*/

/* ---------- Start ---------- */
if (ABOUT.tailor) document.querySelector('[data-th="about.privacy"]').dataset.th = "about.privacy.ai";
initTailor();
applyLang();
loadPrefs();
fillForm(store.get("jf-search", null) || { country: "SE", place: "", radius: 25, terms: [], excludes: [], links: true });
render();
