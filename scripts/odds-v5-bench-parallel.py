#!/usr/bin/env python3
"""Quick parallel benchmark for GET /matches/v5/odds (5 workers, configurable duration)."""

from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from threading import Lock

BASE = "http://localhost:4000/matches/v5/odds"
TIMEOUT_SEC = 30
WORKERS = 5
DURATION_SEC = 60

FIXTURES = [
    ("https://www.aiscore.com/match-sk-treibach-sc-gleisdorf/527r3i4954pu47e", True),
    ("https://www.aiscore.com/match-elfsborg-mjallby-aif/g6763i5lw3jio7r", True),
    ("https://www.aiscore.com/match-ik-tord-skara-fc/edq09il49deceqx", True),
    ("https://www.aiscore.com/match-maccabi-tel-aviv-maccabi-haifa/edq09imvdooteqx", False),
    ("https://www.aiscore.com/match-western-sydney-central-coast-mariners/69759iy3x0efgk2", False),
]


@dataclass
class Stats:
    total: int = 0
    ok: int = 0
    slow: int = 0
    fail: int = 0
    latencies: list[float] = field(default_factory=list)
    lock: Lock = field(default_factory=Lock)

    def add(self, ok: bool, ms: float, slow: bool) -> None:
        with self.lock:
            self.total += 1
            self.latencies.append(ms)
            if ok and not slow:
                self.ok += 1
            elif ok and slow:
                self.slow += 1
            else:
                self.fail += 1


def call(link: str, corner: bool) -> tuple[bool, float, bool]:
    params = urllib.parse.urlencode(
        {"event_link": link, "has_odds_corner": str(corner).lower()}
    )
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(f"{BASE}?{params}", timeout=TIMEOUT_SEC) as resp:
            data = json.loads(resp.read())
            ms = (time.perf_counter() - start) * 1000
            odds = data.get("odds") or []
            ok = resp.status == 200 and len(odds) > 0
            return ok, ms, ms >= 5000
    except Exception:
        ms = (time.perf_counter() - start) * 1000
        return False, ms, ms >= 5000


def worker(idx: int, link: str, corner: bool, end_at: float, stats: Stats) -> None:
    while time.perf_counter() < end_at:
        ok, ms, slow = call(link, corner)
        stats.add(ok, ms, slow)


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    return s[min(int(len(s) * p / 100), len(s) - 1)]


def main() -> int:
    stats = Stats()
    end_at = time.perf_counter() + DURATION_SEC
    print(f"Parallel v5 bench: {WORKERS} workers, {DURATION_SEC}s, target <5000ms")
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futs = [
            pool.submit(worker, i, link, corner, end_at, stats)
            for i, (link, corner) in enumerate(FIXTURES)
        ]
        for f in as_completed(futs):
            f.result()
    lat = stats.latencies
    print(f"total={stats.total} ok(<5s)={stats.ok} slow_ok(>=5s)={stats.slow} fail={stats.fail}")
    if lat:
        print(
            f"latency_ms min={min(lat):.0f} p50={pct(lat, 50):.0f} "
            f"p95={pct(lat, 95):.0f} max={max(lat):.0f}"
        )
    return 0 if stats.fail == 0 and stats.slow == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
