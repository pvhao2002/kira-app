// Package overview is the dashboard at /app.
package overview

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

// Pages registers the overview page.
func Pages(env *kit.Env) []kit.Page {
	return []kit.Page{{
		ID: "/app", TitleKey: "route.overview", MenuKey: "shell.overview", Icon: theme.HomeIcon(),
		Build: func() fyne.CanvasObject { return newOverview(env).root },
	}}
}

// ---- API shapes ----

type dueItem struct {
	ID              int64            `json:"id"`
	CardID          int64            `json:"cardId"`
	BankName        string           `json:"bankName"`
	Nickname        string           `json:"nickname"`
	LastFour        *string          `json:"lastFour"`
	DueDate         *string          `json:"dueDate"`
	RemainingAmount *decimal.Decimal `json:"remainingAmount"`
	Currency        string           `json:"currency"`
}
type dueGroup struct {
	Total int       `json:"total"`
	Items []dueItem `json:"items"`
}
type creditData struct {
	Summary struct {
		TotalCreditLimit decimal.Decimal `json:"totalCreditLimit"`
		CurrentBalance   decimal.Decimal `json:"currentBalance"`
		AvailableCredit  decimal.Decimal `json:"availableCredit"`
		UtilizationRate  decimal.Decimal `json:"utilizationRate"`
		Currency         string          `json:"currency"`
		CardCount        int             `json:"cardCount"`
	} `json:"summary"`
	Overdue    dueGroup `json:"overdue"`
	DueToday   dueGroup `json:"dueToday"`
	DueSoon    dueGroup `json:"dueSoon"`
	NeedsInput dueGroup `json:"needsInput"`
}

type batchItem struct {
	BatchID     string `json:"batchId"`
	AccountID   int64  `json:"accountId"`
	AccountName string `json:"accountName"`
}
type batchGroup struct {
	Total int         `json:"total"`
	Items []batchItem `json:"items"`
}
type dailyFlow struct {
	Date        string          `json:"date"`
	Deposits    decimal.Decimal `json:"deposits"`
	Withdrawals decimal.Decimal `json:"withdrawals"`
}
type currencyFlow struct {
	Currency    string          `json:"currency"`
	Deposits    decimal.Decimal `json:"deposits"`
	Withdrawals decimal.Decimal `json:"withdrawals"`
	Bonuses     decimal.Decimal `json:"bonuses"`
	NetDeposits decimal.Decimal `json:"netDeposits"`
	Daily       []dailyFlow     `json:"daily"`
}
type investData struct {
	Days           int            `json:"days"`
	FromDate       string         `json:"fromDate"`
	ToDate         string         `json:"toDate"`
	ActiveAccounts int            `json:"activeAccounts"`
	Currencies     []currencyFlow `json:"currencies"`
	Review         batchGroup     `json:"review"`
	Failed         batchGroup     `json:"failed"`
}

type lesson struct {
	Date        string          `json:"date"`
	StartTime   string          `json:"startTime"`
	EndTime     string          `json:"endTime"`
	StudentName string          `json:"studentName"`
	Subject     string          `json:"subject"`
	Fee         decimal.Decimal `json:"fee"`
}
type conflict struct {
	Date        string `json:"date"`
	StartTime   string `json:"startTime"`
	Description string `json:"description"`
}
type tutorData struct {
	WeekStart   string          `json:"weekStart"`
	WeekEnd     string          `json:"weekEnd"`
	LessonCount int             `json:"lessonCount"`
	TotalHours  decimal.Decimal `json:"totalHours"`
	TotalFee    decimal.Decimal `json:"totalFee"`
	Upcoming    struct {
		Total int      `json:"total"`
		Items []lesson `json:"items"`
	} `json:"upcoming"`
	Conflicts struct {
		Total int        `json:"total"`
		Items []conflict `json:"items"`
	} `json:"conflicts"`
}

type notification struct {
	ID        int64   `json:"id"`
	Title     string  `json:"title"`
	CreatedAt string  `json:"createdAt"`
	ReadAt    *string `json:"readAt"`
}
type notifData struct {
	Items  []notification
	Unread int
}

// section is an independent loadable block; failures keep the previous data.
type section[T any] struct {
	data    *T
	loading bool
	failed  bool
	updated time.Time
}

type overview struct {
	env    *kit.Env
	root   *fyne.Container
	hidden bool
	days   int
	cur    string // selected investment currency

	credit section[creditData]
	invest section[investData]
	tutor  section[tutorData]
	notif  section[notifData]
}

func newOverview(env *kit.Env) *overview {
	o := &overview{env: env, days: 30, root: container.NewVBox()}
	o.hidden = env.Pref(o.hiddenKey(), "0") == "1"
	o.reloadAll()
	return o
}

func (o *overview) hiddenKey() string {
	return "kira-overview-hidden-" + strconv.FormatInt(o.env.User().ID, 10)
}

func (o *overview) anyLoading() bool {
	return o.credit.loading || o.invest.loading || o.tutor.loading || o.notif.loading
}

func (o *overview) reloadAll() {
	o.loadCredit()
	o.loadInvest()
	o.loadTutor()
	o.loadNotif()
}

func fetch[T any](o *overview, s *section[T], get func(ctx context.Context) (T, error)) {
	s.loading = true
	o.render()
	kit.Async(get, func(v T, err error) {
		s.loading = false
		if err != nil {
			s.failed = true // keep previous data; status line offers a retry
		} else {
			s.data, s.failed, s.updated = &v, false, time.Now()
		}
		o.render()
	})
}

func (o *overview) loadCredit() {
	fetch(o, &o.credit, func(ctx context.Context) (creditData, error) {
		var v creditData
		return v, o.env.API.Get(ctx, "dashboards/overview/credit-cards", nil, &v)
	})
}

func (o *overview) loadInvest() {
	days := o.days
	fetch(o, &o.invest, func(ctx context.Context) (investData, error) {
		var v investData
		return v, o.env.API.Get(ctx, "dashboards/overview/investments", url.Values{"days": {strconv.Itoa(days)}}, &v)
	})
}

func (o *overview) loadTutor() {
	fetch(o, &o.tutor, func(ctx context.Context) (tutorData, error) {
		var v tutorData
		return v, o.env.API.Get(ctx, "dashboards/overview/tutoring", nil, &v)
	})
}

func (o *overview) loadNotif() {
	fetch(o, &o.notif, func(ctx context.Context) (notifData, error) {
		var d notifData
		p, err := api.GetPage[notification](ctx, o.env.API, "notifications", url.Values{"sort": {"createdAt,desc"}}, 0, 5)
		if err != nil {
			return d, err
		}
		var c struct {
			Count int `json:"count"`
		}
		if err := o.env.API.Get(ctx, "notifications/unread-count", nil, &c); err != nil {
			return d, err
		}
		return notifData{p.Data, c.Count}, nil
	})
}

// ---- formatting helpers ----

func (o *overview) money(v decimal.Decimal, cur string) string {
	if o.hidden {
		return format.HiddenMoney
	}
	return format.Money(v, cur)
}

func (o *overview) percent(v decimal.Decimal) string {
	if o.hidden {
		return format.HiddenPercent
	}
	return format.Percent(v, 2)
}

func statusLine[T any](s *section[T], retry func()) fyne.CanvasObject {
	switch {
	case s.loading:
		return kit.Muted(i18n.T("overview.loading"))
	case s.failed:
		l := widget.NewLabel(i18n.T("overview.loadFailed"))
		l.Importance = widget.DangerImportance
		l.Wrapping = fyne.TextWrapWord
		return container.NewVBox(l, widget.NewButton(i18n.T("overview.retry"), retry))
	case s.data != nil:
		return kit.Muted(i18n.T("overview.updated") + " " + format.DateTimeShort(s.updated))
	}
	return container.NewVBox()
}

// ---- render ----

func (o *overview) render() {
	hideLabel := i18n.T("overview.hideMoney")
	if o.hidden {
		hideLabel = i18n.T("overview.showMoney")
	}
	toggle := widget.NewButtonWithIcon(hideLabel, theme.VisibilityIcon(), func() {
		o.hidden = !o.hidden
		v := "0"
		if o.hidden {
			v = "1"
		}
		o.env.SetPref(o.hiddenKey(), v)
		o.render()
	})
	refresh := widget.NewButtonWithIcon(i18n.T("overview.refresh"), theme.ViewRefreshIcon(), o.reloadAll)
	if o.anyLoading() {
		refresh.Disable()
	}
	name := i18n.T("overview.you")
	if u := o.env.User(); u != nil && strings.TrimSpace(u.FullName) != "" {
		name = u.FullName
	}
	head := kit.PageHeader(format.LongDate(time.Now()), i18n.T("overview.greeting", i18n.P{"name": name}),
		i18n.T("overview.subtitle"), toggle, refresh)

	left := container.NewVBox(o.attention(), o.upcoming(), o.notifications(), o.shortcuts())
	right := container.NewVBox(o.cards(), o.investments(), o.tutoring())
	o.root.Objects = []fyne.CanvasObject{head, container.NewGridWithColumns(2, left, right)}
	o.root.Refresh()
}

type taskRow struct {
	title, detail, amount string
	open                  func()
}

func (o *overview) taskGroup(titleKey, link string, urgent bool, total int, rows []taskRow) fyne.CanvasObject {
	imp := widget.MediumImportance
	if urgent {
		imp = widget.DangerImportance
	}
	box := container.NewVBox(container.NewBorder(nil, nil,
		container.NewHBox(kit.Badge(i18n.T("overview."+titleKey), imp), kit.Badge(strconv.Itoa(total), imp)),
		widget.NewButton(i18n.T("overview.viewAll"), func() { o.env.Navigate(link, nil) })))
	for _, r := range rows {
		r := r
		b := widget.NewButton(r.title, r.open)
		b.Alignment = widget.ButtonAlignLeading
		b.Importance = widget.LowImportance
		line := container.NewBorder(nil, nil, nil, widget.NewLabel(r.amount), b)
		box.Add(line)
		box.Add(kit.Muted(r.detail))
	}
	return box
}

func (o *overview) attention() fyne.CanvasObject {
	body := container.NewVBox()
	if !(o.credit.data != nil && o.invest.data != nil && o.tutor.data != nil) {
		body.Add(kit.Muted(i18n.T("overview.partialAttention")))
		if o.credit.failed {
			body.Add(widget.NewButton(i18n.T("overview.retryCards"), o.loadCredit))
		}
		if o.invest.failed {
			body.Add(widget.NewButton(i18n.T("overview.retryInvestments"), o.loadInvest))
		}
		if o.tutor.failed {
			body.Add(widget.NewButton(i18n.T("overview.retryTutoring"), o.loadTutor))
		}
	}
	tasks := 0
	if c := o.credit.data; c != nil {
		for _, g := range []struct {
			key    string
			grp    dueGroup
			urgent bool
		}{{"overdue", c.Overdue, true}, {"dueToday", c.DueToday, true}, {"dueSoon", c.DueSoon, false}, {"needsInput", c.NeedsInput, false}} {
			if g.grp.Total == 0 {
				continue
			}
			tasks += g.grp.Total
			var rows []taskRow
			for _, it := range g.grp.Items {
				detail := []string{}
				if it.LastFour != nil && *it.LastFour != "" {
					detail = append(detail, "•••• "+*it.LastFour)
				}
				if it.DueDate != nil && *it.DueDate != "" {
					detail = append(detail, format.DateOnly(*it.DueDate, format.DateShort))
				} else {
					detail = append(detail, i18n.T("overview.noDueDate"))
				}
				amount := ""
				if g.key != "needsInput" && it.RemainingAmount != nil {
					amount = o.money(*it.RemainingAmount, it.Currency)
				}
				rows = append(rows, taskRow{it.BankName + " · " + it.Nickname, strings.Join(detail, " · "), amount,
					func() { o.env.Navigate("/app/credit-cards", nil) }})
			}
			body.Add(o.taskGroup(g.key, "/app/credit-cards", g.urgent, g.grp.Total, rows))
		}
	}
	if v := o.invest.data; v != nil {
		for _, g := range []struct {
			key string
			grp batchGroup
		}{{"failed", v.Failed}, {"review", v.Review}} {
			if g.grp.Total == 0 {
				continue
			}
			tasks += g.grp.Total
			var rows []taskRow
			for _, it := range g.grp.Items {
				it := it
				rows = append(rows, taskRow{it.AccountName, i18n.T("overview." + g.key), "", func() {
					o.env.Navigate("/app/investment/transactions", map[string]string{
						"accountId": strconv.FormatInt(it.AccountID, 10), "batchId": it.BatchID})
				}})
			}
			body.Add(o.taskGroup(g.key, "/app/investment/ai-queue", g.key == "failed", g.grp.Total, rows))
		}
	}
	if t := o.tutor.data; t != nil && t.Conflicts.Total > 0 {
		tasks += t.Conflicts.Total
		var rows []taskRow
		for _, c := range t.Conflicts.Items {
			rows = append(rows, taskRow{c.Description, format.DateOnly(c.Date, format.DateShort) + " · " + format.HHmm(c.StartTime), "",
				func() { o.env.Navigate("/app/tutor-schedule", nil) }})
		}
		body.Add(o.taskGroup("conflicts", "/app/tutor-schedule", true, t.Conflicts.Total, rows))
	}
	if tasks == 0 && o.credit.data != nil && o.invest.data != nil && o.tutor.data != nil {
		body.Add(kit.Heading(i18n.T("overview.allClear")))
		body.Add(kit.Muted(i18n.T("overview.allClearHint")))
	}
	return kit.Card(i18n.T("overview.attention"), i18n.T("overview.startHere"), body)
}

func (o *overview) upcoming() fyne.CanvasObject {
	body := container.NewVBox(statusLine(&o.tutor, o.loadTutor))
	if t := o.tutor.data; t != nil {
		if len(t.Upcoming.Items) == 0 {
			body.Add(kit.Muted(i18n.T("overview.noUpcoming")))
		}
		for _, l := range t.Upcoming.Items {
			body.Add(container.NewBorder(nil, nil, nil, widget.NewLabel(o.money(l.Fee, "VND")),
				widget.NewLabel(format.DateOnly(l.Date, format.DateShort)+" "+format.HHmm(l.StartTime)+"–"+format.HHmm(l.EndTime)+" · "+l.StudentName+" · "+l.Subject)))
		}
		if t.Upcoming.Total > len(t.Upcoming.Items) {
			body.Add(kit.Muted(i18n.T("overview.showing", i18n.P{"count": len(t.Upcoming.Items), "total": t.Upcoming.Total})))
		}
	}
	body.Add(widget.NewButton(i18n.T("overview.openSchedule"), func() { o.env.Navigate("/app/tutor-schedule", nil) }))
	return kit.Card(i18n.T("overview.upcoming"), i18n.T("overview.next7"), body)
}

func (o *overview) cards() fyne.CanvasObject {
	body := container.NewVBox(statusLine(&o.credit, o.loadCredit))
	if c := o.credit.data; c != nil {
		if c.Summary.CardCount == 0 {
			body.Add(kit.Muted(i18n.T("overview.noCards")))
			body.Add(widget.NewButton(i18n.T("overview.manageCards"), func() { o.env.Navigate("/app/credit-cards", nil) }))
		} else {
			s, cur := c.Summary, c.Summary.Currency
			body.Add(container.NewGridWithColumns(2,
				kit.Tile(i18n.T("overview.creditLimit"), o.money(s.TotalCreditLimit, cur)),
				kit.Tile(i18n.T("overview.balance"), o.money(s.CurrentBalance, cur)),
				kit.Tile(i18n.T("overview.available"), o.money(s.AvailableCredit, cur)),
				kit.Tile(i18n.T("overview.utilization"), o.percent(s.UtilizationRate))))
			body.Add(kit.Muted(i18n.T("overview.bankShared")))
			body.Add(widget.NewButton(i18n.T("overview.details"), func() { o.env.Navigate("/app/credit-card/dashboard", nil) }))
		}
	}
	return kit.Card(i18n.T("overview.cards"), i18n.T("overview.currentSnapshot"), body)
}

func (o *overview) investments() fyne.CanvasObject {
	period := widget.NewSelect(nil, nil)
	var opts []string
	for _, d := range []int{7, 30, 90} {
		opts = append(opts, i18n.T("overview.days", i18n.P{"days": d}))
	}
	period.Options = opts
	period.SetSelected(i18n.T("overview.days", i18n.P{"days": o.days}))
	period.OnChanged = func(s string) {
		for i, d := range []int{7, 30, 90} {
			if opts[i] == s && d != o.days {
				o.days = d
				o.loadInvest()
			}
		}
	}
	body := container.NewVBox(container.NewBorder(nil, nil, widget.NewLabel(i18n.T("overview.period")), nil, period),
		statusLine(&o.invest, o.loadInvest))
	v := o.invest.data
	if v == nil {
		return kit.Card(i18n.T("overview.investments"), i18n.T("overview.completedOnly"), body)
	}
	if v.Days != o.days {
		body.Add(kit.Muted(i18n.T("overview.previousPeriod", i18n.P{"days": v.Days})))
	}
	if len(v.Currencies) == 0 {
		body.Add(kit.Muted(i18n.T("overview.noInvestments")))
		body.Add(widget.NewButton(i18n.T("overview.manageAccounts"), func() { o.env.Navigate("/app/investment/accounts", nil) }))
		return kit.Card(i18n.T("overview.investments"), i18n.T("overview.completedOnly"), body)
	}
	cf := v.Currencies[0]
	for _, c := range v.Currencies {
		if c.Currency == o.cur {
			cf = c
		}
	}
	if len(v.Currencies) > 1 {
		var codes []string
		for _, c := range v.Currencies {
			codes = append(codes, c.Currency)
		}
		sel := widget.NewSelect(codes, func(s string) { o.cur = s; o.render() })
		sel.SetSelected(cf.Currency)
		body.Add(container.NewBorder(nil, nil, widget.NewLabel(i18n.T("overview.currency")), nil, sel))
	}
	body.Add(kit.Muted(i18n.T("overview.activeAccounts") + ": " + strconv.Itoa(v.ActiveAccounts) + " · " +
		format.DateOnly(v.FromDate, format.DateShort) + " – " + format.DateOnly(v.ToDate, format.DateShort)))
	body.Add(container.NewGridWithColumns(2,
		kit.Tile(i18n.T("overview.deposits"), o.money(cf.Deposits, cf.Currency)),
		kit.Tile(i18n.T("overview.withdrawals"), o.money(cf.Withdrawals, cf.Currency)),
		kit.Tile(i18n.T("overview.bonuses"), o.money(cf.Bonuses, cf.Currency)),
		kit.Tile(i18n.T("overview.netDeposits"), o.money(cf.NetDeposits, cf.Currency))))
	body.Add(kit.Heading(i18n.T("overview.cashFlow")))
	switch {
	case o.hidden:
		body.Add(kit.Muted(i18n.T("overview.chartHidden")))
	case cf.Deposits.IsZero() && cf.Withdrawals.IsZero():
		body.Add(kit.Muted(i18n.T("overview.noFlow")))
	default:
		body.Add(o.flowChart(cf, v.Days))
	}
	body.Add(kit.Muted(i18n.T("overview.flowHint")))
	body.Add(container.NewHBox(
		widget.NewButton(i18n.T("overview.details"), func() { o.env.Navigate("/app/investment/accounts", nil) }),
		widget.NewButton(i18n.T("shell.investmentReports"), func() { o.env.Navigate("/app/investment/reports", nil) })))
	return kit.Card(i18n.T("overview.investments"), i18n.T("overview.completedOnly"), body)
}

func (o *overview) flowChart(cf currencyFlow, days int) fyne.CanvasObject {
	var labels []string
	dep := kit.Series{Name: i18n.T("overview.deposits"), Color: kit.ColorBlue}
	wd := kit.Series{Name: i18n.T("overview.withdrawals"), Color: kit.ColorAmber}
	for _, d := range cf.Daily {
		labels = append(labels, format.DateOnly(d.Date, format.DateShort))
		dep.Values = append(dep.Values, d.Deposits.InexactFloat64())
		wd.Values = append(wd.Values, d.Withdrawals.InexactFloat64())
	}
	ch := kit.NewBarChart(labels, dep, wd)
	ch.LabelEvery = map[int]int{7: 1, 30: 5, 90: 15}[days]
	ch.Tooltip = func(i int) string {
		d := cf.Daily[i]
		return labels[i] + " · " + dep.Name + ": " + o.money(d.Deposits, cf.Currency) + " · " + wd.Name + ": " + o.money(d.Withdrawals, cf.Currency)
	}
	return container.NewVBox(ch, kit.Legend(dep, wd))
}

func (o *overview) tutoring() fyne.CanvasObject {
	body := container.NewVBox(statusLine(&o.tutor, o.loadTutor))
	if t := o.tutor.data; t != nil {
		body.Add(kit.Muted(format.DateOnly(t.WeekStart, format.DateShort) + " – " + format.DateOnly(t.WeekEnd, format.DateShort) + " · " + i18n.T("overview.vietnamTime")))
		body.Add(container.NewGridWithColumns(3,
			kit.Tile(i18n.T("overview.lessons"), strconv.Itoa(t.LessonCount)),
			kit.Tile(i18n.T("overview.hours"), format.Num(t.TotalHours, 2)),
			kit.Tile(i18n.T("overview.expectedFees"), o.money(t.TotalFee, "VND"))))
	}
	body.Add(widget.NewButton(i18n.T("overview.openSchedule"), func() { o.env.Navigate("/app/tutor-schedule", nil) }))
	return kit.Card(i18n.T("overview.tutoring"), i18n.T("overview.thisWeek"), body)
}

func (o *overview) notifications() fyne.CanvasObject {
	body := container.NewVBox(statusLine(&o.notif, o.loadNotif))
	if n := o.notif.data; n != nil {
		body.Add(kit.Muted(i18n.T("overview.unread", i18n.P{"count": n.Unread})))
		if len(n.Items) == 0 {
			body.Add(kit.Muted(i18n.T("overview.noNotifications")))
		}
		for _, it := range n.Items {
			dot := "○ "
			if it.ReadAt == nil {
				dot = "● "
			}
			title := it.Title
			if o.hidden {
				title = i18n.T("overview.notificationPrivate")
			}
			body.Add(container.NewBorder(nil, nil, nil, kit.Muted(format.Timestamp(it.CreatedAt, format.DateShort)),
				widget.NewLabel(dot+title)))
		}
	}
	body.Add(widget.NewButton(i18n.T("overview.viewAll"), func() { o.env.Navigate("/app/notifications", nil) }))
	return kit.Card(i18n.T("overview.notifications"), "", body)
}

func (o *overview) shortcuts() fyne.CanvasObject {
	links := []struct{ key, path string }{
		{"cards", "/app/credit-cards"}, {"benefits", "/app/credit-card/benefits"},
		{"investments", "/app/investment/accounts"}, {"queue", "/app/investment/ai-queue"},
		{"tutoring", "/app/tutor-schedule"}, {"travel", "/app/travel"},
		{"lodgings", "/app/lodgings"}, {"passwords", "/app/password-manager"},
	}
	grid := container.NewGridWithColumns(2)
	for _, l := range links {
		path := l.path
		grid.Add(widget.NewButton(i18n.T("overview."+l.key), func() { o.env.Navigate(path, nil) }))
	}
	return kit.Card(i18n.T("overview.shortcuts"), "", grid)
}
