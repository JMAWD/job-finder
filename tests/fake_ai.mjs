// A stand-in for Scaleway Generative APIs, used only by the tests.
//   node tests/fake_ai.mjs 8799
// POST /v1/chat/completions answers with fixed Markdown for each task.
// GET /last returns the last request it received and how many came in. POST /mode {"status":429} makes the next answers fail,
// {"mentorBad":true} makes the Mentor's answer come back as Markdown instead of JSON.
import http from "node:http";
let last = null, count = 0, mode = { status: 200, delay: 300, mentorBad: false };
const course = (name, provider, format, extra, directions, priority, skill, forRole, why) => ({ name, provider, format, ...extra, directions, priority, why, skill, for_role: forRole });
const MENTOR = {
  name: "Eva", years: 8, stage: "established", stage_reason: "Eight years in quality roles, the last three leading improvement work.",
  history: [{ title: "Quality Engineer", org: "Nordvik Automotive", years: "2018–now" }, { title: "Production Technician", org: "Svea Bearings", years: "2016–2018" }],
  education: "BSc Mechanical Engineering", certs: "", domains: "Automotive, production", skills: ["FMEA", "8D", "Supplier audits", "Root cause analysis"],
  opener: "Eight years of FMEA and supplier work in automotive is a solid base. Electric and software-heavy vehicles make quality engineers who understand whole systems more valuable.",
  direction_notes: { deeper: "Go deeper with the 2019 FMEA method and the basics of functional safety.", lead: "Take the lead on improvement projects and a first leadership course.",
    change: "Software quality is the closest change, since you already think in risks.", advise: "Become the FMEA trainer people ask for." },
  roles: [
    { title: "Kvalitetsingenjör", tier: "direct", directions: ["deeper"], match: 90, why: "Matches your current work almost one to one.", gaps: [], gap_months: 0, search: "kvalitetsingenjör" },
    { title: "Supplier Quality Engineer", tier: "direct", directions: ["deeper", "advise"], match: 82, why: "Your supplier audits are the core of this role.", gaps: ["PPAP"], gap_months: 2, search: "FMEA" },
    { title: "Quality Manager", tier: "stretch", directions: ["lead"], match: 64, why: "You already lead improvement work.", gaps: ["Leading a team", "Owning ISO 9001"], gap_months: 18, search: "kvalitetschef" },
    { title: "FMEA Trainer", tier: "stretch", directions: ["advise"], match: 60, why: "Teams need people who teach FMEA from experience.", gaps: ["Course delivery"], gap_months: 4, search: "FMEA" },
    { title: "Functional Safety Engineer", tier: "stretch", directions: ["deeper"], match: 55, why: "Builds on your risk analysis.", gaps: ["ISO 26262"], gap_months: 30, search: "ISO 26262" },
    { title: "Software Test Engineer", tier: "pivot", directions: ["change"], match: 45, why: "You already think about how things fail.", gaps: ["Python", "Test automation"], gap_months: 12, search: "software engineer" },
    { title: "Production Manager", tier: "pivot", directions: ["change", "lead"], match: 40, why: "You know the shop floor well.", gaps: ["Budget responsibility"], gap_months: 24, search: "produktionschef" },
  ],
  courses: [
    course("AIAG-VDA FMEA (2019 method)", "Classroom, 2 days", "class", { hours: 16, days: 2, cost_sek: 14000, ramp_months: 0 }, ["deeper", "advise"], { deeper: 10, advise: 9 }, "FMEA", "Kvalitetsingenjör", "Brings your strongest skill up to the current method."),
    course("Python for engineers", "Self-paced online", "self", { hours: 40, cost_sek: 0, ramp_months: 2 }, ["change", "deeper"], { change: 9, deeper: 5 }, "Python", "Kvalitetsingenjör", "Lets you analyse test data yourself."),
    course("UGL leadership course", "Residential course, 5 days", "class", { hours: 40, days: 5, cost_sek: 26000, ramp_months: 3 }, ["lead"], { lead: 10 }, "ledarskap", "Quality Manager", "The usual first leadership course in Swedish industry."),
    course("ISO 26262 Functional Safety Engineer", "Course, 4 days plus exam", "class", { hours: 110, days: 4, cost_sek: 35000, ramp_months: 24 }, ["deeper"], { deeper: 7 }, "ISO 26262", "Functional Safety Engineer", "The entry ticket for functional safety roles."),
    course("Software testing, university course", "University, 25% pace, one term", "program", { hours: 200, months: 5, hours_per_week: 10, cost_sek: 0, ramp_months: 0 }, ["change"], { change: 7 }, "testning", "Software Test Engineer", "Free and gives formal credits."),
    course("AI tools for quality work", "Self-paced online", "self", { hours: 6, cost_sek: 0, ramp_months: 0 }, ["deeper", "lead", "change", "advise"], 6, "AI", "Kvalitetsingenjör", "A few hours is enough to start saving time."),
    course("Train the trainer", "Classroom, 2 days", "class", { hours: 16, days: 2, cost_sek: 11000, ramp_months: 1 }, ["advise"], { advise: 8 }, "utbildning", "FMEA Trainer", "Helps you teach what you know."),
  ],
};
const ANSWERS = {
  match: "## Det som matchar\n- **FMEA**: åtta års erfarenhet inom fordonsindustrin\n- Leverantörsrevisioner\n\n---\n\n## Det som saknas\n1. Python nämns inte i CV:t\n\n## Samlad bedömning\nStark match.",
  letter: "## Cover letter\nDear [contact person],\n\nI want to work at **Acme Robotics** because the role joins quality work and software.\n\n- Eight years of FMEA\n- Supplier audits\n\nKind regards,\n[Your name]",
  cv: "## Profil\nKvalitetsingenjör med åtta års erfarenhet.\n\n## Nyckelkompetenser\n- FMEA\n- 8D",
  interview: "## Troliga frågor\n1. Berätta om en FMEA du ledde.\n2. Hur arbetar du med leverantörer?",
};
http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const send = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.method === "GET" && req.url === "/last") return send(200, { ...(last || {}), count });
  if (req.method === "POST" && req.url === "/mode") { mode = { ...mode, ...JSON.parse(body || "{}") }; return send(200, mode); }
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    last = { auth: req.headers.authorization, body: JSON.parse(body) }; count++;
    await new Promise(r => setTimeout(r, mode.delay));
    if (mode.status !== 200) return send(mode.status, { error: "fake failure" });
    if (/career mentor|karriärmentor/.test(last.body.messages[0].content)) {
      const content = mode.mentorBad ? "## Advice\n- Take a course" : "Here is the advice:\n```json\n" + JSON.stringify(MENTOR) + "\n```";
      return send(200, { choices: [{ message: { content } }], usage: { prompt_tokens: 1500, completion_tokens: 1800 } });
    }
    const ask = last.body.messages[1].content;
    const task = /cover letter|personligt brev/i.test(ask) ? "letter" : /Tailor the CV|Anpassa CV/i.test(ask) ? "cv" : /interview|intervju/i.test(ask) ? "interview" : "match";
    return send(200, { choices: [{ message: { content: ANSWERS[task] } }], usage: { prompt_tokens: 1200, completion_tokens: 300 } });
  }
  send(404, {});
}).listen(+process.argv[2] || 8799, "127.0.0.1");
