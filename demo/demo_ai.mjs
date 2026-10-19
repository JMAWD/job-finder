// A stand-in for the AI service with the demo's fictional answers (Sam Ekström, a test engineer in Göteborg).
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
http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const send = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.method === "GET" && req.url === "/last") return send(200, { ok: true });
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") return send(404, {});
  const msg = JSON.parse(body).messages;
  if (/career mentor|karriärmentor/.test(msg[0].content)) {
    await new Promise(r => setTimeout(r, 2600));
    return send(200, { choices: [{ message: { content: "```json\n" + JSON.stringify(MENTOR) + "\n```" } }], usage: { prompt_tokens: 1500, completion_tokens: 1800 } });
  }
  const ask = msg[1].content;
  const task = /cover letter|personligt brev/i.test(ask) ? "letter" : /Tailor the CV|Anpassa CV/i.test(ask) ? "cv" : /interview|intervju/i.test(ask) ? "interview" : "match";
  await new Promise(r => setTimeout(r, 2400));
  send(200, { choices: [{ message: { content: ANSWERS[task] } }], usage: { prompt_tokens: 1200, completion_tokens: 300 } });
}).listen(+process.argv[2] || 8798, "127.0.0.1");
