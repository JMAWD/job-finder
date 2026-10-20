# sweden-labour-data

The data gathering behind the Labor Market Tracker (Sweden), as a Python package you can install into any project.

It does two things:

1. Fetches live figures from Statistics Sweden (SCB) and Arbetsförmedlingen's JobTech API, with the exact queries the tracker uses, and gives you a client for any other SCB table or Platsbanken ad count.
2. Ships the figures that have no API (ManpowerGroup, Cinode, Sveriges Ingenjörer, Konjunkturinstitutet and Arbetsförmedlingen's monthly releases) as bundled data with their sources and the date they were compiled.

Every dataset comes back as a list of dicts in the same shape the tracker's dashboard uses, so anything built on the dashboard data works with this too.

## Install

From the wheel file:

```
pip install sweden_labour_data-0.1.0-py3-none-any.whl
```

From the source folder (add `-e` to edit it in place):

```
pip install ./sweden-labour-data
```

If you push the folder to GitHub, any project can pull it with:

```
pip install git+https://github.com/<you>/sweden-labour-data
```

It needs Python 3.9+ and `requests`. For DataFrames, install with the pandas extra: `pip install "sweden-labour-data[pandas]"`.

## Quick start

```python
import sweden_labour as sl

sl.list_datasets()                    # ids, titles, live or snapshot

ds = sl.get("tech_employment")        # fetched live from SCB
ds.rows[:2]
# [{'quarter': '2019 Q1', 'date': '2019-03-31', 'sector': 'All jobs', 'thousands': 5216.6}, ...]
df = ds.to_frame()                    # needs pandas

sl.collect(out_dir="data")            # every dataset to data/<id>.json plus manifest.json
sl.collect(out_dir="data", fmt="csv") # or CSV
```

If an API is down, a live dataset falls back to the copy bundled with the package and is marked `stale=True` with the reason in `note`. Pass `fallback=False` to get an error instead, or `offline=True` to skip the network entirely.

## Datasets

| id | kind | source |
|---|---|---|
| `tech_employment` | live | SCB TAB4936, employed by sector, seasonally adjusted |
| `regional_jobs` | live | SCB TAB3786, employed by workplace county, sector and sex |
| `job_openings` | live | SCB TAB6406, job openings, whole economy, seasonally adjusted |
| `tech_vacancies` | live | SCB TAB4299, private-sector openings by industry, 2019 to Q1 2024 (survey ended) |
| `openings_by_industry` | live | SCB TAB6398, openings by industry from Q2 2024 (the survey that replaced it) |
| `unemployment_monthly` | live | SCB TAB6387, LFS unemployment rate, raw, seasonally adjusted and trend |
| `job_ads` | live | JobTech historical ads API, Data/IT, technical and all ads, year to date |
| `national_now` | snapshot | SCB and Arbetsförmedlingen, September 2026 |
| `national_yearly` | snapshot | SCB actuals and Konjunkturinstitutet forecast to 2030 |
| `hiring_outlook` | snapshot | ManpowerGroup employment outlook, Q4 2026 |
| `hiring_plans` | snapshot | Konjunkturinstitutet hiring plans, via Ekonomifakta |
| `redundancies` | snapshot | Arbetsförmedlingen redundancy notices, via Ekonomifakta |
| `redundancies_industry` | snapshot | Notices by industry, via Newsworthy |
| `consulting` | snapshot | Cinode, 25 listed Nordic consultancies, quarterly |
| `consulting_yearly` | snapshot | Cinode Konsultkollen, yearly |
| `engineers` | snapshot | Sveriges Ingenjörer unemployment and member survey |

`openings_by_industry` and `unemployment_monthly` are additions: the first picks up tech openings where `tech_vacancies` stops, the second gives the monthly unemployment series. Neither has a bundled copy, so they need the network.

## Any SCB table

```python
from sweden_labour.scb import SCB

scb = SCB()                       # lang="sv" for Swedish labels
scb.dimensions("TAB4936")         # {dimension: {code: label}} to find codes
rows = scb.data("TAB4936", {
    "SNI2007": ["J58-J63", "0003"],
    "ContentsCode": "0000025Q",
    "Tid": "top(8)",              # also "*", "from(2019K1)", "range(2020K1,2021K4)"
}, with_labels=True)
```

Find table ids at statistikdatabasen.scb.se. SCB allows 30 requests per 10 seconds and 150,000 cells per request; the client spaces requests out for you.

PxWebApi v2 currently answers at `https://api.scb.se/ov0104/v2beta/api/v2`. If SCB moves it, set the environment variable `SWEDEN_LABOUR_SCB_BASE` to the new address, or pass `SCB(base_url=...)`.

## Any ad count

```python
import datetime as dt
from sweden_labour.jobtech import JobTech, OCCUPATION_FIELDS, job_ads

jt = JobTech()
jt.count_ads(dt.date(2026, 1, 1), dt.date(2026, 9, 30), occupation_field="Data/IT")
# {'ads': ..., 'positions': ...}

job_ads(start_year=2020)          # the tracker's table: 1 Jan to end of last full month, each year
```

`OCCUPATION_FIELDS` maps all 21 occupation fields to their taxonomy ids. Extra keyword arguments to `count_ads` go straight to the API (`q="python"`, `region=...`). No API key is needed.

## Command line

```
sweden-labour list
sweden-labour fetch tech_employment --format csv
sweden-labour fetch --out data                   # everything, with manifest.json
sweden-labour fetch --offline --out data         # bundled copies only
sweden-labour scb TAB4936                        # list a table's codes
sweden-labour scb TAB4936 --select SNI2007=J58-J63 --select ContentsCode=0000025Q --select Tid=top(4)
sweden-labour ads 2026-01-01 2026-09-30 --field Data/IT
```

`python -m sweden_labour` works the same way.

## Keeping the snapshots current

The snapshot datasets are compiled by hand because their publishers have no API. Each file in `src/sweden_labour/data/snapshots/` holds the rows, a description of where they came from and an `as_of` date. To update one, edit that file and reinstall, or keep your own copy and load it with `sl.load_file("my_hiring_outlook.json")`.

Where each one comes from:

- `hiring_outlook`: ManpowerGroup's quarterly Employment Outlook Survey press release for Sweden.
- `hiring_plans`, `redundancies`: Ekonomifakta's charts of Konjunkturinstitutet's business survey and Arbetsförmedlingen's notices.
- `redundancies_industry`: Newsworthy's monthly articles on Arbetsförmedlingen notices. Industry codes changed in August 2026.
- `consulting`, `consulting_yearly`: Cinode's quarterly economic reports and yearly Konsultkollen.
- `engineers`: Sveriges Ingenjörer reports and press releases.
- `national_now`, `national_yearly`: SCB's monthly LFS release, Arbetsförmedlingen's monthly statistics and Konjunkturinstitutet's forecast.

## Caveats

- `job_ads` counts depend on JobTech's archive, whose coverage varies by year. Compare years with care.
- `openings_by_industry` is not seasonally adjusted and covers the whole economy, while `tech_vacancies` covered the private sector. Compare a quarter with the same quarter a year earlier rather than splicing the two series.
- `regional_jobs` returns every region and sector combination you ask for; by default that is information and communication and manufacturing for Sweden, Stockholm, Skåne and Västra Götaland.

## Tests

```
pip install -e .
python -m unittest discover -s tests
```

The tests answer the API calls with fake responses, so they run without the network.
