package invreports

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"
)

func d(s string) D { return decimal.RequireFromString(s) }

func TestDefaultRangeAndStatus(t *testing.T) {
	today := time.Date(2026, 10, 14, 0, 0, 0, 0, time.UTC)
	if f, _ := defaultRange("ledger", today); f.Format(dateFmt) != "2026-10-01" {
		t.Errorf("ledger from %v", f)
	}
	if f, _ := defaultRange("overview", today); f.Format(dateFmt) != "2025-11-01" {
		t.Errorf("overview from %v", f)
	}
	f, to := today.AddDate(-6, 0, 0), today
	if rangeStatus(&f, &to, false, nil, nil) != "long" || rangeStatus(&to, &f, false, nil, nil) != "bad" {
		t.Error("range status")
	}
	if rangeStatus(&f, &to, true, &to, nil) == "" {
		t.Error("one compare date must be invalid")
	}
}

func TestCSVRowsAndHelpers(t *testing.T) {
	r := periodicReport{Granularity: "MONTH", Rows: []periodRow{{Period: "2026-01", Totals: totals{Count: 2, Net: d("-5")}, NetChangePct: nil}}}
	c := csvPeriodic(r, "VND")
	if c.File != "investment-month-VND.csv" || len(c.Rows[0]) != len(c.Header) || c.Rows[0][5] != "-5" || c.Rows[0][8] != "" {
		t.Errorf("%+v", c)
	}
	l := csvLots(lotsReport{Truncated: true}, "USD")
	if l.File != "investment-lots-USD-newest-200.csv" {
		t.Error(l.File)
	}
	rows := []ledgerRow{{Type: "DEPOSIT"}, {Type: "BONUS"}}
	if len(ledgerFiltered(rows, "BONUS")) != 1 || len(ledgerFiltered(rows, "")) != 2 {
		t.Error("ledger filter")
	}
	if wr := winRate(3, 1); wr == nil || !wr.Equal(d("75")) || winRate(0, 0) != nil {
		t.Error("winRate")
	}
	days := []dayRow{{Date: "a", Totals: totals{Net: d("5")}}, {Date: "b", Totals: totals{Net: d("9")}}, {Date: "c", Totals: totals{Net: d("-2")}}, {Date: "d", Totals: totals{Net: d("-7")}}}
	if b := topDays(days, true, 5); b[0].Date != "b" || len(b) != 2 {
		t.Error("best")
	}
	if w := topDays(days, false, 5); w[0].Date != "d" {
		t.Error("worst")
	}
	if got := insightValue("NEGATIVE_MONTH", nil, nil); got != "" {
		t.Error(got)
	}
}
