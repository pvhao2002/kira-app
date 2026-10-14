// Package health is the personal health module (/app/health/*): overview,
// profile & weight, plans, journal and the Apple Health connection.
package health

import (
	"context"
	"sync"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

var sections = []string{"overview", "profile", "plans", "journal", "connection"}

// Pages registers one page per section (sidebar group "health.overview") plus a
// hidden /app/health alias for the overview.
func Pages(env *kit.Env) []kit.Page {
	var out []kit.Page
	for i, s := range sections {
		s := s
		out = append(out, kit.Page{ID: "/app/health/" + s, Group: "health.overview", TitleKey: "health." + s,
			MenuKey: "health." + s, Order: (i + 1) * 10, Icon: theme.VisibilityIcon(),
			Build: func() fyne.CanvasObject { return build(env, s) }})
	}
	out = append(out, kit.Page{ID: "/app/health", TitleKey: "health.overview", Hidden: true,
		Build: func() fyne.CanvasObject { return build(env, "overview") }})
	return out
}

// data is what a section needs; only the fields of the open section are filled.
type data struct {
	profile  *profileResp
	weights  []weight
	summary  *summary
	stats    []summary
	conn     *connection
	plans    []plan
	jobs     []aiJob
	journals []journal
}

type view struct {
	env     *kit.Env
	section string
	date    string // overview + journal date
	week    string // Monday of the plans week
	data    data

	saving, loading bool
	seq             int
	body            *fyne.Container
	errLbl, notice  *widget.Label
	bar             *widget.ProgressBarInfinite
	refresh         *widget.Button

	editPlan    *plan // plan being edited (copy when not a draft); nil = none
	editJournal *journal
}

func build(env *kit.Env, section string) fyne.CanvasObject {
	h := &view{env: env, section: section, date: time.Now().Format(day),
		week: mondayOf(time.Now()).Format(day), body: container.NewVBox(),
		errLbl: widget.NewLabel(""), notice: widget.NewLabel(""), bar: widget.NewProgressBarInfinite()}
	h.errLbl.Importance = widget.DangerImportance
	h.errLbl.Wrapping = fyne.TextWrapWord
	h.errLbl.Hide()
	h.notice.Importance = widget.SuccessImportance
	h.notice.Hide()
	h.bar.Hide()
	h.refresh = widget.NewButtonWithIcon(i18n.T("health.refresh"), theme.ViewRefreshIcon(), h.reload)
	head := container.NewVBox(
		kit.PageHeader("KIRA LIFE", i18n.T("health."+section), i18n.T("health.subtitle"), h.refresh),
		h.errLbl, h.notice, h.bar)
	h.reload()
	return container.NewBorder(head, nil, nil, nil, container.NewVScroll(h.body))
}

func (h *view) setBusy() {
	if h.loading || h.saving {
		h.refresh.Disable()
	} else {
		h.refresh.Enable()
	}
}

func (h *view) showErr(err error) {
	h.errLbl.SetText(i18n.T(errKey(err)))
	h.errLbl.Show()
}

func (h *view) clearMsgs() {
	h.errLbl.Hide()
	h.notice.Hide()
}

// fetch loads what the current section needs, in parallel.
func (h *view) fetch(ctx context.Context) (data, error) {
	var d data
	var wg sync.WaitGroup
	var mu sync.Mutex
	var first error
	run := func(f func() error) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := f(); err != nil {
				mu.Lock()
				if first == nil {
					first = err
				}
				mu.Unlock()
			}
		}()
	}
	get := h.env.API.Get
	run(func() error { return get(ctx, "health/profile", nil, &d.profile) })
	switch h.section {
	case "overview":
		from := time.Now().Format(day)
		if t, err := time.Parse(day, h.date); err == nil {
			from = t.AddDate(0, 0, -6).Format(day)
		}
		run(func() error { return get(ctx, "health/summary", q("date", h.date), &d.summary) })
		run(func() error { return get(ctx, "health/statistics", q("from", from, "to", h.date), &d.stats) })
	case "profile":
		run(func() error { return get(ctx, "health/weights", nil, &d.weights) })
	case "plans":
		run(func() error { return get(ctx, "health/plans", q("weekStart", h.week), &d.plans) })
		run(func() error { return get(ctx, "health/ai-jobs", nil, &d.jobs) })
	case "journal":
		run(func() error { return get(ctx, "health/journals", q("from", h.date, "to", h.date), &d.journals) })
	case "connection":
		run(func() error { return get(ctx, "health/connection", nil, &d.conn) })
	}
	wg.Wait()
	return d, first
}

func (h *view) reload() {
	h.seq++
	seq := h.seq
	h.loading = true
	h.bar.Show()
	h.setBusy()
	kit.Async(h.fetch, func(d data, err error) {
		if seq != h.seq {
			return
		}
		h.loading = false
		h.bar.Hide()
		h.setBusy()
		if err != nil {
			h.showErr(err)
			return
		}
		h.data = d
		h.render()
	})
}

func (h *view) render() {
	var content fyne.CanvasObject
	switch {
	case h.data.profile == nil && h.section != "profile":
		content = container.NewVBox(kit.Heading(i18n.T("health.setup")), kit.Muted(i18n.T("health.setupHelp")),
			widget.NewButton(i18n.T("health.profile"), func() { h.env.Navigate("/app/health/profile", nil) }))
	case h.section == "overview":
		content = h.overview()
	case h.section == "profile":
		content = h.profileSection()
	case h.section == "plans":
		content = h.plansSection()
	case h.section == "journal":
		content = h.journalSection()
	default:
		content = h.connectionSection()
	}
	h.body.Objects = []fyne.CanvasObject{content}
	h.body.Refresh()
}

// mutate runs a write once at a time, then reports success and reloads.
// after (optional) runs on success and may return false to suppress the notice.
func (h *view) mutate(work func(ctx context.Context) error, after func() bool) {
	if h.saving {
		return
	}
	h.saving = true
	h.clearMsgs()
	h.setBusy()
	kit.Async(func(ctx context.Context) (struct{}, error) { return struct{}{}, work(ctx) }, func(_ struct{}, err error) {
		h.saving = false
		h.setBusy()
		if err != nil {
			h.showErr(err)
			return
		}
		if after == nil || after() {
			h.notice.SetText(i18n.T("health.saved"))
			h.notice.Show()
		}
		h.reload()
	})
}
