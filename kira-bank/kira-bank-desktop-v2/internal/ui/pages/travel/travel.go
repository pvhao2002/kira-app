// Package travel is the trip planner (/app/travel). A trip is one JSON blob
// (`data`) saved whole with PUT {data, version}; settlement is computed by the server.
package travel

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type member struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	X    extras `json:"-"`
}

type activity struct {
	ID       string `json:"id"`
	Date     string `json:"date"`
	Time     string `json:"time"`
	Title    string `json:"title"`
	Location string `json:"location"`
	Notes    string `json:"notes"`
	X        extras `json:"-"`
}

type packing struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Category string `json:"category"`
	Quantity int    `json:"quantity"`
	Packed   bool   `json:"packed"`
	X        extras `json:"-"`
}

type expense struct {
	ID           string          `json:"id"`
	Title        string          `json:"title"`
	Date         string          `json:"date"`
	Amount       decimal.Decimal `json:"amount"`
	PaidBy       string          `json:"paidBy"`
	Participants []string        `json:"participants"`
	X            extras          `json:"-"`
}

type booking struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Type      string `json:"type"`
	Reference string `json:"reference"`
	Date      string `json:"date"`
	Notes     string `json:"notes"`
	URL       string `json:"url"`
	X         extras `json:"-"`
}

type place struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Address   string  `json:"address"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Notes     string  `json:"notes"`
	Visited   bool    `json:"visited"`
	X         extras  `json:"-"`
}

type data struct {
	Name        string          `json:"name"`
	Destination string          `json:"destination"`
	StartDate   string          `json:"startDate"`
	EndDate     string          `json:"endDate"`
	Timezone    string          `json:"timezone"`
	Currency    string          `json:"currency"`
	Budget      decimal.Decimal `json:"budget"`
	Notes       string          `json:"notes"`
	Members     []member        `json:"members"`
	Activities  []activity      `json:"activities"`
	Packing     []packing       `json:"packing"`
	Expenses    []expense       `json:"expenses"`
	Bookings    []booking       `json:"bookings"`
	Places      []place         `json:"places"`
	X           extras          `json:"-"`
}

// clone deep-copies via JSON and makes every list non-nil (the server rejects null lists).
func (d data) clone() data {
	b, _ := json.Marshal(d)
	var c data
	_ = json.Unmarshal(b, &c)
	if c.Members == nil {
		c.Members = []member{}
	}
	if c.Activities == nil {
		c.Activities = []activity{}
	}
	if c.Packing == nil {
		c.Packing = []packing{}
	}
	if c.Expenses == nil {
		c.Expenses = []expense{}
	}
	if c.Bookings == nil {
		c.Bookings = []booking{}
	}
	if c.Places == nil {
		c.Places = []place{}
	}
	return c
}

type summary struct {
	Total    decimal.Decimal `json:"total"`
	Balances []struct {
		MemberID string          `json:"memberId"`
		Paid     decimal.Decimal `json:"paid"`
		Share    decimal.Decimal `json:"share"`
		Net      decimal.Decimal `json:"net"`
	} `json:"balances"`
	Transfers []struct {
		From   string          `json:"from"`
		To     string          `json:"to"`
		Amount decimal.Decimal `json:"amount"`
	} `json:"transfers"`
}

type trip struct {
	ID      string  `json:"id"`
	Version int64   `json:"version"`
	Data    data    `json:"data"`
	Summary summary `json:"summary"`
}

type tfile struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
}

const (
	maxActivities = 500
	maxPacking    = 500
	maxExpenses   = 1000
	maxBookings   = 200
	maxPlaces     = 300
	maxMembers    = 50
	maxFiles      = 20
	maxFileBytes  = 5 << 20
)

var currencies = []string{"VND", "USD", "EUR", "JPY", "THB", "GBP", "SGD"}

// fallbacks for keys missing from the shared dictionaries.
var fallback = map[string]string{
	"travel.paid": "Paid",
}

func tr(key string, p ...i18n.P) string {
	if !i18n.Has(key) {
		if f, ok := fallback[key]; ok {
			return f
		}
	}
	return i18n.T(key, p...)
}

// Pages registers the Travel group (first in the sidebar) with a single item.
func Pages(env *kit.Env) []kit.Page {
	return []kit.Page{{ID: "/app/travel", Group: "travel.title", TitleKey: "travel.title", MenuKey: "travel.title",
		Icon: theme.HomeIcon(), Order: 10, Build: func() fyne.CanvasObject { return build(env) }}}
}

type view struct {
	env    *kit.Env
	trips  []trip
	selID  string
	tab    int
	query  string
	files  []tfile
	fstate int // 0 loading, 1 ok, 2 error
	loaded bool
	failed bool
	seq    int

	list   *fyne.Container
	detail *fyne.Container
	status *fyne.Container
	newBtn *widget.Button
}

func build(env *kit.Env) fyne.CanvasObject {
	v := &view{env: env, list: container.NewVBox(), detail: container.NewStack(), status: container.NewVBox()}
	v.newBtn = widget.NewButtonWithIcon(tr("travel.newTrip"), theme.ContentAddIcon(), func() { v.tripEditor(nil) })
	v.newBtn.Importance = widget.HighImportance
	v.newBtn.Disable()

	search := widget.NewEntry()
	search.SetPlaceHolder(tr("travel.search"))
	search.OnChanged = func(s string) { v.query = strings.ToLower(strings.TrimSpace(s)); v.renderList() }
	side := container.NewBorder(container.NewVBox(kit.Heading(tr("travel.trips")), search), nil, nil, nil, container.NewVScroll(v.list))
	split := container.NewHSplit(side, container.NewVScroll(v.detail))
	split.Offset = 0.28

	v.load()
	return container.NewBorder(container.NewVBox(
		kit.PageHeader("KIRA LIFE / "+tr("travel.private"), tr("travel.title"), tr("travel.subtitle"), v.newBtn), v.status),
		nil, nil, nil, split)
}

func (v *view) load() {
	v.seq++
	seq := v.seq
	v.failed = false
	v.status.Objects = []fyne.CanvasObject{kit.Muted(tr("travel.loading")), widget.NewProgressBarInfinite()}
	v.status.Refresh()
	kit.Async(func(ctx context.Context) ([]trip, error) {
		var t []trip
		return t, v.env.API.Get(ctx, "travel/trips", nil, &t)
	}, func(t []trip, err error) {
		if seq != v.seq {
			return
		}
		v.status.Objects = nil
		if err != nil {
			v.failed = true
			msg := widget.NewLabel(tr("travel.error"))
			msg.Importance = widget.DangerImportance
			v.status.Objects = []fyne.CanvasObject{container.NewHBox(msg, widget.NewButton(tr("travel.retry"), v.load))}
			v.status.Refresh()
			return
		}
		v.status.Refresh()
		v.loaded = true
		v.newBtn.Enable()
		v.trips = t
		if v.find(v.selID) == nil {
			v.selID = ""
			if len(t) > 0 {
				v.selID = t[0].ID
			}
		}
		v.renderAll()
		v.loadFiles()
	})
}

func (v *view) find(id string) *trip {
	for i := range v.trips {
		if v.trips[i].ID == id && id != "" {
			return &v.trips[i]
		}
	}
	return nil
}

func (v *view) renderAll() { v.renderList(); v.renderDetail() }

func (v *view) select_(id string) {
	if id == v.selID {
		return
	}
	v.selID, v.files, v.fstate = id, nil, 0
	v.renderAll()
	v.loadFiles()
}

// applyTrip stores a saved trip (moved to the front) and selects it.
func (v *view) applyTrip(t trip) {
	isNew := v.find(t.ID) == nil
	out := []trip{t}
	for _, x := range v.trips {
		if x.ID != t.ID {
			out = append(out, x)
		}
	}
	v.trips = out
	if isNew || v.selID != t.ID {
		v.tab, v.selID, v.files, v.fstate = 0, t.ID, nil, 0
		v.renderAll()
		v.loadFiles()
		return
	}
	v.renderAll()
}

func (v *view) renderList() {
	v.list.Objects = nil
	shown := 0
	for _, t := range v.trips {
		if v.query != "" && !strings.Contains(strings.ToLower(t.Data.Name+" "+t.Data.Destination), v.query) {
			continue
		}
		shown++
		t := t
		b := widget.NewButton(t.Data.Name, func() { v.select_(t.ID) })
		b.Alignment = widget.ButtonAlignLeading
		if t.ID == v.selID {
			b.Importance = widget.HighImportance
		} else {
			b.Importance = widget.LowImportance
		}
		v.list.Add(kit.Muted(t.Data.Destination))
		v.list.Add(b)
		v.list.Add(kit.Muted(dates(t.Data) + " · " + countdownText(t.Data)))
		v.list.Add(widget.NewSeparator())
	}
	if shown == 0 && v.loaded {
		if len(v.trips) > 0 {
			v.list.Add(kit.Muted(tr("travel.noMatches")))
		} else {
			v.list.Add(kit.Muted(tr("travel.emptyIntro")))
		}
	}
	v.list.Refresh()
}

func dates(d data) string {
	return format.DateOnly(d.StartDate, format.DateDMY) + " — " + format.DateOnly(d.EndDate, format.DateDMY)
}

func countdownText(d data) string {
	k, days := countdown(d.StartDate, d.EndDate, todayIn(d.Timezone, time.Now()))
	switch k {
	case cdDays:
		return tr("travel.daysLeft", i18n.P{"days": days})
	case cdToday:
		return tr("travel.today")
	case cdOngoing:
		return tr("travel.ongoing")
	}
	return tr("travel.finished")
}

func money(d decimal.Decimal, cur string) string { return format.Money(d, cur) }

// ---- saving ----

func apiErr(err error) *api.ApiError {
	st := api.StatusOf(err)
	key := "travel.error"
	switch st {
	case 409:
		key = "travel.conflict"
	case 400:
		key = "travel.invalid"
	}
	return &api.ApiError{Status: st, Code: "TRAVEL", Message: tr(key)}
}

// commit saves the whole blob: POST for a new trip (version -1), PUT otherwise. Off the UI thread.
func (v *view) commit(ctx context.Context, t *trip, nd data) (trip, error) {
	var out trip
	var err error
	if t == nil {
		err = v.env.API.Post(ctx, "travel/trips", map[string]any{"data": nd, "version": -1}, &out)
	} else {
		err = v.env.API.Put(ctx, "travel/trips/"+url.PathEscape(t.ID), map[string]any{"data": nd, "version": t.Version}, &out)
	}
	if err != nil {
		return out, apiErr(err)
	}
	return out, nil
}

// persist saves a changed blob for toggles/deletes; errors toast.
func (v *view) persist(t trip, nd data) {
	kit.Async(func(ctx context.Context) (trip, error) { return v.commit(ctx, &t, nd) }, func(r trip, err error) {
		if err != nil {
			v.env.Toast(kit.ToastError, api.Message(err, tr("travel.error")))
			v.renderDetail() // restore toggled widgets
			return
		}
		v.applyTrip(r)
	})
}

func (v *view) cur() *trip { return v.find(v.selID) }

// editDialog shows form (+extra) in a modal; build turns validated values into the new blob.
func (v *view) editDialog(title string, form *kit.Form, extra fyne.CanvasObject, t *trip, build func(map[string]any) (data, bool)) {
	var d *dialog.CustomDialog
	save := widget.NewButton(tr("travel.save"), nil)
	save.Importance = widget.HighImportance
	cancel := widget.NewButton(tr("travel.cancel"), func() { d.Hide() })
	save.OnTapped = func() {
		vals, ok := form.Values()
		if !ok {
			return
		}
		nd, ok := build(vals)
		if !ok {
			form.SetFormError(tr("travel.invalid"))
			return
		}
		save.Disable()
		save.SetText(tr("travel.saving"))
		kit.Async(func(ctx context.Context) (trip, error) { return v.commit(ctx, t, nd) }, func(r trip, err error) {
			save.Enable()
			save.SetText(tr("travel.save"))
			if err != nil {
				form.ShowAPIError(err)
				return
			}
			d.Hide()
			v.env.Toast(kit.ToastSuccess, tr("travel.saved"))
			v.applyTrip(r)
		})
	}
	body := container.NewVBox(form.Content())
	if extra != nil {
		body.Add(extra)
	}
	body.Add(container.NewHBox(cancel, save))
	d = dialog.NewCustomWithoutButtons(title, container.NewVScroll(container.NewPadded(body)), v.env.Window)
	cs := v.env.Window.Canvas().Size()
	d.Resize(fyne.NewSize(min(560, cs.Width-40), min(680, cs.Height-60)))
	d.Show()
}

// ---- trip editor ----

func (v *view) tripEditor(t *trip) {
	var init data
	title := tr("travel.newTrip")
	if t != nil {
		init, title = t.Data.clone(), tr("travel.editTrip")
	} else {
		tz := time.Local.String()
		if _, ok := zone(tz); !ok {
			tz = "Asia/Ho_Chi_Minh"
		}
		today := todayIn(tz, time.Now())
		name := ""
		if u := v.env.User(); u != nil {
			name = u.FullName
		}
		init = data{StartDate: today, EndDate: today, Timezone: tz, Currency: "VND", Members: []member{{ID: newID(), Name: name}}}
		init = init.clone()
	}
	hasExpenses := len(init.Expenses) > 0
	opts := make([]kit.Option, len(currencies))
	for i, c := range currencies {
		opts[i] = kit.Option{Value: c, Label: c}
	}
	form := kit.NewForm([]kit.Field{
		{Key: "name", Label: tr("travel.name"), Required: true, MaxLen: 160, Initial: nilIfEmpty(init.Name)},
		{Key: "destination", Label: tr("travel.destination"), Required: true, MaxLen: 200, Initial: nilIfEmpty(init.Destination)},
		{Key: "startDate", Label: tr("travel.start"), Kind: kit.KindDate, Required: true, Initial: nilIfEmpty(init.StartDate)},
		{Key: "endDate", Label: tr("travel.end"), Kind: kit.KindDate, Required: true, Initial: nilIfEmpty(init.EndDate)},
		{Key: "timezone", Label: tr("travel.timezone"), Required: true, MaxLen: 80, Initial: nilIfEmpty(init.Timezone), Hint: "Asia/Ho_Chi_Minh",
			Validate: func(x any) string {
				if s, _ := x.(string); s != "" {
					if _, ok := zone(s); !ok {
						return tr("travel.invalid")
					}
				}
				return ""
			}},
		{Key: "currency", Label: tr("travel.currency"), Kind: kit.KindSelect, Required: true, Options: opts, Initial: init.Currency, Disabled: hasExpenses,
			Hint: map[bool]string{true: tr("travel.currencyLocked")}[hasExpenses]},
		{Key: "budget", Label: tr("travel.budget"), Kind: kit.KindMoney, Required: true, MaxFrac: 2, Min: kit.Dec("0"), Max: kit.Dec("1000000000000"), Initial: init.Budget},
		{Key: "notes", Label: tr("travel.notes"), Kind: kit.KindTextArea, MaxLen: 4000, Initial: nilIfEmpty(init.Notes)},
	})

	members := append([]member{}, init.Members...)
	box := container.NewVBox()
	addBtn := widget.NewButtonWithIcon(tr("travel.addMember"), theme.ContentAddIcon(), nil)
	var redraw func()
	redraw = func() {
		box.Objects = nil
		for i := range members {
			i := i
			e := widget.NewEntry()
			e.SetText(members[i].Name)
			e.SetPlaceHolder(tr("travel.memberName"))
			e.OnChanged = func(s string) { members[i].Name = s }
			del := widget.NewButtonWithIcon(tr("travel.delete"), theme.DeleteIcon(), func() {
				for _, x := range init.Expenses {
					if x.PaidBy == members[i].ID {
						v.env.Toast(kit.ToastError, tr("travel.memberInUse"))
						return
					}
					for _, p := range x.Participants {
						if p == members[i].ID {
							v.env.Toast(kit.ToastError, tr("travel.memberInUse"))
							return
						}
					}
				}
				members = append(members[:i], members[i+1:]...)
				redraw()
			})
			if len(members) <= 1 {
				del.Disable()
			}
			box.Add(container.NewBorder(nil, nil, nil, del, e))
		}
		if len(members) >= maxMembers {
			addBtn.Disable()
		} else {
			addBtn.Enable()
		}
		box.Refresh()
	}
	addBtn.OnTapped = func() { members = append(members, member{ID: newID()}); redraw() }
	redraw()
	extra := container.NewVBox(kit.Heading(tr("travel.members")), box, addBtn)

	v.editDialog(title, form, extra, t, func(vals map[string]any) (data, bool) {
		nd := init
		nd.Name, nd.Destination = sv(vals["name"]), sv(vals["destination"])
		nd.StartDate, nd.EndDate = sv(vals["startDate"]), sv(vals["endDate"])
		nd.Timezone, nd.Currency, nd.Notes = sv(vals["timezone"]), sv(vals["currency"]), sv(vals["notes"])
		nd.Budget, _ = vals["budget"].(decimal.Decimal)
		if n := dayCount(nd.StartDate, nd.EndDate); n < 1 || n > 731 {
			return nd, false
		}
		if _, ok := zone(nd.Timezone); !ok || strings.TrimSpace(nd.Name) == "" || strings.TrimSpace(nd.Destination) == "" {
			return nd, false
		}
		if (nd.Currency == "VND" || nd.Currency == "JPY") && !nd.Budget.IsInteger() {
			return nd, false
		}
		if len(members) == 0 {
			return nd, false
		}
		for _, m := range members {
			if strings.TrimSpace(m.Name) == "" {
				return nd, false
			}
		}
		for _, a := range nd.Activities {
			if a.Date < nd.StartDate || a.Date > nd.EndDate {
				return nd, false
			}
		}
		nd.Members = append([]member{}, members...)
		return nd, true
	})
}

func sv(x any) string { s, _ := x.(string); return strings.TrimSpace(s) }

func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// ---- detail ----

func (v *view) renderDetail() {
	t := v.cur()
	if t == nil {
		v.detail.Objects = nil
		if v.loaded {
			newBtn := widget.NewButtonWithIcon(tr("travel.newTrip"), theme.ContentAddIcon(), func() { v.tripEditor(nil) })
			v.detail.Objects = []fyne.CanvasObject{container.NewVBox(kit.Heading(tr("travel.noTrips")), kit.Muted(tr("travel.emptyIntro")), newBtn)}
		}
		v.detail.Refresh()
		return
	}
	d := t.Data
	hero := container.NewVBox(kit.Muted(d.Destination), kit.Heading(d.Name),
		kit.Muted(dates(d)), kit.Muted(fmt.Sprintf("%s · %d", d.Timezone, len(d.Members))),
		kit.Badge(countdownText(d), widget.HighImportance))
	tabs := container.NewAppTabs(
		container.NewTabItem(tr("travel.overview"), v.overviewTab(*t)),
		container.NewTabItem(tr("travel.itinerary"), v.itineraryTab(*t)),
		container.NewTabItem(tr("travel.packing"), v.packingTab(*t)),
		container.NewTabItem(tr("travel.expenses"), v.expensesTab(*t)),
		container.NewTabItem(tr("travel.bookings"), v.bookingsTab(*t)),
		container.NewTabItem(tr("travel.places"), v.placesTab(*t)),
	)
	tabs.SelectIndex(v.tab)
	tabs.OnSelected = func(*container.TabItem) { v.tab = tabs.SelectedIndex() }
	v.detail.Objects = []fyne.CanvasObject{container.NewVBox(hero, tabs)}
	v.detail.Refresh()
}

func (v *view) overviewTab(t trip) fyne.CanvasObject {
	d := t.Data
	packed := 0
	for _, p := range d.Packing {
		if p.Packed {
			packed++
		}
	}
	remaining, remSub := "—", tr("travel.noBudget")
	if d.Budget.IsPositive() {
		remaining, remSub = money(d.Budget.Sub(t.Summary.Total), d.Currency), d.Currency
	}
	bar := widget.NewProgressBar()
	bar.Max = float64(max(len(d.Packing), 1))
	bar.Value = float64(packed)
	bar.TextFormatter = func() string { return fmt.Sprintf("%d / %d", packed, len(d.Packing)) }
	spent := container.NewVBox(kit.Tile(tr("travel.total"), money(t.Summary.Total, d.Currency)), kit.Muted(tr("travel.budget")+": "+money(d.Budget, d.Currency)))
	rem := container.NewVBox(kit.Tile(tr("travel.remaining"), remaining), kit.Muted(remSub))
	pk := container.NewVBox(kit.Tile(tr("travel.packed"), fmt.Sprintf("%d / %d", packed, len(d.Packing))), bar)

	edit := widget.NewButton(tr("travel.editTrip"), func() { v.tripEditor(&t) })
	del := widget.NewButton(tr("travel.deleteTrip"), func() {
		v.env.Confirm(tr("travel.confirmTrip"), func() {
			kit.Async(func(ctx context.Context) (struct{}, error) {
				return struct{}{}, v.env.API.Delete(ctx, "travel/trips/"+url.PathEscape(t.ID), url.Values{"version": {fmt.Sprint(t.Version)}})
			}, func(_ struct{}, err error) {
				if err != nil {
					v.env.Toast(kit.ToastError, api.Message(apiErr(err), tr("travel.error")))
					return
				}
				out := v.trips[:0:0]
				for _, x := range v.trips {
					if x.ID != t.ID {
						out = append(out, x)
					}
				}
				v.trips, v.selID, v.files = out, "", nil
				if len(out) > 0 {
					v.selID = out[0].ID
				}
				v.renderAll()
				v.loadFiles()
			})
		})
	})
	del.Importance = widget.DangerImportance
	chips := container.NewHBox()
	for _, m := range d.Members {
		chips.Add(kit.Badge(m.Name, widget.MediumImportance))
	}
	line := fmt.Sprintf("%d %s · %d %s · %d %s", len(d.Activities), tr("travel.planned"), len(d.Bookings), tr("travel.bookings"), len(d.Places), tr("travel.places"))
	box := container.NewVBox(container.NewGridWithColumns(3, spent, rem, pk), container.NewHBox(edit, del))
	if d.Notes != "" {
		box.Add(kit.Muted(d.Notes))
	}
	box.Add(chips)
	box.Add(kit.Muted(line))
	return box
}

func (m data) memberName(id string) string {
	for _, x := range m.Members {
		if x.ID == id {
			return x.Name
		}
	}
	return "—"
}

func rowButtons(edit, del func()) fyne.CanvasObject {
	return container.NewHBox(widget.NewButton(tr("travel.edit"), edit), widget.NewButton(tr("travel.delete"), del))
}

func (v *view) confirmDelete(t trip, mut func(d *data)) {
	v.env.Confirm(tr("travel.confirmItem"), func() {
		nd := t.Data.clone()
		mut(&nd)
		v.persist(t, nd)
	})
}

func addBtn(label string, disabled bool, f func()) *widget.Button {
	b := widget.NewButtonWithIcon(label, theme.ContentAddIcon(), f)
	if disabled {
		b.Disable()
	}
	return b
}

var timeFieldRe = timePattern()

// ---- itinerary ----

func (v *view) itineraryTab(t trip) fyne.CanvasObject {
	d := t.Data
	box := container.NewVBox(addBtn(tr("travel.add"), len(d.Activities) >= maxActivities, func() { v.activityDialog(t, nil) }))
	if len(d.Activities) == 0 {
		box.Add(kit.Muted(tr("travel.emptyActivities")))
	}
	start, ok := parseDay(d.StartDate)
	n := dayCount(d.StartDate, d.EndDate)
	for i := 0; ok && i < n; i++ {
		ds := start.AddDate(0, 0, i).Format("2006-01-02")
		var day []activity
		for _, a := range d.Activities {
			if a.Date == ds {
				day = append(day, a)
			}
		}
		for x := 1; x < len(day); x++ { // sort by time string (insertion, stable)
			for y := x; y > 0 && day[y].Time < day[y-1].Time; y-- {
				day[y], day[y-1] = day[y-1], day[y]
			}
		}
		inner := container.NewVBox()
		if len(day) == 0 {
			inner.Add(kit.Muted(tr("travel.noDayActivities")))
		}
		for _, a := range day {
			a := a
			tm := a.Time
			if tm == "" {
				tm = "—"
			}
			info := container.NewVBox(widget.NewLabelWithStyle(tm+"  "+a.Title, fyne.TextAlignLeading, fyne.TextStyle{Bold: true}))
			if a.Location != "" {
				info.Add(kit.Muted(a.Location))
			}
			if a.Notes != "" {
				info.Add(kit.Muted(a.Notes))
			}
			inner.Add(container.NewBorder(nil, nil, nil, rowButtons(
				func() { v.activityDialog(t, &a) },
				func() {
					v.confirmDelete(t, func(nd *data) {
						nd.Activities = removeIf(nd.Activities, func(x activity) bool { return x.ID == a.ID })
					})
				}), info))
		}
		box.Add(widget.NewCard(fmt.Sprintf("#%d  %s", i+1, format.DateOnly(ds, format.DateDMY)), "", inner))
	}
	return box
}

func removeIf[T any](s []T, f func(T) bool) []T {
	out := []T{}
	for _, x := range s {
		if !f(x) {
			out = append(out, x)
		}
	}
	return out
}

func (v *view) activityDialog(t trip, a *activity) {
	var init activity
	title := tr("travel.add")
	if a != nil {
		init, title = *a, tr("travel.edit")
	} else {
		init.Date = t.Data.StartDate
	}
	form := kit.NewForm([]kit.Field{
		{Key: "title", Label: tr("travel.activityTitle"), Required: true, MaxLen: 160, Initial: nilIfEmpty(init.Title)},
		{Key: "date", Label: tr("travel.date"), Kind: kit.KindDate, Required: true, Initial: nilIfEmpty(init.Date)},
		{Key: "time", Label: tr("travel.time"), Pattern: timeFieldRe, Hint: "HH:mm", Initial: nilIfEmpty(init.Time)},
		{Key: "location", Label: tr("travel.location"), MaxLen: 300, Initial: nilIfEmpty(init.Location)},
		{Key: "notes", Label: tr("travel.notes"), Kind: kit.KindTextArea, MaxLen: 2000, Initial: nilIfEmpty(init.Notes)},
	})
	v.editDialog(title, form, nil, &t, func(x map[string]any) (data, bool) {
		nd := t.Data.clone()
		n := activity{X: init.X, ID: init.ID, Title: sv(x["title"]), Date: sv(x["date"]), Time: sv(x["time"]), Location: sv(x["location"]), Notes: sv(x["notes"])}
		if n.Title == "" || n.Date < nd.StartDate || n.Date > nd.EndDate {
			return nd, false
		}
		if a == nil {
			n.ID = newID()
			nd.Activities = append(nd.Activities, n)
		} else {
			for i := range nd.Activities {
				if nd.Activities[i].ID == n.ID {
					nd.Activities[i] = n
				}
			}
		}
		return nd, true
	})
}

// ---- packing ----

func (v *view) packingTab(t trip) fyne.CanvasObject {
	d := t.Data
	packed := 0
	for _, p := range d.Packing {
		if p.Packed {
			packed++
		}
	}
	bar := widget.NewProgressBar()
	bar.Max, bar.Value = float64(max(len(d.Packing), 1)), float64(packed)
	box := container.NewVBox(container.NewBorder(nil, nil, kit.Heading(fmt.Sprintf("%s %d/%d", tr("travel.packing"), packed, len(d.Packing))),
		addBtn(tr("travel.add"), len(d.Packing) >= maxPacking, func() { v.packingDialog(t, nil) })), bar)
	if len(d.Packing) == 0 {
		box.Add(kit.Muted(tr("travel.emptyPacking")))
	}
	for _, p := range d.Packing {
		p := p
		chk := widget.NewCheck(fmt.Sprintf("%s × %d", p.Name, p.Quantity), nil)
		chk.Checked = p.Packed
		chk.OnChanged = func(b bool) {
			nd := t.Data.clone()
			for i := range nd.Packing {
				if nd.Packing[i].ID == p.ID {
					nd.Packing[i].Packed = b
				}
			}
			v.persist(t, nd)
		}
		box.Add(container.NewBorder(nil, nil, nil, rowButtons(
			func() { v.packingDialog(t, &p) },
			func() {
				v.confirmDelete(t, func(nd *data) { nd.Packing = removeIf(nd.Packing, func(x packing) bool { return x.ID == p.ID }) })
			}), container.NewVBox(chk, kit.Muted(p.Category))))
	}
	return box
}

func (v *view) packingDialog(t trip, p *packing) {
	init := packing{Category: tr("travel.essentials"), Quantity: 1}
	title := tr("travel.add")
	if p != nil {
		init, title = *p, tr("travel.edit")
	}
	form := kit.NewForm([]kit.Field{
		{Key: "name", Label: tr("travel.item"), Required: true, MaxLen: 160, Initial: nilIfEmpty(init.Name)},
		{Key: "category", Label: tr("travel.category"), Required: true, MaxLen: 80, Initial: nilIfEmpty(init.Category)},
		{Key: "quantity", Label: tr("travel.quantity"), Kind: kit.KindNumber, Required: true, Min: kit.Dec("1"), Max: kit.Dec("999"), Initial: decimal.NewFromInt(int64(init.Quantity))},
	})
	v.editDialog(title, form, nil, &t, func(x map[string]any) (data, bool) {
		nd := t.Data.clone()
		q, _ := x["quantity"].(decimal.Decimal)
		n := packing{X: init.X, ID: init.ID, Name: sv(x["name"]), Category: sv(x["category"]), Quantity: int(q.IntPart()), Packed: init.Packed}
		if n.Name == "" || n.Category == "" || !q.IsInteger() {
			return nd, false
		}
		if p == nil {
			n.ID = newID()
			nd.Packing = append(nd.Packing, n)
		} else {
			for i := range nd.Packing {
				if nd.Packing[i].ID == n.ID {
					nd.Packing[i] = n
				}
			}
		}
		return nd, true
	})
}

// ---- expenses ----

func (v *view) expensesTab(t trip) fyne.CanvasObject {
	d := t.Data
	box := container.NewVBox(addBtn(tr("travel.add"), len(d.Expenses) >= maxExpenses, func() { v.expenseDialog(t, nil) }))
	if len(d.Expenses) == 0 {
		box.Add(kit.Muted(tr("travel.emptyExpenses")))
	}
	for _, e := range d.Expenses {
		e := e
		names := make([]string, len(e.Participants))
		for i, id := range e.Participants {
			names[i] = d.memberName(id)
		}
		info := container.NewVBox(widget.NewLabelWithStyle(e.Title+"  "+money(e.Amount, d.Currency), fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
			kit.Muted(format.DateOnly(e.Date, format.DateDMY)+" · "+d.memberName(e.PaidBy)), kit.Muted(strings.Join(names, ", ")))
		box.Add(container.NewBorder(nil, nil, nil, rowButtons(
			func() { v.expenseDialog(t, &e) },
			func() {
				v.confirmDelete(t, func(nd *data) { nd.Expenses = removeIf(nd.Expenses, func(x expense) bool { return x.ID == e.ID }) })
			}), info))
	}
	grid := container.NewGridWithColumns(4, kit.Heading(tr("travel.memberName")), kit.Heading(tr("travel.paid")), kit.Heading(tr("travel.share")), kit.Heading(tr("travel.net")))
	for _, b := range t.Summary.Balances {
		net := widget.NewLabel(money(b.Net, d.Currency))
		if b.Net.IsNegative() {
			net.Importance = widget.DangerImportance
		}
		grid.Add(widget.NewLabel(d.memberName(b.MemberID)))
		grid.Add(widget.NewLabel(money(b.Paid, d.Currency)))
		grid.Add(widget.NewLabel(money(b.Share, d.Currency)))
		grid.Add(net)
	}
	box.Add(widget.NewSeparator())
	box.Add(grid)
	box.Add(kit.Heading(tr("travel.settlements")))
	if len(t.Summary.Transfers) == 0 {
		box.Add(kit.Muted(tr("travel.balanced")))
	}
	for _, tf := range t.Summary.Transfers {
		box.Add(widget.NewLabel(fmt.Sprintf("%s → %s   %s", d.memberName(tf.From), d.memberName(tf.To), money(tf.Amount, d.Currency))))
	}
	box.Add(kit.Muted(tr("travel.settlementHelp")))
	return box
}

func (v *view) expenseDialog(t trip, e *expense) {
	d := t.Data
	init := expense{Date: d.StartDate, Participants: nil}
	if len(d.Members) > 0 {
		init.PaidBy = d.Members[0].ID
		for _, m := range d.Members {
			init.Participants = append(init.Participants, m.ID)
		}
	}
	title := tr("travel.add")
	if e != nil {
		init, title = *e, tr("travel.edit")
	}
	opts := make([]kit.Option, len(d.Members))
	for i, m := range d.Members {
		opts[i] = kit.Option{Value: m.ID, Label: m.Name}
	}
	minAmt := kit.Dec("0.01")
	if d.Currency == "VND" || d.Currency == "JPY" {
		minAmt = kit.Dec("1")
	}
	form := kit.NewForm([]kit.Field{
		{Key: "title", Label: tr("travel.expenseTitle"), Required: true, MaxLen: 160, Initial: nilIfEmpty(init.Title)},
		{Key: "amount", Label: tr("travel.amount"), Kind: kit.KindMoney, Required: true, MaxFrac: 2, Min: minAmt, Max: kit.Dec("1000000000000"), Initial: init.Amount},
		{Key: "date", Label: tr("travel.date"), Kind: kit.KindDate, Required: true, Initial: nilIfEmpty(init.Date)},
		{Key: "paidBy", Label: tr("travel.paidBy"), Kind: kit.KindSelect, Required: true, Options: opts, Initial: nilIfEmpty(init.PaidBy)},
	})
	if e == nil {
		form.Set("amount", nil)
	}
	checks := map[string]*widget.Check{}
	boxP := container.NewVBox(kit.Heading(tr("travel.splitBetween")))
	for _, m := range d.Members {
		c := widget.NewCheck(m.Name, nil)
		for _, p := range init.Participants {
			if p == m.ID {
				c.Checked = true
			}
		}
		checks[m.ID] = c
		boxP.Add(c)
	}
	boxP.Add(kit.Muted(tr("travel.splitHelp")))
	v.editDialog(title, form, boxP, &t, func(x map[string]any) (data, bool) {
		nd := t.Data.clone()
		amt, _ := x["amount"].(decimal.Decimal)
		n := expense{X: init.X, ID: init.ID, Title: sv(x["title"]), Date: sv(x["date"]), Amount: amt, PaidBy: sv(x["paidBy"]), Participants: []string{}}
		for _, m := range d.Members {
			if checks[m.ID].Checked {
				n.Participants = append(n.Participants, m.ID)
			}
		}
		if n.Title == "" || len(n.Participants) == 0 || ((d.Currency == "VND" || d.Currency == "JPY") && !amt.IsInteger()) {
			return nd, false
		}
		if e == nil {
			n.ID = newID()
			nd.Expenses = append(nd.Expenses, n)
		} else {
			for i := range nd.Expenses {
				if nd.Expenses[i].ID == n.ID {
					nd.Expenses[i] = n
				}
			}
		}
		return nd, true
	})
}

// ---- bookings + files ----

var bookingTypes = []string{"FLIGHT", "STAY", "TRAIN", "BUS", "ACTIVITY", "OTHER"}
var bookingURLRe = urlPattern()

func (v *view) bookingsTab(t trip) fyne.CanvasObject {
	d := t.Data
	box := container.NewVBox(addBtn(tr("travel.add"), len(d.Bookings) >= maxBookings, func() { v.bookingDialog(t, nil) }))
	if len(d.Bookings) == 0 {
		box.Add(kit.Muted(tr("travel.emptyBookings")))
	}
	for _, b := range d.Bookings {
		b := b
		ref := b.Reference
		if ref == "" {
			ref = "—"
		}
		info := container.NewVBox(kit.Badge(tr("travel."+b.Type), widget.MediumImportance),
			kit.Muted(format.DateOnly(b.Date, format.DateDMY)), widget.NewLabelWithStyle(b.Title, fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
			kit.Muted(tr("travel.reference")+": "+ref))
		if b.Notes != "" {
			info.Add(kit.Muted(b.Notes))
		}
		btns := container.NewHBox()
		if b.URL != "" {
			btns.Add(widget.NewButton(tr("travel.openLink")+" ↗", func() { v.env.OpenURL(b.URL) }))
		}
		btns.Add(rowButtons(func() { v.bookingDialog(t, &b) }, func() {
			v.confirmDelete(t, func(nd *data) { nd.Bookings = removeIf(nd.Bookings, func(x booking) bool { return x.ID == b.ID }) })
		}))
		box.Add(widget.NewCard("", "", container.NewVBox(info, btns)))
	}
	box.Add(v.filesPanel(t))
	return box
}

func (v *view) bookingDialog(t trip, b *booking) {
	init := booking{Type: "FLIGHT", Date: t.Data.StartDate}
	title := tr("travel.add")
	if b != nil {
		init, title = *b, tr("travel.edit")
	}
	opts := make([]kit.Option, len(bookingTypes))
	for i, k := range bookingTypes {
		opts[i] = kit.Option{Value: k, Label: tr("travel." + k)}
	}
	form := kit.NewForm([]kit.Field{
		{Key: "title", Label: tr("travel.bookingTitle"), Required: true, MaxLen: 160, Initial: nilIfEmpty(init.Title)},
		{Key: "type", Label: tr("travel.type"), Kind: kit.KindSelect, Required: true, Options: opts, Initial: init.Type},
		{Key: "date", Label: tr("travel.date"), Kind: kit.KindDate, Required: true, Initial: nilIfEmpty(init.Date)},
		{Key: "reference", Label: tr("travel.reference"), MaxLen: 120, Initial: nilIfEmpty(init.Reference)},
		{Key: "url", Label: tr("travel.url"), MaxLen: 1000, Pattern: bookingURLRe, Initial: nilIfEmpty(init.URL)},
		{Key: "notes", Label: tr("travel.notes"), Kind: kit.KindTextArea, MaxLen: 2000, Initial: nilIfEmpty(init.Notes)},
	})
	v.editDialog(title, form, nil, &t, func(x map[string]any) (data, bool) {
		nd := t.Data.clone()
		n := booking{X: init.X, ID: init.ID, Title: sv(x["title"]), Type: sv(x["type"]), Date: sv(x["date"]), Reference: sv(x["reference"]), URL: sv(x["url"]), Notes: sv(x["notes"])}
		if n.Title == "" {
			return nd, false
		}
		if b == nil {
			n.ID = newID()
			nd.Bookings = append(nd.Bookings, n)
		} else {
			for i := range nd.Bookings {
				if nd.Bookings[i].ID == n.ID {
					nd.Bookings[i] = n
				}
			}
		}
		return nd, true
	})
}

func (v *view) loadFiles() {
	t := v.cur()
	if t == nil {
		return
	}
	id := t.ID
	v.files, v.fstate = nil, 0
	kit.Async(func(ctx context.Context) ([]tfile, error) {
		var f []tfile
		return f, v.env.API.Get(ctx, "travel/trips/"+url.PathEscape(id)+"/files", nil, &f)
	}, func(f []tfile, err error) {
		if v.selID != id {
			return
		}
		if err != nil {
			v.fstate = 2
		} else {
			v.files, v.fstate = f, 1
		}
		v.renderDetail()
	})
}

func (v *view) filesPanel(t trip) fyne.CanvasObject {
	box := container.NewVBox(kit.Muted(tr("travel.fileHelp")))
	up := widget.NewButtonWithIcon(tr("travel.upload"), theme.UploadIcon(), func() { v.upload(t) })
	if v.fstate != 1 || len(v.files) >= maxFiles {
		up.Disable()
	}
	box.Add(up)
	switch v.fstate {
	case 0:
		box.Add(widget.NewProgressBarInfinite())
	case 2:
		box.Add(container.NewHBox(widget.NewLabel(tr("travel.fileLoadError")), widget.NewButton(tr("travel.retry"), func() { v.loadFiles(); v.renderDetail() })))
	default:
		if len(v.files) == 0 {
			box.Add(kit.Muted(tr("travel.noFiles")))
		}
		for _, f := range v.files {
			f := f
			dl := widget.NewButtonWithIcon(tr("travel.download"), theme.DownloadIcon(), func() {
				kit.Async(func(ctx context.Context) ([]byte, error) {
					b, _, err := v.env.API.Bytes(ctx, "travel/trips/"+url.PathEscape(t.ID)+"/files/"+url.PathEscape(f.ID), nil)
					return b, err
				}, func(b []byte, err error) {
					if err != nil {
						v.env.ShowError(err)
						return
					}
					v.env.SaveFile(f.Name, b)
				})
			})
			del := widget.NewButtonWithIcon(tr("travel.delete"), theme.DeleteIcon(), func() {
				v.env.Confirm(tr("travel.confirmFile"), func() {
					kit.Async(func(ctx context.Context) (struct{}, error) {
						return struct{}{}, v.env.API.Delete(ctx, "travel/trips/"+url.PathEscape(t.ID)+"/files/"+url.PathEscape(f.ID), nil)
					}, func(_ struct{}, err error) {
						if err != nil {
							v.env.ShowError(err)
							return
						}
						v.files = removeIf(v.files, func(x tfile) bool { return x.ID == f.ID })
						v.renderDetail()
					})
				})
			})
			box.Add(container.NewBorder(nil, nil, nil, container.NewHBox(dl, del),
				widget.NewLabel(fmt.Sprintf("%s  (%.1f KB)", f.Name, float64(f.Size)/1024))))
		}
	}
	return widget.NewCard(tr("travel.files"), "", box)
}

func (v *view) upload(t trip) {
	v.env.ReadPicked(func(f api.File) {
		ok := f.ContentType == "application/pdf" || f.ContentType == "image/png" || f.ContentType == "image/jpeg"
		if !ok || len(f.Data) == 0 || len(f.Data) > maxFileBytes {
			v.env.Toast(kit.ToastError, tr("travel.fileInvalid"))
			return
		}
		kit.Async(func(ctx context.Context) (tfile, error) {
			var out tfile
			return out, v.env.API.Upload(ctx, "travel/trips/"+url.PathEscape(t.ID)+"/files", nil, "file", []api.File{f}, &out)
		}, func(out tfile, err error) {
			if err != nil {
				v.env.Toast(kit.ToastError, api.Message(err, tr("travel.fileInvalid")))
				return
			}
			if v.selID == t.ID {
				v.files = append(v.files, out)
				v.renderDetail()
			}
		})
	})
}

// ---- places ----

func (v *view) placesTab(t trip) fyne.CanvasObject {
	d := t.Data
	box := container.NewVBox(addBtn(tr("travel.add"), len(d.Places) >= maxPlaces, func() { v.placeDialog(t, nil) }), kit.Muted(tr("travel.mapHelp")))
	if len(d.Places) == 0 {
		box.Add(kit.Muted(tr("travel.emptyPlaces")))
	}
	for _, p := range d.Places {
		p := p
		visited := widget.NewCheck(tr("travel.visited"), nil)
		visited.Checked = p.Visited
		visited.OnChanged = func(b bool) {
			nd := t.Data.clone()
			for i := range nd.Places {
				if nd.Places[i].ID == p.ID {
					nd.Places[i].Visited = b
				}
			}
			v.persist(t, nd)
		}
		info := container.NewVBox(widget.NewLabelWithStyle(p.Name, fyne.TextAlignLeading, fyne.TextStyle{Bold: true}), visited)
		if p.Address != "" {
			info.Add(kit.Muted(p.Address))
		}
		info.Add(kit.Muted(fmt.Sprintf("%v, %v", p.Latitude, p.Longitude)))
		if p.Notes != "" {
			info.Add(kit.Muted(p.Notes))
		}
		maps := container.NewHBox(
			widget.NewButton(tr("travel.showMap")+" (OSM)", func() { v.env.OpenURL(osmURL(p.Latitude, p.Longitude)) }),
			widget.NewButton("Google Maps", func() { v.env.OpenURL(googleMapsURL(p.Latitude, p.Longitude)) }),
			widget.NewButton(tr("travel.directions")+" ↗", func() { v.env.OpenURL(directionsURL(p.Latitude, p.Longitude)) }),
			rowButtons(func() { v.placeDialog(t, &p) }, func() {
				v.confirmDelete(t, func(nd *data) { nd.Places = removeIf(nd.Places, func(x place) bool { return x.ID == p.ID }) })
			}))
		box.Add(widget.NewCard("", "", container.NewVBox(info, maps)))
	}
	return box
}

func (v *view) placeDialog(t trip, p *place) {
	var init place
	title := tr("travel.add")
	var la, lo any
	if p != nil {
		init, title = *p, tr("travel.edit")
		la, lo = decimal.NewFromFloat(p.Latitude), decimal.NewFromFloat(p.Longitude)
	}
	form := kit.NewForm([]kit.Field{
		{Key: "name", Label: tr("travel.placeName"), Required: true, MaxLen: 160, Initial: nilIfEmpty(init.Name)},
		{Key: "address", Label: tr("travel.address"), MaxLen: 300, Initial: nilIfEmpty(init.Address)},
		{Key: "latitude", Label: tr("travel.latitude"), Kind: kit.KindNumber, Required: true, Min: kit.Dec("-90"), Max: kit.Dec("90"), Initial: la},
		{Key: "longitude", Label: tr("travel.longitude"), Kind: kit.KindNumber, Required: true, Min: kit.Dec("-180"), Max: kit.Dec("180"), Initial: lo, Hint: tr("travel.mapHelp")},
		{Key: "notes", Label: tr("travel.notes"), Kind: kit.KindTextArea, MaxLen: 2000, Initial: nilIfEmpty(init.Notes)},
	})
	v.editDialog(title, form, nil, &t, func(x map[string]any) (data, bool) {
		nd := t.Data.clone()
		lat, _ := x["latitude"].(decimal.Decimal)
		lon, _ := x["longitude"].(decimal.Decimal)
		n := place{X: init.X, ID: init.ID, Name: sv(x["name"]), Address: sv(x["address"]), Latitude: lat.InexactFloat64(), Longitude: lon.InexactFloat64(), Notes: sv(x["notes"]), Visited: init.Visited}
		if n.Name == "" {
			return nd, false
		}
		if p == nil {
			n.ID = newID()
			nd.Places = append(nd.Places, n)
		} else {
			for i := range nd.Places {
				if nd.Places[i].ID == n.ID {
					nd.Places[i] = n
				}
			}
		}
		return nd, true
	})
}
