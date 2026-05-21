#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
DATE="${DATE:-20180101}"

echo "Concurrent crawl smoke test against ${BASE_URL}"

start_ms=$(python3 -c 'import time; print(int(time.time()*1000))')

curl -s -o /dev/null -w 'matches time (s): %{time_total}\n' \
  "${BASE_URL}/matches?date=${DATE}&sport_id=1&lang=2&tz=07%3A00" &
matches_pid=$!

curl -s -o /dev/null -w 'odds time (s): %{time_total}\n' \
  "${BASE_URL}/matches/odds?event_link=https%3A%2F%2Fwww.aiscore.com%2Fmatch-home-away%2Fg6763i4gwvvso7r" &
odds_pid=$!

wait "$matches_pid"
wait "$odds_pid"

end_ms=$(python3 -c 'import time; print(int(time.time()*1000))')
echo "wall clock elapsed (ms): $((end_ms - start_ms))"
echo "Independent pools should keep wall clock near the slower request, not the sum of both."
