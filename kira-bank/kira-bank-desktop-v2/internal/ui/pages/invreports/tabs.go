package invreports

import (
	"context"
	"encoding/json"
	"fmt"
	"image/color"
	"strconv"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type renderer func(c *rc, raw json.RawMessage) (fyne.CanvasObject, error)

// typed adapts a typed tab renderer.
func typed[T any](f func(c *rc, r T) fyne.CanvasObject) renderer {
	return func(c *rc, raw json.RawMessage) (fyne.CanvasObject, error) {
		var r T
		if err := json.Unmarshal(raw, &r); err != nil {
			return nil, err
		}
		return f(c, r), nil
	}
}

var renderers map[string]renderer

func init() {
	renderers = map[string]renderer{
		"overview": typed(tabOverview), "insights": typed(tabInsights), "goals": typed(tabGoals), "periodic": typed(tabPeriodic),
		"accounts": typed(tabAccounts), "matrix": typed(tabMatrix), "equity": typed(tabEquity), "performance": typed(tabPerformance),
		"drawdowns": typed(tabDrawdowns), "rolling": typed(tabRolling), "daily": typed(tabDaily), "activity": typed(tabActivity),
		"distribution": typed(tabDistribution), "bonus": typed(tabBonus), "ledger": typed(tabLedger), "cadence": typed(tabCadence),
		"allocation": typed(tabAllocation), "lots": typed(tabLots), "payback": typed(tabPayback), "seasonality": typed(tabSeasonality),
		"projection": typed(tabProjection), "comparison": typed(tabComparison),
	}
}

func vbox(o ...fyne.CanvasObject) fyne.CanvasObject { return container.NewVBox(o...) }

func totalsMetrics(c *rc, t totals) fyne.CanvasObject {
	return metrics(c.mt(c.t("deposits"), t.Deposits), c.mt(c.t("withdrawals"), t.Withdrawals), c.mt(c.t("bonuses"), t.Bonuses), c.mt(c.t("net"), t.Net))
}

func tabOverview(c *rc, r overviewReport) fyne.CanvasObject {
	m := []fyne.CanvasObject{
		c.mt(c.t("deposits"), r.Totals.Deposits), c.mt(c.t("withdrawals"), r.Totals.Withdrawals), c.mt(c.t("bonuses"), r.Totals.Bonuses),
		c.mt(c.t("net"), r.Totals.Net), c.mt(c.t("netWithBonus"), r.Totals.NetWithBonus),
		metric(c.t("payback.recovered"), pct(r.WithdrawalToDepositPct), nil),
		metric(c.t("transactions"), strconv.Itoa(r.Totals.Count), nil),
		metric(c.t("overview.avgTx"), c.money(r.AverageTransaction), nil),
		metric(c.t("overview.accounts"), strconv.Itoa(r.ActiveAccounts), nil),
		metric(c.t("daily.activeDays"), strconv.Itoa(r.ActiveDays), nil),
	}
	if r.LastAt != nil {
		m = append(m, metric(c.t("overview.lastTx"), format.Timestamp(*r.LastAt, func(t time.Time) string {
			return format.DateMedium(t) + " " + format.TimeShort(t)
		}), nil))
	}
	if r.FirstDate != nil {
		m = append(m, metric(c.t("overview.firstTx"), *r.FirstDate, nil))
	}
	mom := []fyne.CanvasObject{
		metric(r.CurrentMonth, c.money(r.CurrentMonthNet), sign(r.CurrentMonthNet)),
		c.mt(c.t("overview.previousMonth"), r.PreviousMonthNet),
		metric(c.t("periodic.change"), c.money(r.MonthNetChange), sign(r.MonthNetChange)),
	}
	acc := func(k string, a *accountNet) fyne.CanvasObject {
		if a == nil {
			return metric(c.t(k), format.Dash, nil)
		}
		return metric(c.t(k), a.AccountName+" · "+c.money(a.Net), nil)
	}
	mom = append(mom, acc("overview.best", r.BestAccount), acc("overview.worst", r.WorstAccount))
	return vbox(metrics(m...), kit.Heading(c.t("overview.monthOverMonth")), metrics(mom...))
}

func tabInsights(c *rc, r insightsReport) fyne.CanvasObject {
	out := vbox(kit.Muted(c.t("projection.asOf")+": "+r.AsOf), hint("insights.hint", c))
	box := out.(*fyne.Container)
	if len(r.Insights) == 0 {
		box.Add(widget.NewLabel(c.t("insights.none")))
	}
	for _, in := range r.Insights {
		imp := widget.MediumImportance
		switch lower(in.Severity) {
		case "warn":
			imp = widget.DangerImportance
		case "good":
			imp = widget.SuccessImportance
		}
		name, date := "", ""
		if in.AccountName != nil {
			name = *in.AccountName
		}
		if in.Date != nil {
			date = *in.Date
		}
		msg := i18n.T("investmentReports.insight."+lower(in.Code), i18n.P{"account": name, "value": insightValue(in.Code, in.Value, c.money), "date": date})
		l := widget.NewLabel(msg)
		l.Wrapping = fyne.TextWrapWord
		box.Add(container.NewBorder(nil, nil, kit.Badge(c.t("insights.sev."+lower(in.Severity)), imp), nil, l))
	}
	return out
}

func tabGoals(c *rc, r goalsReport) fyne.CanvasObject {
	box := container.NewVBox(kit.Muted(c.t("projection.asOf")+": "+r.AsOf), hint("goals.hint", c))
	if len(r.Goals) == 0 {
		box.Add(widget.NewLabel(c.t("goals.none")))
	}
	for _, g := range r.Goals {
		badge := kit.Badge(c.t("goals.behind"), widget.DangerImportance)
		switch {
		case g.Reached:
			badge = kit.Badge(c.t("goals.reached"), widget.SuccessImportance)
		case g.OnTrack:
			badge = kit.Badge(c.t("goals.onTrack"), widget.HighImportance)
		}
		del := widget.NewButtonWithIcon(c.t("goals.delete"), theme.DeleteIcon(), func() {
			c.sh.mutate(func(ctx context.Context) error {
				return c.sh.env.API.Delete(ctx, "investment/goals/"+strconv.FormatInt(g.ID, 10), nil)
			})
		})
		bar := widget.NewProgressBar()
		bar.TextFormatter = func() string { return format.Percent(g.Pct, 1) }
		bar.SetValue(clampPct(g.Pct))
		detail := fmt.Sprintf("%s %s (%s) · %s %s · %s %s · %s %s · %dd", c.t("goals.achieved"), c.money(g.Achieved), format.Percent(g.Pct, 1),
			c.t("goals.elapsed"), format.Percent(g.ElapsedPct, 1), c.t("goals.remaining"), c.money(g.Remaining),
			c.t("goals.requiredDaily"), c.money(g.RequiredDaily), g.DaysRemaining)
		box.Add(widget.NewCard(c.t("goals."+lower(g.Period))+" · "+c.money(g.Target), "", vbox(
			container.NewBorder(nil, nil, badge, del), bar, kit.Muted(detail))))
	}
	cur := c.cur
	period := widget.NewSelect([]string{c.t("goals.month"), c.t("goals.year")}, nil)
	period.SetSelectedIndex(0)
	target := kit.NewMoneyEntry(4)
	save := widget.NewButton(c.t("goals.save"), nil)
	save.Importance = widget.HighImportance
	save.Disable()
	target.OnValueChanged = func() {
		if v, ok := target.Value(); ok && v.IsPositive() {
			save.Enable()
		} else {
			save.Disable()
		}
	}
	save.OnTapped = func() {
		v, ok := target.Value()
		if !ok || !v.IsPositive() {
			return
		}
		p := "MONTH"
		if period.SelectedIndex() == 1 {
			p = "YEAR"
		}
		c.sh.mutate(func(ctx context.Context) error {
			return c.sh.env.API.Put(ctx, "investment/goals", map[string]any{"currency": cur, "period": p, "targetAmount": v}, nil)
		})
	}
	box.Add(widget.NewCard(c.t("goals.set")+" ("+cur+")", "", container.NewGridWithColumns(3,
		labelled(c.t("goals.period"), period), labelled(c.t("goals.target"), target), container.NewVBox(widget.NewLabel(""), save))))
	return box
}

func labelled(l string, o fyne.CanvasObject) fyne.CanvasObject {
	return container.NewVBox(kit.Muted(l), o)
}

func tabPeriodic(c *rc, r periodicReport) fyne.CanvasObject {
	gran := []string{"DAY", "WEEK", "MONTH", "QUARTER", "YEAR"}
	labels := make([]string, len(gran))
	for i, g := range gran {
		labels[i] = c.t("periodic." + lower(g))
	}
	sel := widget.NewSelect(labels, nil)
	for i, g := range gran {
		if g == c.sh.gran {
			sel.SetSelectedIndex(i)
		}
	}
	sel.OnChanged = func(string) {
		if i := sel.SelectedIndex(); i >= 0 && gran[i] != c.sh.gran {
			c.sh.gran = gran[i]
			c.sh.load()
		}
	}
	bp := func(p *periodRow) string {
		if p == nil {
			return format.Dash
		}
		return p.Period + " · " + c.money(p.Totals.Net)
	}
	var rows [][]cell
	for i := len(r.Rows) - 1; i >= 0; i-- {
		p := r.Rows[i]
		ch := cell{S: pct(p.NetChangePct)}
		rows = append(rows, []cell{txt(p.Period), txt(strconv.Itoa(p.Totals.Count)), plainMoney(c, p.Totals.Deposits), plainMoney(c, p.Totals.Withdrawals),
			plainMoney(c, p.Totals.Bonuses), c.mc(p.Totals.Net), ch, plainMoney(c, p.CumulativeNet)})
	}
	labelsX, nets := make([]string, len(r.Rows)), make([]D, len(r.Rows))
	for i, p := range r.Rows {
		labelsX[i], nets[i] = p.Period, p.Totals.Net
	}
	chart := signedBars(labelsX, nets, func(i int) string { return labelsX[i] + " · " + c.money(nets[i]) })
	return vbox(
		container.NewBorder(nil, nil, nil, container.NewHBox(sel, c.csvBtn(csvPeriodic(r, c.cur)))),
		totalsMetrics(c, r.Totals),
		metrics(c.mt(c.t("periodic.average"), r.AverageNet), metric(c.t("periodic.winning"), strconv.Itoa(r.ProfitablePeriod), nil),
			metric(c.t("periodic.losing"), strconv.Itoa(r.LosingPeriods), nil), metric(c.t("periodic.best"), bp(r.Best), nil), metric(c.t("periodic.worst"), bp(r.Worst), nil)),
		kit.Heading(c.t("periodic.chart")), chart,
		dataTable([]string{c.t("periodic.period"), c.t("transactions"), c.t("deposits"), c.t("withdrawals"), c.t("bonuses"), c.t("net"),
			c.t("periodic.change"), c.t("periodic.cumulative")}, rows, 1))
}

func tabAccounts(c *rc, r accountsReport) fyne.CanvasObject {
	var rows [][]cell
	for i, a := range r.Rows {
		id := a.AccountID
		rows = append(rows, []cell{txt(strconv.Itoa(i + 1)), {S: a.AccountName, Click: func() { c.sh.drill(id) }}, txt(strconv.Itoa(a.Totals.Count)),
			plainMoney(c, a.Totals.Deposits), plainMoney(c, a.Totals.Withdrawals), plainMoney(c, a.Totals.Bonuses), c.mc(a.Totals.Net),
			txt(pct(a.RoiPct)), txt(pct(a.NetSharePct)), plainMoney(c, a.AverageDeposit), plainMoney(c, a.AverageWithdrawal),
			txt(a.LastDate + " · " + strconv.Itoa(a.DaysSinceLast) + "d")})
	}
	return vbox(container.NewBorder(nil, nil, nil, c.csvBtn(csvAccounts(r, c.cur))),
		metrics(c.mt(c.t("deposits"), r.Totals.Deposits), c.mt(c.t("withdrawals"), r.Totals.Withdrawals), c.mt(c.t("net"), r.Totals.Net)),
		dataTable([]string{"#", c.t("account"), c.t("transactions"), c.t("deposits"), c.t("withdrawals"), c.t("bonuses"), c.t("net"), "ROI",
			c.t("accounts.share"), c.t("accounts.avgDeposit"), c.t("accounts.avgWithdrawal"), c.t("accounts.last")}, rows, 2))
}

func tabMatrix(c *rc, r matrixReport) fyne.CanvasObject {
	body := container.NewStack()
	render := func(cumulative bool) {
		var all []D
		get := func(row matrixRow) []D {
			if cumulative {
				return row.Cumulative
			}
			return row.Cells
		}
		for _, row := range r.Rows {
			all = append(all, get(row)...)
		}
		mx := maxAbs(all, 1)
		grid := container.NewGridWithColumns(len(r.Months)+2, widget.NewLabel(c.t("account")))
		for _, m := range r.Months {
			grid.Add(widget.NewLabel(m))
		}
		grid.Add(widget.NewLabel(c.t("seasonality.total")))
		for _, row := range r.Rows {
			grid.Add(widget.NewLabel(row.AccountName))
			for _, v := range get(row) {
				grid.Add(heat(signedCompact(v), tintBase(v), tintPct(v, mx, 8, 40)))
			}
			grid.Add(cellObj(c.mc(row.Total), true))
		}
		grid.Add(widget.NewLabel(c.t("seasonality.total")))
		tot := r.MonthTotals
		if cumulative {
			tot = r.CumulativeTotals
		}
		for _, v := range tot {
			grid.Add(cellObj(cell{S: signedCompact(v), C: sign(v)}, false))
		}
		grid.Add(widget.NewLabel(""))
		body.Objects = []fyne.CanvasObject{container.NewHScroll(grid)}
		body.Refresh()
	}
	mode := widget.NewSelect([]string{c.t("matrix.monthly"), c.t("matrix.cumulative")}, func(string) {})
	mode.OnChanged = func(string) { render(mode.SelectedIndex() == 1) }
	mode.SetSelectedIndex(0)
	return vbox(container.NewBorder(nil, nil, nil, c.csvBtn(csvMatrix(r, c.cur)), container.NewHBox(widget.NewLabel(c.t("matrix.mode")), mode)),
		hint("matrix.hint", c), body)
}

func tabEquity(c *rc, r equityReport) fyne.CanvasObject {
	bd := func(d *dayNet, col bool) fyne.CanvasObject {
		if d == nil {
			return metric("", format.Dash, nil)
		}
		if col {
			return metric(c.t("equity.bestDay"), d.Date+" · "+c.money(d.Net), kit.ColorBlue)
		}
		return metric(c.t("equity.worstDay"), d.Date+" · "+c.money(d.Net), kit.ColorRed)
	}
	wr := winRate(r.WinDays, r.LossDays)
	wrs := format.Dash
	if wr != nil {
		wrs = format.Num(wr.Round(1), 1) + "%"
	}
	dd := c.money(r.MaxDrawdown)
	if r.MaxDrawdownDate != nil {
		dd += " · " + *r.MaxDrawdownDate
	}
	m := metrics(c.mt(c.t("equity.final"), r.FinalNet), c.mt(c.t("equity.peak"), r.PeakNet), metric(c.t("equity.maxDrawdown"), dd, kit.ColorRed),
		c.mt(c.t("equity.currentDrawdown"), r.CurrentDrawdown), metric(c.t("equity.activeDays"), strconv.Itoa(r.ActiveDays), nil),
		metric(c.t("equity.winDays"), strconv.Itoa(r.WinDays), nil), metric(c.t("equity.lossDays"), strconv.Itoa(r.LossDays), nil),
		metric(c.t("equity.winRate"), wrs, nil), metric(c.t("equity.longestWin"), strconv.Itoa(r.LongestWinStreak), nil),
		metric(c.t("equity.longestLoss"), strconv.Itoa(r.LongestLossStrk), nil), metric(c.t("equity.currentStreak"), strconv.Itoa(r.CurrentStreak), nil),
		bd(r.BestDay, true), bd(r.WorstDay, false))
	if len(r.Points) == 0 {
		return vbox(m)
	}
	labels, cum, peak := make([]string, len(r.Points)), make([]D, len(r.Points)), make([]D, len(r.Points))
	for i, p := range r.Points {
		labels[i], cum[i], peak[i] = p.Date, p.CumulativeNet, p.Peak
	}
	s := []kit.Series{{Name: c.t("equity.cumulative"), Color: kit.ColorBlue, Values: floats(cum)}, {Name: c.t("equity.peak"), Color: kit.ColorAmber, Values: floats(peak)}}
	ch := kit.NewLineChart(labels, s...)
	ch.LabelEvery = labelEvery(len(labels))
	ch.Tooltip = func(i int) string { return labels[i] + " · " + c.money(cum[i]) }
	return vbox(m, kit.Heading(c.t("equity.curve")), ch, c.axisRow(labels[0], labels[len(labels)-1], cum, peak), kit.Legend(s...))
}

func tabPerformance(c *rc, r performanceReport) fyne.CanvasObject {
	wr := pct(r.WinRatePct)
	return vbox(hint("performance.hint", c), metrics(
		c.mt(c.t("net"), r.TotalNet), metric(c.t("equity.winRate"), wr, nil), metric(c.t("performance.profitFactor"), dp(r.ProfitFactor), nil),
		metric(c.t("performance.payoff"), dp(r.PayoffRatio), nil), metric(c.t("performance.expectancy"), c.money(r.ExpectancyPerDay), nil),
		metric(c.t("performance.median"), c.money(r.MedianDayNet), nil), metric(c.t("performance.avgWin"), c.money(r.AverageWin), kit.ColorBlue),
		metric(c.t("performance.avgLoss"), c.money(r.AverageLoss), kit.ColorRed), c.mt(c.t("performance.largestWin"), r.LargestWin),
		c.mt(c.t("performance.largestLoss"), r.LargestLoss), c.mt(c.t("performance.grossWin"), r.GrossWin), c.mt(c.t("performance.grossLoss"), r.GrossLoss),
		metric(c.t("equity.maxDrawdown"), c.money(r.MaxDrawdown), nil), metric(c.t("performance.recovery"), dp(r.RecoveryFactor), nil),
		metric(c.t("daily.activeDays"), fmt.Sprintf("%d (%d / %d)", r.ActiveDays, r.WinDays, r.LossDays), nil)))
}

func tabDrawdowns(c *rc, r drawdownReport) fyne.CanvasObject {
	st := metric(c.t("drawdowns.status"), c.t("drawdowns.atPeak"), kit.ColorBlue)
	if r.Ongoing {
		st = metric(c.t("drawdowns.status"), c.t("drawdowns.ongoing"), kit.ColorRed)
	}
	out := vbox(container.NewBorder(nil, nil, nil, c.csvBtn(csvDrawdowns(r, c.cur))), hint("drawdowns.hint", c),
		metrics(metric(c.t("drawdowns.count"), strconv.Itoa(r.Count), nil), metric(c.t("drawdowns.deepest"), c.money(r.Deepest), kit.ColorRed),
			metric(c.t("drawdowns.longest"), strconv.Itoa(r.LongestDays), nil), st))
	if len(r.Episodes) == 0 {
		out.(*fyne.Container).Add(widget.NewLabel(c.t("drawdowns.none")))
		return out
	}
	var rows [][]cell
	for _, e := range r.Episodes {
		rec := c.t("drawdowns.ongoing")
		if e.RecoveryDate != nil {
			rec = *e.RecoveryDate
		}
		rows = append(rows, []cell{txt(e.PeakDate), txt(e.StartDate), txt(e.TroughDate), txt(rec), {S: c.money(e.Depth), C: kit.ColorRed},
			txt(strconv.Itoa(e.DaysToTrough)), txt(intp(e.DaysToRecover)), txt(strconv.Itoa(e.DurationDays))})
	}
	out.(*fyne.Container).Add(dataTable([]string{c.t("drawdowns.peak"), c.t("drawdowns.start"), c.t("drawdowns.trough"), c.t("drawdowns.recovery"),
		c.t("drawdowns.depth"), c.t("drawdowns.toTrough"), c.t("drawdowns.toRecover"), c.t("drawdowns.duration")}, rows, 4))
	return out
}

func tabRolling(c *rc, r rollingReport) fyne.CanvasObject {
	m := []fyne.CanvasObject{c.mt(c.t("rolling.latest7"), r.Latest7), c.mt(c.t("rolling.latest30"), r.Latest30)}
	if r.Best7 != nil {
		m = append(m, c.mt(c.t("rolling.best7"), *r.Best7))
	}
	if r.Worst7 != nil {
		m = append(m, c.mt(c.t("rolling.worst7"), *r.Worst7))
	}
	m = append(m, c.mt(c.t("rolling.avgDaily"), r.AverageDailyNet), metric(c.t("rolling.volatility"), c.money(r.Volatility), nil))
	out := vbox(metrics(m...), hint("rolling.volatilityHint", c))
	if len(r.Points) == 0 {
		return out
	}
	labels, r7, r30 := make([]string, len(r.Points)), make([]D, len(r.Points)), make([]D, len(r.Points))
	for i, p := range r.Points {
		labels[i], r7[i], r30[i] = p.Date, p.Rolling7, p.Rolling30
	}
	s := []kit.Series{{Name: c.t("rolling.line7"), Color: kit.ColorAmber, Values: floats(r7)}, {Name: c.t("rolling.line30"), Color: kit.ColorBlue, Values: floats(r30)}}
	ch := kit.NewLineChart(labels, s...)
	ch.LabelEvery = labelEvery(len(labels))
	ch.Tooltip = func(i int) string { return labels[i] + " · " + c.money(r7[i]) + " / " + c.money(r30[i]) }
	out.(*fyne.Container).Add(ch)
	out.(*fyne.Container).Add(c.axisRow(labels[0], labels[len(labels)-1], r7, r30))
	out.(*fyne.Container).Add(kit.Legend(s...))
	return out
}

func tabDaily(c *rc, r dailyReport) fyne.CanvasObject {
	bd := func(k string, d *dayRow, col bool) fyne.CanvasObject {
		if d == nil {
			return metric(c.t(k), format.Dash, nil)
		}
		clr := kit.ColorRed
		if col {
			clr = kit.ColorBlue
		}
		return metric(c.t(k), d.Date+" · "+c.money(d.Totals.Net), clr)
	}
	top := func(title string, best bool) fyne.CanvasObject {
		var rows [][]cell
		for _, d := range topDays(r.Days, best, 5) {
			rows = append(rows, []cell{txt(d.Date), c.mc(d.Totals.Net)})
		}
		return section(title, dataTable([]string{c.t("periodic.period"), c.t("net")}, rows, 1))
	}
	out := vbox(container.NewBorder(nil, nil, nil, c.csvBtn(csvDaily(r, c.cur))),
		metrics(c.mt(c.t("net"), r.Totals.Net), metric(c.t("daily.activeDays"), strconv.Itoa(len(r.Days)), nil),
			c.mt(c.t("daily.avgNet"), r.AverageNetPerActiveDay), metric(c.t("daily.avgTx"), format.Num(r.AverageTransactionsPerActive, 2), nil),
			bd("equity.bestDay", r.Best, true), bd("equity.worstDay", r.Worst, false)),
		container.NewGridWithColumns(2, top(c.t("daily.topBest"), true), top(c.t("daily.topWorst"), false)))
	box := out.(*fyne.Container)
	byDate := map[string]D{}
	var nets []D
	for _, d := range r.Days {
		byDate[d.Date] = d.Totals.Net
		nets = append(nets, d.Totals.Net)
	}
	mx := maxAbs(nets, 1)
	from, e1 := format.ParseDate(c.from)
	to, e2 := format.ParseDate(c.to)
	if e1 != nil || e2 != nil {
		return out
	}
	for m := time.Date(from.Year(), from.Month(), 1, 0, 0, 0, 0, time.UTC); !m.After(to); m = m.AddDate(0, 1, 0) {
		grid := container.NewGridWithColumns(7)
		for i := 1; i <= 7; i++ {
			grid.Add(kit.Muted(weekdayLabel(i)))
		}
		for i := 0; i < (int(m.Weekday())+6)%7; i++ {
			grid.Add(widget.NewLabel(""))
		}
		for d := m; d.Month() == m.Month(); d = d.AddDate(0, 0, 1) {
			net, ok := byDate[d.Format(dateFmt)]
			text := strconv.Itoa(d.Day())
			if !ok || net.IsZero() {
				grid.Add(heat(text, kit.ColorBlue, 0))
				continue
			}
			grid.Add(heat(text+" "+signedCompact(net), tintBase(net), tintPct(net, mx, 10, 45)))
		}
		box.Add(section(m.Format("2006-01"), grid))
	}
	return out
}

func tabActivity(c *rc, r activityReport) fyne.CanvasObject {
	var all []D
	for _, row := range r.Matrix {
		all = append(all, row...)
	}
	mx := maxAbs(all, 1)
	grid := container.NewGridWithColumns(25, widget.NewLabel(""))
	for h := 0; h < 24; h++ {
		grid.Add(kit.Muted(strconv.Itoa(h)))
	}
	for wd, row := range r.Matrix {
		grid.Add(kit.Muted(weekdayLabel(wd + 1)))
		for _, v := range row {
			if v.IsZero() {
				grid.Add(heat("", kit.ColorBlue, 0))
				continue
			}
			grid.Add(heat(v.String(), kit.ColorBlue, tintPct(v, mx, 15, 60)))
		}
	}
	var rows [][]cell
	for _, k := range r.ByWeekday {
		rows = append(rows, []cell{txt(weekdayLabel(k.Key)), txt(strconv.Itoa(k.Totals.Count)), plainMoney(c, k.Totals.Deposits),
			plainMoney(c, k.Totals.Withdrawals), c.mc(k.Totals.Net)})
	}
	labels, nets := make([]string, len(r.ByDayOfMonth)), make([]D, len(r.ByDayOfMonth))
	for i, k := range r.ByDayOfMonth {
		labels[i], nets[i] = strconv.Itoa(k.Key), k.Totals.Net
	}
	return vbox(
		metrics(metric(c.t("activity.busiestDay"), weekdayLabel(r.BusiestWeekday), nil), metric(c.t("activity.busiestHour"), strconv.Itoa(r.BusiestHour)+":00", nil),
			metric(c.t("activity.busiestDom"), strconv.Itoa(r.BusiestDayOfMonth), nil)),
		kit.Heading(c.t("activity.heatmap")), container.NewHScroll(grid),
		kit.Heading(c.t("activity.byWeekday")),
		dataTable([]string{c.t("activity.day"), c.t("transactions"), c.t("deposits"), c.t("withdrawals"), c.t("net")}, rows, 1),
		kit.Heading(c.t("activity.byDom")), signedBars(labels, nets, func(i int) string { return labels[i] + " · " + c.money(nets[i]) }))
}

func tabDistribution(c *rc, r distributionReport) fyne.CanvasObject {
	var rows [][]cell
	for _, t := range r.ByType {
		rows = append(rows, []cell{txt(c.t("type." + lower(t.Type))), txt(strconv.Itoa(t.Count)), plainMoney(c, t.Total), plainMoney(c, t.Min),
			plainMoney(c, t.Max), plainMoney(c, t.Average), plainMoney(c, t.Median), plainMoney(c, t.P90)})
	}
	var big [][]cell
	for _, l := range r.Largest {
		big = append(big, []cell{txt(l.AccountName), txt(c.t("type." + lower(l.Type))), plainMoney(c, l.Amount),
			txt(format.Timestamp(l.At, func(t time.Time) string { return format.DateMedium(t) + " " + format.TimeShort(t) }))})
	}
	out := vbox(dataTable([]string{c.t("distribution.type"), c.t("transactions"), c.t("distribution.total"), "Min", "Max", c.t("distribution.average"),
		c.t("distribution.median"), "P90"}, rows, 1))
	box := out.(*fyne.Container)
	if len(r.Buckets) > 0 {
		labels := make([]string, len(r.Buckets))
		dep, wd, bo := make([]float64, len(r.Buckets)), make([]float64, len(r.Buckets)), make([]float64, len(r.Buckets))
		for i, b := range r.Buckets {
			labels[i] = c.money(b.From)
			dep[i], wd[i], bo[i] = float64(b.Deposits), float64(b.Withdrawals), float64(b.Bonuses)
		}
		s := []kit.Series{{Name: c.t("deposits"), Color: kit.ColorBlue, Values: dep}, {Name: c.t("withdrawals"), Color: kit.ColorRed, Values: wd},
			{Name: c.t("bonuses"), Color: kit.ColorGreen, Values: bo}}
		ch := kit.NewBarChart(labels, s...)
		ch.LabelEvery = labelEvery(len(labels))
		ch.Tooltip = func(i int) string { return labels[i] + " – " + c.money(r.Buckets[i].To) }
		box.Add(kit.Heading(c.t("distribution.histogram")))
		box.Add(ch)
		box.Add(kit.Legend(s...))
	}
	box.Add(kit.Heading(c.t("distribution.largest")))
	box.Add(dataTable([]string{c.t("account"), c.t("distribution.type"), c.t("distribution.amount"), c.t("distribution.when")}, big, 2))
	return out
}

func tabBonus(c *rc, r bonusReport) fyne.CanvasObject {
	tbl := func(title, first string, rows []bonusRow) fyne.CanvasObject {
		var cs [][]cell
		for _, b := range rows {
			cs = append(cs, []cell{txt(b.Label), plainMoney(c, b.Bonuses), txt(strconv.Itoa(b.BonusCount)), plainMoney(c, b.Deposits), txt(pct(b.BonusPctOfDeposits))})
		}
		return section(title, dataTable([]string{first, c.t("bonuses"), c.t("bonus.count"), c.t("deposits"), c.t("bonus.pctDeposits")}, cs, 1))
	}
	return vbox(container.NewBorder(nil, nil, nil, c.csvBtn(csvBonus(r, c.cur))),
		metrics(c.mt(c.t("bonuses"), r.TotalBonuses), c.mt(c.t("deposits"), r.TotalDeposits), metric(c.t("bonus.pctDeposits"), pct(r.BonusPctOfDeposits), nil),
			metric(c.t("bonus.pctProfit"), pct(r.BonusPctOfPositive), nil), metric(c.t("bonus.average"), c.money(r.AverageBonus), nil),
			metric(c.t("bonus.largest"), c.money(r.LargestBonus), nil)),
		tbl(c.t("bonus.byMonth"), c.t("periodic.period"), r.ByMonth), tbl(c.t("bonus.byAccount"), c.t("account"), r.ByAccount))
}

func tabLedger(c *rc, r ledgerReport) fyne.CanvasObject {
	body := container.NewStack()
	types := []string{"", "DEPOSIT", "WITHDRAWAL", "BONUS"}
	sel := widget.NewSelect([]string{c.t("ledger.allTypes"), c.t("type.deposit"), c.t("type.withdrawal"), c.t("type.bonus")}, nil)
	csvHolder := container.NewStack()
	render := func(typ string) {
		rows := ledgerFiltered(r.Rows, typ)
		count := r.Totals.Count
		if typ != "" {
			count = len(rows)
		}
		var cs [][]cell
		for _, l := range rows {
			net := cell{S: format.Dash}
			if !l.SignedNet.IsZero() {
				net = c.mc(l.SignedNet)
			}
			cs = append(cs, []cell{txt(format.Timestamp(l.At, format.DateTimeShort)), txt(l.AccountName), txt(c.t("type." + lower(l.Type))), plainMoney(c, l.Amount), net, c.mc(l.RunningNet)})
		}
		csvHolder.Objects = []fyne.CanvasObject{c.csvBtn(csvLedger(rows, c.cur))}
		csvHolder.Refresh()
		items := []fyne.CanvasObject{metrics(metric(c.t("transactions"), strconv.Itoa(count), nil), c.mt(c.t("net"), r.Totals.Net))}
		if r.Truncated {
			items = append(items, kit.Muted(c.t("ledger.truncated")+" ("+strconv.Itoa(r.Limit)+")"))
		}
		items = append(items, dataTable([]string{c.t("distribution.when"), c.t("account"), c.t("distribution.type"), c.t("distribution.amount"), c.t("net"), c.t("ledger.running")}, cs, 3))
		body.Objects = []fyne.CanvasObject{container.NewVBox(items...)}
		body.Refresh()
	}
	sel.OnChanged = func(string) { render(types[max(sel.SelectedIndex(), 0)]) }
	sel.SetSelectedIndex(0)
	return vbox(container.NewBorder(nil, nil, nil, csvHolder, sel), body)
}

func tabCadence(c *rc, r cadenceReport) fyne.CanvasObject {
	var rows [][]cell
	for _, a := range r.Rows {
		gap := format.Dash
		if a.LongestGapFrom != nil && a.LongestGapTo != nil {
			gap = *a.LongestGapFrom + " → " + *a.LongestGapTo
		}
		rows = append(rows, []cell{txt(a.AccountName), txt(strconv.Itoa(a.Transactions)), txt(dp(a.AverageGapDays)), txt(strconv.Itoa(a.LongestGapDays)), txt(gap), txt(dp(a.AvgDaysDepositToWithdraw))})
	}
	return vbox(container.NewBorder(nil, nil, nil, c.csvBtn(csvCadence(r, c.cur))), hint("cadence.hint", c),
		metrics(metric(c.t("cadence.avgGap"), dp(r.AverageGapDays), nil), metric(c.t("cadence.turnaround"), dp(r.AvgDaysDepositToWithdraw), nil)),
		dataTable([]string{c.t("account"), c.t("transactions"), c.t("cadence.avgGap"), c.t("cadence.longestGap"), c.t("cadence.gapBetween"), c.t("cadence.turnaround")}, rows, 1))
}

// meterCell is a share bar with its percentage text.
func meterCell(p *D, text string) fyne.CanvasObject {
	bar := widget.NewProgressBar()
	bar.TextFormatter = func() string { return text }
	if p != nil {
		bar.SetValue(clampPct(*p))
	}
	return bar
}

func tabAllocation(c *rc, r allocationReport) fyne.CanvasObject {
	var lvl fyne.CanvasObject = metric(c.t("allocation.level"), c.t("allocation."+lower(r.Concentration)), nil)
	switch r.Concentration {
	case "CONCENTRATED":
		lvl = metric(c.t("allocation.level"), c.t("allocation.concentrated"), kit.ColorRed)
	case "DIVERSIFIED":
		lvl = metric(c.t("allocation.level"), c.t("allocation.diversified"), kit.ColorBlue)
	}
	cols := []kit.Col[allocationRow]{
		{Title: c.t("account"), Weight: 1.5, Text: func(a allocationRow) string { return a.AccountName }},
		{Title: c.t("allocation.outstanding"), Align: fyne.TextAlignTrailing, Text: func(a allocationRow) string { return c.money(a.Outstanding) }},
		{Title: c.t("allocation.share"), Weight: 1.5, Cell: func(a allocationRow) fyne.CanvasObject {
			return meterCell(a.OutstandingSharePc, pct(a.OutstandingSharePc))
		}},
		{Title: c.t("deposits"), Align: fyne.TextAlignTrailing, Text: func(a allocationRow) string { return c.money(a.Deposits) }},
		{Title: c.t("allocation.depositShare"), Align: fyne.TextAlignTrailing, Text: func(a allocationRow) string { return pct(a.DepositSharePct) }},
		{Title: c.t("withdrawals"), Align: fyne.TextAlignTrailing, Text: func(a allocationRow) string { return c.money(a.Withdrawals) }},
	}
	t := kit.NewTable(cols)
	t.SetRows(r.Rows)
	return vbox(hint("allocation.hint", c), metrics(c.mt(c.t("allocation.outstanding"), r.TotalOutstanding), c.mt(c.t("deposits"), r.TotalDeposits),
		metric("HHI", dp(r.HHI), nil), lvl, metric(c.t("allocation.top"), pct(r.TopSharePct), nil)), t)
}

func outstandingCell(c *rc, d D) cell {
	if d.IsPositive() {
		return cell{S: c.money(d), C: kit.ColorRed}
	}
	return plainMoney(c, d)
}

func tabLots(c *rc, r lotsReport) fyne.CanvasObject {
	var mxOut D
	for _, a := range r.Aging {
		if a.Outstanding.GreaterThan(mxOut) {
			mxOut = a.Outstanding
		}
	}
	ag := container.NewGridWithColumns(max(len(r.Aging), 1))
	for _, a := range r.Aging {
		bar := widget.NewProgressBar()
		bar.TextFormatter = func() string { return "" }
		if mxOut.IsPositive() {
			bar.SetValue(a.Outstanding.Div(mxOut).InexactFloat64())
		}
		ag.Add(container.NewVBox(kit.Muted(a.Bucket+" "+c.t("lots.days")), kit.Heading(c.money(a.Outstanding)), bar, kit.Muted(strconv.Itoa(a.Lots)+" "+c.t("lots.lotsWord"))))
	}
	var rows [][]cell
	for _, l := range r.Lots {
		rows = append(rows, []cell{txt(l.AccountName), txt(l.DepositDate), plainMoney(c, l.Amount), plainMoney(c, l.Recovered), outstandingCell(c, l.Outstanding),
			txt(strp(l.RecoveredDate)), txt(intp(l.DaysToRecover)), txt(strconv.Itoa(l.AgeDays))})
	}
	out := vbox(container.NewBorder(nil, nil, nil, c.csvBtn(csvLots(r, c.cur))), hint("lots.hint", c),
		metrics(metric(c.t("lots.count"), fmt.Sprintf("%d (%d %s)", r.LotCount, r.RecoveredLots, c.t("lots.recoveredShort")), nil),
			metric(c.t("lots.avgDays"), dp(r.AverageDaysRecover), nil), c.mt(c.t("deposits"), r.TotalDeposited),
			metric(c.t("payback.recovered"), c.money(r.TotalRecovered), nil), metric(c.t("payback.outstanding"), c.money(r.Outstanding), outCol(r.Outstanding))),
		kit.Heading(c.t("lots.aging")), ag)
	box := out.(*fyne.Container)
	if r.Truncated {
		box.Add(hint("lots.truncated", c))
	}
	box.Add(dataTable([]string{c.t("account"), c.t("lots.depositDate"), c.t("distribution.amount"), c.t("payback.recovered"), c.t("payback.outstanding"),
		c.t("drawdowns.recovery"), c.t("payback.days"), c.t("lots.age")}, rows, 2))
	return out
}

func tabPayback(c *rc, r paybackReport) fyne.CanvasObject {
	cols := []kit.Col[paybackRow]{
		{Title: c.t("account"), Weight: 1.5, Text: func(p paybackRow) string { return p.AccountName }},
		{Title: c.t("deposits"), Align: fyne.TextAlignTrailing, Text: func(p paybackRow) string { return c.money(p.Deposits) }},
		{Title: c.t("withdrawals"), Align: fyne.TextAlignTrailing, Text: func(p paybackRow) string { return c.money(p.Withdrawals) }},
		{Title: c.t("payback.recovered"), Weight: 1.5, Cell: func(p paybackRow) fyne.CanvasObject { return meterCell(p.RecoveredPct, pct(p.RecoveredPct)) }},
		{Title: c.t("payback.outstanding"), Align: fyne.TextAlignTrailing, Cell: func(p paybackRow) fyne.CanvasObject {
			x := outstandingCell(c, p.Outstanding)
			if !p.Outstanding.IsPositive() {
				x.C = kit.ColorBlue
			}
			return cellObj(x, true)
		}},
		{Title: c.t("payback.breakEvenDate"), Align: fyne.TextAlignTrailing, Text: func(p paybackRow) string { return strp(p.BreakEvenDate) }},
		{Title: c.t("payback.days"), Align: fyne.TextAlignTrailing, Text: func(p paybackRow) string { return intp(p.DaysToBreakEven) }},
	}
	t := kit.NewTable(cols)
	t.SetRows(r.Rows)
	out := metric(c.t("payback.outstanding"), c.money(r.Outstanding), kit.ColorBlue)
	if r.Outstanding.IsPositive() {
		out = metric(c.t("payback.outstanding"), c.money(r.Outstanding), kit.ColorRed)
	}
	return vbox(container.NewBorder(nil, nil, nil, c.csvBtn(csvPayback(r, c.cur))), hint("payback.hint", c),
		metrics(c.mt(c.t("deposits"), r.Deposits), c.mt(c.t("withdrawals"), r.Withdrawals), metric(c.t("payback.recovered"), pct(r.RecoveredPct), nil), out,
			metric(c.t("payback.brokeEven"), strconv.Itoa(r.AccountsBrokeEven), nil), metric(c.t("payback.stillOut"), strconv.Itoa(r.AccountsOutstand), nil)), t)
}

func monthName(m int) string {
	if i18n.Lang() == "vi" {
		return "Thg " + strconv.Itoa(m)
	}
	return time.Month(m).String()[:3]
}

func tabSeasonality(c *rc, r seasonalityReport) fyne.CanvasObject {
	bw := func(k string, m *seasonMonth) fyne.CanvasObject {
		if m == nil {
			return metric(c.t(k), format.Dash, nil)
		}
		return metric(c.t(k), monthName(m.Month)+" · "+c.money(m.AverageNet), sign(m.AverageNet))
	}
	labels, vals := make([]string, len(r.Months)), make([]D, len(r.Months))
	var rows [][]cell
	for i, m := range r.Months {
		labels[i], vals[i] = monthName(m.Month), m.AverageNet
		rows = append(rows, []cell{txt(monthName(m.Month)), txt(strconv.Itoa(m.Occurrences)), txt(strconv.Itoa(m.WinningOccurrences)), txt(strconv.Itoa(m.Count)),
			plainMoney(c, m.TotalNet), c.mc(m.AverageNet)})
	}
	return vbox(container.NewBorder(nil, nil, nil, c.csvBtn(csvSeasonality(r, c.cur))), hint("seasonality.hint", c),
		metrics(bw("seasonality.best", r.Best), bw("seasonality.worst", r.Worst)),
		signedBars(labels, vals, func(i int) string { return labels[i] + " · " + c.money(vals[i]) }),
		dataTable([]string{c.t("seasonality.month"), c.t("seasonality.occurrences"), c.t("seasonality.winning"), c.t("transactions"), c.t("seasonality.total"), c.t("seasonality.average")}, rows, 1))
}

func tabProjection(c *rc, r projectionReport) fyne.CanvasObject {
	out := vbox(kit.Muted(c.t("projection.asOf")+": "+r.AsOf), hint("projection.hint", c))
	box := out.(*fyne.Container)
	if r.ObservedDays < 30 {
		w := widget.NewLabel(c.t("projection.shortRange") + " (" + strconv.Itoa(r.ObservedDays) + "/30)")
		w.Importance = widget.WarningImportance
		box.Add(w)
	}
	box.Add(metrics(c.mt(c.t("projection.mtd"), r.MonthToDateNet),
		metric(c.t("projection.days"), fmt.Sprintf("%d / %d", r.DaysElapsed, r.DaysElapsed+r.DaysRemaining), nil),
		metric(c.t("projection.runRate"), c.money(r.DailyRunRate30), nil), c.mt(c.t("projection.monthEnd"), r.ProjectedMonthEnd),
		metric(c.t("projection.next30"), c.money(r.ProjectedNext30), nil), metric(c.t("projection.year"), c.money(r.ProjectedYear), nil),
		metric(c.t("projection.trailing30"), c.money(r.Trailing30), nil), metric(c.t("projection.trailing90"), c.money(r.Trailing90), nil)))
	return out
}

func tabComparison(c *rc, r comparisonReport) fyne.CanvasObject {
	var rows [][]cell
	for _, d := range r.Deltas {
		f := c.money
		if d.Metric == "COUNT" {
			f = func(x D) string { return format.Num(x, 0) }
		}
		rows = append(rows, []cell{txt(c.t("metric." + lower(d.Metric))), txt(f(d.Current)), txt(f(d.Previous)),
			{S: f(d.Change), C: sign(d.Change)}, txt(pct(d.ChangePct))})
	}
	return vbox(kit.Muted(c.t("comparison.previous")+": "+r.PreviousFrom+" – "+r.PreviousTo),
		dataTable([]string{c.t("comparison.metric"), c.t("comparison.current"), c.t("comparison.previousPeriod"), c.t("periodic.change"), "%"}, rows, 1))
}

// outCol is red while money is still outstanding.
func outCol(d D) color.Color {
	if d.IsPositive() {
		return kit.ColorRed
	}
	return nil
}
