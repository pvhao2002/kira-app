#!/usr/bin/env python3
"""Load test GET /matches/v5/odds — 5 parallel workers for a fixed duration."""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from threading import Lock

BASE_URL = "http://localhost:4000/matches/v5/odds"
DURATION_SEC = 300
REQUEST_TIMEOUT_SEC = 120
WORKERS = 5

# 5 events from DB (has_odds=1); 3 corner=true, 2 corner=false API params
FIXTURES: list[tuple[str, bool]] = [
    ("https://www.aiscore.com/match-al-hilal-u21-al-taawoun-u21/xvkjoimojgws879", True),
    ("https://www.aiscore.com/match-eskisehirspor-balcova-belediyespor/zrkn6im4g18uwql", True),
    ("https://www.aiscore.com/match-real-sociedad-women-athletic-club-women/8lk2didyzphz736", True),
    ("https://www.aiscore.com/match-greenock-morton-dunfermline-athletic/jr7owi0p6dsgq0e", False),
    ("https://www.aiscore.com/match-manchester-city-u21-liverpool-u21/o17pjiyow5hy7jw", False),
]


@dataclass
class Stats:
    total: int = 0
    ok: int = 0
    http_error: int = 0
    timeout: int = 0
    other_error: int = 0
    empty_odds: int = 0
    latencies_ms: list[float] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    lock: Lock = field(default_factory=Lock)

    def record_ok(self, ms: float, has_odds: bool) -> None:
        with self.lock:
            self.total += 1
            self.ok += 1
            self.latencies_ms.append(ms)
            if not has_odds:
                self.empty_odds += 1

    def record_fail(self, kind: str, detail: str, ms: float | None = None) -> None:
        with self.lock:
            self.total += 1
            if kind == "http":
                self.http_error += 1
            elif kind == "timeout":
                self.timeout += 1
            else:
                self.other_error += 1
            if ms is not None:
                self.latencies_ms.append(ms)
            if len(self.errors) < 50:
                self.errors.append(detail)


def call_odds(link: str, has_corner: bool) -> tuple[bool, str, float | None]:
    params = urllib.parse.urlencode(
        {"event_link": link, "has_odds_corner": str(has_corner).lower()}
    )
    url = f"{BASE_URL}?{params}"
    start = time.perf_counter()
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            ms = (time.perf_counter() - start) * 1000
            if resp.status != 200:
                return False, f"HTTP {resp.status}", ms
            data = json.loads(body)
            match_id = data.get("matchId") or data.get("match_id")
            odds = data.get("odds") or data.get("oddsList") or data.get("odds_list")
            has_odds = bool(match_id) and odds is not None and odds != [] and odds != {}
            if not has_odds:
                return False, f"empty/missing odds matchId={match_id}", ms
            return True, "ok", ms
    except urllib.error.HTTPError as e:
        ms = (time.perf_counter() - start) * 1000
        try:
            err_body = e.read().decode("utf-8", errors="replace")[:200]
        except Exception:
            err_body = ""
        return False, f"HTTP {e.code} {err_body}", ms
    except TimeoutError:
        ms = (time.perf_counter() - start) * 1000
        return False, "timeout", ms
    except urllib.error.URLError as e:
        ms = (time.perf_counter() - start) * 1000
        if "timed out" in str(e.reason).lower():
            return False, "timeout", ms
        return False, f"url_error: {e.reason}", ms
    except Exception as e:
        ms = (time.perf_counter() - start) * 1000
        return False, f"{type(e).__name__}: {e}", ms


def worker(worker_id: int, link: str, has_corner: bool, end_at: float, stats: Stats) -> None:
    label = f"w{worker_id}|corner={has_corner}|{link[-24:]}"
    while time.perf_counter() < end_at:
        ok, detail, ms = call_odds(link, has_corner)
        if ok:
            stats.record_ok(ms or 0, True)
        else:
            kind = "timeout" if detail == "timeout" else (
                "http" if detail.startswith("HTTP") else "other"
            )
            stats.record_fail(kind, f"{label}: {detail}", ms)
        # no throttle — fire next as soon as previous completes


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = int(len(s) * p / 100)
    return s[min(idx, len(s) - 1)]


def main() -> int:
    stats = Stats()
    end_at = time.perf_counter() + DURATION_SEC
    started = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"Load test started {started}, duration={DURATION_SEC}s, workers={WORKERS}")
    print("Fixtures:")
    for i, (link, corner) in enumerate(FIXTURES):
        print(f"  [{i}] has_odds_corner={corner} {link}")

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [
            pool.submit(worker, i, link, corner, end_at, stats)
            for i, (link, corner) in enumerate(FIXTURES)
        ]
        for f in as_completed(futures):
            f.result()

    lat = stats.latencies_ms
    failed = stats.http_error + stats.timeout + stats.other_error
    print("\n=== RESULTS ===")
    print(f"Duration: {DURATION_SEC}s")
    print(f"Total requests: {stats.total}")
    print(f"Success: {stats.ok}")
    print(f"Failed: {failed} ({100 * failed / stats.total:.1f}%)" if stats.total else "Failed: 0")
    print(f"  HTTP errors: {stats.http_error}")
    print(f"  Timeouts: {stats.timeout}")
    print(f"  Other: {stats.other_error}")
    print(f"  Empty/missing odds (counted as fail): included in other/http above")
    if lat:
        print(f"Latency ms — min={min(lat):.0f} p50={percentile(lat, 50):.0f} "
              f"p95={percentile(lat, 95):.0f} max={max(lat):.0f}")
    if stats.errors:
        print("\nSample errors (up to 20):")
        for e in stats.errors[:20]:
            print(f"  - {e}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
