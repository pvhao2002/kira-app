package investment

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
)

// camel turns READY_WITH_ERRORS into readyWithErrors (i18n key suffix).
func camel(s string) string {
	parts := strings.Split(strings.ToLower(s), "_")
	for i := 1; i < len(parts); i++ {
		if parts[i] != "" {
			parts[i] = strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return strings.Join(parts, "")
}

func str(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func dashIfEmpty(p *string) string {
	if s := strings.TrimSpace(str(p)); s != "" {
		return s
	}
	return format.Dash
}

// ---- import review ----

func batchActive(status string) bool { return status == "QUEUED" || status == "PROCESSING" }

func batchReviewable(status string) bool {
	return status == "READY" || status == "READY_WITH_ERRORS" || status == "PARTIALLY_CONFIRMED"
}

type reviewRow struct {
	item       importItem
	selected   bool
	resolution string
}

// mergeRows builds review rows for items, keeping selection/resolution of rows seen before (by itemId).
func mergeRows(old []*reviewRow, items []importItem) []*reviewRow {
	prev := map[string]*reviewRow{}
	for _, r := range old {
		prev[r.item.ItemID] = r
	}
	rows := make([]*reviewRow, 0, len(items))
	for _, it := range items {
		r := &reviewRow{item: it, selected: it.ProcessingAction != "IGNORE", resolution: "ACCEPT"}
		if o, ok := prev[it.ItemID]; ok {
			r.selected, r.resolution = o.selected, o.resolution
		}
		rows = append(rows, r)
	}
	return rows
}

type confirmItem struct {
	ItemID                string           `json:"itemId"`
	Version               int64            `json:"version"`
	Selected              bool             `json:"selected"`
	Resolution            string           `json:"resolution"`
	TransactionType       *string          `json:"transactionType"`
	TransactionStatus     *string          `json:"transactionStatus"`
	Amount                *decimal.Decimal `json:"amount"`
	Currency              *string          `json:"currency"`
	TransactionAt         *string          `json:"transactionAt"`
	ExternalTransactionID *string          `json:"externalTransactionId"`
	Description           *string          `json:"description"`
}

// buildConfirm sends EVERY row; unselected rows are forced to SKIP; currency upper-cased or null.
func buildConfirm(rows []*reviewRow) []confirmItem {
	out := make([]confirmItem, 0, len(rows))
	for _, r := range rows {
		it := r.item
		c := confirmItem{ItemID: it.ItemID, Version: it.Version, Selected: r.selected, Resolution: "SKIP",
			TransactionType: it.TransactionType, TransactionStatus: it.TransactionStatus, Amount: it.Amount,
			TransactionAt: it.TransactionAt, ExternalTransactionID: it.ExternalTransactionID, Description: it.Description}
		if r.selected {
			c.Resolution = r.resolution
		}
		if cur := strings.ToUpper(strings.TrimSpace(str(it.Currency))); cur != "" {
			c.Currency = &cur
		}
		out = append(out, c)
	}
	return out
}

// ---- dates ----

// rangeValid: both dates set, from <= to, span <= maxDays (0 = unlimited).
func rangeValid(from, to string, maxDays int) bool {
	f, err1 := format.ParseDate(from)
	t, err2 := format.ParseDate(to)
	if err1 != nil || err2 != nil || f.After(t) {
		return false
	}
	return maxDays == 0 || int(t.Sub(f).Hours()/24) <= maxDays
}

func shiftDate(s string, days int) string {
	t, err := format.ParseDate(s)
	if err != nil {
		return s
	}
	return t.AddDate(0, 0, days).Format("2006-01-02")
}

func monthStart(now time.Time, monthsBack int) string {
	return time.Date(now.Year(), now.Month()-time.Month(monthsBack), 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
}

// periodFrom is the default range start per granularity.
func periodFrom(gran string, now time.Time) string {
	switch gran {
	case "DAY":
		return monthStart(now, 0)
	case "YEAR":
		return monthStart(now, 59)
	}
	return monthStart(now, 11)
}

func monthLabel(ym string) string {
	t, err := time.Parse("2006-01", ym)
	if err != nil {
		return ym
	}
	if i18n.Lang() == "vi" {
		return fmt.Sprintf("thg %d %s", int(t.Month()), t.Format("06"))
	}
	return t.Format("Jan 06")
}

// ---- charts ----

// labelStep: x label stride by number of days.
func labelStep(n int) int {
	switch {
	case n <= 30:
		return 1
	case n <= 60:
		return 5
	}
	return 15
}

func floats(ds []decimal.Decimal) []float64 {
	out := make([]float64, len(ds))
	for i, d := range ds {
		out[i] = d.InexactFloat64() // drawing only
	}
	return out
}

const (
	modeWD   = "WITHDRAWAL_MINUS_DEPOSIT"
	modeWDBD = "WITHDRAWAL_PLUS_BONUS_MINUS_DEPOSIT"
)

func netFlow(mode string, dep, wd, bonus decimal.Decimal) decimal.Decimal {
	n := wd.Sub(dep)
	if mode == modeWDBD {
		n = n.Add(bonus)
	}
	return n
}

type monthSum struct {
	Month               string // yyyy-MM
	Dep, Wd, Bonus, Net decimal.Decimal
}

// groupMonthly sums daily points per yyyy-MM, ascending.
func groupMonthly(daily []dailyFlow, mode string) []monthSum {
	m := map[string]*monthSum{}
	for _, d := range daily {
		if len(d.Date) < 7 {
			continue
		}
		k := d.Date[:7]
		s := m[k]
		if s == nil {
			s = &monthSum{Month: k}
			m[k] = s
		}
		s.Dep, s.Wd, s.Bonus = s.Dep.Add(d.Deposits), s.Wd.Add(d.Withdrawals), s.Bonus.Add(d.Bonuses)
	}
	out := make([]monthSum, 0, len(m))
	for _, s := range m {
		s.Net = netFlow(mode, s.Dep, s.Wd, s.Bonus)
		out = append(out, *s)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Month < out[j].Month })
	return out
}

func fmtBytes(n int64) string {
	switch {
	case n < 1024:
		return fmt.Sprintf("%d B", n)
	case n < 1<<20:
		return fmt.Sprintf("%.1f KB", float64(n)/1024)
	}
	return fmt.Sprintf("%.1f MB", float64(n)/(1<<20))
}

// feedTone: pending | failed | out | in.
func feedTone(txType, status string) string {
	switch {
	case status == "PENDING":
		return "pending"
	case status == "FAILED" || status == "CANCELLED":
		return "failed"
	case txType == "WITHDRAWAL":
		return "out"
	}
	return "in"
}

type dayGroup struct {
	Day  string
	Rows []txn
}

// groupDays groups consecutive rows by formatted day, preserving order.
func groupDays(rows []txn) []dayGroup {
	var out []dayGroup
	for _, r := range rows {
		day := format.Timestamp(r.TransactionAt, format.DateMedium)
		if n := len(out); n > 0 && out[n-1].Day == day {
			out[n-1].Rows = append(out[n-1].Rows, r)
			continue
		}
		out = append(out, dayGroup{Day: day, Rows: []txn{r}})
	}
	return out
}
