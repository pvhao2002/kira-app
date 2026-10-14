package creditcard

import (
	"strings"
	"testing"

	"github.com/shopspring/decimal"
)

func dp(s string) *decimal.Decimal { d := decimal.RequireFromString(s); return &d }

func TestAddMCC(t *testing.T) {
	g1, g2 := &groupDraft{}, &groupDraft{}
	gs := []*groupDraft{g1, g2}
	if m := addMCC(gs, g1, "5812, 5411;5999"); m != "" {
		t.Fatal(m)
	}
	if strings.Join(g1.MCC, ",") != "5411,5812,5999" {
		t.Errorf("not sorted: %v", g1.MCC)
	}
	if addMCC(gs, g2, "5812") == "" {
		t.Error("duplicate across groups accepted")
	}
	if addMCC(gs, g2, "1234 1234") == "" {
		t.Error("duplicate inside input accepted")
	}
	if addMCC(gs, g2, "12a4") == "" || addMCC(gs, g2, "123") == "" {
		t.Error("invalid code accepted")
	}
	if len(g2.MCC) != 0 {
		t.Error("failed add must not append")
	}
}

func TestValidateProgram(t *testing.T) {
	ok := func() *programDraft {
		return &programDraft{Name: "P", Active: true, Groups: []*groupDraft{
			{Name: "Dining", Rate: dp("5"), Cap: dp("100000"), MCC: []string{"5812"}},
			{Name: "Fuel", Rate: dp("100"), Cap: dp("1"), MCC: []string{"5541"}}}}
	}
	if m := validateProgram(ok()); m != "" {
		t.Fatalf("valid draft rejected: %s", m)
	}
	cases := map[string]func(p *programDraft){
		"name":      func(p *programDraft) { p.Name = " " },
		"url":       func(p *programDraft) { p.TermsURL = "ftp://x" },
		"nogroups":  func(p *programDraft) { p.Groups = nil },
		"dupname":   func(p *programDraft) { p.Groups[1].Name = "dining" },
		"rate0":     func(p *programDraft) { p.Groups[0].Rate = dp("0") },
		"rate101":   func(p *programDraft) { p.Groups[0].Rate = dp("100.01") },
		"cap0":      func(p *programDraft) { p.Groups[0].Cap = nil },
		"nomcc":     func(p *programDraft) { p.Groups[0].MCC = nil },
		"dupmcc":    func(p *programDraft) { p.Groups[1].MCC = []string{"5812"} },
		"pendinglt": func(p *programDraft) { p.Groups[0].MCCInput = "5541" },
	}
	for name, mut := range cases {
		p := ok()
		mut(p)
		if validateProgram(p) == "" {
			t.Errorf("%s: invalid draft accepted", name)
		}
	}
	p := ok()
	p.Groups[0].MCCInput = "5999"
	if m := validateProgram(p); m != "" || len(p.Groups[0].MCC) != 2 {
		t.Errorf("pending MCC not flushed: %q %v", m, p.Groups[0].MCC)
	}
}

func TestUsedPercent(t *testing.T) {
	if usedPercent(dp("25"), dp("100")) != 75 || usedPercent(nil, dp("100")) != 0 || usedPercent(dp("-5"), dp("100")) != 100 || usedPercent(dp("5"), dp("0")) != 0 {
		t.Error("usedPercent")
	}
}

func TestPatterns(t *testing.T) {
	if got := rulePattern("  GRAB*  Food  12345"); got != "grab" {
		t.Errorf("rulePattern=%q", got)
	}
	if got := suggestPattern("Highlands Coffee Nguyen Hue 123"); got != "highlands coffee nguyen" {
		t.Errorf("suggestPattern=%q", got)
	}
	if got := suggestPattern("Shopee - 99"); got != "shopee" {
		t.Errorf("suggestPattern trailing=%q", got)
	}
	if got := rulePattern(strings.Repeat("ab ", 30)); len(got) > 40 {
		t.Errorf("not truncated: %d", len(got))
	}
}

func TestValidateDraft(t *testing.T) {
	tot := draftTotals{StatementDate: "2026-10-01", DueDate: "2026-10-20", StatementBalance: dp("100"), MinimumPayment: dp("10")}
	row := func() *draftRow {
		return &draftRow{Line: 1, Include: true, Date: "2026-09-30", Desc: "x", Amount: dp("5"), Type: "SPENDING"}
	}
	if m := validateDraft(tot, []*draftRow{row()}); m != "" {
		t.Fatalf("valid rejected: %s", m)
	}
	bad := map[string]func(t *draftTotals, r *draftRow){
		"dates":    func(t *draftTotals, r *draftRow) { t.DueDate = "" },
		"due":      func(t *draftTotals, r *draftRow) { t.DueDate = "2026-09-01" },
		"period":   func(t *draftTotals, r *draftRow) { t.PeriodStart, t.PeriodEnd = "2026-09-30", "2026-09-01" },
		"balance":  func(t *draftTotals, r *draftRow) { t.StatementBalance = nil },
		"negative": func(t *draftTotals, r *draftRow) { t.StatementBalance = dp("-1") },
		"minreq":   func(t *draftTotals, r *draftRow) { t.MinimumPayment = dp("0") },
		"minexc":   func(t *draftTotals, r *draftRow) { t.MinimumPayment = dp("101") },
		"row":      func(t *draftTotals, r *draftRow) { r.Type = "" },
		"mcc":      func(t *draftTotals, r *draftRow) { r.MCC = "12" },
		"remember": func(t *draftTotals, r *draftRow) { r.Remember, r.MCC, r.Pattern = true, "5812", "a" },
	}
	for name, mut := range bad {
		tt, r := tot, row()
		mut(&tt, r)
		if validateDraft(tt, []*draftRow{r}) == "" {
			t.Errorf("%s: accepted", name)
		}
	}
	// zero statement needs no minimum; excluded incomplete rows are ignored
	z := draftTotals{StatementDate: "2026-10-01", DueDate: "2026-10-01", StatementBalance: dp("0")}
	if m := validateDraft(z, []*draftRow{{Line: 2, Include: false}}); m != "" {
		t.Errorf("zero statement rejected: %s", m)
	}
}

func TestConfirmBody(t *testing.T) {
	tot := draftTotals{StatementDate: "2026-10-01", DueDate: "2026-10-20", StatementBalance: dp("0"), MinimumPayment: dp("5")}
	rows := []*draftRow{
		{Line: 1, Include: true, Date: "2026-09-30", Desc: " x ", Amount: dp("5"), Type: "SPENDING", MCC: "5812", Remember: true, Pattern: " kfc "},
		{Line: 2, Include: false}, // incomplete and unselected: dropped
		{Line: 3, Include: false, Date: "2026-09-29", Desc: "dup", Amount: dp("1"), Type: "FEE"},
	}
	b := confirmBody(7, tot, rows)
	txs := b["transactions"].([]map[string]any)
	if len(txs) != 2 || txs[0]["rememberPattern"] != "kfc" || txs[1]["rememberPattern"] != nil || txs[0]["description"] != "x" {
		t.Errorf("transactions: %v", txs)
	}
	if !b["minimumPayment"].(*decimal.Decimal).IsZero() || b["periodStart"] != nil || b["version"] != int64(7) {
		t.Errorf("body: %v", b)
	}
}
