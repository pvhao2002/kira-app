package investment

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"
)

func d(s string) decimal.Decimal { return decimal.RequireFromString(s) }

func TestCamel(t *testing.T) {
	for in, want := range map[string]string{"READY_WITH_ERRORS": "readyWithErrors", "QUEUED": "queued", "SAVE_AS_NEW": "saveAsNew"} {
		if got := camel(in); got != want {
			t.Errorf("%s: %s != %s", in, got, want)
		}
	}
}

func TestRangeValid(t *testing.T) {
	cases := []struct {
		f, t string
		max  int
		ok   bool
	}{
		{"2026-01-01", "2026-01-31", 365, true}, {"2026-02-01", "2026-01-31", 365, false},
		{"", "2026-01-31", 365, false}, {"2025-01-01", "2026-01-02", 365, false}, {"2025-01-01", "2026-01-01", 365, true},
	}
	for _, c := range cases {
		if rangeValid(c.f, c.t, c.max) != c.ok {
			t.Errorf("%+v", c)
		}
	}
}

func TestPeriodFrom(t *testing.T) {
	now := time.Date(2026, 10, 14, 0, 0, 0, 0, time.UTC)
	for g, want := range map[string]string{"DAY": "2026-10-01", "MONTH": "2025-11-01", "YEAR": "2021-11-01"} {
		if got := periodFrom(g, now); got != want {
			t.Errorf("%s: %s != %s", g, got, want)
		}
	}
}

func TestGroupMonthlyAndNet(t *testing.T) {
	daily := []dailyFlow{{"2026-02-01", d("10"), d("30"), d("5")}, {"2026-01-31", d("100"), d("20"), d("0")}, {"2026-02-02", d("1"), d("1"), d("1")}}
	m := groupMonthly(daily, modeWDBD)
	if len(m) != 2 || m[0].Month != "2026-01" || !m[0].Net.Equal(d("-80")) || !m[1].Net.Equal(d("26")) {
		t.Fatalf("%+v", m)
	}
	if !netFlow(modeWD, d("10"), d("30"), d("5")).Equal(d("20")) {
		t.Fatal("net")
	}
}

func TestLabelStepBytes(t *testing.T) {
	if labelStep(30) != 1 || labelStep(31) != 5 || labelStep(61) != 15 {
		t.Fatal("step")
	}
	if fmtBytes(512) != "512 B" || fmtBytes(1536) != "1.5 KB" || fmtBytes(3<<20) != "3.0 MB" {
		t.Fatal("bytes")
	}
}

func TestConfirmAndMerge(t *testing.T) {
	cur, typ := " vnd ", "DEPOSIT"
	items := []importItem{{ItemID: "a", Version: 2, ProcessingAction: "INSERT", Currency: &cur, TransactionType: &typ}, {ItemID: "b", ProcessingAction: "IGNORE"}}
	rows := mergeRows(nil, items)
	if !rows[0].selected || rows[1].selected {
		t.Fatal("initial selection")
	}
	rows[0].resolution = "SAVE_AS_NEW"
	rows = mergeRows(rows, items)
	if rows[0].resolution != "SAVE_AS_NEW" {
		t.Fatal("merge keeps resolution")
	}
	c := buildConfirm(rows)
	if len(c) != 2 || c[0].Resolution != "SAVE_AS_NEW" || *c[0].Currency != "VND" || c[1].Resolution != "SKIP" || c[1].Currency != nil {
		t.Fatalf("%+v", c)
	}
}

func TestFeed(t *testing.T) {
	if feedTone("WITHDRAWAL", "PENDING") != "pending" || feedTone("WITHDRAWAL", "COMPLETED") != "out" || feedTone("DEPOSIT", "FAILED") != "failed" || feedTone("BONUS", "COMPLETED") != "in" {
		t.Fatal("tone")
	}
	g := groupDays([]txn{{TransactionAt: "2026-10-14T03:00:00Z"}, {TransactionAt: "2026-10-14T01:00:00Z"}, {TransactionAt: "2026-10-13T01:00:00Z"}})
	if len(g) != 2 || len(g[0].Rows) != 2 {
		t.Fatalf("%+v", g)
	}
}
