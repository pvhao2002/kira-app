package health

import (
	"net/url"
	"strconv"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

// q builds url.Values from key, value pairs.
func q(kv ...string) url.Values {
	v := url.Values{}
	for i := 0; i+1 < len(kv); i += 2 {
		v.Set(kv[i], kv[i+1])
	}
	return v
}

// dateEntry returns a date picker preset to s; onChange gets the new yyyy-MM-dd
// only when it differs from s.
func dateEntry(s string, onChange func(string)) *widget.DateEntry {
	d := kit.NewDateEntry()
	if t, err := time.ParseInLocation(day, s, time.Local); err == nil {
		d.SetDate(&t)
	}
	d.OnChanged = func(t *time.Time) {
		if t == nil {
			return
		}
		if n := t.Format(day); n != s {
			onChange(n)
		}
	}
	return d
}

func tile(caption, value, help string) fyne.CanvasObject {
	box := container.NewVBox(kit.Tile(caption, value))
	if help != "" {
		box.Add(kit.Muted(help))
	}
	return box
}

func kcal(v *float64) string {
	if v == nil {
		return format.Dash
	}
	return num(*v) + " kcal"
}

func (h *view) overview() fyne.CanvasObject {
	s := h.data.summary
	date := container.NewVBox(widget.NewLabel(i18n.T("health.date")),
		dateEntry(h.date, func(n string) { h.date = n; h.reload() }), kit.Muted(i18n.T("health.provisionalHelp")))
	if s == nil {
		return container.NewVBox(date, kit.Muted(i18n.T("health.noData")))
	}
	target := kcal(s.TargetCalories)
	tiles := container.NewGridWithColumns(4,
		tile(i18n.T("health.target"), target, targetHelp(s.TargetSource)),
		tile(i18n.T("health.eaten"), num(s.EatenCalories)+" kcal", i18n.T("health.journalOnly")),
		tile(i18n.T("health.activeCalories"), kcal(s.ActiveCalories), "Apple Health"),
		tile(i18n.T("health.totalBurned"), kcal(s.TotalBurned), i18n.T("health.totalHelp")),
		tile("BMI", val(s.BMI), i18n.T("health.bmiHelp")),
		tile(i18n.T("health.restingEstimate"), kcal(s.RestingEstimate), "Mifflin–St Jeor"),
		tile(i18n.T("health.restingCalories"), kcal(s.RestingCalories), "Apple Health"),
		tile(i18n.T("health.netCalories"), kcal(s.NetCalories), i18n.T("health.netHelp")))

	week := kit.NewTable([]kit.Col[summary]{
		{Title: i18n.T("health.date"), Text: func(r summary) string { return format.DateOnly(r.Date, format.DateDMY) }},
		{Title: i18n.T("health.eaten"), Text: func(r summary) string { return num(r.EatenCalories) }},
		{Title: i18n.T("health.target"), Text: func(r summary) string { return val(r.TargetCalories) }},
		{Title: i18n.T("health.totalBurned"), Text: func(r summary) string { return val(r.TotalBurned) }},
		{Title: i18n.T("health.steps"), Text: func(r summary) string {
			if r.Steps == nil {
				return format.Dash
			}
			return strconv.FormatInt(*r.Steps, 10)
		}},
	})
	week.SetEmpty(i18n.T("health.noData"))
	week.SetRows(h.data.stats)

	workouts := container.NewVBox(kit.Heading(i18n.T("health.watchWorkouts")), kit.Muted(i18n.T("health.noDoubleCount")))
	for _, w := range s.Workouts {
		start := format.Timestamp(w.Start, format.DateTimeShort)
		workouts.Add(container.NewHBox(widget.NewLabel(w.Type+" · "+start), kit.Muted(w.Source), widget.NewLabel(kcal(w.Calories))))
	}
	if len(s.Workouts) == 0 {
		workouts.Add(kit.Muted(i18n.T("health.noData")))
	}
	return container.NewVBox(date, tiles, kit.Sep(), kit.Heading(i18n.T("health.lastSevenDays")), week, kit.Sep(), workouts)
}

func targetHelp(src string) string {
	if src == "" {
		return ""
	}
	return i18n.T("health." + src)
}
