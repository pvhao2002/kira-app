package reports

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"
)

func TestRangeValid(t *testing.T) {
	a := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	ok := a.AddDate(0, 0, 365)
	bad := a.AddDate(0, 0, 366)
	before := a.AddDate(0, 0, -1)
	if !RangeValid(&a, &ok) || RangeValid(&a, &bad) || RangeValid(&a, &before) || RangeValid(nil, &a) || !RangeValid(&a, &a) {
		t.Fatal("range")
	}
}

func TestSortAccountsByNetDesc(t *testing.T) {
	a := []accountStats{{AccountName: "a", NetAmount: decimal.NewFromInt(1)}, {AccountName: "b", NetAmount: decimal.NewFromInt(5)}}
	sortAccounts(a)
	if a[0].AccountName != "b" {
		t.Fatal(a)
	}
}
