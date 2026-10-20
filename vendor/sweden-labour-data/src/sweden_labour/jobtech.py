"""Job ads from Platsbanken, counted through JobTech's historical ads API.

No API key is needed. The tracker counts ads (and the positions they
advertise) published between 1 January and the same cut-off date each year,
so years can be compared like for like.

Occupation fields use JobTech taxonomy concept ids. ``OCCUPATION_FIELDS``
lists all 21; the tracker uses Data/IT and Technical.
"""

from __future__ import annotations

import calendar
import datetime as dt
import os
from typing import Any, Dict, List, Mapping, Optional

from ._http import HttpClient

DEFAULT_BASE = "https://historical.api.jobtechdev.se"

# Occupation fields (yrkesområden), taxonomy.api.jobtechdev.se, type=occupation-field
OCCUPATION_FIELDS: Dict[str, str] = {
    "Administration, ekonomi, juridik": "X82t_awd_Qyc",
    "Bygg och anläggning": "j7Cq_ZJe_GkT",
    "Chefer och verksamhetsledare": "bh3H_Y3h_5eD",
    "Data/IT": "apaJ_2ja_LuF",
    "Försäljning, inköp, marknadsföring": "RPTn_bxG_ExZ",
    "Hantverk": "PaxQ_o1G_wWH",
    "Hotell, restaurang, storhushåll": "ScKy_FHB_7wT",
    "Hälso- och sjukvård": "NYW6_mP6_vwf",
    "Industriell tillverkning": "wTEr_CBC_bqh",
    "Installation, drift, underhåll": "yhCP_AqT_tns",
    "Kropps- och skönhetsvård": "Uuf1_GMh_Uvw",
    "Kultur, media, design": "9puE_nYg_crq",
    "Militära yrken": "bH5L_uXD_ZAX",
    "Naturbruk": "VuuL_7CH_adj",
    "Naturvetenskap": "kJeN_wmw_9wX",
    "Pedagogik": "MVqp_eS8_kDZ",
    "Sanering och renhållning": "whao_Q6A_ScE",
    "Säkerhet och bevakning": "E7hm_BLq_fqZ",
    "Transport, distribution, lager": "ASGV_zcE_bWf",
    "Yrken med social inriktning": "GazW_2TU_kJw",
    "Yrken med teknisk inriktning": "6Hq3_tKo_V57",
}

# What the tracker counts: label in the output -> occupation field id (None = all ads).
TRACKER_FIELDS: Dict[str, Optional[str]] = {
    "Data/IT": OCCUPATION_FIELDS["Data/IT"],
    "Technical": OCCUPATION_FIELDS["Yrken med teknisk inriktning"],
    "All occupations": None,
}


class JobTech:
    def __init__(self, base_url: Optional[str] = None, http: Optional[HttpClient] = None) -> None:
        self.base_url = (base_url or os.environ.get("SWEDEN_LABOUR_JOBTECH_BASE") or DEFAULT_BASE).rstrip("/")
        # Historical queries can take minutes on the server side.
        self.http = http or HttpClient(min_interval=0.5, timeout=330)

    def search(self, params: Mapping[str, Any]) -> Dict[str, Any]:
        """Raw /search call. Any parameter the API accepts can go in ``params``."""
        q = {"limit": 0, "request-timeout": 300}
        q.update(params)
        return self.http.get_json(f"{self.base_url}/search", params=q)

    def count_ads(
        self,
        published_after: dt.date,
        published_before: dt.date,
        occupation_field: Optional[str] = None,
        **filters: Any,
    ) -> Dict[str, int]:
        """Ads and positions published between two dates, both days included.

        ``occupation_field`` is a taxonomy id (see OCCUPATION_FIELDS) or a
        label from that dict. Extra keyword filters go straight to the API
        with underscores turned into hyphens, e.g. ``region=<county concept id>``
        or ``q="python"``. Concept ids are listed at
        https://taxonomy.api.jobtechdev.se/v1/taxonomy/main/concepts?type=region
        """
        params: Dict[str, Any] = {
            "published-after": f"{published_after.isoformat()}T00:00:00",
            "published-before": f"{published_before.isoformat()}T23:59:59",
        }
        if occupation_field:
            params["occupation-field"] = OCCUPATION_FIELDS.get(occupation_field, occupation_field)
        for k, v in filters.items():
            params[k.replace("_", "-")] = v
        res = self.search(params)
        total = res.get("total", {})
        ads = total.get("value") if isinstance(total, dict) else total
        return {"ads": int(ads or 0), "positions": int(res.get("positions") or 0)}


def default_window(today: Optional[dt.date] = None) -> Dict[str, int]:
    """The latest year-to-date window made of whole months.

    On 20 October 2026 that's 1 Jan to 30 Sep, with 2026 as the last year.
    In January it falls back to the whole previous year.
    """
    today = today or dt.date.today()
    if today.month == 1:
        return {"end_year": today.year - 1, "month": 12, "day": 31}
    month = today.month - 1
    return {"end_year": today.year, "month": month, "day": calendar.monthrange(today.year, month)[1]}


def job_ads(
    start_year: int = 2020,
    end_year: Optional[int] = None,
    window_end: Optional[str] = None,
    fields: Optional[Mapping[str, Optional[str]]] = None,
    client: Optional[JobTech] = None,
) -> List[Dict[str, Any]]:
    """Ads and positions from 1 January to ``window_end`` ('MM-DD') each year.

    With no ``window_end`` the window ends on the last day of the last full
    month, which is how the tracker's numbers were made. Rows:
    {year, field, ads, positions}.
    """
    client = client or JobTech()
    fields = dict(fields or TRACKER_FIELDS)
    win = default_window()
    if window_end:
        month, day = (int(x) for x in window_end.split("-"))
    else:
        month, day = win["month"], win["day"]
    end_year = end_year or win["end_year"]

    rows: List[Dict[str, Any]] = []
    for year in range(start_year, end_year + 1):
        last_day = min(day, calendar.monthrange(year, month)[1])  # 29 Feb in a non-leap year
        start, end = dt.date(year, 1, 1), dt.date(year, month, last_day)
        for label, field_id in fields.items():
            counts = client.count_ads(start, end, occupation_field=field_id)
            rows.append({"year": year, "field": label, **counts})
    return rows
