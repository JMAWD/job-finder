"""Tests for market.py, the monthly count behind the Market tab, without the network.

    python3 tests/test_market_counts.py"""
import contextlib, datetime as dt, io, pathlib, sys, unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import market

FIELDS = [['Data/IT', 'apaJ_2ja_LuF'], ['Hälso- och sjukvård', 'NYW6_mP6_vwf']]
REGIONS = [['Skåne län', 'CaRE_1nn_cSU'], ['Västra Götalands län', 'zdoY_6u5_Krt']]


class Window(unittest.TestCase):
    def test_the_three_months_before_the_1st(self):
        self.assertEqual(market.window(dt.date(2026, 11, 1)), {'from': '2026-08-01', 'to': '2026-10-31', 'from_prev': '2025-08-01', 'to_prev': '2025-10-31'})

    def test_over_new_year(self):
        self.assertEqual(market.window(dt.date(2027, 1, 1)), {'from': '2026-10-01', 'to': '2026-12-31', 'from_prev': '2025-10-01', 'to_prev': '2025-12-31'})
        self.assertEqual(market.window(dt.date(2026, 3, 1)), {'from': '2025-12-01', 'to': '2026-02-28', 'from_prev': '2024-12-01', 'to_prev': '2025-02-28'})

    def test_leap_year(self):
        w = market.window(dt.date(2028, 3, 1))
        self.assertEqual((w['to'], w['to_prev']), ('2028-02-29', '2027-02-28'))

    def test_a_late_run_counts_the_same_months(self):
        self.assertEqual(market.window(dt.date(2026, 11, 3)), market.window(dt.date(2026, 11, 1)))


class Counts(unittest.TestCase):
    def setUp(self):
        self.calls = []
        def hist(after, before, field, region):
            self.calls.append(('hist', after, before, field, region))
            return 1000 if after.startswith('2026') else 2000
        def live(after, before, field, region):
            self.calls.append(('live', after, before, field, region))
            return 100 if after else 300
        self.hist, self.live = hist, live
        self.w = market.window(dt.date(2026, 11, 1))

    def test_every_field_in_every_county_and_all_of_sweden(self):
        out = market.count_all(FIELDS, REGIONS, self.w, self.hist, self.live)
        self.assertEqual(len(out), 3 * 3)
        self.assertEqual(out['|'], [1000, 100, 2000, 300])
        self.assertIn('apaJ_2ja_LuF|zdoY_6u5_Krt', out)
        self.assertIn(('hist', '2025-08-01', '2025-10-31', 'NYW6_mP6_vwf', 'CaRE_1nn_cSU'), self.calls)
        self.assertIn(('live', None, None, '', ''), self.calls)   # all open ads on the 1st

    def test_a_failed_count_is_left_unknown(self):
        def hist(after, before, field, region):
            if field == 'NYW6_mP6_vwf' and region: raise RuntimeError('503')
            return self.hist(after, before, field, region)
        with contextlib.redirect_stdout(io.StringIO()):
            out = market.count_all(FIELDS, REGIONS, self.w, hist, self.live)
        self.assertEqual(out['NYW6_mP6_vwf|CaRE_1nn_cSU'], [None, 100, None, 300])
        self.assertEqual(out['apaJ_2ja_LuF|CaRE_1nn_cSU'], [1000, 100, 2000, 300])

    def test_nothing_is_written_if_sweden_fails_or_too_many_fail(self):
        def sweden_down(after, before, field, region):
            if not field and not region: raise RuntimeError('timeout')
            return 1
        def all_down(*a): raise RuntimeError('down')
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertRaises(RuntimeError, market.count_all, FIELDS, REGIONS, self.w, sweden_down, self.live)
            self.assertRaises(RuntimeError, market.count_all, FIELDS, REGIONS, self.w, lambda *a: 1 if not a[2] and not a[3] else all_down(), self.live)


class Postings(unittest.TestCase):
    def nat(self, period):
        return {'national_now': {'rows': [{'metric': 'New job postings', 'period': period, 'value': 65000, 'year_ago': 78000}]}}

    def test_warns_when_the_hand_compiled_figure_is_behind(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            market.check_postings(self.nat('Sep 2026'), market.window(dt.date(2026, 11, 1)))
        self.assertIn('is for Sep 2026, but the counts run to 2026-10', out.getvalue())

    def test_quiet_when_it_is_current(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            market.check_postings(self.nat('Sep 2026'), market.window(dt.date(2026, 10, 1)))
        self.assertEqual(out.getvalue(), '')


if __name__ == '__main__':
    unittest.main(verbosity=1)
