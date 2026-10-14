package investment

import (
	"context"
	"net/url"
	"strconv"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type adminMonth struct {
	Month        string          `json:"month"`
	Transactions int             `json:"transactions"`
	Deposits     decimal.Decimal `json:"deposits"`
	Withdrawals  decimal.Decimal `json:"withdrawals"`
	Bonuses      decimal.Decimal `json:"bonuses"`
	Net          decimal.Decimal `json:"net"`
}

type adminUser struct {
	UserID       int64           `json:"userId"`
	Email        string          `json:"email"`
	FullName     string          `json:"fullName"`
	Transactions int             `json:"transactions"`
	Deposits     decimal.Decimal `json:"deposits"`
	Withdrawals  decimal.Decimal `json:"withdrawals"`
	Net          decimal.Decimal `json:"net"`
}

type adminCurrency struct {
	Currency string `json:"currency"`
	Totals   struct {
		Transactions int             `json:"transactions"`
		Users        int             `json:"users"`
		Accounts     int             `json:"accounts"`
		Deposits     decimal.Decimal `json:"deposits"`
		Withdrawals  decimal.Decimal `json:"withdrawals"`
		Bonuses      decimal.Decimal `json:"bonuses"`
		Net          decimal.Decimal `json:"net"`
	} `json:"totals"`
	Months   []adminMonth `json:"months"`
	TopUsers []adminUser  `json:"topUsers"`
}

type adminSummary struct {
	Currencies []adminCurrency `json:"currencies"`
}

type adminPage struct {
	env      *kit.Env
	root     *fyne.Container
	filters  *fyne.Container
	body     *fyne.Container
	from, to string
	cur      string
	data     *adminSummary
	loading  bool
	failed   bool
	seq      int
	apply    *widget.Button
}

func newAdminSummary(env *kit.Env) fyne.CanvasObject {
	a := &adminPage{env: env, filters: container.NewVBox(), body: container.NewVBox()}
	a.to, a.from = format.Today(), monthStart(time.Now(), 11)
	t := i18n.T
	a.root = container.NewVBox(
		kit.PageHeader(t("investmentReports.admin.eyebrow"), t("investmentReports.admin.title"), t("investmentReports.admin.description")),
		a.filters, a.body)
	a.buildFilters()
	a.load()
	return a.root
}

func (a *adminPage) buildFilters() {
	t := i18n.T
	fromE, toE := newDate(a.from), newDate(a.to)
	a.apply = widget.NewButton(t("investmentReports.apply"), a.load)
	sync := func() {
		a.from, a.to = dateText(fromE), dateText(toE)
		if a.loading || !rangeValid(a.from, a.to, 0) {
			a.apply.Disable()
		} else {
			a.apply.Enable()
		}
	}
	fromE.OnChanged = func(*time.Time) { sync() }
	toE.OnChanged = func(*time.Time) { sync() }
	sync()
	row := container.NewHBox(labeled(t("investmentReports.from"), fromE), labeled(t("investmentReports.to"), toE))
	if a.data != nil && len(a.data.Currencies) > 1 {
		var codes []string
		for _, c := range a.data.Currencies {
			codes = append(codes, c.Currency)
		}
		sel := widget.NewSelect(codes, func(v string) { a.cur = v; a.render() })
		sel.SetSelected(a.cur)
		row.Add(labeled(t("investmentReports.currency"), sel))
	}
	row.Add(a.apply)
	a.filters.Objects = []fyne.CanvasObject{row}
	a.filters.Refresh()
}

func (a *adminPage) load() {
	if !rangeValid(a.from, a.to, 0) {
		return
	}
	a.seq++
	seq, from, to := a.seq, a.from, a.to
	a.loading, a.failed = true, false
	a.apply.Disable()
	a.render()
	kit.Async(func(ctx context.Context) (adminSummary, error) {
		var s adminSummary
		return s, a.env.API.Get(ctx, "admin/investment/reports/summary", url.Values{"fromDate": {from}, "toDate": {to}}, &s)
	}, func(s adminSummary, err error) {
		if seq != a.seq {
			return
		}
		a.loading, a.failed = false, err != nil
		if err == nil {
			a.data = &s
			found := false
			for _, c := range s.Currencies {
				found = found || c.Currency == a.cur
			}
			if !found && len(s.Currencies) > 0 {
				a.cur = s.Currencies[0].Currency
			}
		}
		a.buildFilters()
		a.render()
	})
}

func (a *adminPage) render() {
	t := i18n.T
	a.body.Objects = nil
	defer a.body.Refresh()
	switch {
	case a.loading:
		a.body.Add(kit.Muted(t("investmentReports.loading")))
		return
	case a.failed:
		l := widget.NewLabel(t("investmentReports.error"))
		l.Importance = widget.DangerImportance
		a.body.Add(container.NewHBox(l, widget.NewButton(t("investmentReports.retry"), a.load)))
		return
	case a.data == nil:
		return
	}
	var c *adminCurrency
	for i := range a.data.Currencies {
		if a.data.Currencies[i].Currency == a.cur {
			c = &a.data.Currencies[i]
		}
	}
	if c == nil {
		a.body.Add(kit.Muted(t("investmentReports.empty")))
		return
	}
	m := func(d decimal.Decimal) string { return format.Money(d, c.Currency) }
	tt := c.Totals
	a.body.Add(container.NewGridWithColumns(4,
		kit.Tile(t("investmentReports.admin.users"), strconv.Itoa(tt.Users)),
		kit.Tile(t("investmentReports.overview.accounts"), strconv.Itoa(tt.Accounts)),
		kit.Tile(t("investmentReports.transactions"), strconv.Itoa(tt.Transactions)),
		kit.Tile(t("investmentReports.deposits"), m(tt.Deposits)),
		kit.Tile(t("investmentReports.withdrawals"), m(tt.Withdrawals)),
		kit.Tile(t("investmentReports.bonuses"), m(tt.Bonuses)),
		tileColored(t("investmentReports.net"), m(tt.Net), signColor(tt.Net))))

	months := kit.NewTable([]kit.Col[adminMonth]{
		{Title: t("investmentReports.periodic.period"), Text: func(r adminMonth) string { return r.Month }},
		{Title: t("investmentReports.transactions"), Text: func(r adminMonth) string { return strconv.Itoa(r.Transactions) }},
		{Title: t("investmentReports.deposits"), Align: fyne.TextAlignTrailing, MinWidth: 110, Text: func(r adminMonth) string { return m(r.Deposits) }},
		{Title: t("investmentReports.withdrawals"), Align: fyne.TextAlignTrailing, MinWidth: 110, Text: func(r adminMonth) string { return m(r.Withdrawals) }},
		{Title: t("investmentReports.bonuses"), Align: fyne.TextAlignTrailing, MinWidth: 100, Text: func(r adminMonth) string { return m(r.Bonuses) }},
		{Title: t("investmentReports.net"), Align: fyne.TextAlignTrailing, MinWidth: 110, Cell: func(r adminMonth) fyne.CanvasObject {
			return coloredText(m(r.Net), signColor(r.Net), true)
		}},
	})
	months.SetRows(c.Months)
	a.body.Add(kit.Card(t("investmentReports.admin.byMonth"), "", months))

	users := kit.NewTable([]kit.Col[adminUser]{
		{Title: t("investmentReports.admin.user"), Weight: 2, Text: func(r adminUser) string { return r.FullName + " · " + r.Email }},
		{Title: t("investmentReports.transactions"), Text: func(r adminUser) string { return strconv.Itoa(r.Transactions) }},
		{Title: t("investmentReports.deposits"), Align: fyne.TextAlignTrailing, MinWidth: 110, Text: func(r adminUser) string { return m(r.Deposits) }},
		{Title: t("investmentReports.withdrawals"), Align: fyne.TextAlignTrailing, MinWidth: 110, Text: func(r adminUser) string { return m(r.Withdrawals) }},
		{Title: t("investmentReports.net"), Align: fyne.TextAlignTrailing, MinWidth: 110, Cell: func(r adminUser) fyne.CanvasObject {
			return coloredText(m(r.Net), signColor(r.Net), true)
		}},
	})
	users.SetRows(c.TopUsers)
	a.body.Add(kit.Card(t("investmentReports.admin.topUsers"), "", users))
}
