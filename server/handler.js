"use strict";
/*
  Job Finder tailoring server: one Scaleway Serverless Function (Node 22).

  Job Finder's tailoring server: translation sends only ad text, application writing sends a CV and ad, and Mentor reads only a CV. The function checks the beta access code, limits how much each code can use, sends the request to Scaleway Generative APIs (Paris) with the prompts kept here on the server, and returns the text (or, for the Mentor, the advice as JSON). It never stores or logs CV or ad text.

  Environment variables (set on the function in the Scaleway console):
    ALLOWED_ORIGINS   comma-separated sites allowed to call it, e.g. https://name.github.io  (add "null" to allow the downloaded file)
    AI_MODEL          model name, default mistral-medium-3.5-128b
    AI_MODELS         optional comma-separated models a request may pick instead (for comparing models side by side)
    AI_BASE_URL       default https://api.scaleway.ai/v1
    LIMIT_PER_HOUR    requests per access code per hour, default 15
    LIMIT_PER_DAY     requests per access code per day, default 40
  Secret environment variables:
    AI_KEY            an IAM API secret key that is allowed to use Generative APIs
    ACCESS_CODES      comma-separated SHA-256 hashes of the beta access codes (make them with make-codes.mjs)
*/
const crypto = require("crypto");
const { PROMPTS, TASKS, AD_TASKS, CV_TASKS, parseMentor } = require("./prompts.js");

const MAX_CV = 20000, MAX_AD = 20000, MAX_EXTRA = 2000;
const usage = new Map();   // access code hash -> timestamps of recent requests (per running instance)

const env = k => (process.env[k] || "").trim();
const list = k => env(k).split(",").map(s => s.trim()).filter(Boolean);
const sha256 = s => crypto.createHash("sha256").update(s, "utf8").digest("hex");

function corsHeaders(origin) {
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600", "Vary": "Origin" };
}
function reply(status, data, origin) {
  return { statusCode: status, headers: { "Content-Type": "application/json; charset=utf-8", ...(origin ? corsHeaders(origin) : {}) }, body: JSON.stringify(data) };
}
const fail = (status, code, origin, extra = {}) => reply(status, { error: code, ...extra }, origin);

function codeOk(code) {
  if (typeof code !== "string" || code.length < 6 || code.length > 64) return null;
  const h = sha256(code.trim().toUpperCase());
  const hb = Buffer.from(h, "hex");
  for (const allowed of list("ACCESS_CODES")) {
    const ab = Buffer.from(allowed.toLowerCase(), "hex");
    if (ab.length === hb.length && crypto.timingSafeEqual(ab, hb)) return h;
  }
  return null;
}
function overLimit(h, now = Date.now()) {
  const perHour = +env("LIMIT_PER_HOUR") || 15, perDay = +env("LIMIT_PER_DAY") || 40;
  const times = (usage.get(h) || []).filter(t => now - t < 864e5);
  const lastHour = times.filter(t => now - t < 36e5).length;
  if (lastHour >= perHour || times.length >= perDay) { usage.set(h, times); return { perHour, perDay }; }
  times.push(now); usage.set(h, times);
  return null;
}
function header(event, name) {
  const h = event.headers || {};
  const k = Object.keys(h).find(x => x.toLowerCase() === name);
  return k ? String(h[k]) : "";
}

async function callModel(messages, model, { maxTokens = 2500, temperature = 0.4, timeout = 90000 } = {}) {
  const base = env("AI_BASE_URL") || "https://api.scaleway.ai/v1";
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST", signal: ctrl.signal,
      headers: { "Authorization": `Bearer ${env("AI_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });
    if (!r.ok) return { error: r.status === 429 ? "ai_busy" : "ai_error", status: r.status };
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) return { error: "ai_empty" };
    return { text: text.trim(), model, tokens: j.usage ? { in: j.usage.prompt_tokens, out: j.usage.completion_tokens } : null };
  } catch (e) {
    return { error: e.name === "AbortError" ? "ai_timeout" : "ai_unreachable" };
  } finally { clearTimeout(timer); }
}

async function handle(event) {
  const origin = header(event, "origin") || "null";
  const allowed = list("ALLOWED_ORIGINS");
  const okOrigin = allowed.includes("*") || allowed.includes(origin) ? origin : null;
  const method = (event.httpMethod || "").toUpperCase();
  if (method === "OPTIONS") return okOrigin ? { statusCode: 204, headers: corsHeaders(okOrigin), body: "" } : { statusCode: 403, body: "" };
  if (!okOrigin) return fail(403, "origin_not_allowed", null);
  if (method !== "POST") return fail(405, "use_post", okOrigin);
  if (!env("AI_KEY") || !list("ACCESS_CODES").length) return fail(503, "not_configured", okOrigin);

  let req;
  try { req = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "")); }
  catch { return fail(400, "bad_json", okOrigin); }
  const h = codeOk(req.code);
  if (!h) return fail(401, "bad_code", okOrigin);
  const task = req.task, lang = req.lang === "en" ? "en" : "sv";
  if (!TASKS.includes(task)) return fail(400, "bad_task", okOrigin, { tasks: TASKS });
  const needsAd = AD_TASKS.includes(task), needsCv = CV_TASKS.includes(task);
  const cv = needsCv && typeof req.cv === "string" ? req.cv.trim() : "", ad = needsAd && typeof req.job?.text === "string" ? req.job.text.trim() : "";
  if (needsCv && cv.length < 200) return fail(400, "cv_too_short", okOrigin);
  if (needsAd && ad.length < 100) return fail(400, "ad_too_short", okOrigin);
  if (cv.length > MAX_CV || ad.length > MAX_AD) return fail(413, "too_long", okOrigin, { maxCv: MAX_CV, maxAd: MAX_AD });
  const limit = overLimit(h);
  if (limit) return fail(429, "limit_reached", okOrigin, limit);

  const job = task === "translate" ? { text: ad } : { title: String(req.job?.title || "").slice(0, 300), employer: String(req.job?.employer || "").slice(0, 200), text: ad };
  const extra = typeof req.extra === "string" ? req.extra.slice(0, MAX_EXTRA) : "";
  const started = Date.now();
  const model = req.model && list("AI_MODELS").includes(req.model) ? req.model : (env("AI_MODEL") || "mistral-medium-3.5-128b");
  const mentor = task === "mentor", translation = task === "translate";
  const options = mentor ? { maxTokens: 4000, temperature: 0.3, timeout: 110000 } : translation ? { maxTokens: 6000, temperature: 0.1 } : undefined;
  const out = await callModel(PROMPTS[task](lang, { cv, job, extra, year: new Date().getFullYear() }), model, options);
  const data = mentor && !out.error ? parseMentor(out.text) : null;
  if (mentor && !out.error && !data) out.error = "ai_bad_format";
  // Only sizes and timings are logged, never the CV or the ad
  console.log(JSON.stringify({ task, lang, model, cvChars: cv.length, adChars: ad.length, ms: Date.now() - started, result: out.error || "ok", tokens: out.tokens || null }));
  if (out.error) return fail(out.error === "ai_busy" ? 503 : 502, out.error, okOrigin);
  return reply(200, mentor ? { data, model: out.model, tokens: out.tokens } : { text: out.text, model: out.model, tokens: out.tokens }, okOrigin);
}

module.exports = { handle, _test: { usage, sha256 } };
