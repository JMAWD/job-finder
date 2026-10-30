# Security

## Reporting a problem

Please don't report security problems in a public issue. Send me a private message on [LinkedIn](https://www.linkedin.com/in/john-billy-mawdsley-0000b069/) with what you found and how to reproduce it. I'll reply as soon as I can and let you know when it's fixed.

Only the latest release and the live app at [jmawd.github.io/job-finder](https://jmawd.github.io/job-finder/) are looked after. Older versions are not patched.

## What's worth reporting

- A way into step 2, the Mentor or ad translation without a valid access code, or past a code's usage limits.
- A way to make the AI server do something other than its fixed tasks, or to make it reveal its keys or other people's access codes.
- Anything that makes the server log, keep or pass on a CV, an ad or the words the fact check flagged.
- Script injection in the page, for example through the text of a job ad, an event or a pasted CV.
- Anything that sends a person's saved jobs, notes or CV out of their browser without them choosing to.

## What isn't a security problem

- The AI writing something wrong. That's what the fact check and the notes on every answer are for. Please report it with the AI answer link in the app instead.
- Wrong or missing job ads, which come from JobTech's open data.
- Data a person can see in their own browser's storage. Everything the app saves is meant to stay there, readable by them.

## How data is handled

There are no accounts, cookies or tracking. Saved jobs, notes, the CV and tailored texts are kept in the browser's local storage. Job searches go straight from the browser to JobTech. The AI server receives only what a task needs (the ad alone for a translation, the CV alone for the Mentor, the CV and ad for application writing), sends it to an EU-hosted model and logs only sizes, timings and counts. More detail is in [How it works](README.md#how-it-works).
