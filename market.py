"""Gathers the Market tab's figures once a month and writes them to data/market.json.

    pip install requests
    python3 market.py                  # then python3 build.py
    python3 market.py --national-only  # only the figures for Sweden, keeping this month's counts (after editing a snapshot)
    python3 market.py --national-only --offline   # the same with the package's own copies, no network

On the 1st of every month .github/workflows/market.yml runs this, rebuilds the page and commits both, so visitors'
browsers never search for market data themselves. It uses the sweden-labour-data package in vendor/ (the data behind
the Labor Market Tracker) for two things:

1. The figures for Sweden: SCB's latest numbers, fetched live (the package's own copy if SCB can't be reached), and the
   figures that have no API (Arbetsförmedlingen, Konjunkturinstitutet, ManpowerGroup, Sveriges Ingenjörer, Cinode),
   which are compiled by hand in vendor/sweden-labour-data/src/sweden_labour/data/snapshots/.
2. Platsbanken ad counts for every occupation field in every county and in all of Sweden: ads published in the last
   three full months, both those in the archive and those still open, the same months a year earlier, and all open ads.
   About 2,000 counts, which take 10 to 15 minutes with the package's polite spacing."""
import calendar, datetime as dt, json, os, pathlib, re, sys

here = pathlib.Path(__file__).parent
sys.path.insert(0, str(here / 'vendor' / 'sweden-labour-data' / 'src'))
import sweden_labour as sl
from sweden_labour._http import HttpClient

JOBSEARCH = 'https://jobsearch.api.jobtechdev.se/search'
TAXONOMY = 'https://taxonomy.api.jobtechdev.se/v1/taxonomy/main/concepts?type=region&relation=narrower&related-ids=i46j_HmG_v64'
# Sweden's 21 counties and their JobTech ids, used if the taxonomy service can't be reached
COUNTIES = [['Blekinge län', 'DQZd_uYs_oKb'], ['Dalarnas län', 'oDpK_oZ2_WYt'], ['Gotlands län', 'K8iD_VQv_2BA'], ['Gävleborgs län', 'zupA_8Nt_xcD'],
            ['Hallands län', 'wjee_qH2_yb6'], ['Jämtlands län', '65Ms_7r1_RTG'], ['Jönköpings län', 'MtbE_xWT_eMi'], ['Kalmar län', '9QUH_2bb_6Np'],
            ['Kronobergs län', 'tF3y_MF9_h5G'], ['Norrbottens län', '9hXe_F4g_eTG'], ['Skåne län', 'CaRE_1nn_cSU'], ['Stockholms län', 'CifL_Rzy_Mku'],
            ['Södermanlands län', 's93u_BEb_sx2'], ['Uppsala län', 'zBon_eET_fFU'], ['Värmlands län', 'EVVp_h6U_GSZ'], ['Västerbottens län', 'g5Tt_CAV_zBd'],
            ['Västernorrlands län', 'NvUF_SP1_1zo'], ['Västmanlands län', 'G6DV_fKE_Viz'], ['Västra Götalands län', 'zdoY_6u5_Krt'], ['Örebro län', 'xTCk_nT5_Zjm'],
            ['Östergötlands län', 'oLT3_Q9p_3nn']]
DATASETS = ('national_now', 'national_yearly', 'hiring_outlook', 'hiring_plans', 'redundancies', 'engineers', 'consulting', 'tech_employment', 'job_openings')


def window(today):
    """The last three full months before today, and the same months a year earlier, as ISO dates."""
    end = today.replace(day=1) - dt.timedelta(days=1)
    m = end.month - 2
    start = dt.date(end.year + (m - 1) // 12, (m - 1) % 12 + 1, 1)
    prev_end = dt.date(end.year - 1, end.month, calendar.monthrange(end.year - 1, end.month)[1])
    return {'from': start.isoformat(), 'to': end.isoformat(), 'from_prev': start.replace(year=start.year - 1).isoformat(), 'to_prev': prev_end.isoformat()}


def national(offline=False):
    """The figures for Sweden, trimmed to what the Market tab draws, each with the date it was compiled."""
    def last_periods(rows, key, n):   # the last n months or quarters, for every sector the rows have
        periods = sorted({r[key] for r in rows})[-n:]
        return [r for r in rows if r[key] in periods]
    trim = {'redundancies': lambda r: last_periods(r, 'month', 25), 'hiring_plans': lambda r: last_periods(r, 'month', 13),
            'tech_employment': lambda r: last_periods(r, 'quarter', 5), 'job_openings': lambda r: last_periods(r, 'quarter', 5)}
    out = {}
    for did in DATASETS:
        ds = sl.get(did, offline=offline)
        out[did] = {'as_of': ds.as_of, 'stale': ds.stale, 'rows': trim.get(did, lambda r: r)(ds.rows)}
        if did == 'hiring_outlook':   # the survey quarter is only named in the description, e.g. "outlook for Q4 2026"
            m = re.search(r'\bQ([1-4]) (\d{4})', ds.description)
            out[did]['period'] = f'{m.group(2)} Q{m.group(1)}' if m else ''
        if ds.stale and not offline:
            print(f'  {did}: {ds.note[:160]}')
    return out


def counties(http):
    try:
        got = sorted([c['taxonomy/preferred-label'], c['taxonomy/id']] for c in http.get_json(TAXONOMY))
        if len(got) == 21:
            return got
        print(f'  The taxonomy service listed {len(got)} counties, so the built-in list is used')
    except Exception as exc:
        print(f'  Counties from the built-in list: {exc}')
    return COUNTIES


def count_all(fields, regions, w, hist, live):
    """[closed ads in the archive, ads still open, the same months a year earlier, all open ads now] for every field
    (and all fields, "") in every county (and all of Sweden, ""), keyed "field|county". hist(after, before, field, region)
    counts the archive, live(after, before, field, region) the open ads, with None dates for all open ads.
    A count that fails is left as None, which the page treats as unknown."""
    out, failed = {}, 0
    def safe(fn, *a):
        nonlocal failed
        try:
            return fn(*a)
        except Exception as exc:
            failed += 1
            print(f'  failed: {a}: {exc}')
            return None
    for f in [''] + [fid for _, fid in fields]:
        for r in [''] + [rid for _, rid in regions]:
            out[f'{f}|{r}'] = [safe(hist, w['from'], w['to'], f, r), safe(live, w['from'], w['to'], f, r),
                               safe(hist, w['from_prev'], w['to_prev'], f, r), safe(live, None, None, f, r)]
    if None in out['|']:
        raise RuntimeError('The counts for all of Sweden failed, so the month can\'t be compared. Nothing was written.')
    if failed > len(out):   # more than one in four
        raise RuntimeError(f'{failed} counts failed, so nothing was written. Platsbanken may be down; run it again later.')
    return out


def note(text):
    """A warning in the log, and on the run's summary page on GitHub."""
    print(text)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as fh:
            fh.write(f'- {text}\n')


def check_postings(nat, w):
    """The field estimates lean on Arbetsförmedlingen's change in new postings, which is compiled by hand."""
    post = next((r for r in nat['national_now']['rows'] if r['metric'] == 'New job postings'), None)
    month = dt.datetime.strptime(post['period'], '%b %Y').date() if post else None
    if not month or month.strftime('%Y-%m') < w['to'][:7]:
        note(f'Arbetsförmedlingen\'s new postings figure is for {post["period"] if post else "no month"}, but the counts run to {w["to"][:7]}. '
             'Update national_now.json in vendor/sweden-labour-data/src/sweden_labour/data/snapshots/ when the next release is out, '
             'then run python3 market.py --national-only and python3 build.py.')


def main():
    args = sys.argv[1:]
    path = here / 'data' / 'market.json'
    if '--national-only' in args:
        data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
        data['fields'] = sorted([label, fid] for label, fid in sl.jobtech.OCCUPATION_FIELDS.items())
        data.setdefault('regions', COUNTIES); data.setdefault('counts', None)
        data['datasets'] = national(offline='--offline' in args)
        path.parent.mkdir(exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
        if data['counts']: check_postings(data['datasets'], data['counts']['window'])
        print('data/market.json: figures for Sweden updated' + ('' if data['counts'] else ', no ad counts yet'))
        return
    today = dt.date.today()
    w = window(today)
    print(f'Counting {w["from"]} to {w["to"]} against {w["from_prev"]} to {w["to_prev"]}')
    jobtech = sl.jobtech.JobTech()   # the archive, through the package
    http = HttpClient(min_interval=0.2, timeout=60)

    def hist(after, before, field, region):
        extra = {'region': region} if region else {}
        return jobtech.count_ads(dt.date.fromisoformat(after), dt.date.fromisoformat(before), occupation_field=field or None, **extra)['ads']

    def live(after, before, field, region):
        params = {'limit': 0}
        if after: params['published-after'] = f'{after}T00:00:00'
        if before: params['published-before'] = f'{before}T23:59:59'
        if field: params['occupation-field'] = field
        if region: params['region'] = region
        total = http.get_json(JOBSEARCH, params=params).get('total', {})
        return int(total.get('value', 0) if isinstance(total, dict) else total or 0)

    fields = sorted([label, fid] for label, fid in sl.jobtech.OCCUPATION_FIELDS.items())
    regions = counties(http)
    nat = national()
    counts = count_all(fields, regions, w, hist, live)
    path.parent.mkdir(exist_ok=True)
    data = {'fields': fields, 'regions': regions, 'datasets': nat, 'counts': {'on': today.isoformat(), 'window': w, 'n': counts}}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    check_postings(nat, w)
    print(f'data/market.json written: {len(counts)} combinations of field and place')


if __name__ == '__main__':
    main()
