import json, urllib.parse, urllib.request, time
links = [
 ("https://www.aiscore.com/match-al-hilal-u21-al-taawoun-u21/xvkjoimojgws879", True),
 ("https://www.aiscore.com/match-eskisehirspor-balcova-belediyespor/zrkn6im4g18uwql", True),
 ("https://www.aiscore.com/match-real-sociedad-women-athletic-club-women/8lk2didyzphz736", True),
 ("https://www.aiscore.com/match-greenock-morton-dunfermline-athletic/jr7owi0p6dsgq0e", False),
 ("https://www.aiscore.com/match-manchester-city-u21-liverpool-u21/o17pjiyow5hy7jw", False),
]
for link, corner in links:
    p = urllib.parse.urlencode({"event_link": link, "has_odds_corner": str(corner).lower()})
    t = time.perf_counter()
    with urllib.request.urlopen(f"http://localhost:4000/matches/v5/odds?{p}", timeout=120) as r:
        d = json.loads(r.read())
    ms = (time.perf_counter()-t)*1000
    odds = d.get("odds") or []
    mid = d.get("matchId")
    print(f"corner={corner} ms={ms:.0f} odds={len(odds)} matchId={mid} bodyLen={len(json.dumps(d))}")
