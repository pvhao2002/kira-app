package invreports

import (
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
)

var tabs = []string{"overview", "insights", "goals", "periodic", "accounts", "matrix", "equity", "performance", "drawdowns",
	"rolling", "daily", "activity", "distribution", "bonus", "ledger", "cadence", "allocation", "lots", "payback",
	"seasonality", "projection", "comparison"}

// defaultMonths is the default look-back (in months) of every tab.
var defaultMonths = map[string]int{"overview": 12, "insights": 3, "goals": 12, "periodic": 12, "accounts": 12, "matrix": 12,
	"drawdowns": 12, "cadence": 12, "equity": 3, "performance": 12, "rolling": 3, "daily": 3, "activity": 3, "distribution": 3,
	"bonus": 12, "ledger": 1, "allocation": 60, "lots": 60, "payback": 60, "seasonality": 24, "projection": 3, "comparison": 1}

const dateFmt = "2006-01-02"

// defaultRange: from = first day of the month (N-1) months ago (first of this month when N==1), to = today.
func defaultRange(tab string, today time.Time) (from, to time.Time) {
	n := defaultMonths[tab]
	if n < 1 {
		n = 1
	}
	from = time.Date(today.Year(), today.Month()-time.Month(n-1), 1, 0, 0, 0, 0, today.Location())
	return from, today
}

// rangeStatus validates the filter. "" = ok, "long" = span over 1830 days, "bad" = anything else.
func rangeStatus(from, to *time.Time, comparison bool, cFrom, cTo *time.Time) string {
	if from == nil || to == nil || from.After(*to) {
		return "bad"
	}
	if to.Sub(*from) > 1830*24*time.Hour {
		return "long"
	}
	if comparison && ((cFrom == nil) != (cTo == nil) || (cFrom != nil && cTo != nil && cFrom.After(*cTo))) {
		return "bad"
	}
	return ""
}

func csvNum(d D) string { return d.String() }

func csvPtr(d *D) string {
	if d == nil {
		return ""
	}
	return d.String()
}

func csvStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func csvInt(p *int) string {
	if p == nil {
		return ""
	}
	return strconv.Itoa(*p)
}

// csvData is one tab's export: file name, header and rows.
type csvData struct {
	File   string
	Header []string
	Rows   [][]string
}

func csvPeriodic(r periodicReport, cur string) csvData {
	c := csvData{File: "investment-" + strings.ToLower(r.Granularity) + "-" + cur + ".csv",
		Header: []string{"period", "transactions", "deposits", "withdrawals", "bonuses", "net", "net_with_bonus", "cumulative_net", "change_pct", "currency"}}
	for _, p := range r.Rows {
		c.Rows = append(c.Rows, []string{p.Period, strconv.Itoa(p.Totals.Count), csvNum(p.Totals.Deposits), csvNum(p.Totals.Withdrawals),
			csvNum(p.Totals.Bonuses), csvNum(p.Totals.Net), csvNum(p.Totals.NetWithBonus), csvNum(p.CumulativeNet), csvPtr(p.NetChangePct), cur})
	}
	return c
}

func csvAccounts(r accountsReport, cur string) csvData {
	c := csvData{File: "investment-accounts-" + cur + ".csv", Header: []string{"account", "transactions", "deposits", "withdrawals", "bonuses",
		"net", "roi_pct", "net_share_pct", "avg_deposit", "avg_withdrawal", "last_date", "days_since_last", "currency"}}
	for _, a := range r.Rows {
		c.Rows = append(c.Rows, []string{a.AccountName, strconv.Itoa(a.Totals.Count), csvNum(a.Totals.Deposits), csvNum(a.Totals.Withdrawals),
			csvNum(a.Totals.Bonuses), csvNum(a.Totals.Net), csvPtr(a.RoiPct), csvPtr(a.NetSharePct), csvNum(a.AverageDeposit),
			csvNum(a.AverageWithdrawal), a.LastDate, strconv.Itoa(a.DaysSinceLast), cur})
	}
	return c
}

// csvMatrix always exports the monthly cells.
func csvMatrix(r matrixReport, cur string) csvData {
	c := csvData{File: "investment-matrix-" + cur + ".csv", Header: append(append([]string{"account"}, r.Months...), "total", "currency")}
	for _, row := range r.Rows {
		rec := []string{row.AccountName}
		for _, v := range row.Cells {
			rec = append(rec, csvNum(v))
		}
		c.Rows = append(c.Rows, append(rec, csvNum(row.Total), cur))
	}
	return c
}

func csvDrawdowns(r drawdownReport, cur string) csvData {
	c := csvData{File: "investment-drawdowns-" + cur + ".csv", Header: []string{"peak_date", "start", "trough", "recovery", "depth",
		"days_to_trough", "days_to_recover", "duration_days", "currency"}}
	for _, e := range r.Episodes {
		c.Rows = append(c.Rows, []string{e.PeakDate, e.StartDate, e.TroughDate, csvStr(e.RecoveryDate), csvNum(e.Depth),
			strconv.Itoa(e.DaysToTrough), csvInt(e.DaysToRecover), strconv.Itoa(e.DurationDays), cur})
	}
	return c
}

func csvDaily(r dailyReport, cur string) csvData {
	c := csvData{File: "investment-daily-" + cur + ".csv", Header: []string{"date", "transactions", "deposits", "withdrawals", "bonuses", "net", "currency"}}
	for _, d := range r.Days {
		c.Rows = append(c.Rows, []string{d.Date, strconv.Itoa(d.Totals.Count), csvNum(d.Totals.Deposits), csvNum(d.Totals.Withdrawals),
			csvNum(d.Totals.Bonuses), csvNum(d.Totals.Net), cur})
	}
	return c
}

func csvBonus(r bonusReport, cur string) csvData {
	c := csvData{File: "investment-bonus-" + cur + ".csv", Header: []string{"scope", "label", "bonuses", "bonus_count", "deposits", "bonus_pct_of_deposits", "currency"}}
	add := func(scope string, rows []bonusRow) {
		for _, b := range rows {
			c.Rows = append(c.Rows, []string{scope, b.Label, csvNum(b.Bonuses), strconv.Itoa(b.BonusCount), csvNum(b.Deposits), csvPtr(b.BonusPctOfDeposits), cur})
		}
	}
	add("month", r.ByMonth)
	add("account", r.ByAccount)
	return c
}

// ledgerFiltered filters rows by type ("" = all).
func ledgerFiltered(rows []ledgerRow, typ string) []ledgerRow {
	if typ == "" {
		return rows
	}
	var out []ledgerRow
	for _, r := range rows {
		if r.Type == typ {
			out = append(out, r)
		}
	}
	return out
}

func csvLedger(rows []ledgerRow, cur string) csvData {
	c := csvData{File: "investment-ledger-" + cur + ".csv", Header: []string{"at", "account", "type", "amount", "net", "running_net", "currency"}}
	for _, r := range rows {
		c.Rows = append(c.Rows, []string{r.At, r.AccountName, r.Type, csvNum(r.Amount), csvNum(r.SignedNet), csvNum(r.RunningNet), cur})
	}
	return c
}

func csvCadence(r cadenceReport, cur string) csvData {
	c := csvData{File: "investment-cadence-" + cur + ".csv", Header: []string{"account", "transactions", "avg_gap_days", "longest_gap_days",
		"longest_gap_from", "longest_gap_to", "avg_days_deposit_to_withdrawal"}}
	for _, a := range r.Rows {
		c.Rows = append(c.Rows, []string{a.AccountName, strconv.Itoa(a.Transactions), csvPtr(a.AverageGapDays), strconv.Itoa(a.LongestGapDays),
			csvStr(a.LongestGapFrom), csvStr(a.LongestGapTo), csvPtr(a.AvgDaysDepositToWithdraw)})
	}
	return c
}

func csvLots(r lotsReport, cur string) csvData {
	name := "investment-lots-" + cur
	if r.Truncated {
		name += "-newest-200"
	}
	c := csvData{File: name + ".csv", Header: []string{"account", "deposit_date", "amount", "recovered", "outstanding", "recovered_date",
		"days_to_recover", "age_days", "currency"}}
	for _, l := range r.Lots {
		c.Rows = append(c.Rows, []string{l.AccountName, l.DepositDate, csvNum(l.Amount), csvNum(l.Recovered), csvNum(l.Outstanding),
			csvStr(l.RecoveredDate), csvInt(l.DaysToRecover), strconv.Itoa(l.AgeDays), cur})
	}
	return c
}

func csvPayback(r paybackReport, cur string) csvData {
	c := csvData{File: "investment-payback-" + cur + ".csv", Header: []string{"account", "deposits", "withdrawals", "recovered_pct", "outstanding",
		"break_even_date", "days_to_break_even", "currency"}}
	for _, p := range r.Rows {
		c.Rows = append(c.Rows, []string{p.AccountName, csvNum(p.Deposits), csvNum(p.Withdrawals), csvPtr(p.RecoveredPct), csvNum(p.Outstanding),
			csvStr(p.BreakEvenDate), csvInt(p.DaysToBreakEven), cur})
	}
	return c
}

func csvSeasonality(r seasonalityReport, cur string) csvData {
	c := csvData{File: "investment-seasonality-" + cur + ".csv", Header: []string{"month", "years_with_activity", "winning_years", "transactions",
		"total_net", "average_net", "currency"}}
	for _, m := range r.Months {
		c.Rows = append(c.Rows, []string{strconv.Itoa(m.Month), strconv.Itoa(m.Occurrences), strconv.Itoa(m.WinningOccurrences), strconv.Itoa(m.Count),
			csvNum(m.TotalNet), csvNum(m.AverageNet), cur})
	}
	return c
}

// winRate = winDays/(winDays+lossDays)*100 (nil when there are no decided days).
func winRate(win, loss int) *D {
	if win+loss == 0 {
		return nil
	}
	r := decimal.NewFromInt(int64(win)).Mul(decimal.NewFromInt(100)).Div(decimal.NewFromInt(int64(win + loss)))
	return &r
}

// clampPct clamps a percent to [0,100] and returns it as a 0..1 float for drawing.
func clampPct(d D) float64 {
	f := d.InexactFloat64() / 100
	return max(0, min(1, f))
}

// maxAbs is the largest |v| (at least floor), used to scale heat tints and bars.
func maxAbs(vals []D, floor float64) float64 {
	m := floor
	for _, v := range vals {
		if a := v.Abs().InexactFloat64(); a > m {
			m = a
		}
	}
	return m
}

// tintPct is base+scale*|v|/max in percent (the web's colour-mix weight).
func tintPct(v D, max, base, scale float64) float64 {
	return base + v.Abs().InexactFloat64()/max*scale
}

// insightValue formats an insight value: money for month/large-transaction codes, raw otherwise.
func insightValue(code string, v *D, money func(D) string) string {
	if v == nil {
		return ""
	}
	if code == "NEGATIVE_MONTH" || code == "POSITIVE_MONTH" || strings.HasPrefix(code, "LARGE_TRANSACTION") {
		return money(*v)
	}
	return v.String()
}

// topDays returns up to n days with net>0 (best, desc) or net<0 (worst, most negative first).
func topDays(days []dayRow, best bool, n int) []dayRow {
	var out []dayRow
	for _, d := range days {
		if (best && d.Totals.Net.IsPositive()) || (!best && d.Totals.Net.IsNegative()) {
			out = append(out, d)
		}
	}
	// insertion sort: n is small relative to days, but days<=1830
	for i := 1; i < len(out); i++ {
		for j := i; j > 0; j-- {
			a, b := out[j-1].Totals.Net, out[j].Totals.Net
			if (best && a.LessThan(b)) || (!best && a.GreaterThan(b)) {
				out[j-1], out[j] = out[j], out[j-1]
			} else {
				break
			}
		}
	}
	if len(out) > n {
		out = out[:n]
	}
	return out
}

// sparse picks every ceil(n/8)-th label (chart x axis).
func labelEvery(n int) int { return max(1, (n+7)/8) }
