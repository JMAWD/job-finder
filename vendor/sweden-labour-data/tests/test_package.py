import contextlib
import datetime as dt
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import sweden_labour as sl
from sweden_labour import cli, datasets, jobtech, scb
from sweden_labour._http import FetchError
from sweden_labour.jsonstat import to_rows

from helpers import DownHttp, FakeHttp, jsonstat, parse_selection

FIXTURES = Path(__file__).parent / "fixtures"
QUARTERS = [f"{y}K{q}" for y in range(2017, 2027) for q in range(1, 5)][:-2]  # 2017K1..2026K2
MONTHS = [f"{y}M{m:02d}" for y in range(2018, 2027) for m in range(1, 13)][:-3]  # ..2026M09


def fake_scb_handler(url, params):
    """Answer like SCB for the tables the package queries, honouring the selection."""
    sel = parse_selection(url)
    table = url.split("/tables/")[1].split("/")[0]
    dims = []
    for dim, codes in sel.items():
        if codes == ["*"]:
            codes = MONTHS if table == "TAB6387" else QUARTERS
        dims.append((dim, codes))

    def value(cell):
        # Deterministic, recognisable numbers.
        return float(len(cell["Tid"]) * 100 + int(cell["Tid"][:4]) % 100)

    return jsonstat(dims, value)


def fake_scb():
    http = FakeHttp(fake_scb_handler)
    return scb.SCB(base_url="https://example.test/api/v2", http=http), http


def bundled_columns(dataset_id):
    rec = json.loads((Path(sl.__file__).parent / "data" / "cache" / f"{dataset_id}.json").read_text(encoding="utf-8"))
    return list(rec["rows"][0].keys())


class JsonStatTests(unittest.TestCase):
    def test_real_shaped_payload(self):
        payload = json.loads((FIXTURES / "tab6406_sample.json").read_text(encoding="utf-8"))
        rows = to_rows(payload, with_labels=True)
        self.assertEqual(len(rows), 4)
        self.assertEqual(rows[1]["SNI2007Naring"], "A-S")
        self.assertEqual(rows[1]["Tid"], "2026K2")
        self.assertEqual(rows[1]["value"], 139600.0)
        self.assertEqual(rows[2]["SNI2007Naring_label"], "J information and communication companies")
        self.assertIsNone(rows[3]["value"])

    def test_row_major_order_and_list_index(self):
        ds = {
            "id": ["a", "b"],
            "size": [2, 3],
            "dimension": {
                "a": {"category": {"index": ["x", "y"]}},
                "b": {"category": {"index": {"p": 0, "q": 1, "r": 2}}},
            },
            "value": [1, 2, 3, 4, 5, 6],
        }
        rows = to_rows(ds)
        self.assertEqual([(r["a"], r["b"], r["value"]) for r in rows][:4],
                         [("x", "p", 1), ("x", "q", 2), ("x", "r", 3), ("y", "p", 4)])

    def test_sparse_values(self):
        ds = {"id": ["a"], "size": [3], "dimension": {"a": {"category": {"index": {"x": 0, "y": 1, "z": 2}}}},
              "value": {"1": 7}}
        self.assertEqual([r["value"] for r in to_rows(ds)], [None, 7, None])

    def test_size_mismatch_is_an_error(self):
        ds = {"id": ["a"], "size": [2], "dimension": {"a": {"category": {"index": {"x": 0}}}}, "value": [1, 2]}
        with self.assertRaises(ValueError):
            to_rows(ds)


class ScbTests(unittest.TestCase):
    def test_query_encoding(self):
        q = scb._query({"Kon": "1+2", "Arbetskraftstillh": ["ALÖSP"], "Tid": "top(8)"})
        self.assertIn("valueCodes[Kon]=1%2B2", q)
        self.assertIn("valueCodes[Arbetskraftstillh]=AL%C3%96SP", q)
        self.assertIn("valueCodes[Tid]=top(8)", q)
        self.assertTrue(q.startswith("outputFormat=json-stat2"))

    def test_periods(self):
        self.assertEqual(scb.quarter_info("2026K2"), {"quarter": "2026 Q2", "date": "2026-06-30"})
        self.assertEqual(scb.month_label("2026M09"), "2026-09")

    def test_tech_employment_matches_dashboard_shape(self):
        client, http = fake_scb()
        rows = scb.tech_employment(client=client)
        self.assertEqual(list(rows[0].keys()), bundled_columns("tech_employment"))
        self.assertEqual(len(rows), 4 * 30)  # 4 sectors, 2019Q1..2026Q2
        self.assertEqual(rows[0]["sector"], "All jobs")
        self.assertEqual(rows[0]["quarter"], "2019 Q1")
        url = http.calls[0][0]
        self.assertIn("/tables/TAB4936/data?lang=en", url)
        self.assertEqual(parse_selection(url)["ContentsCode"], ["0000025Q"])

    def test_regional_jobs(self):
        client, http = fake_scb()
        rows = scb.regional_jobs(client=client)
        self.assertEqual(list(rows[0].keys()), bundled_columns("regional_jobs"))
        self.assertEqual({r["region"] for r in rows}, {"Sweden", "Stockholm", "Skåne", "Västra Götaland"})
        self.assertEqual({r["sex"] for r in rows}, {"Men", "Women"})
        self.assertTrue(all(isinstance(r["employed"], int) for r in rows))
        self.assertEqual(parse_selection(http.calls[0][0])["SNI2007"], ["J", "B+C"])

    def test_job_openings(self):
        client, _ = fake_scb()
        rows = scb.job_openings(client=client)
        self.assertEqual(list(rows[0].keys()), bundled_columns("job_openings"))
        self.assertEqual(len(rows), 30)

    def test_job_openings_uses_seasonally_adjusted_total(self):
        client, http = fake_scb()
        scb.job_openings(client=client)
        sel = parse_selection(http.calls[0][0])
        self.assertEqual(sel["SNI2007Naring"], ["A-S"])
        self.assertEqual(sel["ContentsCode"], ["000007J4"])

    def test_openings_by_industry_continues_vacancies(self):
        client, http = fake_scb()
        rows = scb.openings_by_industry(client=client)
        self.assertEqual(list(rows[0].keys()), bundled_columns("tech_vacancies"))
        self.assertEqual({r["sector"] for r in rows}, set(scb.OPENINGS_SECTORS.values()))
        self.assertEqual(rows[0]["quarter"], "2024 Q2")
        self.assertEqual(len(rows), 4 * 9)
        sel = parse_selection(http.calls[0][0])
        self.assertIn("/tables/TAB6398/", http.calls[0][0])
        self.assertEqual(sel["SNI2007Naring"], ["A-S", "J", "B+C", "M"])

    def test_tech_vacancies_merges_margin(self):
        client, _ = fake_scb()
        rows = scb.tech_vacancies(client=client)
        self.assertEqual(list(rows[0].keys()), bundled_columns("tech_vacancies"))
        self.assertTrue(all(r["openings"] is not None and r["margin"] is not None for r in rows))
        self.assertEqual(len(rows), 4 * 30)

    def test_unemployment_monthly(self):
        client, http = fake_scb()
        rows = scb.unemployment_monthly(client=client)
        self.assertEqual(rows[0]["month"], "2019-01")
        self.assertEqual(rows[-1]["month"], "2026-09")
        self.assertEqual(set(rows[0]), {"month", "rate", "rate_sa", "rate_trend"})
        sel = parse_selection(http.calls[0][0])
        self.assertEqual(sel["Kon"], ["1+2"])
        self.assertEqual(sel["Arbetskraftstillh"], ["ALÖSP"])

    def test_error_mentions_base_override(self):
        client = scb.SCB(base_url="https://example.test", http=DownHttp())
        with self.assertRaises(FetchError) as ctx:
            client.metadata("TAB4936")
        self.assertIn("SWEDEN_LABOUR_SCB_BASE", str(ctx.exception))


class JobTechTests(unittest.TestCase):
    def setUp(self):
        def handler(url, params):
            field = params.get("occupation-field")
            ads = {"apaJ_2ja_LuF": 100, "6Hq3_tKo_V57": 50}.get(field, 1000)
            return {"total": {"value": ads}, "positions": ads * 2, "hits": []}

        self.http = FakeHttp(handler)
        self.client = jobtech.JobTech(base_url="https://example.test", http=self.http)

    def test_count_ads_params(self):
        out = self.client.count_ads(dt.date(2026, 1, 1), dt.date(2026, 9, 30), occupation_field="Data/IT")
        self.assertEqual(out, {"ads": 100, "positions": 200})
        url, params = self.http.calls[0]
        self.assertEqual(url, "https://example.test/search")
        self.assertEqual(params["occupation-field"], "apaJ_2ja_LuF")
        self.assertEqual(params["published-after"], "2026-01-01T00:00:00")
        self.assertEqual(params["published-before"], "2026-09-30T23:59:59")
        self.assertEqual(params["limit"], 0)

    def test_job_ads_matches_dashboard_shape(self):
        rows = jobtech.job_ads(2024, 2026, window_end="09-30", client=self.client)
        self.assertEqual(list(rows[0].keys()), bundled_columns("job_ads"))
        self.assertEqual(len(rows), 9)
        self.assertEqual(rows[0], {"year": 2024, "field": "Data/IT", "ads": 100, "positions": 200})

    def test_default_window(self):
        self.assertEqual(jobtech.default_window(dt.date(2026, 10, 20)), {"end_year": 2026, "month": 9, "day": 30})
        self.assertEqual(jobtech.default_window(dt.date(2027, 1, 5)), {"end_year": 2026, "month": 12, "day": 31})
        self.assertEqual(jobtech.default_window(dt.date(2028, 3, 2)), {"end_year": 2028, "month": 2, "day": 29})

    def test_leap_day_clamped(self):
        jobtech.job_ads(2023, 2024, window_end="02-29", fields={"All": None}, client=self.client)
        befores = [p["published-before"] for _, p in self.http.calls]
        self.assertEqual(befores, ["2023-02-28T23:59:59", "2024-02-29T23:59:59"])


class DatasetTests(unittest.TestCase):
    def test_every_dataset_listed(self):
        listed = {d["id"] for d in sl.list_datasets()}
        self.assertIn("tech_employment", listed)
        self.assertIn("hiring_outlook", listed)
        self.assertEqual(len(listed), 16)

    def test_offline_returns_bundled_copies(self):
        for did in sl.ids():
            src = datasets._SOURCES[did]
            if src.kind == "live" and not src.has_bundled_copy:
                with self.assertRaises(FetchError):
                    sl.get(did, offline=True)
                continue
            ds = sl.get(did, offline=True)
            self.assertTrue(ds.rows, did)
            self.assertEqual(ds.stale, ds.kind == "live", did)

    def test_fallback_when_live_source_fails(self):
        with mock.patch.object(datasets._SOURCES["tech_employment"], "fetch", side_effect=FetchError("down")):
            ds = sl.get("tech_employment")
            self.assertTrue(ds.stale)
            self.assertIn("down", ds.note)
            with self.assertRaises(FetchError):
                sl.get("tech_employment", fallback=False)

    def test_collect_writes_files_and_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            res = sl.collect(["consulting", "job_ads", "unemployment_monthly"], out_dir=tmp, offline=True)
            self.assertEqual(set(res), {"consulting", "job_ads"})
            manifest = json.loads((Path(tmp) / "manifest.json").read_text(encoding="utf-8"))
            status = {m["id"]: m for m in manifest["datasets"]}
            self.assertFalse(status["unemployment_monthly"]["ok"])
            self.assertTrue(status["job_ads"]["stale"])
            back = sl.load_file(Path(tmp) / "consulting.json")
            self.assertEqual(back.rows, res["consulting"].rows)

            sl.collect(["hiring_plans"], out_dir=tmp, fmt="csv")
            header = (Path(tmp) / "hiring_plans.csv").read_text(encoding="utf-8").splitlines()[0]
            self.assertEqual(header, "month,sector,net_balance")

    def test_unknown_id(self):
        with self.assertRaises(KeyError):
            sl.get("nope")

    @unittest.skipUnless(__import__("importlib").util.find_spec("pandas"), "pandas not installed")
    def test_to_frame(self):
        df = sl.get("national_yearly").to_frame()
        self.assertEqual(list(df.columns), ["year", "value", "kind"])


class CliTests(unittest.TestCase):
    def run_cli(self, *argv):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = cli.main(list(argv))
        return code, out.getvalue(), err.getvalue()

    def test_list(self):
        code, out, _ = self.run_cli("list")
        self.assertEqual(code, 0)
        self.assertIn("job_ads", out)

    def test_fetch_one_offline_csv(self):
        code, out, err = self.run_cli("fetch", "job_ads", "--offline", "--format", "csv")
        self.assertEqual(code, 0)
        self.assertTrue(out.startswith("year,field,ads,positions"))
        self.assertIn("bundled copy", err)

    def test_fetch_all_offline_to_folder(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, out, err = self.run_cli("fetch", "--offline", "--out", tmp)
            self.assertEqual(code, 1)  # the two live-only datasets need the network
            self.assertEqual(len(list(Path(tmp).glob("*.json"))), 15)  # 14 datasets + manifest


if __name__ == "__main__":
    unittest.main()
