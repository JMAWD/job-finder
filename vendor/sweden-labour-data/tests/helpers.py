"""Test doubles: a fake HTTP client and a JSON-stat builder shaped like SCB's output."""

from __future__ import annotations

import itertools
import re
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple
from urllib.parse import unquote

from sweden_labour._http import FetchError, HttpClient


def jsonstat(dims: Sequence[Tuple[str, Sequence[str]]], value_fn: Callable[[Dict[str, str]], Any]) -> Dict[str, Any]:
    """Build a JSON-stat 2.0 dataset the way PxWebApi v2 returns it (index as a dict)."""
    ids = [d for d, _ in dims]
    dimension = {
        d: {"label": d, "category": {"index": {c: i for i, c in enumerate(codes)}, "label": {c: f"label {c}" for c in codes}}}
        for d, codes in dims
    }
    values = [value_fn(dict(zip(ids, combo))) for combo in itertools.product(*[codes for _, codes in dims])]
    return {
        "version": "2.0",
        "class": "dataset",
        "label": "test table",
        "source": "Statistics Sweden",
        "updated": "2026-08-28T06:00:00Z",
        "id": ids,
        "size": [len(codes) for _, codes in dims],
        "dimension": dimension,
        "value": values,
    }


def parse_selection(url: str) -> Dict[str, List[str]]:
    """valueCodes[DIM]=a,b from a request URL, decoded."""
    out = {}
    for dim, codes in re.findall(r"valueCodes\[([^\]]+)\]=([^&]*)", url):
        out[unquote(dim)] = [unquote(c) for c in codes.split(",")]
    return out


class FakeHttp(HttpClient):
    """Answers get_json from a handler instead of the network and records every call."""

    def __init__(self, handler: Callable[[str, Optional[dict]], Any]) -> None:
        super().__init__(min_interval=0, retries=1)
        self.handler = handler
        self.calls: List[Tuple[str, Optional[dict]]] = []

    def get_json(self, url, params=None, timeout=None):
        self.calls.append((url, dict(params) if params else None))
        return self.handler(url, params)


class DownHttp(HttpClient):
    def __init__(self) -> None:
        super().__init__(min_interval=0, retries=1)

    def get_json(self, url, params=None, timeout=None):
        raise FetchError(f"{url} is unreachable (test)")
