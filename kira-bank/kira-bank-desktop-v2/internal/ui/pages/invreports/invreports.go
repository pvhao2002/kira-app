// Package invreports is the investment reports screen (/app/investment/reports): 22 tabs
// over GET investment/reports/{tab} with per-tab CSV export.
package invreports

import (
	"context"
	"encoding/json"
	"net/url"
	"slices"
	"strconv"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

const prefKey = "kira-investment-reports"

// Pages registers the reports screen. The web route is a user route (not admin-only).
func Pages(env *kit.Env) []kit.Page {
	return []kit.Page{{ID: "/app/investment/reports", Group: "shell.groupInvestment", TitleKey: "investmentReports.title",
		MenuKey: "shell.investmentReports", Icon: theme.DocumentIcon(), Order: 70, Build: func() fyne.CanvasObject { return build(env) }}}
}

type savedPref struct {
	Tab       string `json:"tab"`
	AccountID string `json:"accountId"`
}

type shell struct {
	env      *kit.Env
	tab      string
	gran     string
	currency string
	last     *envelope
	csv      func()
	seq      int

	from, to, cFrom, cTo *widget.DateEntry
	accSel, curSel       *widget.Select
	accIDs               []string // "" = all accounts
	compareRow           *fyne.Container
	warn                 *widget.Label
	apply                *widget.Button
	content              *fyne.Container
	tabBtns              map[string]*widget.Button
}

func build(env *kit.Env) fyne.CanvasObject {
	s := &shell{env: env, gran: "MONTH", accIDs: []string{""}, tabBtns: map[string]*widget.Button{}, content: container.NewStack()}
	var p savedPref
	_ = json.Unmarshal([]byte(env.Pref(prefKey, "")), &p)
	prm := env.Params()
	wantAcc := ""
	if t := prm["tab"]; slices.Contains(tabs, t) {
		s.tab, wantAcc = t, prm["accountId"]
	} else {
		s.tab, wantAcc = "overview", p.AccountID
		if slices.Contains(tabs, p.Tab) {
			s.tab = p.Tab
		}
		if prm["accountId"] != "" {
			wantAcc = prm["accountId"]
		}
	}

	s.from, s.to, s.cFrom, s.cTo = kit.NewDateEntry(), kit.NewDateEntry(), kit.NewDateEntry(), kit.NewDateEntry()
	s.setDefaultRange()
	s.accSel = widget.NewSelect([]string{i18n.T("investmentReports.allAccounts")}, nil)
	s.accSel.SetSelectedIndex(0)
	s.curSel = widget.NewSelect(nil, func(c string) { s.currency = c; s.render() })
	s.curSel.Hide()
	s.warn = widget.NewLabel(i18n.T("investmentReports.rangeTooLong"))
	s.warn.Importance = widget.WarningImportance
	s.warn.Hide()
	s.apply = widget.NewButton(i18n.T("investmentReports.apply"), func() { s.savePref(); s.load() })
	s.apply.Importance = widget.HighImportance
	check := func() { s.validate() }
	for _, d := range []*widget.DateEntry{s.from, s.to, s.cFrom, s.cTo} {
		d.OnChanged = func(*time.Time) { check() }
	}

	s.compareRow = container.NewGridWithColumns(2, labelled(i18n.T("investmentReports.comparison.compareFrom"), s.cFrom),
		labelled(i18n.T("investmentReports.comparison.compareTo"), s.cTo))
	s.compareRow.Hide()
	strip := container.NewHBox()
	for _, t := range tabs {
		b := widget.NewButton(i18n.T("investmentReports.tab."+t), func() { s.selectTab(t, true) })
		b.Importance = widget.LowImportance
		s.tabBtns[t] = b
		strip.Add(b)
	}
	printBtn := widget.NewButtonWithIcon(i18n.T("investmentReports.print"), theme.DownloadIcon(), func() {
		if s.csv != nil {
			s.csv()
		} else {
			env.SaveCSV("", nil, nil)
		}
	})
	filters := container.NewVBox(
		container.NewGridWithColumns(4, labelled(i18n.T("investmentReports.account"), s.accSel), labelled(i18n.T("investmentReports.from"), s.from),
			labelled(i18n.T("investmentReports.to"), s.to), container.NewVBox(widget.NewLabel(""), container.NewHBox(s.apply, s.curSel))),
		s.compareRow, s.warn, kit.Muted(i18n.T("investmentReports.netHint")))
	head := container.NewVBox(
		kit.PageHeader(i18n.T("investmentReports.eyebrow"), i18n.T("investmentReports.title"), i18n.T("investmentReports.description"), printBtn),
		container.NewHScroll(strip), filters, kit.Sep())

	s.markTab()
	s.loadAccounts(wantAcc)
	return container.NewBorder(head, nil, nil, nil, container.NewVScroll(s.content))
}

func (s *shell) setDefaultRange() {
	f, t := defaultRange(s.tab, time.Now())
	s.from.SetDate(&f)
	s.to.SetDate(&t)
}

func (s *shell) validate() {
	st := rangeStatus(s.from.Date, s.to.Date, s.tab == "comparison", s.cFrom.Date, s.cTo.Date)
	if st == "" {
		s.apply.Enable()
	} else {
		s.apply.Disable()
	}
	if st == "long" {
		s.warn.Show()
	} else {
		s.warn.Hide()
	}
}

func (s *shell) markTab() {
	for t, b := range s.tabBtns {
		b.Importance = widget.LowImportance
		if t == s.tab {
			b.Importance = widget.HighImportance
		}
		b.Refresh()
	}
	if s.tab == "comparison" {
		s.compareRow.Show()
	} else {
		s.compareRow.Hide()
	}
}

// selectTab switches tab; reset also restores that tab's default range.
func (s *shell) selectTab(t string, reset bool) {
	s.tab = t
	if reset {
		s.setDefaultRange()
		s.cFrom.SetDate(nil)
		s.cTo.SetDate(nil)
	}
	s.markTab()
	s.savePref()
	s.load()
}

func (s *shell) accountID() string {
	if i := s.accSel.SelectedIndex(); i >= 0 && i < len(s.accIDs) {
		return s.accIDs[i]
	}
	return ""
}

func (s *shell) savePref() {
	b, _ := json.Marshal(savedPref{Tab: s.tab, AccountID: s.accountID()})
	s.env.SetPref(prefKey, string(b))
}

func (s *shell) loadAccounts(want string) {
	kit.Async(func(ctx context.Context) ([]invAccount, error) {
		p, err := api.GetPage[invAccount](ctx, s.env.API, "investment/accounts", nil, 0, 100)
		return p.Data, err
	}, func(list []invAccount, err error) {
		if err == nil {
			opts := []string{i18n.T("investmentReports.allAccounts")}
			s.accIDs = []string{""}
			for _, a := range list {
				opts = append(opts, a.AccountName+" · "+a.Currency)
				s.accIDs = append(s.accIDs, strconv.FormatInt(a.ID, 10))
			}
			s.accSel.Options = opts
			s.accSel.Refresh()
			if i := slices.Index(s.accIDs, want); i > 0 {
				s.accSel.SetSelectedIndex(i)
			} else {
				s.accSel.SetSelectedIndex(0)
			}
		}
		s.load() // the report loads even when the account list failed
	})
}

// drill is the accounts-tab link: pick the account, go to overview, keep the dates.
func (s *shell) drill(id int64) {
	if i := slices.Index(s.accIDs, strconv.FormatInt(id, 10)); i > 0 {
		s.accSel.SetSelectedIndex(i)
	}
	s.selectTab("overview", false)
}

// mutate runs a write (goal save/delete) and reloads the report.
func (s *shell) mutate(f func(ctx context.Context) error) {
	kit.Async(func(ctx context.Context) (struct{}, error) { return struct{}{}, f(ctx) }, func(_ struct{}, err error) {
		if err != nil {
			s.env.ShowError(err)
		}
		s.load()
	})
}

func (s *shell) show(o fyne.CanvasObject) {
	s.content.Objects = []fyne.CanvasObject{o}
	s.content.Refresh()
}

func (s *shell) load() {
	if rangeStatus(s.from.Date, s.to.Date, s.tab == "comparison", s.cFrom.Date, s.cTo.Date) != "" {
		return
	}
	q := url.Values{"fromDate": {s.from.Date.Format(dateFmt)}, "toDate": {s.to.Date.Format(dateFmt)}}
	if a := s.accountID(); a != "" {
		q.Set("accountId", a)
	}
	switch {
	case s.tab == "periodic":
		q.Set("granularity", s.gran)
	case s.tab == "comparison" && s.cFrom.Date != nil && s.cTo.Date != nil:
		q.Set("compareFromDate", s.cFrom.Date.Format(dateFmt))
		q.Set("compareToDate", s.cTo.Date.Format(dateFmt))
	}
	s.seq++
	seq, tab := s.seq, s.tab
	s.csv = nil
	s.show(container.NewVBox(widget.NewLabel(i18n.T("investmentReports.loading")), widget.NewProgressBarInfinite()))
	kit.Async(func(ctx context.Context) (envelope, error) {
		var e envelope
		return e, s.env.API.Get(ctx, "investment/reports/"+tab, q, &e)
	}, func(e envelope, err error) {
		if seq != s.seq {
			return
		}
		if err != nil {
			s.last = nil
			s.show(container.NewVBox(widget.NewLabel(api.Message(err, i18n.T("investmentReports.error"))),
				widget.NewButton(i18n.T("investmentReports.retry"), s.load)))
			return
		}
		s.last = &e
		opts := make([]string, len(e.Currencies))
		for i, c := range e.Currencies {
			opts[i] = c.Currency
		}
		if !slices.Contains(opts, s.currency) && len(opts) > 0 {
			s.currency = opts[0]
		}
		s.curSel.Options = opts
		s.curSel.Selected = s.currency
		s.curSel.Refresh()
		if len(opts) > 1 {
			s.curSel.Show()
		} else {
			s.curSel.Hide()
		}
		s.render()
	})
}

func (s *shell) render() {
	e := s.last
	if e == nil {
		return
	}
	s.csv = nil
	cur, raw := s.currency, json.RawMessage(nil)
	for _, c := range e.Currencies {
		if c.Currency == cur {
			raw = c.Data
		}
	}
	empty := len(raw) == 0 || string(raw) == "null"
	if s.tab == "goals" && empty {
		if cur == "" {
			cur = "VND"
		}
		raw, _ = json.Marshal(goalsReport{AsOf: e.ToDate, Goals: []goal{}})
		empty = false
	}
	if empty {
		s.show(widget.NewLabel(i18n.T("investmentReports.empty")))
		return
	}
	c := &rc{sh: s, cur: cur, from: e.FromDate, to: e.ToDate}
	obj, err := renderers[s.tab](c, raw)
	if err != nil {
		s.show(widget.NewLabel(i18n.T("investmentReports.error")))
		return
	}
	s.show(container.NewPadded(obj))
}
