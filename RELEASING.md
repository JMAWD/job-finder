# Releasing

A release is one PR. Merging it to main deploys the server and publishes the GitHub release.

## Steps
1. `python3 release.py X.Y.Z` sets the version in `config.json` and `server/package.json`, builds the page and starts `docs/releases/X.Y.Z.md`.
2. Write the notes in `docs/releases/X.Y.Z.md`: `## What's new`, one `###` per change, then `### Unchanged`. Plain words, no dashes as punctuation.
3. Run the full suite (see Tests in CLAUDE.md). Commit only the screenshots the change affects.
4. Open a PR and merge it.

The Release workflow (`.github/workflows/release.yml`) then runs on its own, in about two minutes:
- checks the version matches everywhere and the notes exist
- runs the server tests, builds `function-X.Y.Z.zip`
- uploads it to the Scaleway function, deploys, waits for Ready and checks it answers
- publishes release `X.Y.Z` with the notes and the ZIP attached

If it fails, the Actions tab says which step and why. Fix it and run it again with Actions → Release → Run workflow. No release is published until the server deploy has worked.

## Fixed values
| What | Value |
|---|---|
| Scaleway region | `fr-par` |
| Namespace `job-finder` | `cfbe37f4-ee74-4af1-8c62-b21085a0be8e` |
| Function `tailor` | `91af48f0-c142-4d3a-b8e0-2a5c3f7bed57` |
| Endpoint | `https://jobfinderaokuqyuj-tailor.functions.fnc.fr-par.scw.cloud` (a GET answers `{"error":"use_post"}`) |
| ZIP contents | handler.js, prompts.js, pipeline.js, factcheck.js, style.js, titles.json, package.json; handler `handler.handle` |
| Live page | https://jmawd.github.io/job-finder/ (`ABOUT.version` shows the version once Pages has rebuilt) |

## One-time setup: the deploy key
The workflow needs one repository secret, `SCW_SECRET_KEY`. Make it its own key, never the function's AI_KEY:
1. Scaleway: IAM → Applications → Create application `job-finder-deploy`.
2. IAM → Policies → Create policy: principal = that application, permission set `ServerlessFunctionsFullAccess` only, scope = the project.
3. Open the application → API keys → Generate. Copy the secret key.
4. GitHub: repo Settings → Secrets and variables → Actions → New repository secret, name `SCW_SECRET_KEY`, paste it.

To check the key without releasing: Actions → Release → Run workflow, tick the check box. It only reads the function's status.

If the key leaks: delete it on the application, make a new one, replace the secret. It can only change serverless functions in that project.

## Changing a function setting
Settings and secrets on the function (ALLOWED_ORIGINS, AI_MODEL, ACCESS_CODES, limits) are not touched by a release. Change them in the console: Functions → job-finder → tailor → Settings → Deploy.
