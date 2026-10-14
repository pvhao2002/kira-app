// Package lodging is the room finder (/app/lodgings): listings, reference
// locations, reviews and authenticated photos.
package lodging

import (
	"context"
	"net/url"
	"strconv"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
	"kira-bank-desktop-v2/internal/ui/pages/resources/fb"
)

const pageSize = 20

// Pages registers the lodging screen.
func Pages(env *kit.Env) []kit.Page {
	return []kit.Page{{ID: "/app/lodgings", Group: "shell.groupLodging", TitleKey: "shell.lodgings", MenuKey: "shell.lodgings",
		Order: 10, Icon: theme.HomeIcon(), Build: func() fyne.CanvasObject { return build(env) }}}
}

type view struct {
	env    *kit.Env
	list   *fyne.Container
	bar    *widget.ProgressBarInfinite
	pager  *fyne.Container
	page   int
	search string
	seq    int
	timer  *time.Timer
}

func build(env *kit.Env) fyne.CanvasObject {
	v := &view{env: env, list: container.NewVBox(), bar: widget.NewProgressBarInfinite(), pager: container.NewHBox()}
	v.bar.Hide()

	add := widget.NewButtonWithIcon(i18n.T("lodging.add"), theme.ContentAddIcon(), func() { openListingForm(env, nil, v.reload) })
	add.Importance = widget.HighImportance
	addLoc := widget.NewButton(i18n.T("lodging.addLocation"), func() { openLocationForm(env, nil) })

	search := widget.NewEntry()
	search.SetPlaceHolder(i18n.T("lodging.search"))
	search.OnChanged = func(q string) {
		if v.timer != nil {
			v.timer.Stop()
		}
		v.timer = time.AfterFunc(250*time.Millisecond, func() { fyne.Do(func() { v.search, v.page = q, 0; v.reload() }) })
	}

	head := container.NewVBox(
		kit.PageHeader(i18n.T("lodging.eyebrow"), i18n.T("lodging.title"), i18n.T("lodging.description"), add),
		container.NewBorder(nil, nil, nil, addLoc, search), v.bar)
	v.reload()
	return container.NewBorder(head, v.pager, nil, nil, container.NewVScroll(v.list))
}

func (v *view) reload() {
	v.seq++
	seq, page, q := v.seq, v.page, v.search
	v.bar.Show()
	kit.Async(func(ctx context.Context) (api.Page[listing], error) {
		return api.GetPage[listing](ctx, v.env.API, "lodgings", url.Values{"search": {q}}, page, pageSize)
	}, func(p api.Page[listing], err error) {
		if seq != v.seq {
			return
		}
		v.bar.Hide()
		if err != nil {
			v.env.Toast(kit.ToastError, api.Message(err, i18n.T("lodging.loadFailed")))
			return
		}
		v.list.Objects = nil
		if len(p.Data) == 0 {
			v.list.Add(widget.NewLabel(i18n.T("lodging.empty") + ". " + i18n.T("lodging.emptyDescription")))
		}
		for _, l := range p.Data {
			v.list.Add(v.card(l))
		}
		v.list.Refresh()
		prev := widget.NewButton(i18n.T("common.previous"), func() { v.page--; v.reload() })
		next := widget.NewButton(i18n.T("common.next"), func() { v.page++; v.reload() })
		if p.Meta.Page <= 0 {
			prev.Disable()
		}
		if p.Meta.Page+1 >= p.Meta.TotalPages {
			next.Disable()
		}
		v.pager.Objects = []fyne.CanvasObject{prev, next,
			widget.NewLabel(strconv.Itoa(p.Meta.Page+1) + " / " + strconv.Itoa(max(p.Meta.TotalPages, 1)))}
		v.pager.Refresh()
	})
}

func feeText(label string, f *fee) string {
	if f == nil {
		return ""
	}
	return label + ": " + format.Num(f.Amount, 2) + " " + fb.T("lodging.unit."+f.Unit)
}

func (v *view) card(l listing) fyne.CanvasObject {
	env := v.env
	var cover fyne.CanvasObject = container.NewCenter(widget.NewIcon(theme.HomeIcon()))
	if len(l.Images) > 0 {
		cover = env.Image(l.Images[0].ContentURL, fyne.NewSize(170, 120))
	} else {
		cover = container.NewGridWrap(fyne.NewSize(170, 120), cover)
	}

	info := container.NewVBox(
		kit.Heading(l.title()),
		kit.Muted(i18n.T("lodging.by")+" "+l.Owner.FullName),
		widget.NewLabelWithStyle(format.Num(l.RentPrice, 2)+" VND / "+i18n.T("lodging.month"), fyne.TextAlignLeading, fyne.TextStyle{Bold: true}))
	for _, t := range []string{
		feeText(i18n.T("lodging.electricity"), l.Electricity), feeText(i18n.T("lodging.water"), l.Water),
		feeText(i18n.T("lodging.service"), l.Service), feeText(i18n.T("lodging.parking"), l.Parking)} {
		if t != "" {
			info.Add(kit.Muted(t))
		}
	}
	for _, d := range l.Distances {
		info.Add(widget.NewLabel(kmText(d)))
	}
	if l.Note != "" {
		info.Add(kit.Muted(l.Note))
	}

	open := func(label, link string) fyne.CanvasObject {
		if link == "" {
			return nil
		}
		b := widget.NewButtonWithIcon(label, theme.ComputerIcon(), func() { env.OpenURL(link) })
		b.Importance = widget.LowImportance
		return b
	}
	links := container.NewHBox()
	if l.Phone != "" {
		links.Add(widget.NewLabel(l.Phone))
	}
	for _, o := range []fyne.CanvasObject{open(fb.T("lodging.facebook"), l.FacebookURL), open(fb.T("lodging.video"), l.VideoURL)} {
		if o != nil {
			links.Add(o)
		}
	}
	info.Add(links)

	reviewBtn := func() { openReview(env, l, v.reload) }
	ok := widget.NewButton("✓ "+strconv.Itoa(l.ReviewSummary.OKCount)+" "+fb.T("lodging.ok"), reviewBtn)
	notOK := widget.NewButton("✗ "+strconv.Itoa(l.ReviewSummary.NotOKCount)+" "+i18n.T("lodging.notOk"), reviewBtn)
	actions := container.NewHBox(ok, notOK, widget.NewButton(i18n.T("lodging.review"), reviewBtn))
	if l.CanEdit {
		actions.Add(widget.NewButton(i18n.T("lodging.retry"), func() { v.recalc(l) }))
		actions.Add(widget.NewButton(i18n.T("common.edit"), func() { openListingForm(env, &l, v.reload) }))
	}
	if l.CanDelete {
		actions.Add(widget.NewButton(i18n.T("lodging.delete"), func() {
			env.Confirm(i18n.T("lodging.deleteConfirm"), func() { v.remove(l) })
		}))
	}
	return widget.NewCard("", "", container.NewVBox(container.NewBorder(nil, nil, cover, nil, info), actions))
}

func (v *view) recalc(l listing) {
	kit.Async(func(ctx context.Context) (struct{}, error) {
		return struct{}{}, v.env.API.Post(ctx, "lodgings/"+strconv.FormatInt(l.ID, 10)+"/distances/recalculate", map[string]any{}, nil)
	}, func(_ struct{}, err error) {
		if err != nil {
			v.env.Toast(kit.ToastError, i18n.T("lodging.retryFailed"))
			return
		}
		v.reload()
	})
}

func (v *view) remove(l listing) {
	kit.Async(func(ctx context.Context) (struct{}, error) {
		return struct{}{}, v.env.API.Delete(ctx, "lodgings/"+strconv.FormatInt(l.ID, 10), nil)
	}, func(_ struct{}, err error) {
		if err != nil {
			v.env.ShowError(err)
			return
		}
		v.env.Toast(kit.ToastSuccess, i18n.T("lodging.deleted"))
		v.reload()
	})
}
