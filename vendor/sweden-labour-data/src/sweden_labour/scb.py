"""Statistics Sweden (SCB) through PxWebApi v2.

Two layers:

* ``SCB.data(table_id, selection)`` fetches any table in Statistikdatabasen
  and returns one dict per cell. Use it for tables this package doesn't
  wrap yet.
* The functions further down (``tech_employment``, ``regional_jobs`` and so
  on) are the exact queries behind the Labor Market Tracker, returning rows
  in the same shape the dashboard uses.

Table ids are the new-style ids (TAB4936). Look one up on
https://www.statistikdatabasen.scb.se and read its dimension codes with
``SCB().metadata("TAB4936")``.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Union
from urllib.parse import quote

from ._http import FetchError, HttpClient
from .jsonstat import to_rows

# SCB launched PxWebApi v2 in October 2025. This is the address it answers on
# today; if SCB moves it, set SWEDEN_LABOUR_SCB_BASE or pass base_url.
DEFAULT_BASE = "https://api.scb.se/ov0104/v2beta/api/v2"

Selection = Mapping[str, Union[str, Sequence[str]]]


class SCB:
    def __init__(
        self,
        base_url: Optional[str] = None,
        lang: str = "en",
        http: Optional[HttpClient] = None,
    ) -> None:
        self.base_url = (base_url or os.environ.get("SWEDEN_LABOUR_SCB_BASE") or DEFAULT_BASE).rstrip("/")
        self.lang = lang
        # 30 calls per 10 seconds per IP is SCB's limit; 0.4 s keeps well inside it.
        self.http = http or HttpClient(min_interval=0.4)

    def _get(self, path: str, query: str = "") -> Any:
        url = f"{self.base_url}/{path}?lang={self.lang}"
        if query:
            url += "&" + query
        try:
            return self.http.get_json(url)
        except FetchError as exc:
            raise FetchError(
                f"{exc}\nIf SCB has moved PxWebApi v2, set SWEDEN_LABOUR_SCB_BASE to the new address."
            ) from exc

    def metadata(self, table_id: str) -> Dict[str, Any]:
        """The table's dimensions and their category codes, as JSON-stat."""
        return self._get(f"tables/{table_id}/metadata")

    def dimensions(self, table_id: str) -> Dict[str, Dict[str, str]]:
        """{dimension id: {code: label}} for a table. Handy for finding codes."""
        meta = self.metadata(table_id)
        out: Dict[str, Dict[str, str]] = {}
        for dim_id in meta.get("id", []):
            cat = meta["dimension"][dim_id]["category"]
            out[dim_id] = dict(cat.get("label", {}))
        return out

    def data(self, table_id: str, selection: Selection, with_labels: bool = False) -> List[Dict[str, Any]]:
        """Fetch cells from a table.

        ``selection`` maps each dimension id to the codes you want, as a list
        or a comma-separated string. PxWebApi selection expressions work too:
        ``"*"`` for every code, ``"top(8)"`` for the latest eight periods,
        ``"from(2019K1)"`` and so on.

        Returns one dict per cell with a key per dimension (the code) and
        ``value``. SCB caps a single request at 150,000 cells.
        """
        return to_rows(self._get(f"tables/{table_id}/data", _query(selection)), with_labels=with_labels)


def _query(selection: Selection) -> str:
    parts = ["outputFormat=json-stat2"]
    for dim, codes in selection.items():
        if isinstance(codes, str):
            codes = [c.strip() for c in codes.split(",")]
        # '+' must be sent as %2B or SCB reads it as a space ("1+2" is a real code).
        encoded = ",".join(quote(c, safe="*()?-_.~") for c in codes)
        parts.append(f"valueCodes[{quote(dim, safe='')}]={encoded}")
    return "&".join(parts)


# ---------------------------------------------------------------- periods

_QUARTER_END = {"1": "03-31", "2": "06-30", "3": "09-30", "4": "12-31"}


def quarter_info(code: str) -> Dict[str, str]:
    """'2026K2' -> {'quarter': '2026 Q2', 'date': '2026-06-30'}"""
    year, q = code.split("K")
    return {"quarter": f"{year} Q{q}", "date": f"{year}-{_QUARTER_END[q]}"}


def month_label(code: str) -> str:
    """'2026M09' -> '2026-09'"""
    year, m = code.split("M")
    return f"{year}-{int(m):02d}"


def _num(v: Any) -> Any:
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def _client(client: Optional[SCB]) -> SCB:
    return client or SCB()


# ---------------------------------------------------- tracker queries
# Each returns rows in the same shape as the dashboard dataset of the same name.

TECH_EMPLOYMENT_SECTORS = {
    "0003": "All jobs",
    "J58-J63": "Information and communication",
    "C10-C33": "Manufacturing",
    "M69-N82": "Professional and technical services",
}


def tech_employment(
    start: str = "2019K1",
    sectors: Optional[Mapping[str, str]] = None,
    client: Optional[SCB] = None,
) -> List[Dict[str, Any]]:
    """People employed, thousands, calendar and seasonally adjusted (national accounts).

    Table TAB4936. ``sectors`` maps SNI2007 codes to the names you want in
    the output; the default is the tracker's four.
    """
    sectors = dict(sectors or TECH_EMPLOYMENT_SECTORS)
    cells = _client(client).data(
        "TAB4936",
        {"SNI2007": list(sectors), "ContentsCode": "0000025Q", "Tid": "*"},
    )
    rows = []
    for c in cells:
        if c["Tid"] < start:
            continue
        rows.append({**quarter_info(c["Tid"]), "sector": sectors[c["SNI2007"]], "thousands": c["value"]})
    order = list(sectors.values())
    rows.sort(key=lambda r: (order.index(r["sector"]), r["date"]))
    return rows


REGIONS = {"00": "Sweden", "01": "Stockholm", "12": "Skåne", "14": "Västra Götaland"}
REGIONAL_SECTORS = {"J": "Information and communication", "B+C": "Manufacturing"}
SEXES = {"1": "Men", "2": "Women"}


def regional_jobs(
    start: str = "2020K1",
    regions: Optional[Mapping[str, str]] = None,
    sectors: Optional[Mapping[str, str]] = None,
    client: Optional[SCB] = None,
) -> List[Dict[str, Any]]:
    """People employed aged 15 to 74 by workplace county, sector and sex.

    Table TAB3786, preliminary quarterly statistics from 2020, not seasonally
    adjusted. County codes: 01 Stockholm, 12 Skåne, 14 Västra Götaland, 00
    the whole country (see ``SCB().dimensions('TAB3786')`` for the rest).
    """
    regions = dict(regions or REGIONS)
    sectors = dict(sectors or REGIONAL_SECTORS)
    cells = _client(client).data(
        "TAB3786",
        {
            "Region": list(regions),
            "Kon": list(SEXES),
            "SNI2007": list(sectors),
            "Fodelseregion": "tot",
            "ContentsCode": "000005JR",  # by region of work
            "Tid": "*",
        },
    )
    rows = []
    for c in cells:
        if c["Tid"] < start:
            continue
        rows.append(
            {
                **quarter_info(c["Tid"]),
                "region": regions[c["Region"]],
                "sector": sectors[c["SNI2007"]],
                "sex": SEXES[c["Kon"]],
                "employed": _num(c["value"]),
            }
        )
    r_order, s_order = list(regions.values()), list(sectors.values())
    rows.sort(key=lambda r: (s_order.index(r["sector"]), r_order.index(r["region"]), r["sex"], r["date"]))
    return rows


def job_openings(start: str = "2019K1", client: Optional[SCB] = None) -> List[Dict[str, Any]]:
    """Job openings in the whole economy, seasonally adjusted. Table TAB6406.

    TAB6406 also lists industries, but SCB publishes the seasonally adjusted
    figures for the total only; for industries use ``openings_by_industry``.
    """
    cells = _client(client).data(
        "TAB6406",
        {"LedJobbTyp": "LJtot", "SNI2007Naring": "A-S", "ContentsCode": "000007J4", "Tid": "*"},
    )
    return [
        {**quarter_info(c["Tid"]), "openings_sa": _num(c["value"])}
        for c in sorted(cells, key=lambda c: c["Tid"])
        if c["Tid"] >= start
    ]


def _openings_with_margin(
    table: str,
    base_selection: Mapping[str, Any],
    industry_dim: str,
    sectors: Mapping[str, str],
    value_code: str,
    margin_code: str,
    start: str,
    client: Optional[SCB],
) -> List[Dict[str, Any]]:
    cells = _client(client).data(
        table,
        {**base_selection, industry_dim: list(sectors), "ContentsCode": [value_code, margin_code], "Tid": "*"},
    )
    by_key: Dict[tuple, Dict[str, Any]] = {}
    for c in cells:
        if c["Tid"] < start:
            continue
        key = (c[industry_dim], c["Tid"])
        row = by_key.setdefault(key, {**quarter_info(c["Tid"]), "sector": sectors[c[industry_dim]], "openings": None, "margin": None})
        row["openings" if c["ContentsCode"] == value_code else "margin"] = _num(c["value"])
    rows = list(by_key.values())
    order = list(sectors.values())
    rows.sort(key=lambda r: (order.index(r["sector"]), r["date"]))
    return rows


OPENINGS_SECTORS = {
    "A-S": "Whole economy",
    "J": "Information and communication",
    "B+C": "Manufacturing",
    "M": "Professional and technical services",
}


def openings_by_industry(
    start: str = "2024K2",
    sectors: Optional[Mapping[str, str]] = None,
    client: Optional[SCB] = None,
) -> List[Dict[str, Any]]:
    """Job openings by industry with margin of error, from 2024 Q2. Table TAB6398.

    This is SCB's new vacancy survey and carries on where ``tech_vacancies``
    stops. Two differences: it covers the whole economy (public sector too)
    and it isn't seasonally adjusted, so compare a quarter with the same
    quarter a year earlier. Same row shape as ``tech_vacancies``.
    """
    return _openings_with_margin(
        "TAB6398", {"LedJobbTyp": "LJtot"}, "SNI2007Naring",
        dict(sectors or OPENINGS_SECTORS), "000007MD", "000007MF", start, client,
    )


VACANCY_SECTORS = {
    "A-S": "All private sector",
    "J": "Information and communication",
    "B+C": "Manufacturing",
    "M": "Professional and technical services",
}


def tech_vacancies(start: str = "2019K1", client: Optional[SCB] = None) -> List[Dict[str, Any]]:
    """Private-sector job openings by industry with margin of error, TAB4299.

    SCB's old vacancy survey ended after Q1 2024, so this series stops there.
    Use ``openings_by_industry`` for later quarters.
    """
    return _openings_with_margin(
        "TAB4299", {}, "SNI2007", VACANCY_SECTORS, "000000GF", "000000GG", start, client,
    )


def unemployment_monthly(
    start: str = "2019M01",
    age: str = "tot15-74",
    client: Optional[SCB] = None,
) -> List[Dict[str, Any]]:
    """Unemployment rate from the Labour Force Survey, monthly, TAB6387.

    ``rate`` is as measured, ``rate_sa`` seasonally adjusted (the headline
    figure) and ``rate_trend`` seasonally adjusted and smoothed. ``age`` takes
    the table's age codes, e.g. 'tot15-74', '15-24', '25-54'.
    """
    types = {"O_DATA": "rate", "SR_DATA": "rate_sa", "TC_DATA": "rate_trend"}
    cells = _client(client).data(
        "TAB6387",
        {
            "Arbetskraftstillh": "ALÖSP",
            "TypData": list(types),
            "Kon": "1+2",
            "Alder": age,
            "ContentsCode": "000007L9",
            "Tid": "*",
        },
    )
    by_month: Dict[str, Dict[str, Any]] = {}
    for c in cells:
        if c["Tid"] < start:
            continue
        row = by_month.setdefault(c["Tid"], {"month": month_label(c["Tid"]), "rate": None, "rate_sa": None, "rate_trend": None})
        row[types[c["TypData"]]] = c["value"]
    return [by_month[k] for k in sorted(by_month)]


def fetch_table(table_id: str, selection: Selection, with_labels: bool = True, client: Optional[SCB] = None) -> List[Dict[str, Any]]:
    """Shortcut for ``SCB().data(...)`` with labels on."""
    return _client(client).data(table_id, selection, with_labels=with_labels)


__all__: Iterable[str] = [
    "SCB",
    "fetch_table",
    "tech_employment",
    "regional_jobs",
    "job_openings",
    "openings_by_industry",
    "tech_vacancies",
    "unemployment_monthly",
    "quarter_info",
    "month_label",
]
