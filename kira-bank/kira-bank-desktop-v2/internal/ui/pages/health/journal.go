package health

import (
	"context"
	"net/url"
	"strconv"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

func (h *view) journalSection() fyne.CanvasObject {
	ed := h.editJournal
	cur := journal{Date: h.date, Version: -1, Data: journalData{Kind: "MEAL"}}
	if ed != nil {
		cur = *ed
	}
	form := kit.NewForm([]kit.Field{
		{Key: "date", Label: i18n.T("health.date"), Kind: kit.KindDate, Required: true, Initial: cur.Date},
		{Key: "kind", Label: i18n.T("health.kind"), Kind: kit.KindSelect, Required: true, Options: opt("health.", "MEAL", "WORKOUT"), Initial: cur.Data.Kind},
		{Key: "title", Label: i18n.T("health.title"), Required: true, MaxLen: 200, Initial: cur.Data.Title},
		{Key: "calories", Label: i18n.T("health.calories"), Kind: kit.KindNumber, Required: true, Min: kit.Dec("0"), Max: kit.Dec("10000"),
			Validate: intOnly, Initial: decimal.NewFromInt(int64(cur.Data.Calories))},
		{Key: "minutes", Label: i18n.T("health.minutes"), Kind: kit.KindNumber, Required: true, Min: kit.Dec("0"), Max: kit.Dec("1440"),
			Validate: intOnly, Initial: decimal.NewFromInt(int64(cur.Data.Minutes))},
		{Key: "notes", Label: i18n.T("health.notes"), Kind: kit.KindTextArea, MaxLen: 2000, Initial: cur.Data.Notes},
	})
	save := widget.NewButton(i18n.T("health.save"), func() {
		v, ok := form.Values()
		if !ok {
			return
		}
		s := func(k string) string { x, _ := v[k].(string); return x }
		n := func(k string) int { d, _ := v[k].(decimal.Decimal); return int(d.IntPart()) }
		body := map[string]any{"date": s("date"), "version": cur.Version, "data": journalData{
			Kind: s("kind"), Title: s("title"), Calories: n("calories"), Minutes: n("minutes"), Notes: s("notes")}}
		h.mutate(func(ctx context.Context) error {
			if cur.ID == "" {
				return h.env.API.Post(ctx, "health/journals", body, nil)
			}
			return h.env.API.Put(ctx, "health/journals/"+url.PathEscape(cur.ID), body, nil)
		}, func() bool { h.editJournal = nil; return true })
	})
	save.Importance = widget.HighImportance
	cancel := widget.NewButton(i18n.T("health.cancel"), func() { h.editJournal = nil; h.render() })

	list := container.NewVBox()
	for _, j := range h.data.journals {
		j := j
		edit := widget.NewButtonWithIcon(i18n.T("health.edit"), theme.DocumentCreateIcon(), func() { h.editJournal = &j; h.render() })
		del := widget.NewButtonWithIcon(i18n.T("health.delete"), theme.DeleteIcon(), func() {
			h.env.Confirm(i18n.T("health.deleteConfirm"), func() {
				h.mutate(func(ctx context.Context) error {
					return h.env.API.Delete(ctx, "health/journals/"+url.PathEscape(j.ID), url.Values{"version": {strconv.FormatInt(j.Version, 10)}})
				}, nil)
			})
		})
		row := container.NewVBox(container.NewHBox(
			widget.NewLabelWithStyle(i18n.T("health."+j.Data.Kind)+" · "+format.DateOnly(j.Date, format.DateDMY), fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
			widget.NewLabel(j.Data.Title), widget.NewLabel(strconv.Itoa(j.Data.Calories)+" kcal"), edit, del))
		if j.Data.Notes != "" {
			row.Add(kit.Muted(j.Data.Notes))
		}
		list.Add(row)
	}
	if len(h.data.journals) == 0 {
		list.Add(kit.Muted(i18n.T("health.noData")))
	}
	date := container.NewVBox(widget.NewLabel(i18n.T("health.date")),
		dateEntry(h.date, func(n string) { h.date = n; h.editJournal = nil; h.reload() }), kit.Muted(i18n.T("health.journalHelp")))
	return container.NewVBox(date, kit.Card(i18n.T("health.logActual"), "", container.NewVBox(form.Content(), container.NewHBox(save, cancel))), list)
}

func (h *view) connectionSection() fyne.CanvasObject {
	box := container.NewVBox(kit.Heading(i18n.T("health.connectTitle")), kit.Muted(i18n.T("health.connectHelp")),
		widget.NewLabel("1. "+i18n.T("health.connectStep1")), widget.NewLabel("2. "+i18n.T("health.connectStep2")),
		widget.NewLabel("3. "+i18n.T("health.connectStep3")),
		kit.Muted(i18n.T("health.backgroundHelp")), kit.Muted(i18n.T("health.timezoneHelp")), kit.Sep())
	c := h.data.conn
	if c == nil {
		box.Add(kit.Badge(i18n.T("health.disconnected"), widget.LowImportance))
		return box
	}
	last := i18n.T("health.notSynced")
	if c.LastSyncedAt != nil {
		last = format.Timestamp(*c.LastSyncedAt, format.DateTimeShort)
	}
	disconnect := func(erase bool, confirm string) func() {
		return func() {
			h.env.Confirm(i18n.T(confirm), func() {
				h.mutate(func(ctx context.Context) error {
					return h.env.API.Delete(ctx, "health/connection", url.Values{"deleteData": {strconv.FormatBool(erase)}})
				}, nil)
			})
		}
	}
	erase := widget.NewButton(i18n.T("health.erase"), disconnect(true, "health.eraseConfirm"))
	erase.Importance = widget.DangerImportance
	box.Add(kit.Badge(i18n.T("health.connected"), widget.SuccessImportance))
	box.Add(widget.NewLabel(i18n.T("health.lastSync") + ": " + last))
	box.Add(widget.NewLabel(i18n.T("health.timezone") + ": " + c.Timezone))
	box.Add(container.NewHBox(widget.NewButton(i18n.T("health.disconnect"), disconnect(false, "health.disconnectConfirm")), erase))
	return box
}
