# Job Finder: handoff

Read this first. Open other files only when the task needs them.

## What it is
Free job search for Sweden in one HTML file, plus a small AI server for step 2 (tailored CV, cover letter, interview prep, ad translation) and the Mentor. Swedish and English. Everything user-side stays in the browser.

- Repo: https://github.com/JMAWD/job-finder (public, all rights reserved since 20 Oct 2026)
- Live: https://jmawd.github.io/job-finder/
- Full docs: README in the repo. Jump to the part you need:
  - [What it does](https://github.com/JMAWD/job-finder#what-it-does)
  - [How it works](https://github.com/JMAWD/job-finder#how-it-works)
  - [Writing like a person](https://github.com/JMAWD/job-finder#writing-like-a-person)
  - [The fact check](https://github.com/JMAWD/job-finder#the-fact-check)
  - [Tests](https://github.com/JMAWD/job-finder#tests)
- Server setup: `server/SETUP.md`
- Releasing: `RELEASING.md` (one PR; merging deploys the server and publishes the release)

## Work list
Jira project Job Finder (JF), only for this app. Nothing from other projects goes in it.
https://johnmawdsley.atlassian.net/jira/software/projects/JF/boards
Open work: `project = JF AND statusCategory != Done`. Fetch only summary and status.

## File map
| Area | File |
|---|---|
| Layout and styles | `src/shell.html` |
| Search, tracking, i18n, everything else | `src/app.js` |
| Step 2 panel, PDF (`pdfBlob`) | `src/tailor.js` |
| Mentor | `src/mentor.js` |
| Fairs and events | `src/events.js` |
| Market tab, rejection pop-up | `src/market.js` |
| Places, English titles | `src/munis.txt`, `src/titles.txt` |
| AI server (Scaleway, Node 22) | `server/` |
| Fact check and sentence trace | `server/factcheck.js` |
| Dash removal, style check | `server/style.js` |
| Correction pass | `server/pipeline.js` |
| Release (version bump, notes, deploy) | `release.py`, `docs/releases/`, `.github/workflows/release.yml` |
| Monthly market data | `market.py`, `data/market.json`, `.github/workflows/market.yml` |

Build: `python3 build.py` joins `src/` into `Job Finder.html`.

## Rules that must not break
- AI text: no em or en dashes as punctuation, uneven job lengths, no buzzwords, nothing made bigger, names never translated.
- Never invent experience. The fact check is plain code, not a second AI call.
- Server never logs the CV, the ad or flagged words. Sizes, timings and counts only.
- Mentor never estimates or uses age.
- No accounts, cookies or tracking. Swedish and English both updated for any UI text.

## Tests (run only the one that fits the change)
- Search, tracking, UI: `python3 build.py && python3 tests/test_app.py`
- Step 2: `python3 tests/test_tailor.py`
- Mentor: `python3 tests/test_mentor.py`
- Market: `python3 tests/test_market.py`, `python3 tests/test_market_counts.py`
- Events: `python3 tests/test_events.py`
- Server: `cd server && node --test`
Full suite only before a release.

## How we work
- One chat per Jira story. Start with the ticket key and the file or function.
- When John says yes to an addition: build, test, push, update README, cut the release, without asking at each step. Cutting the release means `python3 release.py X.Y.Z`, notes in `docs/releases/`, merge; never the browser.
- After a change, update the README section it touched and add a line under "Recent changes" below. Keep this file under a page.

## Recent changes
- 2026-10-27: Set up this handoff and the Jira project JF.
- 2026-10-27 (1.8.2): Key achievements at the top of the tailored CV (`server/prompts.js`, echo check in `server/style.js`); CV aims at two full pages from real material and `pdfBlob` fits the layout to its pages (`fitPages` in `src/tailor.js`).
- 2026-10-27: Release workflow: merging a version bump deploys to Scaleway and publishes the release (`RELEASING.md`).

## Parked
- Moving step 2, Mentor and server to a private repo (on hold).
- Name Kindvance: trademark and app store checks pending.
