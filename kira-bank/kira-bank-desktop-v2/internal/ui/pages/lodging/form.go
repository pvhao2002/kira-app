package lodging

import (
	"context"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
	"kira-bank-desktop-v2/internal/ui/pages/resources/fb"
)

// modal is a dialog with Cancel/Save. onSave must end by calling fail or close.
type modal struct {
	d    *dialog.CustomDialog
	save *widget.Button
	err  *widget.Label
}

func openModal(env *kit.Env, title string, content fyne.CanvasObject, onSave func(m *modal)) *modal {
	m := &modal{save: widget.NewButton(i18n.T("common.save"), nil), err: widget.NewLabel("")}
	m.err.Importance = widget.DangerImportance
	m.err.Wrapping = fyne.TextWrapWord
	m.err.Hide()
	m.save.Importance = widget.HighImportance
	cancel := widget.NewButton(i18n.T("common.cancel"), func() { m.d.Hide() })
	m.save.OnTapped = func() {
		m.save.Disable()
		m.save.SetText(i18n.T("form.saving"))
		m.err.Hide()
		onSave(m)
	}
	body := container.NewVBox(content, m.err, container.NewHBox(cancel, m.save))
	m.d = dialog.NewCustomWithoutButtons(title, container.NewVScroll(container.NewPadded(body)), env.Window)
	cs := env.Window.Canvas().Size()
	m.d.Resize(fyne.NewSize(min(560, cs.Width-40), min(700, cs.Height-60)))
	m.d.Show()
	return m
}

// fail re-enables Save and shows msg (when non-empty).
func (m *modal) fail(msg string) {
	m.save.Enable()
	m.save.SetText(i18n.T("common.save"))
	if msg != "" {
		m.err.SetText(msg)
		m.err.Show()
	}
}

func (m *modal) close() { m.d.Hide() }

// addrInput is an address entry with server-side suggestions (>=3 chars, 300 ms debounce).
type addrInput struct {
	Entry   *widget.Entry
	box     *fyne.Container
	env     *kit.Env
	timer   *time.Timer
	picking bool
}

func newAddrInput(env *kit.Env, initial string) *addrInput {
	a := &addrInput{Entry: widget.NewEntry(), box: container.NewVBox(), env: env}
	a.Entry.Text = initial
	a.Entry.OnChanged = func(q string) {
		if a.picking {
			return
		}
		if a.timer != nil {
			a.timer.Stop()
		}
		a.box.Objects = nil
		a.box.Refresh()
		q = strings.TrimSpace(q)
		if len([]rune(q)) < 3 {
			return
		}
		a.timer = time.AfterFunc(300*time.Millisecond, func() { a.suggest(q) })
	}
	return a
}

func (a *addrInput) suggest(q string) {
	kit.Async(func(ctx context.Context) ([]suggestion, error) {
		var s []suggestion
		return s, a.env.API.Get(ctx, "lodgings/address-suggestions", url.Values{"q": {q}}, &s)
	}, func(s []suggestion, err error) {
		if err != nil || strings.TrimSpace(a.Entry.Text) != q { // stale or failed: ignore
			return
		}
		a.box.Objects = nil
		for _, x := range s[:min(len(s), 6)] {
			label := x.Label
			b := widget.NewButtonWithIcon(label, theme.SearchIcon(), func() {
				a.picking = true
				a.Entry.SetText(label)
				a.picking = false
				a.box.Objects = nil
				a.box.Refresh()
			})
			b.Alignment = widget.ButtonAlignLeading
			b.Importance = widget.LowImportance
			a.box.Add(b)
		}
		a.box.Refresh()
	})
}

func (a *addrInput) Content(label string) fyne.CanvasObject {
	return container.NewVBox(widget.NewLabel(label+" *"), a.Entry, a.box)
}

func (a *addrInput) Value() string { return strings.TrimSpace(a.Entry.Text) }

// ---- listing form ----

func openListingForm(env *kit.Env, l *listing, reload func()) {
	kit.Async(func(ctx context.Context) ([]refLocation, error) {
		var locs []refLocation
		return locs, env.API.Get(ctx, "lodgings/reference-locations", nil, &locs)
	}, func(locs []refLocation, err error) {
		if err != nil {
			env.ShowError(err)
			return
		}
		showListingForm(env, l, locs, reload)
	})
}

func locLabel(r refLocation) string { return r.Name + " — " + r.Address }

func showListingForm(env *kit.Env, l *listing, locs []refLocation, reload func()) {
	edit := l != nil
	if l == nil {
		l = &listing{}
	}
	addr := newAddrInput(env, l.Address)

	feeFields := func(key, labelKey string, f *fee) []kit.Field {
		var amt any
		unit := unitsFor[key][0]
		if f != nil {
			amt, unit = f.Amount, f.Unit
		}
		var o []kit.Option
		for _, u := range unitsFor[key] {
			o = append(o, kit.Option{Value: u, Label: fb.T("lodging.unit." + u)})
		}
		return []kit.Field{
			{Key: key + "Amount", Label: i18n.T(labelKey), Kind: kit.KindMoney, MaxFrac: 2, Min: kit.Dec("0"), Initial: amt},
			{Key: key + "Unit", Label: i18n.T(labelKey) + " — " + fb.T("lodging.unit"), Kind: kit.KindSelect, Options: o, Initial: unit},
		}
	}
	var rent any
	if edit {
		rent = l.RentPrice
	}
	fields := []kit.Field{{Key: "rentPrice", Label: i18n.T("lodging.rent"), Kind: kit.KindMoney, MaxFrac: 2, Required: true, Min: kit.Dec("0"), Initial: rent},
		{Key: "phone", Label: i18n.T("lodging.phone"), MaxLen: 50, Initial: l.Phone}}
	fields = append(fields, feeFields("electricity", "lodging.electricity", l.Electricity)...)
	fields = append(fields, feeFields("water", "lodging.water", l.Water)...)
	fields = append(fields, feeFields("service", "lodging.service", l.Service)...)
	fields = append(fields, feeFields("parking", "lodging.parking", l.Parking)...)
	fields = append(fields,
		kit.Field{Key: "facebookUrl", Label: fb.T("lodging.facebook"), MaxLen: 1000, Initial: l.FacebookURL},
		kit.Field{Key: "videoUrl", Label: fb.T("lodging.video"), MaxLen: 1000, Initial: l.VideoURL},
		kit.Field{Key: "note", Label: i18n.T("lodging.note"), Kind: kit.KindTextArea, MaxLen: 5000, Initial: l.Note})
	form := kit.NewForm(fields)

	// reference locations (multi-select, at least one)
	selected := map[int64]bool{}
	for _, d := range l.Distances {
		selected[d.ReferenceLocationID] = true
	}
	var checks *widget.CheckGroup
	byLabel := map[string]int64{}
	rebuild := func() {
		sort.SliceStable(locs, func(i, j int) bool { return strings.ToLower(locs[i].Name) < strings.ToLower(locs[j].Name) })
		var opts, sel []string
		byLabel = map[string]int64{}
		for _, r := range locs {
			lb := locLabel(r)
			opts = append(opts, lb)
			byLabel[lb] = r.ID
			if selected[r.ID] {
				sel = append(sel, lb)
			}
		}
		checks.Options, checks.Selected = opts, sel
		checks.Refresh()
	}
	checks = widget.NewCheckGroup(nil, func(sel []string) {
		for _, r := range locs {
			selected[r.ID] = false
		}
		for _, s := range sel {
			selected[byLabel[s]] = true
		}
	})
	rebuild()
	addLoc := widget.NewButtonWithIcon(i18n.T("lodging.addLocation"), theme.ContentAddIcon(), func() {
		openLocationForm(env, func(r refLocation) {
			locs = append(locs, r)
			selected[r.ID] = true
			rebuild()
		})
	})

	// photos: existing (removable) and new
	images := append([]image(nil), l.Images...)
	existing := container.NewVBox()
	var drawImages func()
	drawImages = func() {
		existing.Objects = nil
		for _, im := range images {
			im := im
			row := container.NewHBox(env.Image(im.ContentURL, fyne.NewSize(80, 60)), widget.NewLabel(im.OriginalName))
			if l.CanEdit {
				row.Add(widget.NewButtonWithIcon(fb.T("lodging.removeImage"), theme.DeleteIcon(), func() {
					kit.Async(func(ctx context.Context) (struct{}, error) {
						return struct{}{}, env.API.Delete(ctx, "lodgings/"+strconv.FormatInt(l.ID, 10)+"/images/"+strconv.FormatInt(im.AttachmentID, 10), nil)
					}, func(_ struct{}, err error) {
						if err != nil {
							env.ShowError(err)
							return
						}
						for i := range images {
							if images[i].AttachmentID == im.AttachmentID {
								images = append(images[:i], images[i+1:]...)
								break
							}
						}
						drawImages()
						reload()
					})
				}))
			}
			existing.Add(row)
		}
		existing.Refresh()
	}
	drawImages()
	rules := kit.ImageRules(10)
	rules.ErrInvalid = "lodging.invalidImages"
	picker := kit.NewFilePicker(env, rules)

	content := container.NewVBox(
		addr.Content(i18n.T("lodging.address")), form.Content(),
		widget.NewLabel(i18n.T("lodging.locations")+" *"), checks, addLoc,
		widget.NewLabel(i18n.T("lodging.images")), existing, picker)

	title := i18n.T("lodging.add")
	if edit {
		title = i18n.T("lodging.edit")
	}
	openModal(env, title, content, func(m *modal) {
		v, ok := form.Values()
		var ids []int64
		for _, r := range locs {
			if selected[r.ID] {
				ids = append(ids, r.ID)
			}
		}
		msg := ""
		switch {
		case addr.Value() == "":
			msg = i18n.T("form.required")
		case len([]rune(addr.Value())) > 500:
			msg = i18n.T("form.maxLength", i18n.P{"value": 500})
		case len(ids) == 0:
			msg = i18n.T("lodging.selectLocation")
		}
		if !ok || msg != "" {
			m.fail(msg)
			return
		}
		body := map[string]any{
			"address": addr.Value(), "rentPrice": v["rentPrice"], "phone": v["phone"],
			"electricity": feeBody(v["electricityAmount"], v["electricityUnit"]),
			"water":       feeBody(v["waterAmount"], v["waterUnit"]),
			"service":     feeBody(v["serviceAmount"], v["serviceUnit"]),
			"parking":     feeBody(v["parkingAmount"], v["parkingUnit"]),
			"facebookUrl": v["facebookUrl"], "videoUrl": v["videoUrl"], "note": v["note"],
			"referenceLocationIds": ids, "version": nil,
		}
		if edit {
			body["version"] = l.Version
		}
		files := picker.Files()
		kit.Async(func(ctx context.Context) (listing, error) {
			var out listing
			if edit {
				return out, env.API.Put(ctx, "lodgings/"+strconv.FormatInt(l.ID, 10), body, &out)
			}
			return out, env.API.Post(ctx, "lodgings", body, &out)
		}, func(saved listing, err error) {
			if err != nil {
				m.fail(api.Message(err, i18n.T("lodging.saveFailed")))
				return
			}
			m.close()
			env.Toast(kit.ToastSuccess, i18n.T("lodging.saved"))
			reload()
			uploadImages(env, saved.ID, files, reload)
		})
	})
}

// uploadImages sends the files one by one; each failure is toasted, the list reloads after each.
func uploadImages(env *kit.Env, id int64, files []api.File, reload func()) {
	if len(files) == 0 {
		return
	}
	go func() {
		for _, f := range files {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			err := env.API.Upload(ctx, "lodgings/"+strconv.FormatInt(id, 10)+"/images", nil, "file", []api.File{f}, nil)
			cancel()
			name := f.Name
			fyne.Do(func() {
				if err != nil {
					env.Toast(kit.ToastError, name+": "+i18n.T("lodging.uploadFailed"))
				}
				reload()
			})
		}
	}()
}

// ---- reference location ----

// openLocationForm creates a shared reference location; onCreated (optional) receives it.
func openLocationForm(env *kit.Env, onCreated func(refLocation)) {
	name := widget.NewEntry()
	addr := newAddrInput(env, "")
	content := container.NewVBox(widget.NewLabel(i18n.T("lodging.locationName")+" *"), name, addr.Content(i18n.T("lodging.address")))
	openModal(env, i18n.T("lodging.addLocation"), content, func(m *modal) {
		n := strings.TrimSpace(name.Text)
		if n == "" || addr.Value() == "" {
			m.fail(i18n.T("form.required"))
			return
		}
		body := map[string]any{"name": n, "address": addr.Value(), "version": nil}
		kit.Async(func(ctx context.Context) (refLocation, error) {
			var r refLocation
			return r, env.API.Post(ctx, "lodgings/reference-locations", body, &r)
		}, func(r refLocation, err error) {
			if err != nil {
				m.fail(api.Message(err, i18n.T("lodging.saveFailed")))
				return
			}
			m.close()
			env.Toast(kit.ToastSuccess, i18n.T("lodging.saved"))
			if onCreated != nil {
				onCreated(r)
			}
		})
	})
}

// ---- review ----

func openReview(env *kit.Env, l listing, reload func()) {
	okLabel, notLabel := fb.T("lodging.ok"), i18n.T("lodging.notOk")
	choice := widget.NewRadioGroup([]string{okLabel, notLabel}, nil)
	choice.Horizontal = true
	if l.ReviewSummary.MyStatus == "NOT_OK" {
		choice.SetSelected(notLabel)
	} else {
		choice.SetSelected(okLabel)
	}
	reason := widget.NewMultiLineEntry()
	reason.SetMinRowsVisible(3)
	reason.SetText(l.ReviewSummary.MyReason)
	others := container.NewVBox()

	kit.Async(func(ctx context.Context) ([]review, error) {
		var r []review
		return r, env.API.Get(ctx, "lodgings/"+strconv.FormatInt(l.ID, 10)+"/reviews", nil, &r)
	}, func(rs []review, err error) {
		if err != nil {
			return
		}
		for _, r := range rs {
			reasonText := r.Reason
			if reasonText == "" {
				reasonText = "—"
			}
			others.Add(container.NewVBox(widget.NewLabel(r.FullName+" · "+r.Status), kit.Muted(reasonText)))
		}
		others.Refresh()
	})

	content := container.NewVBox(choice, widget.NewLabel(i18n.T("lodging.reason")), reason,
		kit.Heading(i18n.T("lodging.reviewHistory")), others)
	openModal(env, i18n.T("lodging.review"), content, func(m *modal) {
		status := "OK"
		if choice.Selected == notLabel {
			status = "NOT_OK"
		}
		if msg := reviewError(status, reason.Text); msg != "" {
			m.fail(msg)
			return
		}
		var rs any
		if t := strings.TrimSpace(reason.Text); t != "" {
			rs = t
		}
		body := map[string]any{"status": status, "reason": rs}
		kit.Async(func(ctx context.Context) (struct{}, error) {
			return struct{}{}, env.API.Put(ctx, "lodgings/"+strconv.FormatInt(l.ID, 10)+"/reviews/me", body, nil)
		}, func(_ struct{}, err error) {
			if err != nil {
				m.fail(api.Message(err, i18n.T("lodging.saveFailed")))
				return
			}
			m.close()
			env.Toast(kit.ToastSuccess, i18n.T("lodging.reviewSaved"))
			reload()
		})
	})
}
