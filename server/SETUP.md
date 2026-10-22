# Setting up the tailoring server on Scaleway

This is how the live server was set up. Repeat it if you ever need a second one.

1. **An app identity for the AI key.** IAM → Applications → Create application (`job-finder-tailor`). Then IAM → Policies → Create policy: principal = that application, permission set `GenerativeApisModelAccess` only, scope = your project. A key made for this application can call the AI models and nothing else in your account.
2. **The key.** Open the application → API keys → Generate an API key. Copy the **secret key** (the long one with dashes) straight into step 4. It is shown only once. Never paste it anywhere else.
3. **The function.** Serverless Functions → Create (region Paris, namespace `job-finder`, function `tailor`): runtime Node 22, Upload a ZIP (`function.zip` = handler.js, prompts.js, pipeline.js, factcheck.js, style.js, titles.json, package.json), handler `handler.handle`, 256 MB, min 0 and max 1 instance (one instance keeps the per-code limits exact), privacy Public, HTTPS only.
4. **Settings** (Data tab of the function):
   - ALLOWED_ORIGINS = `null` (the downloaded file). Add the GitHub Pages address later, comma-separated, e.g. `null,https://name.github.io`.
   - AI_MODEL = `mistral-medium-3.5-128b`
   - AI_MODELS = the models `compare.html` may pick. Remove it when you have chosen.
   - LIMIT_PER_HOUR = `15`, LIMIT_PER_DAY = `40` (per access code)
   - Optional: TRANSLATE_PER_HOUR (default `20`) and TRANSLATE_PER_DAY (default `60`). Ad translations are counted apart from the other tasks.
   - Secrets: AI_KEY = the secret key from step 2. ACCESS_CODES = the long line from `beta-codes.txt`.
5. Deploy and copy the function endpoint (`https://….functions.fnc.fr-par.scw.cloud`). The address is safe to share; it only works with an access code.
6. Put the endpoint in `config.json` as `tailor_url` and run `python3 build.py`.

**Making the ZIP:** run `python3 build.py` first (it writes `titles.json`), then from `server/`: `zip function.zip handler.js prompts.js pipeline.js factcheck.js style.js titles.json package.json`.

**Checking the model before a beta round:** `AI_KEY=... node eval/run.mjs` runs the fact-check eval against the real model (192 answers, roughly €2–4) and writes the summary to `eval/results/latest.md`. Read the flags there and mark the false alarms before quoting the result.

**Access codes:** `node make-codes.mjs 20` prints new codes and the matching ACCESS_CODES line. Keep the codes private and give one to each tester. To stop a code working, remove its hash from ACCESS_CODES and deploy again.

**Changing a setting:** Functions → job-finder → tailor → Settings → edit → Deploy. Secrets can be replaced but not read back.

**Costs:** with Mistral Medium 3.5 one text costs about €0.005 to €0.02, depending on how long the CV and ad are (the first live match check used 439 tokens in and 460 out, under €0.01). At beta volumes the function itself stays inside Scaleway's free monthly allowance.

**If the key leaks:** IAM → Applications → job-finder-tailor → API keys → delete it, generate a new one and replace AI_KEY. The leaked key could only have been used to run AI models on your bill.
