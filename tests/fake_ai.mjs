// A stand-in for Scaleway Generative APIs, used only by the tests.
//   node tests/fake_ai.mjs 8799
// POST /v1/chat/completions answers with fixed Markdown for each task.
// GET /last returns the last request it received. POST /mode {"status":429} makes the next answers fail.
import http from "node:http";
let last = null, mode = { status: 200, delay: 300 };
const ANSWERS = {
  match: "## Det som matchar\n- **FMEA**: åtta års erfarenhet inom fordonsindustrin\n- Leverantörsrevisioner\n\n---\n\n## Det som saknas\n1. Python nämns inte i CV:t\n\n## Samlad bedömning\nStark match.",
  letter: "## Cover letter\nDear [contact person],\n\nI want to work at **Acme Robotics** because the role joins quality work and software.\n\n- Eight years of FMEA\n- Supplier audits\n\nKind regards,\n[Your name]",
  cv: "## Profil\nKvalitetsingenjör med åtta års erfarenhet.\n\n## Nyckelkompetenser\n- FMEA\n- 8D",
  interview: "## Troliga frågor\n1. Berätta om en FMEA du ledde.\n2. Hur arbetar du med leverantörer?",
};
http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const send = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.method === "GET" && req.url === "/last") return send(200, last || {});
  if (req.method === "POST" && req.url === "/mode") { mode = { ...mode, ...JSON.parse(body || "{}") }; return send(200, mode); }
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    last = { auth: req.headers.authorization, body: JSON.parse(body) };
    await new Promise(r => setTimeout(r, mode.delay));
    if (mode.status !== 200) return send(mode.status, { error: "fake failure" });
    const ask = last.body.messages[1].content;
    const task = /cover letter|personligt brev/i.test(ask) ? "letter" : /Tailor the CV|Anpassa CV/i.test(ask) ? "cv" : /interview|intervju/i.test(ask) ? "interview" : "match";
    return send(200, { choices: [{ message: { content: ANSWERS[task] } }], usage: { prompt_tokens: 1200, completion_tokens: 300 } });
  }
  send(404, {});
}).listen(+process.argv[2] || 8799, "127.0.0.1");
