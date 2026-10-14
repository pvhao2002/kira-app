package health

import (
	"context"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

const maxItems = 100

var kinds = []string{"MEAL", "WORKOUT", "REST"}

// itemRow is one editable plan item.
type itemRow struct {
	date               *widget.DateEntry
	kind               *widget.Select
	title, portion     *widget.Entry
	notes, cal, minute *widget.Entry
	completed          bool
	box                fyne.CanvasObject
}

func newItemRow(it planItem, onRemove func(*itemRow)) *itemRow {
	r := &itemRow{date: kit.NewDateEntry(), title: widget.NewEntry(), portion: widget.NewEntry(),
		notes: widget.NewEntry(), cal: widget.NewEntry(), minute: widget.NewEntry(), completed: it.Completed}
	if t, err := time.ParseInLocation(day, it.Date, time.Local); err == nil {
		r.date.SetDate(&t)
	}
	var labels []string
	for _, k := range kinds {
		labels = append(labels, i18n.T("health."+k))
	}
	r.kind = widget.NewSelect(labels, nil)
	r.kind.SetSelected(i18n.T("health." + it.Kind))
	r.title.SetText(it.Title)
	r.portion.SetText(it.Portion)
	r.notes.SetText(it.Notes)
	r.cal.SetText(strconv.Itoa(it.Calories))
	r.minute.SetText(strconv.Itoa(it.Minutes))
	rm := widget.NewButtonWithIcon(i18n.T("health.remove"), theme.DeleteIcon(), func() { onRemove(r) })
	r.box = container.NewVBox(
		container.NewGridWithColumns(2, r.date, r.kind),
		container.NewGridWithColumns(2,
			container.NewVBox(widget.NewLabel(i18n.T("health.title")), r.title),
			container.NewVBox(widget.NewLabel(i18n.T("health.portion")), r.portion)),
		container.NewGridWithColumns(2,
			container.NewVBox(widget.NewLabel(i18n.T("health.estimatedCalories")), r.cal),
			container.NewVBox(widget.NewLabel(i18n.T("health.minutes")), r.minute)),
		widget.NewLabel(i18n.T("health.notes")), r.notes, rm, widget.NewSeparator())
	return r
}

// read validates and returns the item; msg is a translated error ("" = ok).
func (r *itemRow) read(week string) (planItem, string) {
	it := planItem{Title: strings.TrimSpace(r.title.Text), Portion: strings.TrimSpace(r.portion.Text),
		Notes: strings.TrimSpace(r.notes.Text), Completed: r.completed}
	for i, k := range kinds {
		if i18n.T("health."+k) == r.kind.Selected {
			it.Kind = kinds[i]
		}
	}
	if r.date.Date != nil {
		it.Date = r.date.Date.Format(day)
	}
	var err1, err2 error
	it.Calories, err1 = strconv.Atoi(strings.TrimSpace(r.cal.Text))
	it.Minutes, err2 = strconv.Atoi(strings.TrimSpace(r.minute.Text))
	switch {
	case it.Kind == "" || it.Date == "":
		return it, i18n.T("form.required")
	case !inWeek(it.Date, week):
		return it, i18n.T("health.error.HEALTH_AI_DATE_INVALID")
	case err1 != nil || it.Calories < 0 || it.Calories > 10000:
		return it, i18n.T("form.invalidValue")
	case err2 != nil || it.Minutes < 0 || it.Minutes > 1440:
		return it, i18n.T("form.invalidValue")
	case utf8.RuneCountInString(it.Title) > 200 || utf8.RuneCountInString(it.Portion) > 1000 || utf8.RuneCountInString(it.Notes) > 2000:
		return it, i18n.T("form.invalidValue")
	}
	return it, ""
}

// inWeek reports whether date lies within the seven days starting at week (both yyyy-MM-dd).
func inWeek(date, week string) bool {
	d, err1 := time.Parse(day, date)
	w, err2 := time.Parse(day, week)
	return err1 == nil && err2 == nil && !d.Before(w) && !d.After(w.AddDate(0, 0, 6))
}

func (h *view) plansSection() fyne.CanvasObject {
	weekPicker := container.NewVBox(widget.NewLabel(i18n.T("health.week")), dateEntry(h.week, func(n string) {
		if t, err := time.Parse(day, n); err == nil {
			h.week = mondayOf(t).Format(day)
			h.editPlan = nil
			h.reload()
		}
	}))
	newPlan := widget.NewButton(i18n.T("health.newPlan"), func() {
		h.editPlan = &plan{WeekStart: h.week, Version: -1, Data: planData{Items: []planItem{blankItem(h.week)}}}
		h.render()
	})
	if h.data.profile == nil {
		newPlan.Disable()
	}
	box := container.NewVBox(container.NewBorder(nil, nil, nil, newPlan, weekPicker), h.aiPanel())
	if h.editPlan != nil {
		box.Add(h.editor())
	}
	if len(h.data.plans) == 0 {
		box.Add(kit.Muted(i18n.T("health.noPlans")))
	}
	for _, p := range h.data.plans {
		box.Add(h.planCard(p))
	}
	return box
}

func blankItem(week string) planItem { return planItem{Date: week, Kind: "MEAL"} }

func (h *view) aiPanel() fyne.CanvasObject {
	from := time.Now().Format(day)
	if from < h.week {
		from = h.week
	}
	if end := addDays(h.week, 6); from > end {
		from = end
	}
	week := h.week
	form := kit.NewForm([]kit.Field{
		{Key: "fromDate", Label: i18n.T("health.fromDate"), Kind: kit.KindDate, Required: true, Initial: from,
			Validate: func(v any) string {
				if s, _ := v.(string); !inWeek(s, week) {
					return i18n.T("health.error.HEALTH_AI_DATE_INVALID")
				}
				return ""
			}},
		{Key: "consent", Label: i18n.T("health.aiConsent"), Kind: kit.KindCheckbox, Validate: func(v any) string {
			if b, _ := v.(bool); !b {
				return i18n.T("form.required")
			}
			return ""
		}},
	})
	gen := widget.NewButton(i18n.T("health.generate"), func() {
		v, ok := form.Values()
		if !ok {
			return
		}
		body := map[string]any{"weekStart": week, "fromDate": v["fromDate"], "language": i18n.Lang(), "consent": true}
		var job aiJob
		h.mutate(func(ctx context.Context) error { return h.env.API.Post(ctx, "health/ai-jobs", body, &job) }, func() bool {
			if job.Status == "FAILED" {
				code := ""
				if job.ErrorCode != nil {
					code = *job.ErrorCode
				}
				k := "health.error." + code
				if !i18n.Has(k) {
					k = "health.failed"
				}
				h.errLbl.SetText(i18n.T(k))
				h.errLbl.Show()
				return false
			}
			return true
		})
	})
	gen.Importance = widget.HighImportance
	if h.data.profile == nil {
		gen.Disable()
	}
	jobs := container.NewVBox()
	for _, j := range h.data.jobs {
		line := i18n.T("health." + j.Status)
		if j.ErrorCode != nil && *j.ErrorCode != "" {
			line += " · " + i18n.T("health.aiFailed")
		}
		jobs.Add(kit.Muted(line))
	}
	return kit.Card(i18n.T("health.aiTitle"), i18n.T("health.aiHelp"), container.NewVBox(form.Content(), gen, jobs))
}

func addDays(s string, n int) string {
	t, err := time.Parse(day, s)
	if err != nil {
		return s
	}
	return t.AddDate(0, 0, n).Format(day)
}

// editor edits h.editPlan (a draft, a copy of a non-draft, or a new plan).
func (h *view) editor() fyne.CanvasObject {
	p := h.editPlan
	title := widget.NewEntry()
	title.SetText(p.Data.Title)
	list := container.NewVBox()
	var rows []*itemRow
	var errLbl *widget.Label
	redraw := func() {
		list.Objects = nil
		for _, r := range rows {
			list.Add(r.box)
		}
		list.Refresh()
	}
	var add func(planItem)
	remove := func(r *itemRow) {
		for i := range rows {
			if rows[i] == r {
				rows = append(rows[:i], rows[i+1:]...)
				break
			}
		}
		redraw()
	}
	add = func(it planItem) { rows = append(rows, newItemRow(it, remove)) }
	for _, it := range p.Data.Items {
		add(it)
	}
	redraw()
	errLbl = widget.NewLabel("")
	errLbl.Importance = widget.DangerImportance
	errLbl.Hide()

	addBtn := widget.NewButtonWithIcon(i18n.T("health.addItem"), theme.ContentAddIcon(), func() {
		if len(rows) < maxItems {
			add(blankItem(p.WeekStart))
			redraw()
		}
	})
	save := widget.NewButton(i18n.T("health.saveDraft"), func() {
		errLbl.Hide()
		fail := func(m string) { errLbl.SetText(m); errLbl.Show() }
		if utf8.RuneCountInString(title.Text) > 200 {
			fail(i18n.T("form.maxLength", i18n.P{"value": 200}))
			return
		}
		if len(rows) == 0 {
			fail(i18n.T("form.required"))
			return
		}
		items := make([]planItem, 0, len(rows))
		for _, r := range rows {
			it, msg := r.read(p.WeekStart)
			if msg != "" {
				fail(msg)
				return
			}
			items = append(items, it)
		}
		body := map[string]any{"weekStart": p.WeekStart, "version": p.Version,
			"data": planData{Title: strings.TrimSpace(title.Text), Items: items, Warnings: p.Data.Warnings}}
		h.mutate(func(ctx context.Context) error {
			if p.ID == "" {
				return h.env.API.Post(ctx, "health/plans", body, nil)
			}
			return h.env.API.Put(ctx, "health/plans/"+p.ID, body, nil)
		}, func() bool { h.editPlan = nil; return true })
	})
	save.Importance = widget.HighImportance
	cancel := widget.NewButton(i18n.T("health.cancel"), func() { h.editPlan = nil; h.render() })
	return kit.Card(i18n.T("health.editDraft"), "", container.NewVBox(
		widget.NewLabel(i18n.T("health.title")), title, list, addBtn, errLbl, container.NewHBox(save, cancel)))
}

func (h *view) planCard(p plan) fyne.CanvasObject {
	box := container.NewVBox(kit.Badge(i18n.T("health."+p.Status), widget.MediumImportance))
	for _, w := range p.Data.Warnings {
		box.Add(widget.NewLabelWithStyle(w, fyne.TextAlignLeading, fyne.TextStyle{Italic: true}))
	}
	for i, it := range p.Data.Items {
		i, it := i, it
		line := container.NewVBox(
			widget.NewLabelWithStyle(format.DateOnly(it.Date, format.DateDMY)+" · "+i18n.T("health."+it.Kind)+" · "+it.Title, fyne.TextAlignLeading, fyne.TextStyle{Bold: true}))
		if it.Portion != "" {
			line.Add(kit.Muted(it.Portion))
		}
		if it.Notes != "" {
			line.Add(kit.Muted(it.Notes))
		}
		line.Add(kit.Muted(strconv.Itoa(it.Calories) + " kcal · " + i18n.T("health.estimated") + " · " + strconv.Itoa(it.Minutes) + " " + i18n.T("health.minutes")))
		if p.Status == "ACTIVE" {
			label := i18n.T("health.complete")
			if it.Completed {
				label = i18n.T("health.undoComplete")
			}
			line.Add(widget.NewButton(label, func() {
				h.mutate(func(ctx context.Context) error {
					return h.env.API.Do(ctx, "PUT", "health/plans/"+p.ID+"/items/"+strconv.Itoa(i)+"/completion",
						q("version", strconv.FormatInt(p.Version, 10), "completed", strconv.FormatBool(!it.Completed)), map[string]any{}, nil)
				}, nil)
			}))
		}
		box.Add(line)
	}
	if p.Status == "DRAFT" {
		approve := widget.NewButton(i18n.T("health.approve"), func() {
			h.env.Confirm(i18n.T("health.approveConfirm"), func() {
				body := map[string]any{"version": p.Version, "restrictionsReviewed": true}
				h.mutate(func(ctx context.Context) error {
					return h.env.API.Post(ctx, "health/plans/"+p.ID+"/approve", body, nil)
				}, nil)
			})
		})
		approve.Disable()
		review := widget.NewCheck(i18n.T("health.reviewConfirm"), func(on bool) {
			if on {
				approve.Enable()
			} else {
				approve.Disable()
			}
		})
		box.Add(review)
		box.Add(approve)
	}
	editLabel, copyPlan := i18n.T("health.editDraft"), p
	if p.Status != "DRAFT" {
		editLabel = i18n.T("health.copyDraft")
		copyPlan.ID, copyPlan.Version = "", -1 // a copy is saved as a new draft
	}
	box.Add(widget.NewButton(editLabel, func() { h.editPlan = &copyPlan; h.render() }))
	return kit.Card(p.Data.Title, "", box)
}
