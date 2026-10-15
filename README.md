# Job Finder

**Svenska:** Job Finder är en gratis jobbsökare för Sverige. Välj ort och avstånd, skriv egna sökord (till exempel yrkestitlar, kunskaper eller metoder) och se vilka arbetsgivare som har lediga jobb just nu. Annonserna kommer från Platsbanken och andra svenska jobbsajter. Du kan spara jobb, följa dina ansökningar och skriva anteckningar. I steg 2 anpassar en AI ditt CV, ett personligt brev eller en intervjuförberedelse till ett jobb du hittat. Allt sparas i din egen webbläsare. Inget konto, inga kakor, ingen spårning.

**English:** Job Finder is a free job search for Sweden. Pick a place and a distance, add your own keywords (job titles, skills, tools or methods) and see which employers are hiring right now. Ads come from Platsbanken and other Swedish job sites. You can save roles, track your applications and keep notes. In step 2 an AI tailors your CV, a cover letter or interview prep to a job you found. Everything stays in your own browser. No account, no cookies, no tracking.

**Try it:** [jmawd.github.io/job-finder](https://jmawd.github.io/job-finder/) (or download `Job Finder.html` and open it in your browser)

![Job Finder results](docs/screenshots/results-en.png)

## What it does

- Searches Platsbanken (Arbetsförmedlingen) and other job sites collected by JobTech, such as The Hub and Ledigajobb.
- Place: any of Sweden's 290 municipalities with a distance of 10 to 100 km, a whole county, or the whole country.
- Keywords: each one is searched on its own and the results are combined. Tags show which of your keywords each ad actually mentions, and you can keep only ads that mention all of them. A second field leaves out ads with words you don't want.
- Groups the ads by employer, shows the contact people named in the ads, and links to a LinkedIn search for people at the employer.
- Hiring history: when you open an employer it checks the past two years of Platsbanken ads, so you can see whether that kind of role comes up there regularly.
- Tracks applications as Saved, Applied, Interview, Offer, Rejected or Not interested, with notes. They stay in My applications when you search for something else.
- Step 2, tailor my application: each role has a button that opens a panel with the full ad and your CV (paste it or load a Word file). It writes a match check, a tailored CV, a cover letter or interview prep, in Swedish or English, which you can copy or download as a Word file. The AI is told never to invent experience that isn't in your CV.
- Swedish and English, works on phones, exports to CSV, and lets you download and restore a backup of your saved data, including your CV and tailored texts.

![Tailoring a cover letter](docs/screenshots/tailor-en.png)

## How it works

The whole app is one HTML file with no server behind it. Searches go straight from the browser to JobTech's open APIs (`jobsearch`, `historical` and `links` at api.jobtechdev.se), which allow requests from any web page. Saved roles, notes and contacts are kept in the browser's local storage.

To find a place, the app asks Platsbanken for ads in that place and reads their location ids and coordinates, so it needs no separate map service.

Step 2 needs a small server, because an AI model can't be called safely from a public web page. `server/` is one Scaleway Serverless Function (Node 22) in Paris. The browser sends it the CV, the ad and which text to write, with a beta access code. The function checks the code, limits how often each code can be used, adds its own instructions (so the codes only unlock these four jobs) and asks an EU-hosted model through Scaleway Generative APIs. It logs only sizes and timings, never the CV or the ad. Setup steps are in [server/SETUP.md](server/SETUP.md). Without a server address in `config.json`, the app is built without step 2.

## Build and run

```
python3 build.py        # writes index.html and "Job Finder.html"
```

Open `index.html` in a browser, or publish the repo with GitHub Pages (Settings → Pages → deploy from the main branch). Fill in `config.json` with your name, links and the site address first; the site address turns on the link preview image for LinkedIn and other sites. `tailor_url` is the address of the tailoring server.

Source files are in `src/`: `shell.html` (layout and styles), `app.js` (everything else, including both languages), `tailor.js` (step 2) and `munis.txt` (Sweden's municipalities and counties).

## Tests

```
pip install playwright && playwright install chromium
python3 build.py && python3 tests/test_app.py
python3 tests/test_tailor.py          # step 2, against the real server code and a fake AI
cd server && node --test              # the server on its own
```

The tests run the real page in Chromium with JobTech's services replaced by fixed example data, so they work offline. They cover the search requests, keyword tags, filters, application tracking, backup and restore, error messages, Swedish and English, and phone width. The step 2 tests run the server locally with a stand-in for the AI service and check the full ad, Word files in and out, access codes, errors and the backup. The companies and people in the screenshots are made up.

## About

Job Finder is an independent tool. It is not made by, affiliated with or endorsed by Arbetsförmedlingen. Job ads come from Arbetsförmedlingen's open data, published through [JobTech Dev](https://jobtechdev.se). Always check the original ad before you apply.

Designed and built by John Mawdsley, with Claude as coding assistant. MIT licence.
