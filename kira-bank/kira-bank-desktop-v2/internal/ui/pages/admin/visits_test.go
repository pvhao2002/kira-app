package admin

import (
	"testing"
	"time"
)

func TestVisitFilter(t *testing.T) {
	loc := time.FixedZone("x", 7*3600)
	a := time.Date(2026, 10, 8, 12, 0, 0, 0, loc)
	b := time.Date(2026, 10, 14, 1, 0, 0, 0, loc)
	f, ok := newVisitFilter(a, b, " 1.2.3.4 ", loc)
	if !ok || f.from != "2026-10-07T17:00:00.000Z" || f.to != "2026-10-14T17:00:00.000Z" || f.ip != "1.2.3.4" {
		t.Fatalf("%+v %v", f, ok)
	}
	if _, ok := newVisitFilter(b, a, "", loc); ok {
		t.Error("from>to accepted")
	}
	if _, ok := newVisitFilter(a.AddDate(0, 0, -92), a, "", loc); ok {
		t.Error("93 days accepted")
	}
	if _, ok := newVisitFilter(a.AddDate(0, 0, -91), a, "", loc); !ok {
		t.Error("92-day span rejected")
	}
}

func TestUA(t *testing.T) {
	ua := "Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/120.0 Safari/537 Edg/119.0.1"
	if parseBrowser(ua) != "Edge 119" || parseDevice(ua) != "Windows" || parseBrowser("curl") != "" {
		t.Error(parseBrowser(ua))
	}
}
