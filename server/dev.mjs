// Runs the function locally on http://localhost:8787 so the app can be tried against it.
//   AI_KEY=... ACCESS_CODES=... ALLOWED_ORIGINS=null node dev.mjs
import http from "node:http";
import { createRequire } from "node:module";
const { handle } = createRequire(import.meta.url)("./handler.js");
http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const out = await handle({ httpMethod: req.method, headers: req.headers, body });
  res.writeHead(out.statusCode, out.headers || {}); res.end(out.body || "");
}).listen(8787, () => console.log("Tailoring server on http://localhost:8787"));
