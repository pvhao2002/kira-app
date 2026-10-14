// Package reports is the combined investment & bank report (/app/reports/finance).
package reports

import (
	"context"
	"net/url"
	"sort"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

// Pages registers the finance report.
func Pages(env *kit.Env) []kit.Page {
	return []kit.Page{{ID: "/app/reports/finance", Group: "shell.groupReports", TitleKey: "route.financeReport",
		MenuKey: "shell.financeReport", Order: 10, Icon: theme.StorageIcon(), Build: func() fyne.CanvasObject { return build(env) }}}
}

type bankDashboard struct {
	TotalCreditLimit decimal.Decimal `json:"totalCreditLimit"`
	TotalStatement   decimal.Decimal `json:"totalStatementDebt"`
	CurrentBalance   decimal.Decimal `json:"currentBalance"`
	AvailableCredit  decimal.Decimal `json:"availableCredit"`
	UtilizationRate  decimal.Decimal `json:"utilizationRate"`
	Currency         string          `json:"currency"`
	Banks            []bankRow       `json:"banks"`
}

type bankRow struct {
	BankName         string          `json:"bankName"`
	CardCount        int             `json:"cardCount"`
	TotalCreditLimit decimal.Decimal `json:"totalCreditLimit"`
	CurrentBalance   decimal.Decimal `json:"currentBalance"`
	AvailableCredit  decimal.Decimal `json:"availableCredit"`
	UtilizationRate  decimal.Decimal `json:"utilizationRate"`
	Currency         string          `json:"currency"`
}

type invStats struct {
	Currencies []currencyStats `json:"currencies"`
	Accounts   []accountStats  `json:"accounts"`
}

type currencyStats struct {
	Currency    string          `json:"currency"`
	TotalCount  int             `json:"totalCount"`
	Deposits    decimal.Decimal `json:"deposits"`
	Withdrawals decimal.Decimal `json:"withdrawals"`
	Bonuses     decimal.Decimal `json:"bonuses"`
	NetAmount   decimal.Decimal `json:"netAmount"`
}

type accountStats struct {
	AccountName string          `json:"accountName"`
	AccountCode string          `json:"accountCode"`
	Currency    string          `json:"currency"`
	Status      string          `json:"status"`
	TotalCount  int             `json:"totalCount"`
	Deposits    decimal.Decimal `json:"deposits"`
	Withdrawals decimal.Decimal `json:"withdrawals"`
	Bonuses     decimal.Decimal `json:"bonuses"`
	NetAmount   decimal.Decimal `json:"netAmount"`
}

const day = "2006-01-02"

// RangeValid reports whether from..to is a usable range: both set, from <= to,
// and at most 365 days apart.
func RangeValid(from, to *time.Time) bool {
	if from == nil || to == nil || from.After(*to) {
		return false
	}
	return to.Sub(*from) <= 365*24*time.Hour
}

func sortBanks(b []bankRow) {
	sort.SliceStable(b, func(i, j int) bool { return b[i].CurrentBalance.GreaterThan(b[j].CurrentBalance) })
}

func sortAccounts(a []accountStats) {
	sort.SliceStable(a, func(i, j int) bool { return a[i].NetAmount.GreaterThan(a[j].NetAmount) })
}

func build(env *kit.Env) fyne.CanvasObject {
	today := time.Now()
	from, to := kit.NewDateEntry(), kit.NewDateEntry()
	f0, t0 := today.AddDate(0, 0, -29), today
	from.SetDate(&f0)
	to.SetDate(&t0)

	query := func() url.Values {
		q := url.Values{}
		if from.Date != nil {
			q.Set("fromDate", from.Date.Format(day))
		}
		if to.Date != nil {
			q.Set("toDate", to.Date.Format(day))
		}
		return q
	}

	bankView := kit.NewAsyncView(env, func(ctx context.Context) (bankDashboard, error) {
		var d bankDashboard
		return d, env.API.Get(ctx, "dashboards/credit-cards", nil, &d)
	}, func(d bankDashboard) fyne.CanvasObject { return renderBank(env, d) })

	invView := kit.NewAsyncView(env, func(ctx context.Context) (invStats, error) {
		var s invStats
		return s, env.API.Get(ctx, "investment/statistics", query(), &s)
	}, renderInvestment)

	invalid := kit.Muted(i18n.T("financeReport.rangeInvalid"))
	apply := widget.NewButton(i18n.T("financeReport.apply"), invView.Reload)
	apply.Importance = widget.HighImportance
	check := func() {
		if RangeValid(from.Date, to.Date) {
			apply.Enable()
			invalid.Hide()
		} else {
			apply.Disable()
			invalid.Show()
		}
	}
	from.OnChanged = func(*time.Time) { check() }
	to.OnChanged = func(*time.Time) { check() }
	quick := container.NewHBox(widget.NewLabel(i18n.T("financeReport.quickRange")))
	for _, n := range []int{7, 30, 90} {
		n := n
		quick.Add(widget.NewButton(itoa(n)+"d", func() {
			t := time.Now()
			f := t.AddDate(0, 0, -(n - 1))
			from.SetDate(&f)
			to.SetDate(&t)
			check()
			invView.Reload()
		}))
	}
	check()

	refresh := widget.NewButtonWithIcon(i18n.T("financeReport.refresh"), theme.ViewRefreshIcon(), func() {
		bankView.Reload()
		invView.Reload()
	})
	filter := kit.Card("", "", container.NewVBox(
		container.NewGridWithColumns(2,
			container.NewVBox(widget.NewLabel(i18n.T("financeReport.from")), from),
			container.NewVBox(widget.NewLabel(i18n.T("financeReport.to")), to)),
		quick, container.NewHBox(apply, invalid)))

	page := container.NewVBox(
		kit.PageHeader(i18n.T("financeReport.eyebrow"), i18n.T("financeReport.title"), i18n.T("financeReport.description"), refresh),
		section(i18n.T("financeReport.bankEyebrow"), i18n.T("financeReport.bankSection"),
			i18n.T("financeReport.openBankDashboard"), func() { env.Navigate("/app/credit-card/dashboard", nil) }, bankView),
		filter,
		section("", i18n.T("financeReport.investmentSection"), i18n.T("financeReport.openInvestmentStatistics"),
			func() { env.Navigate("/app/investment/statistics", nil) }, invView))
	return container.NewVScroll(page)
}

func itoa(n int) string { return decimal.NewFromInt(int64(n)).String() }

func section(eyebrow, title, linkText string, open func(), body fyne.CanvasObject) fyne.CanvasObject {
	link := widget.NewButton(linkText, open)
	link.Importance = widget.LowImportance
	head := container.NewBorder(nil, nil, container.NewVBox(kit.Muted(eyebrow), kit.Heading(title)), link)
	return container.NewVBox(kit.Sep(), head, body)
}

func renderBank(env *kit.Env, d bankDashboard) fyne.CanvasObject {
	if len(d.Banks) == 0 {
		return kit.Muted(i18n.T("financeReport.noBanks"))
	}
	cur := d.Currency
	tiles := container.NewGridWithColumns(5,
		kit.Tile(i18n.T("financeReport.creditLimit"), format.Money(d.TotalCreditLimit, cur)),
		kit.Tile(i18n.T("financeReport.statementDebt"), format.Money(d.TotalStatement, cur)),
		kit.Tile(i18n.T("financeReport.currentBalance"), format.Money(d.CurrentBalance, cur)),
		kit.Tile(i18n.T("financeReport.availableCredit"), format.Money(d.AvailableCredit, cur)),
		kit.Tile(i18n.T("financeReport.utilization"), format.Percent(d.UtilizationRate, 1)))
	banks := append([]bankRow(nil), d.Banks...)
	sortBanks(banks)
	t := kit.NewTable([]kit.Col[bankRow]{
		{Title: i18n.T("financeReport.bank"), Weight: 2, Text: func(b bankRow) string { return b.BankName + " (" + b.Currency + ")" }},
		{Title: i18n.T("financeReport.cards"), MinWidth: 50, Text: func(b bankRow) string { return itoa(b.CardCount) }},
		{Title: i18n.T("financeReport.creditLimit"), Align: fyne.TextAlignTrailing, Text: func(b bankRow) string { return format.Money(b.TotalCreditLimit, b.Currency) }},
		{Title: i18n.T("financeReport.currentBalance"), Align: fyne.TextAlignTrailing, Text: func(b bankRow) string { return format.Money(b.CurrentBalance, b.Currency) }},
		{Title: i18n.T("financeReport.availableCredit"), Align: fyne.TextAlignTrailing, Text: func(b bankRow) string { return format.Money(b.AvailableCredit, b.Currency) }},
		{Title: i18n.T("financeReport.utilization"), Weight: 1.5, Cell: func(b bankRow) fyne.CanvasObject {
			bar := widget.NewProgressBar()
			bar.Min, bar.Max = 0, 100
			bar.TextFormatter = func() string { return format.Percent(b.UtilizationRate, 1) }
			bar.SetValue(clamp(b.UtilizationRate.InexactFloat64(), 0, 100)) // float only for drawing
			return bar
		}},
	})
	t.SetRows(banks)
	return container.NewVBox(tiles, t)
}

func clamp(v, lo, hi float64) float64 { return max(lo, min(hi, v)) }

func signed(d decimal.Decimal, cur string) fyne.CanvasObject {
	l := widget.NewLabel(format.Money(d, cur))
	l.Alignment = fyne.TextAlignTrailing
	if d.IsNegative() {
		l.Importance = widget.DangerImportance
	} else {
		l.Importance = widget.SuccessImportance
	}
	return l
}

func renderInvestment(s invStats) fyne.CanvasObject {
	if len(s.Currencies) == 0 {
		return kit.Muted(i18n.T("financeReport.noFlow"))
	}
	flow := container.NewVBox()
	show := func(cur string) {
		var c currencyStats
		for _, x := range s.Currencies {
			if x.Currency == cur {
				c = x
			}
		}
		flow.Objects = []fyne.CanvasObject{container.NewGridWithColumns(5,
			kit.Tile(i18n.T("financeReport.deposits"), format.Money(c.Deposits, cur)),
			kit.Tile(i18n.T("financeReport.withdrawals"), format.Money(c.Withdrawals, cur)),
			kit.Tile(i18n.T("financeReport.bonuses"), format.Money(c.Bonuses, cur)),
			container.NewVBox(kit.Muted(i18n.T("financeReport.net")), signed(c.NetAmount, cur)),
			kit.Tile(i18n.T("financeReport.transactions"), itoa(c.TotalCount)))}
		flow.Refresh()
	}
	var curs []string
	for _, c := range s.Currencies {
		curs = append(curs, c.Currency)
	}
	top := container.NewVBox()
	if len(curs) > 1 {
		sel := widget.NewSelect(curs, show)
		sel.SetSelected(curs[0])
		top.Add(container.NewHBox(widget.NewLabel(i18n.T("financeReport.currency")), sel))
		top.Add(kit.Muted(i18n.T("financeReport.currencyHint")))
	} else {
		show(curs[0])
	}

	accs := append([]accountStats(nil), s.Accounts...)
	sortAccounts(accs)
	var tbl fyne.CanvasObject = kit.Muted(i18n.T("financeReport.noAccounts"))
	if len(accs) > 0 {
		t := kit.NewTable([]kit.Col[accountStats]{
			{Title: i18n.T("financeReport.account"), Weight: 2, Text: func(a accountStats) string {
				code := a.AccountCode
				if code == "" {
					code = "—"
				}
				return a.AccountName + " (" + code + " · " + a.Currency + ")"
			}},
			{Title: i18n.T("financeReport.statusLabel"), Text: func(a accountStats) string {
				k := "investmentStatistics.status." + strings.ToLower(a.Status)
				if i18n.Has(k) {
					return i18n.T(k)
				}
				return a.Status
			}},
			{Title: i18n.T("financeReport.transactions"), MinWidth: 60, Text: func(a accountStats) string { return itoa(a.TotalCount) }},
			{Title: i18n.T("financeReport.deposits"), Align: fyne.TextAlignTrailing, Text: func(a accountStats) string { return format.Money(a.Deposits, a.Currency) }},
			{Title: i18n.T("financeReport.withdrawals"), Align: fyne.TextAlignTrailing, Text: func(a accountStats) string { return format.Money(a.Withdrawals, a.Currency) }},
			{Title: i18n.T("financeReport.bonuses"), Align: fyne.TextAlignTrailing, Text: func(a accountStats) string { return format.Money(a.Bonuses, a.Currency) }},
			{Title: i18n.T("financeReport.net"), Align: fyne.TextAlignTrailing, Cell: func(a accountStats) fyne.CanvasObject { return signed(a.NetAmount, a.Currency) }},
		})
		t.SetRows(accs)
		tbl = t
	}
	return container.NewVBox(top, flow, tbl)
}
