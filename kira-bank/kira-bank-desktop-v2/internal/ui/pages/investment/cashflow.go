package investment

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type totals struct {
	Deposits    decimal.Decimal `json:"deposits"`
	Withdrawals decimal.Decimal `json:"withdrawals"`
	Net         decimal.Decimal `json:"net"`
}

type periodRow struct {
	Period string `json:"period"`
	Totals totals `json:"totals"`
}

type periodicData struct {
	Totals totals      `json:"totals"`
	Rows   []periodRow `json:"rows"`
}

type periodicReport struct {
	Currencies []struct {
		Currency string        `json:"currency"`
		Data     *periodicData `json:"data"`
	} `json:"currencies"`
}

type cashflowPage struct {
	env     *kit.Env
	root    *fyne.Container
	body    *fyne.Container
	filters *fyne.Container
	seq     int

	accounts  []account
	accountID int64
	gran      string
	from, to  string
	cur       string
	data      *periodicReport
	loading   bool
	failed    bool
	apply     *widget.Button
}

var granularities = []string{"DAY", "MONTH", "YEAR"}

func newCashflow(env *kit.Env) fyne.CanvasObject {
	c := &cashflowPage{env: env, gran: "MONTH", body: container.NewVBox(), filters: container.NewVBox()}
	c.to, c.from = format.Today(), periodFrom(c.gran, time.Now())
	c.root = container.NewVBox(
		kit.PageHeader(i18n.T("investmentReports.eyebrow"), i18n.T("investmentCashflow.title"), i18n.T("investmentCashflow.description")),
		c.filters, c.body)
	c.buildFilters()
	kit.Async(func(ctx context.Context) ([]account, error) { return loadAccounts(ctx, env) }, func(accs []account, err error) {
		if err == nil {
			c.accounts = accs
			c.buildFilters()
		}
	})
	c.load()
	return c.root
}

func (c *cashflowPage) valid() bool { return !c.loading && rangeValid(c.from, c.to, 1830) }

func (c *cashflowPage) buildFilters() {
	t := i18n.T
	pk := newPicker(c.accounts, t("investmentReports.allAccounts"), account.label, c.accountID, func(id int64) { c.accountID = id })
	gs := widget.NewSelect(nil, nil)
	for _, g := range granularities {
		gs.Options = append(gs.Options, t("investmentReports.periodic."+strings.ToLower(g)))
	}
	gs.SetSelectedIndex(map[string]int{"DAY": 0, "MONTH": 1, "YEAR": 2}[c.gran])
	gs.OnChanged = func(string) {
		c.gran = granularities[gs.SelectedIndex()]
		c.to, c.from = format.Today(), periodFrom(c.gran, time.Now())
		c.buildFilters()
		c.load()
	}
	fromE, toE := newDate(c.from), newDate(c.to)
	c.apply = widget.NewButton(t("investmentReports.apply"), c.load)
	sync := func() {
		c.from, c.to = dateText(fromE), dateText(toE)
		if c.valid() {
			c.apply.Enable()
		} else {
			c.apply.Disable()
		}
	}
	fromE.OnChanged = func(*time.Time) { sync() }
	toE.OnChanged = func(*time.Time) { sync() }
	sync()
	row := container.NewVBox(
		container.NewGridWithColumns(2, labeled(t("investmentReports.account"), pk), labeled(t("investmentReports.periodic.granularity"), gs)),
		container.NewHBox(labeled(t("investmentReports.from"), fromE), labeled(t("investmentReports.to"), toE)))
	if c.data != nil && len(c.data.Currencies) > 1 {
		var codes []string
		for _, x := range c.data.Currencies {
			codes = append(codes, x.Currency)
		}
		sel := widget.NewSelect(codes, func(v string) { c.cur = v; c.render() })
		sel.SetSelected(c.cur)
		row.Add(labeled(t("investmentReports.currency"), sel))
	}
	row.Add(c.apply)
	if !rangeValid(c.from, c.to, 0) {
		row.Add(kit.Muted(t("investmentTransactions.invalidDateRange")))
	} else if !rangeValid(c.from, c.to, 1830) {
		row.Add(kit.Muted(t("investmentReports.rangeTooLong")))
	}
	c.filters.Objects = []fyne.CanvasObject{row}
	c.filters.Refresh()
}

func (c *cashflowPage) load() {
	if !rangeValid(c.from, c.to, 1830) {
		return
	}
	c.seq++
	seq := c.seq
	v := url.Values{"fromDate": {c.from}, "toDate": {c.to}, "granularity": {c.gran}}
	if c.accountID != 0 {
		v.Set("accountId", strconv.FormatInt(c.accountID, 10))
	}
	c.loading, c.failed = true, false
	c.render()
	kit.Async(func(ctx context.Context) (periodicReport, error) {
		var r periodicReport
		return r, c.env.API.Get(ctx, "investment/reports/periodic", v, &r)
	}, func(r periodicReport, err error) {
		if seq != c.seq {
			return
		}
		c.loading, c.failed = false, err != nil
		if err == nil {
			c.data = &r
			found := false
			for _, x := range r.Currencies {
				found = found || x.Currency == c.cur
			}
			if !found && len(r.Currencies) > 0 {
				c.cur = r.Currencies[0].Currency
			}
		}
		c.buildFilters()
		c.render()
	})
}

func (c *cashflowPage) render() {
	t := i18n.T
	c.body.Objects = nil
	defer c.body.Refresh()
	switch {
	case c.loading:
		c.body.Add(kit.Muted(t("investmentReports.loading")))
		return
	case c.failed:
		l := widget.NewLabel(t("investmentReports.error"))
		l.Importance = widget.DangerImportance
		c.body.Add(container.NewHBox(l, widget.NewButton(t("investmentReports.retry"), c.load)))
		return
	case c.data == nil:
		return
	}
	var data *periodicData
	cur := c.cur
	for _, x := range c.data.Currencies {
		if x.Currency == c.cur {
			data = x.Data
		}
	}
	if data == nil {
		c.body.Add(kit.Muted(t("investmentReports.empty")))
		return
	}
	m := func(d decimal.Decimal) string { return format.Money(d, orDefault(cur)) }
	c.body.Add(container.NewGridWithColumns(3,
		kit.Tile(t("investmentCashflow.totalDeposits"), m(data.Totals.Deposits)),
		kit.Tile(t("investmentCashflow.totalWithdrawals"), m(data.Totals.Withdrawals)),
		tileColored(t("investmentCashflow.diff"), m(data.Totals.Net), signColor(data.Totals.Net))))

	var labels []string
	var dep, wd, net []decimal.Decimal
	for _, r := range data.Rows {
		labels = append(labels, r.Period)
		dep, wd, net = append(dep, r.Totals.Deposits), append(wd, r.Totals.Withdrawals), append(net, r.Totals.Net)
	}
	every := max(1, (len(labels)+11)/12) // at most ~12 x labels
	ds := []kit.Series{
		{Name: t("investmentReports.deposits"), Color: kit.ColorBlue, Values: floats(dep)},
		{Name: t("investmentReports.withdrawals"), Color: kit.ColorAmber, Values: floats(wd)},
	}
	bar := kit.NewBarChart(labels, ds...)
	bar.LabelEvery = every
	bar.Tooltip = func(i int) string {
		return labels[i] + " · " + ds[0].Name + ": " + m(dep[i]) + " · " + ds[1].Name + ": " + m(wd[i])
	}
	c.body.Add(kit.Card(t("investmentCashflow.barChart"), "", container.NewVBox(bar, kit.Legend(ds...))))

	ls := kit.Series{Name: t("investmentCashflow.diff"), Color: kit.ColorPurple, Values: floats(net)}
	line := kit.NewLineChart(labels, ls)
	line.LabelEvery = every
	line.Tooltip = func(i int) string { return labels[i] + " · " + ls.Name + ": " + m(net[i]) }
	c.body.Add(kit.Card(t("investmentCashflow.lineChart"), "", container.NewVBox(line, kit.Legend(ls))))
}

func orDefault(cur string) string {
	if cur == "" {
		return "VND"
	}
	return cur
}
