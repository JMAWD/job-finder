"""Every dataset the Labor Market Tracker uses, by name.

Two kinds:

* live: fetched from an API each time (SCB, JobTech). A copy from
  19 Oct 2026 ships with the package and is used when the API can't be
  reached, marked ``stale=True``.
* snapshot: figures compiled by hand from reports and press releases
  (ManpowerGroup, Cinode, Sveriges Ingenjörer, Konjunkturinstitutet,
  Arbetsförmedlingen via Ekonomifakta and Newsworthy). These have no API,
  so they ship as data with the date they were compiled. Update them by
  hand, or pass your own files to ``load_file``.
"""

from __future__ import annotations

import csv
import datetime as dt
import json
from dataclasses import dataclass
from importlib import resources
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Union

from . import jobtech, scb
from ._http import FetchError

PathLike = Union[str, Path]


@dataclass
class Dataset:
    id: str
    title: str
    description: str
    kind: str  # "live" or "snapshot"
    as_of: str
    rows: List[Dict[str, Any]]
    stale: bool = False
    note: str = ""

    @property
    def columns(self) -> List[str]:
        cols: List[str] = []
        for r in self.rows:
            for k in r:
                if k not in cols:
                    cols.append(k)
        return cols

    def to_frame(self):
        """The rows as a pandas DataFrame (needs pandas installed)."""
        try:
            import pandas as pd
        except ImportError as exc:  # pragma: no cover
            raise ImportError("to_frame needs pandas: pip install 'sweden-labour-data[pandas]'") from exc
        return pd.DataFrame(self.rows, columns=self.columns)

    def to_record(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "kind": self.kind,
            "as_of": self.as_of,
            "stale": self.stale,
            "note": self.note,
            "rows": self.rows,
        }

    def to_json(self, path: PathLike) -> Path:
        """Write the dataset with its metadata. The rows sit under "rows"."""
        path = Path(path)
        path.write_text(json.dumps(self.to_record(), ensure_ascii=False, indent=1), encoding="utf-8")
        return path

    def to_csv(self, path: PathLike) -> Path:
        path = Path(path)
        with path.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=self.columns)
            w.writeheader()
            w.writerows(self.rows)
        return path


@dataclass
class Source:
    id: str
    title: str
    description: str
    kind: str
    fetch: Optional[Callable[[], List[Dict[str, Any]]]] = None
    has_bundled_copy: bool = True


_SOURCES: Dict[str, Source] = {}


def _add(src: Source) -> None:
    _SOURCES[src.id] = src


# ---------------------------------------------------------------- live

_add(Source(
    "tech_employment", "Jobs by sector (SCB)",
    "People employed in thousands, calendar and seasonally adjusted, national accounts, from 2019 Q1. "
    "SCB table TAB4936: all jobs, information and communication (J58-J63), manufacturing (C10-C33), "
    "professional and technical services (M69-N82).",
    "live", lambda: scb.tech_employment(),
))
_add(Source(
    "regional_jobs", "Jobs by county (SCB)",
    "People employed aged 15 to 74 by workplace county, men and women, from 2020 Q1, preliminary, "
    "not seasonally adjusted. SCB table TAB3786: information and communication (J) and manufacturing (B+C) "
    "for Sweden, Stockholm, Skåne and Västra Götaland.",
    "live", lambda: scb.regional_jobs(),
))
_add(Source(
    "job_openings", "Job openings, whole economy (SCB)",
    "Job openings in the whole economy, seasonally adjusted, from 2019 Q1. SCB table TAB6406; "
    "figures to Q1 2024 come from the vacancy survey it replaced.",
    "live", lambda: scb.job_openings(),
))
_add(Source(
    "openings_by_industry", "Job openings by industry (SCB)",
    "Job openings by industry with margin of error, from 2024 Q2, SCB table TAB6398: whole economy, "
    "information and communication (J), manufacturing (B+C), professional and technical services (M). "
    "Carries on where tech_vacancies stops; covers the whole economy and is not seasonally adjusted.",
    "live", lambda: scb.openings_by_industry(), has_bundled_copy=False,
))
_add(Source(
    "tech_vacancies", "Open positions by industry (SCB)",
    "Private-sector job openings by industry with margin of error, 2019 Q1 to 2024 Q1, from SCB's vacancy "
    "survey, table TAB4299. The survey ended after Q1 2024.",
    "live", lambda: scb.tech_vacancies(),
))
_add(Source(
    "unemployment_monthly", "Unemployment rate by month (SCB)",
    "Labour Force Survey unemployment rate, ages 15 to 74, monthly from January 2019: as measured, "
    "seasonally adjusted, and seasonally adjusted and smoothed. SCB table TAB6387.",
    "live", lambda: scb.unemployment_monthly(), has_bundled_copy=False,
))
_add(Source(
    "job_ads", "Job ads (JobTech)",
    "Ads and positions published in Platsbanken from 1 January to the end of the last full month of each "
    "year from 2020, counted with Arbetsförmedlingen's JobTech historical ads API: occupation field Data/IT, "
    "occupation field 'Yrken med teknisk inriktning', and all ads. The archive's coverage varies by year.",
    "live", lambda: jobtech.job_ads(),
))

# ------------------------------------------------------------ snapshots

_SNAPSHOT_IDS = [
    "national_now",
    "national_yearly",
    "hiring_outlook",
    "hiring_plans",
    "redundancies",
    "redundancies_industry",
    "consulting",
    "consulting_yearly",
    "engineers",
]


def _read_bundled(folder: str, dataset_id: str) -> Dict[str, Any]:
    ref = resources.files("sweden_labour").joinpath("data", folder, f"{dataset_id}.json")
    return json.loads(ref.read_text(encoding="utf-8"))


for _id in _SNAPSHOT_IDS:
    _rec = _read_bundled("snapshots", _id)
    _add(Source(_id, _rec["title"], _rec["description"], "snapshot"))


# ---------------------------------------------------------------- API

def list_datasets() -> List[Dict[str, Any]]:
    """id, title, kind and description of every dataset."""
    return [
        {"id": s.id, "title": s.title, "kind": s.kind, "description": s.description}
        for s in _SOURCES.values()
    ]


def ids(kind: Optional[str] = None) -> List[str]:
    return [s.id for s in _SOURCES.values() if kind is None or s.kind == kind]


def _bundled(src: Source, note: str = "") -> Dataset:
    folder = "snapshots" if src.kind == "snapshot" else "cache"
    rec = _read_bundled(folder, src.id)
    return Dataset(
        id=src.id,
        title=src.title,
        description=src.description,
        kind=src.kind,
        as_of=rec["as_of"],
        rows=rec["rows"],
        stale=src.kind == "live",
        note=note,
    )


def get(dataset_id: str, offline: bool = False, fallback: bool = True) -> Dataset:
    """Fetch one dataset by id.

    ``offline=True`` skips the network and returns the bundled copy.
    ``fallback=False`` raises instead of returning the bundled copy when a
    live source fails.
    """
    try:
        src = _SOURCES[dataset_id]
    except KeyError:
        raise KeyError(f"Unknown dataset {dataset_id!r}. Known: {', '.join(_SOURCES)}") from None

    if src.kind == "snapshot":
        return _bundled(src)

    if offline:
        if not src.has_bundled_copy:
            raise FetchError(f"{dataset_id} has no bundled copy; it needs the network.")
        return _bundled(src, note="Offline: bundled copy.")

    try:
        rows = src.fetch()  # type: ignore[misc]
    except Exception as exc:
        if fallback and src.has_bundled_copy:
            return _bundled(src, note=f"Live fetch failed, using bundled copy: {exc}")
        raise
    return Dataset(
        id=src.id,
        title=src.title,
        description=src.description,
        kind="live",
        as_of=dt.date.today().isoformat(),
        rows=rows,
    )


def collect(
    dataset_ids: Optional[Iterable[str]] = None,
    out_dir: Optional[PathLike] = None,
    fmt: str = "json",
    offline: bool = False,
    fallback: bool = True,
    strict: bool = False,
) -> Dict[str, Dataset]:
    """Fetch several datasets (all of them by default).

    With ``out_dir`` each dataset is written as <id>.json or <id>.csv, plus a
    manifest.json saying where each one came from and whether it's stale.
    A dataset that fails is left out and its error goes in the manifest,
    unless ``strict=True``, which raises instead.
    """
    if fmt not in ("json", "csv"):
        raise ValueError("fmt must be 'json' or 'csv'")
    wanted = list(dataset_ids) if dataset_ids else list(_SOURCES)
    results: Dict[str, Dataset] = {}
    manifest: List[Dict[str, Any]] = []

    for did in wanted:
        try:
            ds = get(did, offline=offline, fallback=fallback)
        except Exception as exc:
            if strict:
                raise
            manifest.append({"id": did, "ok": False, "error": str(exc)})
            continue
        results[did] = ds
        manifest.append({
            "id": did, "ok": True, "kind": ds.kind, "as_of": ds.as_of,
            "stale": ds.stale, "rows": len(ds.rows), "note": ds.note,
        })

    if out_dir is not None:
        out = Path(out_dir)
        out.mkdir(parents=True, exist_ok=True)
        for did, ds in results.items():
            if fmt == "json":
                ds.to_json(out / f"{did}.json")
            else:
                ds.to_csv(out / f"{did}.csv")
        (out / "manifest.json").write_text(
            json.dumps({"generated": dt.datetime.now().isoformat(timespec="seconds"), "datasets": manifest},
                       ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
    return results


def load_file(path: PathLike, dataset_id: Optional[str] = None) -> Dataset:
    """Load a dataset file written by ``to_json`` (or a plain list of rows)."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(data, list):
        did = dataset_id or Path(path).stem
        src = _SOURCES.get(did)
        return Dataset(did, src.title if src else did, src.description if src else "",
                       src.kind if src else "snapshot", "", data)
    return Dataset(
        id=data.get("id", dataset_id or Path(path).stem),
        title=data.get("title", ""),
        description=data.get("description", ""),
        kind=data.get("kind", "snapshot"),
        as_of=data.get("as_of", ""),
        rows=data["rows"],
        stale=data.get("stale", False),
        note=data.get("note", ""),
    )
