#!/usr/bin/env bash
# Run 3 /matches crawls in parallel against separate kira-crawl-java instances (ports 4001–4003).
set -euo pipefail

QUERY="raw=false&tz=07%3A00&lang=2&sport_id=1"

URL_4001="${URL_4001:-http://localhost:4001/matches?${QUERY}&date=20260104}"
URL_4002="${URL_4002:-http://localhost:4002/matches?${QUERY}&date=20260105}"
URL_4003="${URL_4003:-http://localhost:4003/matches?${QUERY}&date=20260106}"

echo "Parallel /matches (3 instances)"
echo "  1) ${URL_4001}"
echo "  2) ${URL_4002}"
echo "  3) ${URL_4003}"
echo

start_ms=$(python3 -c 'import time; print(int(time.time()*1000))' 2>/dev/null || date +%s000)

run_one() {
  local label=$1
  local url=$2
  curl -sS -o /dev/null -w "${label} http=%{http_code} time_s=%{time_total}\n" "${url}"
}

run_one "4001" "${URL_4001}" &
pid1=$!
run_one "4002" "${URL_4002}" &
pid2=$!
run_one "4003" "${URL_4003}" &
pid3=$!

wait "$pid1"
wait "$pid2"
wait "$pid3"

end_ms=$(python3 -c 'import time; print(int(time.time()*1000))' 2>/dev/null || date +%s000)
echo
echo "wall clock elapsed (ms): $((end_ms - start_ms))"
