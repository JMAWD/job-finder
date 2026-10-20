"""Command line: sweden-labour (or python -m sweden_labour)."""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import sys
from typing import List, Optional

from . import __version__, datasets, jobtech, scb


def _print_rows(rows: List[dict], fmt: str) -> None:
    if fmt == "json":
        json.dump(rows, sys.stdout, ensure_ascii=False, indent=1)
        sys.stdout.write("\n")
        return
    cols: List[str] = []
    for r in rows:
        for k in r:
            if k not in cols:
                cols.append(k)
    w = csv.DictWriter(sys.stdout, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)


def cmd_list(args: argparse.Namespace) -> int:
    for d in datasets.list_datasets():
        print(f"{d['id']:<26} {d['kind']:<9} {d['title']}")
    return 0


def cmd_fetch(args: argparse.Namespace) -> int:
    wanted = args.ids or None
    if args.out:
        results = datasets.collect(
            wanted, out_dir=args.out, fmt=args.format, offline=args.offline,
            fallback=not args.no_fallback, strict=args.strict,
        )
        requested = wanted or datasets.ids()
        failed = [i for i in requested if i not in results]
        for did, ds in results.items():
            flag = "  (stale: bundled copy)" if ds.stale else ""
            print(f"{did:<26} {len(ds.rows):>5} rows  as of {ds.as_of}{flag}")
        for did in failed:
            print(f"{did:<26} failed, see manifest.json", file=sys.stderr)
        print(f"Wrote {len(results)} file(s) and manifest.json to {args.out}")
        return 1 if failed else 0

    if not wanted or len(wanted) != 1:
        print("Without --out, name exactly one dataset to print it.", file=sys.stderr)
        return 2
    ds = datasets.get(wanted[0], offline=args.offline, fallback=not args.no_fallback)
    if ds.stale:
        print(f"# {ds.note}", file=sys.stderr)
    _print_rows(ds.rows, args.format)
    return 0


def cmd_scb(args: argparse.Namespace) -> int:
    client = scb.SCB(lang=args.lang)
    if not args.select:
        for dim, codes in client.dimensions(args.table).items():
            shown = list(codes.items())
            more = f"  ... {len(shown) - 12} more" if len(shown) > 12 else ""
            print(f"{dim}: " + ", ".join(f"{c} ({l})" for c, l in shown[:12]) + more)
        return 0
    selection = {}
    for item in args.select:
        dim, _, codes = item.partition("=")
        if not codes:
            print(f"--select needs DIM=codes, got {item!r}", file=sys.stderr)
            return 2
        selection[dim] = codes
    _print_rows(client.data(args.table, selection, with_labels=args.labels), args.format)
    return 0


def cmd_ads(args: argparse.Namespace) -> int:
    start = dt.date.fromisoformat(args.start)
    end = dt.date.fromisoformat(args.end)
    counts = jobtech.JobTech().count_ads(start, end, occupation_field=args.field)
    print(json.dumps({"from": args.start, "to": args.end, "field": args.field or "all", **counts}, ensure_ascii=False))
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="sweden-labour", description="Swedish labour market data from SCB, JobTech and bundled reports.")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("list", help="list the datasets")
    s.set_defaults(func=cmd_list)

    s = sub.add_parser("fetch", help="fetch datasets; print one, or write many with --out")
    s.add_argument("ids", nargs="*", help="dataset ids (default: all)")
    s.add_argument("--out", help="folder to write files and manifest.json to")
    s.add_argument("--format", choices=["json", "csv"], default="json")
    s.add_argument("--offline", action="store_true", help="use bundled copies, no network")
    s.add_argument("--no-fallback", action="store_true", help="fail instead of using a bundled copy when an API is down")
    s.add_argument("--strict", action="store_true", help="stop at the first failure")
    s.set_defaults(func=cmd_fetch)

    s = sub.add_parser("scb", help="query any SCB table; with no --select, list its dimension codes")
    s.add_argument("table", help="table id, e.g. TAB4936")
    s.add_argument("--select", action="append", metavar="DIM=codes",
                   help="e.g. --select SNI2007=J58-J63,0003 --select Tid=top(8); repeat per dimension")
    s.add_argument("--labels", action="store_true", help="add a label column per dimension")
    s.add_argument("--lang", default="en", choices=["en", "sv"])
    s.add_argument("--format", choices=["json", "csv"], default="csv")
    s.set_defaults(func=cmd_scb)

    s = sub.add_parser("ads", help="count Platsbanken ads between two dates")
    s.add_argument("start", help="YYYY-MM-DD, included")
    s.add_argument("end", help="YYYY-MM-DD, included")
    s.add_argument("--field", help="occupation field label or id, e.g. Data/IT")
    s.set_defaults(func=cmd_ads)
    return p


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except Exception as exc:  # keep tracebacks out of normal use
        print(f"error: {exc}", file=sys.stderr)
        return 1
