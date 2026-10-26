// A stand-in for the AI service with the demo's fictional answers (Sam Ekström, a test engineer in Göteborg), in English or Swedish.
//   node demo/demo_ai.mjs 8798
// Used only by demo/record.py. Answers come back after a short pause so the "Writing…" state shows in the video.
import http from "node:http";
const course = (name, provider, format, extra, directions, priority, skill, forRole, why) => ({ name, provider, format, ...extra, directions, priority, why, skill, for_role: forRole });
const MENTOR = {
  name: "Sam", years: 10, stage: "established", stage_reason: "Ten years in testing, the last four planning release testing for a whole product.",
  history: [{ title: "Senior Test Engineer", org: "Göta Telematics", years: "2019–now" }, { title: "Test Engineer", org: "Brännö Software", years: "2016–2019" }],
  education: "BSc Computer Engineering", certs: "ISTQB Foundation", domains: "Automotive, connected products", skills: ["Test strategy", "Python", "CI", "Hardware-in-the-loop", "Risk-based testing"],
  opener: "Ten years of testing connected products, with automation you built yourself, puts you ahead of most test engineers. Teams in Gothenburg are moving test work into CI pipelines, and people who can lead that shift are in short supply.",
  direction_notes: {
    deeper: "Go deeper on test architecture: the advanced ISTQB automation track and the hardware-in-the-loop side of CI.",
    lead: "You already plan testing for each release. A recognised test management certificate and a first leadership course would make a test lead or QA lead role a natural next step.",
    change: "Product ownership is the closest change, since you already decide what gets tested first and why.",
    advise: "Teams starting with test automation need someone who has done it. Coaching and talks would build that name." },
  roles: [
    { title: "Test Lead", tier: "direct", directions: ["lead", "deeper"], match: 88, why: "You plan release testing today. This is the same work with the title.", gaps: ["Owning the test budget"], gap_months: 0, search: "test lead" },
    { title: "Test Automation Engineer", tier: "direct", directions: ["deeper"], match: 84, why: "Your Python suite and CI work match most of these ads.", gaps: [], gap_months: 0, search: "test automation" },
    { title: "QA Lead", tier: "stretch", directions: ["lead"], match: 70, why: "Sets quality goals across several teams, not just one product.", gaps: ["Leading people", "Quality strategy"], gap_months: 9, search: "QA lead" },
    { title: "Test Architect", tier: "stretch", directions: ["deeper", "advise"], match: 66, why: "Designs how a whole company tests, from unit level to the rig.", gaps: ["Test architecture"], gap_months: 12, search: "test architect" },
    { title: "Test Manager", tier: "stretch", directions: ["lead"], match: 58, why: "A step further: budget and people for a whole test department.", gaps: ["Budget responsibility", "Line management"], gap_months: 24, search: "testchef" },
    { title: "Product Owner", tier: "pivot", directions: ["change", "lead"], match: 44, why: "Testers know a product's edge cases better than anyone.", gaps: ["Backlog management", "Stakeholder work"], gap_months: 12, search: "product owner" },
    { title: "DevOps Engineer", tier: "pivot", directions: ["change", "deeper"], match: 41, why: "You already keep a CI pipeline running.", gaps: ["Cloud infrastructure"], gap_months: 12, search: "DevOps" },
  ],
  courses: [
    course("ISTQB Advanced Test Management", "Self-study, exam via accredited provider", "self", { hours: 60, cost_sek: 7500, ramp_months: 0 }, ["lead", "advise"], { lead: 10, advise: 7 }, "ISTQB", "Test Lead", "The standard qualification for test leads, building on your Foundation level."),
    course("UGL leadership course", "Residential course, 5 days", "class", { hours: 43, days: 5, cost_sek: 26000, ramp_months: 3 }, ["lead"], { lead: 9 }, "ledarskap", "QA Lead", "The usual first leadership course in Swedish industry."),
    course("AI tools for testers", "Self-paced online", "self", { hours: 6, cost_sek: 0, ramp_months: 0 }, ["deeper", "lead", "change", "advise"], 6, "Copilot", "Test Lead", "A few hours is enough to start using AI on test design and reports."),
    course("Professional Scrum Product Owner", "Self-study, online exam", "self", { hours: 20, cost_sek: 2200, ramp_months: 1 }, ["change", "lead"], { change: 10, lead: 5 }, "Scrum", "Product Owner", "A recognised start if you want to move into product work."),
    course("ISTQB Advanced Test Automation Engineering", "Self-study, exam via accredited provider", "self", { hours: 50, cost_sek: 7500, ramp_months: 0 }, ["deeper"], { deeper: 10 }, "Robot Framework", "Test Automation Engineer", "Puts a name on the automation work you already do."),
    course("Kubernetes for developers", "Self-paced online", "self", { hours: 30, cost_sek: 3000, ramp_months: 2 }, ["change", "deeper"], { change: 8, deeper: 4 }, "Kubernetes", "DevOps Engineer", "Where CI pipelines run today."),
  ],
};
const ANSWERS = {
  letter: "## Cover letter\nDear Sara Lindqvist,\n\nI'm applying for the Test Lead role at **Nordvik Automotive** because it brings together the two things I have done for ten years: planning verification of embedded systems and building the automation that keeps it fast.\n\nAt Göta Telematics I plan and run release testing for a vehicle telematics unit. I also built the team's automated regression suite in Python, which cut a two-week manual cycle to two days.\n\n- Test strategy and risk-based planning for embedded releases\n- Python test automation running in CI\n- ISTQB Foundation certified\n\nI would be glad to tell you how I would approach your verification roadmap.\n\nKind regards,\nSam Ekström",
  match: "## What matches\n- **Test strategy** for embedded releases, four years\n- **Python** test automation in CI\n- ISTQB Foundation\n\n## What's missing\n1. Leading a team of five is not in your CV\n\n## Overall\nA strong match.",
  cv: "## Profile\nSenior test engineer with ten years of embedded and connected-product testing.\n\n## Key skills\n- Test strategy\n- Python test automation",
  interview: "## Likely questions\n1. How do you decide what to test first in a release?\n2. Tell us about the regression suite you built.",
};
// The whole tailored CV for the "retailor" clip, in three versions. The first draft borrows ISO 26262 from the ad, the way
// the live model does; the server's fact check catches it and asks for a correction, which takes it out. After Sam writes
// under the answer that he did work to ISO 26262, the CV comes back with it under the job where it happened.
const tailoredCv = ({ skill = "", task = "", borrowed = "" } = {}) => `# Sam Ekström
Göteborg

## Profile
Senior test engineer who plans and runs release testing for a vehicle telematics unit and built the team's automated regression suite in Python. Works with risk-based testing and hardware-in-the-loop, and holds the ISTQB Foundation certificate.

## Key skills
- Test strategy and risk-based testing${skill}
- Python, pytest and Jenkins
- Hardware-in-the-loop
- Jira

## Experience
### Senior Test Engineer, Göta Telematics AB (2019 – now)
- Plan and run release testing for a vehicle telematics unit${borrowed}${task}
- Built the team's automated regression suite in Python
- Run the suite in CI with Jenkins

### Test Engineer, Brännö Software AB (2016 – 2019)
- System and integration testing of IoT gateways

## Education
### BSc Computer Engineering (2016)

## Certificates
- ISTQB Foundation`;
const CV_DRAFTS = {
  first: tailoredCv({ borrowed: ", following ISO 26262" }),
  corrected: tailoredCv(),
  added: tailoredCv({ skill: "\n- ISO 26262 functional safety testing", task: "\n- Wrote the functional safety test cases for the unit to ISO 26262" }),
};
ANSWERS.cv = CV_DRAFTS.first;

// The same answers in Swedish, for the Swedish demo
const MENTOR_SV = {
  ...MENTOR, stage_reason: "Tio år inom test, de senaste fyra med ansvar för releasetesterna för en hel produkt.",
  history: [{ title: "Senior testingenjör", org: "Göta Telematics", years: "2019–nu" }, { title: "Testingenjör", org: "Brännö Software", years: "2016–2019" }],
  education: "Högskoleingenjör i datateknik", domains: "Fordon, uppkopplade produkter", skills: ["Teststrategi", "Python", "CI", "Hardware-in-the-loop", "Riskbaserad testning"],
  opener: "Tio år av test på uppkopplade produkter, med automatisering du byggt själv, gör att du ligger före de flesta testingenjörer. Teamen i Göteborg flyttar in testarbetet i CI-flöden, och det är ont om folk som kan leda den förändringen.",
  direction_notes: {
    deeper: "Fördjupa dig i testarkitektur: ISTQB:s avancerade spår för testautomatisering och hardware-in-the-loop i CI.",
    lead: "Du planerar redan testerna inför varje release. Ett erkänt certifikat i testledning och en första ledarskapsutbildning gör testledare eller QA-ledare till ett naturligt nästa steg.",
    change: "Produktägare är det närmaste bytet, eftersom du redan avgör vad som ska testas först och varför.",
    advise: "Team som börjar med testautomatisering behöver någon som har gjort det. Coachning och föredrag bygger det namnet." },
  roles: [
    { title: "Testledare", tier: "direct", directions: ["lead", "deeper"], match: 88, why: "Du planerar releasetester i dag. Det här är samma arbete med titeln.", gaps: ["Ansvar för testbudgeten"], gap_months: 0, search: "testledare" },
    { title: "Ingenjör inom testautomatisering", tier: "direct", directions: ["deeper"], match: 84, why: "Din Python-svit och ditt CI-arbete matchar de flesta av annonserna.", gaps: [], gap_months: 0, search: "testautomatisering" },
    { title: "QA-ledare", tier: "stretch", directions: ["lead"], match: 70, why: "Sätter kvalitetsmål för flera team, inte bara en produkt.", gaps: ["Leda människor", "Kvalitetsstrategi"], gap_months: 9, search: "QA-ledare" },
    { title: "Testarkitekt", tier: "stretch", directions: ["deeper", "advise"], match: 66, why: "Utformar hur ett helt företag testar, från enhetsnivå till riggen.", gaps: ["Testarkitektur"], gap_months: 12, search: "testarkitekt" },
    { title: "Testchef", tier: "stretch", directions: ["lead"], match: 58, why: "Ett steg till: budget och personal för en hel testavdelning.", gaps: ["Budgetansvar", "Personalansvar"], gap_months: 24, search: "testchef" },
    { title: "Produktägare", tier: "pivot", directions: ["change", "lead"], match: 44, why: "Testare känner en produkts gränsfall bättre än någon annan.", gaps: ["Backloggarbete", "Dialog med intressenter"], gap_months: 12, search: "produktägare" },
    { title: "DevOps-ingenjör", tier: "pivot", directions: ["change", "deeper"], match: 41, why: "Du håller redan ett CI-flöde igång.", gaps: ["Molninfrastruktur"], gap_months: 12, search: "DevOps" },
  ],
  courses: [
    course("ISTQB Advanced Test Management", "Självstudier, prov hos ackrediterad utbildare", "self", { hours: 60, cost_sek: 7500, ramp_months: 0 }, ["lead", "advise"], { lead: 10, advise: 7 }, "ISTQB", "Testledare", "Standardcertifikatet för testledare, som bygger vidare på din Foundation-nivå."),
    course("UGL", "Internatkurs, 5 dagar", "class", { hours: 43, days: 5, cost_sek: 26000, ramp_months: 3 }, ["lead"], { lead: 9 }, "ledarskap", "QA-ledare", "Den vanliga första ledarskapsutbildningen i svensk industri."),
    course("AI-verktyg för testare", "Onlinekurs i egen takt", "self", { hours: 6, cost_sek: 0, ramp_months: 0 }, ["deeper", "lead", "change", "advise"], 6, "Copilot", "Testledare", "Några timmar räcker för att börja använda AI i testdesign och rapporter."),
    course("Professional Scrum Product Owner", "Självstudier, prov online", "self", { hours: 20, cost_sek: 2200, ramp_months: 1 }, ["change", "lead"], { change: 10, lead: 5 }, "Scrum", "Produktägare", "En erkänd start om du vill gå över till produktarbete."),
    course("ISTQB Advanced Test Automation Engineering", "Självstudier, prov hos ackrediterad utbildare", "self", { hours: 50, cost_sek: 7500, ramp_months: 0 }, ["deeper"], { deeper: 10 }, "Robot Framework", "Ingenjör inom testautomatisering", "Sätter ett namn på automatiseringen du redan gör."),
    course("Kubernetes för utvecklare", "Onlinekurs i egen takt", "self", { hours: 30, cost_sek: 3000, ramp_months: 2 }, ["change", "deeper"], { change: 8, deeper: 4 }, "Kubernetes", "DevOps-ingenjör", "Det är där CI-flödena körs i dag."),
  ],
};
const ANSWERS_SV = {
  letter: "## Personligt brev\nHej Sara Lindqvist,\n\nJag söker tjänsten som testledare på **Nordvik Automotive** eftersom den förenar de två saker jag har arbetat med i tio år: att planera verifieringen av inbyggda system och att bygga automatiseringen som håller den snabb.\n\nPå Göta Telematics planerar och genomför jag releasetester för en telematikenhet till fordon. Jag byggde också teamets automatiserade regressionssvit i Python, som kortade en manuell testcykel från två veckor till två dagar.\n\n- Teststrategi och riskbaserad planering för releaser av inbyggda system\n- Testautomatisering i Python som körs i CI\n- Certifierad enligt ISTQB Foundation\n\nJag berättar gärna hur jag skulle ta mig an er verifieringsplan.\n\nVänliga hälsningar,\nSam Ekström",
  match: "## Det som matchar\n- **Teststrategi** för releaser av inbyggda system, fyra år\n- Testautomatisering i **Python** i CI\n- ISTQB Foundation\n\n## Det som saknas\n1. Att leda ett team på fem står inte i ditt CV\n\n## Samlad bedömning\nEn stark match.",
  cv: "## Profil\nSenior testingenjör med tio års erfarenhet av test av inbyggda och uppkopplade produkter.\n\n## Nyckelkompetenser\n- Teststrategi\n- Testautomatisering i Python",
  interview: "## Troliga frågor\n1. Hur bestämmer du vad som ska testas först i en release?\n2. Berätta om regressionssviten du byggde.",
};
http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const send = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.method === "GET" && req.url === "/last") return send(200, { ok: true });
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") return send(404, {});
  const msg = JSON.parse(body).messages, sv = /^Du /.test(msg[0].content);
  if (/career mentor|karriärmentor/.test(msg[0].content)) {
    await new Promise(r => setTimeout(r, 2600));
    return send(200, { choices: [{ message: { content: "```json\n" + JSON.stringify(sv ? MENTOR_SV : MENTOR) + "\n```" } }], usage: { prompt_tokens: 1500, completion_tokens: 1800 } });
  }
  const ask = msg[1].content;
  const reply = (content, ms) => new Promise(r => setTimeout(r, ms)).then(() => send(200, { choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 1200, completion_tokens: 300 } }));
  // The server's one correction pass after the fact check (server/pipeline.js): the CV without what was flagged
  if (!sv && /A check in code found/.test(ask) && /<text>\n# Sam Ekström/.test(ask)) return reply(CV_DRAFTS.corrected, 700);
  const task = /cover letter|personligt brev/i.test(ask) ? "letter" : /Tailor the CV|Anpassa CV/i.test(ask) ? "cv" : /interview|intervju/i.test(ask) ? "interview" : "match";
  // What Sam wrote under the answer comes at the end of the CV, under a heading of its own (server/prompts.js)
  if (!sv && task === "cv" && /\nAdded by the person:\n[^\n]*ISO 26262/.test(ask)) return reply(CV_DRAFTS.added, 2400);
  await reply((sv ? ANSWERS_SV : ANSWERS)[task], 2400);
}).listen(+process.argv[2] || 8798, "127.0.0.1");
