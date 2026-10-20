"""Small HTTP helper shared by the SCB and JobTech clients.

Retries on rate limits and server errors, and spaces out requests so a
loop over many tables stays inside SCB's limit of 30 calls per 10 seconds.
"""

from __future__ import annotations

import time
from typing import Any, Mapping, Optional

import requests

from ._version import __version__

USER_AGENT = f"sweden-labour-data/{__version__} (+https://github.com/JMAWD)"


class FetchError(RuntimeError):
    """Raised when a source can't be reached or answers with an error."""


class HttpClient:
    def __init__(
        self,
        session: Optional[requests.Session] = None,
        min_interval: float = 0.0,
        retries: int = 3,
        backoff: float = 2.0,
        timeout: float = 60.0,
    ) -> None:
        self.session = session or requests.Session()
        self.session.headers.setdefault("User-Agent", USER_AGENT)
        self.session.headers.setdefault("Accept", "application/json")
        self.min_interval = min_interval
        self.retries = retries
        self.backoff = backoff
        self.timeout = timeout
        self._last_call = 0.0

    def _wait_turn(self) -> None:
        if self.min_interval <= 0:
            return
        gap = time.monotonic() - self._last_call
        if gap < self.min_interval:
            time.sleep(self.min_interval - gap)

    def get_json(
        self,
        url: str,
        params: Optional[Mapping[str, Any]] = None,
        timeout: Optional[float] = None,
    ) -> Any:
        last_error: Optional[Exception] = None
        for attempt in range(1, self.retries + 1):
            self._wait_turn()
            try:
                resp = self.session.get(url, params=params, timeout=timeout or self.timeout)
            except requests.RequestException as exc:
                last_error = exc
            else:
                self._last_call = time.monotonic()
                if resp.status_code == 200:
                    try:
                        return resp.json()
                    except ValueError as exc:
                        raise FetchError(f"{url} did not return JSON") from exc
                if resp.status_code in (429, 500, 502, 503, 504):
                    last_error = FetchError(f"{url} answered {resp.status_code}")
                else:
                    body = (resp.text or "")[:300]
                    raise FetchError(f"{url} answered {resp.status_code}: {body}")
            if attempt < self.retries:
                time.sleep(self.backoff * attempt)
        raise FetchError(f"Gave up on {url} after {self.retries} tries: {last_error}")
