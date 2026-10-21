# Job Finder

**Svenska:** Job Finder är en gratis jobbsökare för Sverige. Välj ort och avstånd, skriv egna sökord (till exempel yrkestitlar, kunskaper eller metoder) och se vilka arbetsgivare som har lediga jobb just nu. Annonserna kommer från Platsbanken och andra svenska jobbsajter. Du kan spara jobb, följa dina ansökningar och skriva anteckningar. Ovanför resultaten visas mässor, konferenser och jobbmässor inom ditt område. Platsbanken-annonser kan översättas till appens språk utan att ditt CV skickas. I steg 2 anpassar en AI ditt CV, ett personligt brev eller en intervjuförberedelse till ett jobb du hittat. Mentorn läser ditt CV och föreslår jobb du kan söka och kurser eller certifikat som håller dig eftertraktad, utifrån din erfarenhet och dina planer, aldrig din ålder. Fliken Marknaden visar hur många arbetsgivare inom ditt yrkesområde som annonserar jämfört med för ett år sedan, bredvid de senaste siffrorna för Sverige, och efter några avslag förklarar appen vad siffrorna betyder för dig. Allt sparas i din egen webbläsare. Inget konto, inga kakor, ingen spårning.

**English:** Job Finder is a free job search for Sweden. Pick a place and a distance, add your own keywords (job titles, skills, tools or methods) and see which employers are hiring right now. Ads come from Platsbanken and other Swedish job sites. You can save roles, track your applications and keep notes. Above the results it shows trade fairs, conferences and job fairs in your field. Platsbanken ads can be translated into the app's language without sending your CV. In step 2 an AI tailors your CV, a cover letter or interview prep to a job you found. The Mentor reads your CV and suggests roles to apply for and courses or certificates that keep you in demand, judged by your experience and your plans, never your age. The Market tab shows how many employers in your field are advertising compared with a year ago, next to the latest figures for Sweden, and after a few rejections the app explains what those figures mean for you. Everything stays in your own browser. No account, no cookies, no tracking.

**Try it:** [jmawd.github.io/job-finder](https://jmawd.github.io/job-finder/) (or download `Job Finder.html` and open it in your browser)

![Job Finder results](docs/screenshots/results-en.png)

## What it does

- Searches Platsbanken (Arbetsförmedlingen) and other job sites collected by JobTech, such as The Hub and Ledigajobb.
- Place: any of Sweden's 290 municipalities with a distance of 10 to 100 km, a whole county, or the whole country.
- Keywords: each one is searched on its own and the results are combined. Tags show which of your keywords each ad actually mentions, and you can keep only ads that mention all of them. A second field leaves out ads with words you don't want.
- A keyword of several words is searched as one exact phrase. If almost no ads in Sweden use that phrase but its parts find plenty, the app offers to split it, so "project leader engineering" becomes "project leader" and "engineering". Real phrases like "project leader" stay together.
- Common job titles written in English also search the word Swedish ads use, so "project manager" brings in ads for "projektledare". The Swedish word shows next to the keyword and can be removed. The list of titles is in `src/titles.txt`.
- Groups the ads by employer, shows the contact people named in the ads, and links to a LinkedIn search for people at the employer.
- Fairs and events in your field: above the employers, a panel lists upcoming trade fairs, conferences and job fairs that fit the search, soonest first, with the venue, how far away it is and why it was picked. It reads the calendars of Stockholmsmässan, Kistamässan and Malmömässan, plus job fairs from Visit Sweden's open data near the searched place. An event fits when it mentions one of your keywords, or when it's in the same area of work as most of the ads the search found. Fairs for the general public, school fairs and cancelled events are left out, and the panel only appears when something fits. It can be hidden.
- Hiring history: when you open an employer it checks the past two years of Platsbanken ads, so you can see whether that kind of role comes up there regularly.
- Tracks applications as Saved, Applied, Interview, Offer, Rejected or Not interested, with notes. They stay in My applications when you search for something else. They're stored only in the browser, so the first time you save a job the app suggests downloading a copy, and My applications shows how many changes you've made since your last copy.
- Welcome back: when you return after a while, a card at the top tells you how many new Platsbanken ads match your last search since you ran it, with a button that shows just those. It also lists applications that have waited long enough to follow up on (7 days after applying once the deadline has passed, or 14 days whatever the deadline), with a link to email or call the contact named in the ad. Mark a follow-up as done or ask to be reminded in a week. It's all worked out in your browser, with no AI.
- Four parts in one app, in the top bar: Find jobs, My applications, the Market and the Mentor. On a phone they share the width under the logo, each with an icon, so none is hidden off the edge of the screen.
- When the job ad services don't answer, the results area says why and has a Try again button. Earlier results stay on screen with a note that the new search didn't go through. Above the results it says when they were last checked, and once they're a day old it suggests searching again. Hiring history, the Mentor's open-ad counts and the full ad in step 2 each have their own Try again.
- Feedback during the beta: the footer has a link for each kind of problem (something isn't working, ads are wrong or missing, an AI answer was wrong, an idea, something else). Each opens a new GitHub issue with the app version, language, tab and browser filled in. Nothing from your searches or CV is added, and the page says reports are public. The same link sits next to AI answers and error messages.
- Step 2, tailor my application: each role has a button that opens a panel with the full ad and your CV (paste it or load a Word file). It writes a match check, a tailored CV, a cover letter or interview prep, in Swedish or English, which you can copy or download as a Word file. Platsbanken ads written in another language than the app also have a Translate button that translates the full ad into the app's language using an access code; it sends only the ad text, never your CV, and translations have their own limit so they don't use up a code's tailoring and Mentor requests. The AI is told never to invent experience that isn't in your CV, and every answer is then checked by plain code: any employer, job title or date that your CV doesn't back up is listed in red above the text, so you can take it out before you use it. Every answer also has a note above it saying it's an AI draft to check, worded for the task: a tailored CV or cover letter should lose anything you couldn't explain in an interview, the match check is an estimate, and interview prep has likely questions, not the employer's own.
- Mentor: reads your CV once and shows what it read (experience, roles, career stage), then asks four quick questions: how many more years you see yourself working, where you want to go next, how much time you have for learning each week and who pays for courses. It suggests roles in three tiers (apply now, within reach, a change of track) and a learning plan, and sets aside anything that doesn't fit your answers with the reason. Changing an answer re-ranks the advice at once, without a new AI call. Each role shows how many ads are open right now and has a button that runs the search in Find jobs; each course shows how often its skill is named in recent ads for that role. Career stage comes only from experience and seniority, and the AI is told never to estimate or use age. A note above the roles says the advice comes from an AI that has only read your CV and your four answers, and that course details can be wrong.
- Market: how the job market looks for your field, worked out with no AI. It picks your field (one of Platsbanken's 21 occupation fields) from your applications and searches, and you can change it or pick any county. On the 1st of every month a scheduled job counts the ads published in every field and county over the last three full months and compares them with the same months a year earlier, and the page says whether it's a tough market, slower than last year, about the same or busier, with the open ads on the 1st and how your field compares with the job market as a whole. Below are the latest figures for Sweden: new job postings, unemployment (with Konjunkturinstitutet's forecast), redundancy notices, job openings and ManpowerGroup's hiring outlook, plus figures for the industries closest to your field. Every chart has a table, and each figure shows its source and date. The tab sends no requests of its own.
- After a few rejections: when you mark your third application as Rejected, a pop-up says what the market figures mean for your field, for example that IT ads are down about a quarter on a year ago while unemployment is 8.6%, so even strong candidates hear no more often than usual. It then suggests the Mentor for ideas on becoming a stronger candidate. It comes back after every three more rejections, at most once every two weeks.
- One CV for everything: the Mentor and step 2 read the same copy, saved in your browser.
- Four colour themes, picked with the split circles at the top of Find jobs: seafoam and sunshine, lavender and peach, ocean and mint, or terracotta and sand. One click recolours every view, step 2 and the Mentor, in light and dark mode, and the choice is kept for your next visit.
- Swedish and English, works on phones, exports to CSV, and lets you download and restore a backup of your saved data, including your CV, tailored texts and the Mentor's advice.

![Tailoring a cover letter](docs/screenshots/tailor-en.png)

![The fact check flagging an invented employer, title and date](docs/screenshots/factcheck-en.png)

![The Mentor](docs/screenshots/mentor-en.png)

![The Market](docs/screenshots/market-en.png)

![After a few rejections](docs/screenshots/nudge-en.png)

![Welcome back](docs/screenshots/welcome-en.png)

![Fairs and events in your field](docs/screenshots/events-en.png)

## How it works

The whole app is one HTML file with no server behind it. Searches go straight from the browser to JobTech's open APIs (`jobsearch`, `historical` and `links` at api.jobtechdev.se), which allow requests from any web page. Saved roles, notes and contacts are kept in the browser's local storage.

Fairs and events come from the venues' own calendar APIs (Stockholmsmässan's WordPress events calendar, Kistamässan's and Malmömässan's WordPress event lists) and Visit Sweden's national API at data.visitsweden.com, which all allow requests from any web page. The app downloads each calendar whole and matches it in the browser, so no search words are sent to them, and keeps them for 12 hours. These aren't documented public APIs, so a calendar that stops answering is left out with a note, and the rest still work. Svenska Mässan and Elmia couldn't be read from a web page when this was built.

To find a place, the app asks Platsbanken for ads in that place and reads their location ids and coordinates, so it needs no separate map service.

Step 2 and the Mentor need a small server, because an AI model can't be called safely from a public web page. `server/` is one Scaleway Serverless Function (Node 22) in Paris. The browser sends a beta access code; ad translation sends only the ad text, application-writing tasks send the CV and ad, and the Mentor sends only the CV. The function checks the code, limits how often each code can be used, adds its own instructions (so the codes unlock these specific tasks, not a general chatbot) and asks an EU-hosted model through Scaleway Generative APIs. For the Mentor the model answers with JSON: a pool of roles and courses with hours, costs and which directions they suit. The browser checks that answer, ranks it against the four answers and counts open ads for each role straight from JobTech. Before a written answer goes back, the function runs a fact check on it (`server/factcheck.js`, see below). The function logs only sizes, timings and how many things the check flagged, never the CV, the ad or the flagged words. Setup steps are in [server/SETUP.md](server/SETUP.md). Without a server address in `config.json`, the app is built without step 2 and the Mentor.

### The fact check

Telling a model not to invent things is not the same as knowing it didn't. So every match check, tailored CV, cover letter and interview prep is checked in code, on the server, before it reaches you. The check reads the answer line by line and lists every employer, job title and date that the CV doesn't back up:

- **Dates:** every year in the answer must be in the CV, the ad or your own wishes (this year and next are allowed, for when you can start). On a role line such as `Kvalitetsingenjör, Nordvik Automotive (2018–nu)` the years must be the ones the CV gives for that employer, and "now" only counts if the CV says the job is current.
- **Employers:** names on role lines, and after "at", "worked at", "hos", "arbetat på" and the like, must be in the CV. The employer you are applying to is fine in a heading or "I'd like to join …", but not as a past job.
- **Job titles:** titles on role lines and after "worked as" or "arbetat som" must be in the CV. A title may be translated (Production Technician for Produktionstekniker) but not upgraded: "Senior Quality Engineer" is flagged when the CV says Kvalitetsingenjör.

It is deliberately plain code rather than a second AI call, so the model can't talk its way past it. It doesn't judge skills, figures or wording; those stay covered by the instructions to the model and by reading the answer.

Two kinds of tests keep it honest. `server/factcheck.test.js` is a property test: it generates hundreds of random CVs (Swedish and English, current and past jobs, three layouts) and answers written from them in the ways the model writes, and checks two properties on every one. An answer that only uses facts from the CV must pass, and the same answer with one invented employer, title, "senior", year or date range added must be caught. `FACTCHECK_RUNS=20000 node --test factcheck.test.js` runs 20,000 of each. `server/eval/run.mjs` is the eval against the real model: eight made-up CVs and ads, each task in both languages, three times each (192 answers), with every answer checked and every flag listed in `server/eval/results/latest.md` to be marked as a real invention or a false alarm.

```
cd server && AI_KEY=... node eval/run.mjs     # EVAL_RUNS, EVAL_TASKS, EVAL_LANGS and AI_MODEL change what it runs
```

The Market tab's figures are gathered once a month. On the 1st, `.github/workflows/market.yml` runs `market.py`, which uses the `sweden-labour-data` package in `vendor/` (the data behind my Labor Market Tracker) and writes `data/market.json`, then rebuilds the page and commits both. The figures for Sweden are SCB's latest numbers, fetched live through the package (its own copies if SCB can't be reached), and the figures that have no API (Arbetsförmedlingen's monthly statistics, Konjunkturinstitutet, ManpowerGroup, Sveriges Ingenjörer and Cinode), which are compiled by hand in `vendor/sweden-labour-data/src/sweden_labour/data/snapshots/`, each with the date it was compiled. The counts are Platsbanken ads for each of the 21 occupation fields and all fields, in each of the 21 counties and all of Sweden (about 2,000 counts, 10 to 15 minutes): ads published in the three full months before the 1st, from JobTech's `historical` archive and, for ads still open, `jobsearch`, against the same months a year earlier. Platsbanken's archive covers some years much more fully than others (for July to September, the raw count of IT ads in 2026 is about half of 2025's, while Arbetsförmedlingen's official count of new postings fell 17%), so raw counts can't be compared across years. Instead the page divides a field's change by the change for all ads, which cancels out the archive's coverage, and applies that to Arbetsförmedlingen's official change in new job postings. Below 200 ads this year or 300 a year earlier, counting noise alone could swing the figure by about a fifth, so the comparison is left out and the verdict goes by the nearest wider figure; below 600 ads it's shown with a note that it's a rough guide. The job warns on its summary page when Arbetsförmedlingen's figure is older than the counts; after updating `national_now.json`, run `python3 market.py --national-only` and `python3 build.py`.

## How I thought about it

Job Finder started with a frustration: I wanted to push back against AI-powered CV filters that can screen people out before a person ever sees their application. I wanted to help job seekers find relevant openings and present their real experience clearly, giving them a better chance of being shortlisted. I built it for anyone looking for work—not just engineers—and made it free.

Looking for work is hard enough already, so the app had to be easy to use. It's one page with no account, no install and nothing to set up. Saved jobs, notes and your CV stay in your own browser, because a job search is personal and I didn't want to hold anyone's data. The welcome-back card and follow-up reminders are there so you don't have to remember which ads are new or who to chase.

Search comes first and AI second. Finding employers who are hiring works without any AI. Step 2 and the Mentor only come in once you've picked a job or want advice. They run on my own small server with a model hosted in the EU, so nobody has to install or run a model on their own computer, and the server never logs your CV or the ad.

The AI follows firm rules. It never invents experience that isn't in your CV, and code checks that it didn't: an employer, title or date that isn't in your CV is pointed out before you use the text. The Mentor judges you on your experience and your plans, never your age, and its advice fits how long you plan to keep working and where you want to go next.

Sweden comes first, but the search is built so more countries can be added later.

I built it with Claude as my coding assistant. The tests run the real page against made-up data, so I can change things and know straight away if something broke.

`python3 build.py` joins the source files into one HTML file. They're in `src/`: `shell.html` (layout and styles), `app.js` (everything else, including both languages), `tailor.js` (step 2), `mentor.js` (the Mentor), `events.js` (fairs and events), `market.js` (the Market and the pop-up after a few rejections), `munis.txt` (Sweden's municipalities and counties) and `titles.txt` (English job titles and the Swedish words ads use for them). The Market tab's figures come from `data/market.json` (see above); `python3 market.py` makes a new one by hand (`pip install requests` first).

## Tests

```
pip install playwright && playwright install chromium
python3 build.py && python3 tests/test_app.py
python3 tests/test_market.py          # the Market tab and the pop-up after a few rejections
python3 tests/test_market_counts.py   # the monthly count, without the network
python3 tests/test_tailor.py          # step 2, against the real server code and a fake AI
python3 tests/test_mentor.py          # the Mentor, the same way
python3 tests/test_events.py          # fairs and events, with example venue calendars
cd server && node --test              # the server on its own, the fact check's property tests and the eval's plumbing
```

The demo video is made the same way, with made-up ads and a stand-in AI: `python3 demo/record.py && python3 demo/compose.py` writes `demo/out/job-finder-demo.mp4`, and `python3 demo/record.py sv && python3 demo/compose.py sv` makes the Swedish version.

The tests run the real page in Chromium with JobTech's services replaced by fixed example data, so they work offline. They cover the search requests, keyword tags, splitting phrases, Swedish words for English titles, filters, application tracking, the welcome-back card and follow-up reminders, the colour themes and their contrast, the Market tab's figures, charts and fallbacks, the monthly count, the pop-up after a few rejections, backup and restore and the reminders to keep a copy, error messages, failed and day-old searches and Try again, the feedback links, Swedish and English, phone width with all four tabs in view, focus rings and their contrast in every view and both colour schemes, Escape and focus return in both pop-ups, and 200% and 400% zoom. The step 2 and Mentor tests run the server locally with a stand-in for the AI service and check the full ad and fetching it again, the notes on AI answers, the fact check passing and flagging an invented job, Word files in and out, access codes, errors, the Mentor's answers re-ranking roles and courses, the jump from a role to Find jobs and the backup. The companies and people in the screenshots are made up.

## About

Job Finder is an independent tool. It is not made by, affiliated with or endorsed by Arbetsförmedlingen. Job ads come from Arbetsförmedlingen's open data, published through [JobTech Dev](https://jobtechdev.se). Always check the original ad before you apply.

Designed and built by [John Mawdsley](https://www.linkedin.com/in/john-billy-mawdsley-0000b069/), with Claude as coding assistant.

## Licence

Copyright (c) 2026 John Mawdsley. All rights reserved.

You're welcome to read the code here and to use the app at [jmawd.github.io/job-finder](https://jmawd.github.io/job-finder/), but you may not copy, change, host or sell it without my written permission. Versions published before 20 October 2026 were under the MIT licence. The full terms are in [LICENSE](LICENSE).
