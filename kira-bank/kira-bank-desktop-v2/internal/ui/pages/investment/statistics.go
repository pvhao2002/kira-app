package investment

import (
	"context"
	"fmt"
	"image/color"
	"net/url"
	"strconv"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type statCurrency struct {
	Currency    string          `json:"currency"`
	TotalCount  int             `json:"totalCount"`
	Deposits    decimal.Decimal `json:"deposits"`
	Withdrawals decimal.Decimal `json:"withdrawals"`
	Bonuses     decimal.Decimal `json:"bonuses"`
	NetAmount   decimal.Decimal `json:"netAmount"`
	Daily       []dailyFlow     `json:"daily"`
}

type statAccount struct {
	AccountID   int64           `json:"accountId"`
	AccountName string          `json:"accountName"`
	AccountCode *string         `json:"accountCode"`
	Currency    string          `json:"currency"`
	Status      string          `json:"status"`
	TotalCount  int             `json:"totalCount"`
	Deposits    decimal.Decimal `json:"deposits"`
	Withdrawals decimal.Decimal `json:"withdrawals"`
	Bonuses     decimal.Decimal `json:"bonuses"`
}

type statsResponse struct {
	TimeZone   string         `json:"timeZone"`
	FromDate   string         `json:"fromDate"`
	ToDate     string         `json:"toDate"`
	Currencies []statCurrency `json:"currencies"`
	Accounts   []statAccount  `json:"accounts"`
}

type statsOps struct {
	AI struct {
		Pending, Processing, Ready, Failed int
	} `json:"ai"`
	Imports struct {
		Total int `json:"total"`
		Items []struct {
			BatchID     string `json:"batchId"`
			AccountID   int64  `json:"accountId"`
			AccountName string `json:"accountName"`
			Status      string `json:"status"`
			CreatedAt   string `json:"createdAt"`
		} `json:"items"`
	} `json:"imports"`
	Reconciliation struct {
		Total int `json:"total"`
		Items []struct {
			ID          int64           `json:"id"`
			AccountName string          `json:"accountName"`
			Amount      decimal.Decimal `json:"amount"`
			Currency    string          `json:"currency"`
			Status      string          `json:"status"`
		} `json:"items"`
	} `json:"reconciliation"`
}

type reconReport struct {
	AccountName string `json:"accountName"`
	Reason      string `json:"reason"`
	Detail      string `json:"detail"`
	Status      string `json:"status"`
	History     []struct {
		FromStatus string  `json:"fromStatus"`
		ToStatus   string  `json:"toStatus"`
		Note       *string `json:"note"`
		CreatedAt  string  `json:"createdAt"`
	} `json:"history"`
}

// block is an independently loading section.
type block[T any] struct {
	data    *T
	loading bool
	failed  bool
}

type statsPage struct {
	env  *kit.Env
	root *fyne.Container
	seq  int

	// filter state
	accountID  int64
	selAcc     *account // selected account (may not be on the current selector page)
	accPage    int
	accPages   int
	accSearch  string
	accList    []account
	from, to   string
	cur        string
	mode       string
	filterBox  *fyne.Container
	applyBtn   *widget.Button
	fromE, toE *widget.DateEntry

	rng, month block[statsResponse]
	ops        block[statsOps]
	body       *fyne.Container
}

func newStatistics(env *kit.Env) fyne.CanvasObject {
	today := format.Today()
	s := &statsPage{env: env, mode: modeWD, body: container.NewVBox(), filterBox: container.NewVBox(),
		to: today, from: shiftDate(today, -29)}
	pr := env.Params()
	s.accountID = parseID(pr["accountId"])
	if pr["fromDate"] != "" {
		s.from = pr["fromDate"]
	}
	if pr["toDate"] != "" {
		s.to = pr["toDate"]
	}
	s.root = container.NewVBox(s.header(), s.filterBox, s.body)
	s.buildFilters()
	s.loadAccounts()
	s.reload()
	return s.root
}

func (s *statsPage) header() fyne.CanvasObject {
	t := i18n.T
	reports := widget.NewButton(t("shell.investmentReports"), func() {
		p := map[string]string{"fromDate": s.from, "toDate": s.to}
		if s.accountID != 0 {
			p["accountId"] = strconv.FormatInt(s.accountID, 10)
		}
		s.env.Navigate("/app/investment/reports", p)
	})
	refresh := widget.NewButton(t("investmentStatistics.refresh"), s.reload)
	return kit.PageHeader(t("investmentStatistics.eyebrow"), t("investmentStatistics.title"), t("investmentStatistics.description"), reports, refresh)
}

// ---- filters ----

func (s *statsPage) loadAccounts() {
	page, q := s.accPage, s.accSearch
	kit.Async(func(ctx context.Context) (api.Page[account], error) {
		return api.GetPage[account](ctx, s.env.API, "investment/accounts", url.Values{"search": {q}}, page, 20)
	}, func(res api.Page[account], err error) {
		if err != nil || page != s.accPage || q != s.accSearch {
			return
		}
		s.accList, s.accPages = res.Data, res.Meta.TotalPages
		if s.selAcc == nil && s.accountID != 0 {
			for _, a := range res.Data {
				if a.ID == s.accountID {
					a := a
					s.selAcc = &a
				}
			}
		}
		s.buildFilters()
	})
}

func (s *statsPage) validRange() bool { return rangeValid(s.from, s.to, 365) }

func (s *statsPage) buildFilters() {
	t := i18n.T
	list := s.accList
	if s.selAcc != nil {
		found := false
		for _, a := range list {
			found = found || a.ID == s.selAcc.ID
		}
		if !found {
			list = append([]account{*s.selAcc}, list...)
		}
	}
	pk := newPicker(list, t("investmentStatistics.allAccounts"), account.label, s.accountID, func(id int64) {
		s.accountID, s.selAcc = id, nil
		for _, a := range s.accList {
			if a.ID == id {
				a := a
				s.selAcc = &a
			}
		}
	})
	search := widget.NewEntry()
	search.SetPlaceHolder(t("investmentStatistics.searchAccount"))
	search.SetText(s.accSearch)
	var timer *time.Timer
	search.OnChanged = func(v string) {
		if timer != nil {
			timer.Stop()
		}
		timer = time.AfterFunc(300*time.Millisecond, func() {
			fyne.Do(func() { s.accSearch, s.accPage = v, 0; s.loadAccounts() })
		})
	}
	prev := widget.NewButton("‹", func() { s.accPage--; s.loadAccounts() })
	next := widget.NewButton("›", func() { s.accPage++; s.loadAccounts() })
	if s.accPage <= 0 {
		prev.Disable()
	}
	if s.accPage+1 >= s.accPages {
		next.Disable()
	}
	accRow := container.NewBorder(nil, nil, widget.NewLabel(t("investmentStatistics.account")),
		container.NewHBox(prev, widget.NewLabel(fmt.Sprintf("%d / %d", s.accPage+1, max(1, s.accPages))), next),
		container.NewGridWithColumns(2, search, pk))

	s.fromE, s.toE = newDate(s.from), newDate(s.to)
	s.applyBtn = widget.NewButton(t("investmentStatistics.apply"), s.apply)
	sync := func() {
		s.from, s.to = dateText(s.fromE), dateText(s.toE)
		if s.validRange() {
			s.applyBtn.Enable()
		} else {
			s.applyBtn.Disable()
		}
	}
	s.fromE.OnChanged = func(*time.Time) { sync() }
	s.toE.OnChanged = func(*time.Time) { sync() }
	sync()
	quick := container.NewHBox()
	for _, n := range []int{7, 30, 90} {
		n := n
		quick.Add(widget.NewButton(strconv.Itoa(n)+"d", func() {
			to := format.Today()
			s.to, s.from = to, shiftDate(to, -(n-1))
			s.apply()
		}))
	}
	dates := container.NewHBox(labeled(t("investmentStatistics.from"), s.fromE), labeled(t("investmentStatistics.to"), s.toE), quick, s.applyBtn)
	s.filterBox.Objects = []fyne.CanvasObject{kit.Card("", "", container.NewVBox(accRow, dates))}
	s.filterBox.Refresh()
}

func (s *statsPage) apply() {
	if !s.validRange() {
		return
	}
	s.buildFilters()
	s.reload()
}

// ---- loading ----

func (s *statsPage) reload() {
	s.seq++
	seq := s.seq
	id := s.accountID
	q := func(from, to string) url.Values {
		v := url.Values{"fromDate": {from}, "toDate": {to}}
		if id != 0 {
			v.Set("accountId", strconv.FormatInt(id, 10))
		}
		return v
	}
	load := func(b *block[statsResponse], from, to string) {
		b.loading, b.failed = true, false
		kit.Async(func(ctx context.Context) (statsResponse, error) {
			var r statsResponse
			return r, s.env.API.Get(ctx, "investment/statistics", q(from, to), &r)
		}, func(r statsResponse, err error) {
			if seq != s.seq {
				return
			}
			b.loading, b.failed = false, err != nil
			if err == nil {
				b.data = &r
			}
			s.render()
		})
	}
	load(&s.rng, s.from, s.to)
	today := format.Today()
	load(&s.month, today[:8]+"01", today)
	s.ops.loading, s.ops.failed = true, false
	kit.Async(func(ctx context.Context) (statsOps, error) {
		var o statsOps
		v := url.Values{}
		if id != 0 {
			v.Set("accountId", strconv.FormatInt(id, 10))
		}
		return o, s.env.API.Get(ctx, "investment/statistics/operations", v, &o)
	}, func(o statsOps, err error) {
		if seq != s.seq {
			return
		}
		s.ops.loading, s.ops.failed = false, err != nil
		if err == nil {
			s.ops.data = &o
		}
		s.render()
	})
	s.render()
}

func blockStatus[T any](b *block[T], retry func()) fyne.CanvasObject {
	switch {
	case b.loading:
		return kit.Muted(i18n.T("investmentStatistics.loading"))
	case b.failed:
		l := widget.NewLabel(i18n.T("investmentStatistics.error"))
		l.Importance = widget.DangerImportance
		return container.NewHBox(l, widget.NewButton(i18n.T("investmentStatistics.retry"), retry))
	}
	return nil
}

func pickCurrency(list []statCurrency, want string) *statCurrency {
	for i := range list {
		if list[i].Currency == want {
			return &list[i]
		}
	}
	if len(list) > 0 {
		return &list[0]
	}
	return nil
}

func (s *statsPage) render() {
	s.body.Objects = []fyne.CanvasObject{s.monthSection(), s.cashSection(), s.opsSection()}
	s.body.Refresh()
}

func dateRange(from, to string) string {
	return format.DateOnly(from, format.DateDMY) + " – " + format.DateOnly(to, format.DateDMY)
}

func (s *statsPage) monthSection() fyne.CanvasObject {
	t := i18n.T
	box := container.NewVBox()
	sub := ""
	if st := blockStatus(&s.month, s.reload); st != nil {
		box.Add(st)
	}
	if d := s.month.data; d != nil {
		sub = dateRange(d.FromDate, d.ToDate)
		if c := pickCurrency(d.Currencies, s.cur); c != nil {
			profit := c.Withdrawals.Sub(c.Deposits)
			box.Add(container.NewGridWithColumns(4,
				kit.Tile(t("investmentStatistics.deposits"), format.Money(c.Deposits, c.Currency)),
				kit.Tile(t("investmentStatistics.withdrawals"), format.Money(c.Withdrawals, c.Currency)),
				tileColored(t("investmentStatistics.profit"), format.Money(profit, c.Currency), signColor(profit)),
				kit.Tile(t("investmentStatistics.transactions"), strconv.Itoa(c.TotalCount))))
			if c.TotalCount == 0 {
				box.Add(kit.Muted(t("investmentStatistics.noFlow")))
			} else {
				box.Add(kit.Heading(t("investmentStatistics.monthDepositWithdrawal")))
				box.Add(dailyChart(c, 2))
				box.Add(kit.Heading(t("investmentStatistics.monthProfit")))
				box.Add(netBars(c, modeWD, 5))
			}
		} else {
			box.Add(kit.Muted(t("investmentStatistics.noFlow")))
		}
	}
	return kit.Card(t("investmentStatistics.currentMonth"), sub, box)
}

func tileColored(caption, value string, c color.Color) fyne.CanvasObject {
	return container.NewVBox(kit.Muted(caption), coloredText(value, c, true))
}

// dailyChart draws deposits/withdrawals (and bonuses when series == 3) per day.
func dailyChart(c *statCurrency, series int) fyne.CanvasObject {
	var labels []string
	var dep, wd, bon []decimal.Decimal
	for _, d := range c.Daily {
		labels = append(labels, format.DateOnly(d.Date, format.DateShort))
		dep, wd, bon = append(dep, d.Deposits), append(wd, d.Withdrawals), append(bon, d.Bonuses)
	}
	ds := []kit.Series{
		{Name: i18n.T("investmentStatistics.deposits"), Color: kit.ColorBlue, Values: floats(dep)},
		{Name: i18n.T("investmentStatistics.withdrawals"), Color: kit.ColorAmber, Values: floats(wd)},
	}
	if series == 3 {
		ds = append(ds, kit.Series{Name: i18n.T("investmentStatistics.bonuses"), Color: kit.ColorPurple, Values: floats(bon)})
	}
	ch := kit.NewBarChart(labels, ds...)
	ch.LabelEvery = labelStep(len(labels))
	if series == 2 {
		ch.LabelEvery = 5
	}
	ch.Tooltip = func(i int) string {
		x := c.Daily[i]
		tip := labels[i] + " · " + format.Money(x.Deposits, c.Currency) + " / " + format.Money(x.Withdrawals, c.Currency)
		if series == 3 {
			tip += " / " + format.Money(x.Bonuses, c.Currency)
		}
		return tip
	}
	return container.NewVBox(ch, kit.Legend(ds...))
}

// netBars draws the signed per-day net flow.
func netBars(c *statCurrency, mode string, every int) fyne.CanvasObject {
	labels, vals := netSeries(c, mode)
	s := kit.Series{Name: i18n.T("investmentStatistics.net"), Color: kit.ColorBlue, Values: floats(vals)}
	ch := kit.NewBarChart(labels, s)
	ch.LabelEvery = every
	ch.Tooltip = func(i int) string { return labels[i] + " · " + format.Money(vals[i], c.Currency) }
	return ch
}

func netSeries(c *statCurrency, mode string) ([]string, []decimal.Decimal) {
	var labels []string
	var vals []decimal.Decimal
	for _, d := range c.Daily {
		labels = append(labels, format.DateOnly(d.Date, format.DateShort))
		vals = append(vals, netFlow(mode, d.Deposits, d.Withdrawals, d.Bonuses))
	}
	return labels, vals
}

func (s *statsPage) cashSection() fyne.CanvasObject {
	t := i18n.T
	box := container.NewVBox()
	sub := ""
	if st := blockStatus(&s.rng, s.reload); st != nil {
		box.Add(st)
	}
	d := s.rng.data
	if d == nil {
		return kit.Card(t("investmentStatistics.cashFlow"), sub, box)
	}
	sub = dateRange(d.FromDate, d.ToDate) + " · " + d.TimeZone
	c := pickCurrency(d.Currencies, s.cur)
	if c != nil {
		s.cur = c.Currency
	}
	controls := container.NewHBox()
	if len(d.Currencies) > 1 {
		var codes []string
		for _, x := range d.Currencies {
			codes = append(codes, x.Currency)
		}
		sel := widget.NewSelect(codes, func(v string) { s.cur = v; s.render() })
		sel.SetSelected(s.cur)
		controls.Add(labeled(t("investmentStatistics.currency"), sel))
	}
	modes := []string{modeWD, modeWDBD}
	ms := widget.NewSelect([]string{t("investmentStatistics.netFlowModeWithdrawalMinusDeposit"), t("investmentStatistics.netFlowModeWithdrawalPlusBonusMinusDeposit")}, nil)
	ms.SetSelectedIndex(map[string]int{modeWD: 0, modeWDBD: 1}[s.mode])
	ms.OnChanged = func(string) { s.mode = modes[ms.SelectedIndex()]; s.render() }
	controls.Add(labeled(t("investmentStatistics.netFlowMode"), ms))
	box.Add(controls)

	if c != nil {
		net := netFlow(s.mode, c.Deposits, c.Withdrawals, c.Bonuses)
		box.Add(container.NewGridWithColumns(5,
			kit.Tile(t("investmentStatistics.deposits"), format.Money(c.Deposits, c.Currency)),
			kit.Tile(t("investmentStatistics.withdrawals"), format.Money(c.Withdrawals, c.Currency)),
			kit.Tile(t("investmentStatistics.bonuses"), format.Money(c.Bonuses, c.Currency)),
			tileColored(t("investmentStatistics.net"), format.Money(net, c.Currency), signColor(net)),
			kit.Tile(t("investmentStatistics.transactions"), strconv.Itoa(c.TotalCount))))
		box.Add(kit.Muted(t("investmentStatistics.completedHint")))
		if c.TotalCount == 0 {
			box.Add(kit.Muted(t("investmentStatistics.noFlow")))
		} else {
			step := labelStep(len(c.Daily))
			box.Add(kit.Heading(t("investmentStatistics.daily")))
			box.Add(dailyChart(c, 3))
			box.Add(kit.Heading(t("investmentStatistics.netDaily")))
			labels, vals := netSeries(c, s.mode)
			line := kit.NewLineChart(labels, kit.Series{Name: t("investmentStatistics.net"), Color: kit.ColorPurple, Values: floats(vals)})
			line.LabelEvery = step
			line.Tooltip = func(i int) string { return labels[i] + " · " + format.Money(vals[i], c.Currency) }
			box.Add(line)
			box.Add(kit.Heading(t("investmentStatistics.netMonthly")))
			months := groupMonthly(c.Daily, s.mode)
			var ml []string
			var mv []decimal.Decimal
			for _, m := range months {
				ml, mv = append(ml, monthLabel(m.Month)), append(mv, m.Net)
			}
			mc := kit.NewBarChart(ml, kit.Series{Name: t("investmentStatistics.net"), Color: kit.ColorBlue, Values: floats(mv)})
			mc.Tooltip = func(i int) string { return ml[i] + " · " + format.Money(mv[i], c.Currency) }
			box.Add(mc)
		}
	}
	box.Add(kit.Heading(t("investmentStatistics.byAccount")))
	box.Add(s.accountsTable(d.Accounts))
	return kit.Card(t("investmentStatistics.cashFlow"), sub, box)
}

func (s *statsPage) accountsTable(rows []statAccount) fyne.CanvasObject {
	t := i18n.T
	if len(rows) == 0 {
		return kit.Muted(t("investmentStatistics.noAccounts"))
	}
	net := func(a statAccount) decimal.Decimal { return netFlow(s.mode, a.Deposits, a.Withdrawals, a.Bonuses) }
	m := func(f func(statAccount) decimal.Decimal) func(statAccount) string {
		return func(a statAccount) string { return format.Money(f(a), a.Currency) }
	}
	tbl := kit.NewTable([]kit.Col[statAccount]{
		{Title: t("investmentStatistics.account"), Weight: 2, MinWidth: 160, Cell: func(a statAccount) fyne.CanvasObject {
			b := widget.NewButton(a.AccountName, func() {
				s.accountID, s.selAcc = a.AccountID, &account{ID: a.AccountID, AccountName: a.AccountName, Currency: a.Currency, Status: a.Status}
				s.apply()
			})
			b.Importance, b.Alignment = widget.LowImportance, widget.ButtonAlignLeading
			return container.NewVBox(b, kit.Muted(dashIfEmpty(a.AccountCode)+" · "+a.Currency))
		}},
		{Title: t("investmentStatistics.statusLabel"), Text: func(a statAccount) string {
			k := "investmentStatistics.status." + strings.ToLower(a.Status)
			if i18n.Has(k) {
				return t(k)
			}
			return a.Status
		}},
		{Title: t("investmentStatistics.transactions"), Text: func(a statAccount) string { return strconv.Itoa(a.TotalCount) }},
		{Title: t("investmentStatistics.deposits"), Align: fyne.TextAlignTrailing, MinWidth: 110, Text: m(func(a statAccount) decimal.Decimal { return a.Deposits })},
		{Title: t("investmentStatistics.withdrawals"), Align: fyne.TextAlignTrailing, MinWidth: 110, Text: m(func(a statAccount) decimal.Decimal { return a.Withdrawals })},
		{Title: t("investmentStatistics.bonuses"), Align: fyne.TextAlignTrailing, MinWidth: 100, Text: m(func(a statAccount) decimal.Decimal { return a.Bonuses })},
		{Title: t("investmentStatistics.net"), Align: fyne.TextAlignTrailing, MinWidth: 110, Cell: func(a statAccount) fyne.CanvasObject {
			n := net(a)
			return coloredText(format.Money(n, a.Currency), signColor(n), true)
		}},
	})
	tbl.SetRows(rows)
	return tbl
}

func (s *statsPage) opsSection() fyne.CanvasObject {
	t := i18n.T
	box := container.NewVBox()
	if st := blockStatus(&s.ops, s.reload); st != nil {
		box.Add(st)
	}
	if o := s.ops.data; o != nil {
		box.Add(container.NewGridWithColumns(4,
			kit.Tile(t("investmentStatistics.aiPending"), strconv.Itoa(o.AI.Pending)),
			kit.Tile(t("investmentStatistics.aiProcessing"), strconv.Itoa(o.AI.Processing)),
			kit.Tile(t("investmentStatistics.aiReady"), strconv.Itoa(o.AI.Ready)),
			kit.Tile(t("investmentStatistics.aiFailed"), strconv.Itoa(o.AI.Failed))))
		imports := container.NewVBox(kit.Heading(t("investmentStatistics.importReview") + " · " + strconv.Itoa(o.Imports.Total)))
		for _, it := range o.Imports.Items {
			it := it
			b := widget.NewButton(it.AccountName, func() {
				s.env.Navigate("/app/investment/transactions", map[string]string{
					"accountId": strconv.FormatInt(it.AccountID, 10), "batchId": it.BatchID})
			})
			b.Alignment, b.Importance = widget.ButtonAlignLeading, widget.LowImportance
			imports.Add(b)
			imports.Add(kit.Muted(importStatusLabel(it.Status) + " · " + format.Timestamp(it.CreatedAt, format.DateTimeShort)))
		}
		if len(o.Imports.Items) == 0 {
			imports.Add(kit.Muted(t("investmentStatistics.noPending")))
		}
		recon := container.NewVBox(kit.Heading(t("investmentStatistics.reconciliation") + " · " + strconv.Itoa(o.Reconciliation.Total)))
		for _, it := range o.Reconciliation.Items {
			it := it
			b := widget.NewButton(it.AccountName, func() { s.openRecon(it.ID) })
			b.Alignment, b.Importance = widget.ButtonAlignLeading, widget.LowImportance
			recon.Add(b)
			recon.Add(kit.Muted(reconStatus(it.Status) + " · " + format.Money(it.Amount, it.Currency)))
		}
		if len(o.Reconciliation.Items) == 0 {
			recon.Add(kit.Muted(t("investmentStatistics.noPending")))
		}
		box.Add(container.NewGridWithColumns(2, imports, recon))
	}
	link := widget.NewButton(t("investmentStatistics.openQueue"), func() { s.env.Navigate("/app/investment/ai-queue", nil) })
	box.Add(container.NewHBox(link, kit.Muted(t("investmentStatistics.currentHint"))))
	return kit.Card(t("investmentStatistics.operations"), t("investmentStatistics.current"), box)
}

func reconStatus(s string) string {
	if k := "investmentStatistics.status." + camel(s); i18n.Has(k) {
		return i18n.T(k)
	}
	return s
}

func (s *statsPage) openRecon(id int64) {
	kit.Async(func(ctx context.Context) (reconReport, error) {
		var r reconReport
		return r, s.env.API.Get(ctx, "investment/reconciliation-reports/"+strconv.FormatInt(id, 10), nil, &r)
	}, func(r reconReport, err error) {
		if err != nil {
			s.env.ShowError(err)
			return
		}
		t := i18n.T
		box := container.NewVBox(
			labeledText(t("investmentStatistics.reason"), r.Reason),
			labeledText(t("investmentStatistics.detail"), r.Detail),
			labeledText(t("investmentStatistics.statusLabel"), reconStatus(r.Status)),
			kit.Heading(t("investmentStatistics.history")))
		if len(r.History) == 0 {
			box.Add(kit.Muted(t("investmentStatistics.noHistory")))
		}
		for _, h := range r.History {
			box.Add(widget.NewLabel(reconStatus(h.FromStatus) + " → " + reconStatus(h.ToStatus)))
			box.Add(kit.Muted(format.Timestamp(h.CreatedAt, format.DateTimeShort) + " · " + dashIfEmpty(h.Note)))
		}
		sc := container.NewVScroll(box)
		sc.SetMinSize(fyne.NewSize(420, 320))
		dialog.NewCustom(t("investmentStatistics.reconciliation")+" — "+r.AccountName, t("common.close"), sc, s.env.Window).Show()
	})
}

func labeledText(label, text string) fyne.CanvasObject {
	l := widget.NewLabel(text)
	l.Wrapping = fyne.TextWrapWord
	return container.NewBorder(nil, nil, kit.Muted(label), nil, l)
}
