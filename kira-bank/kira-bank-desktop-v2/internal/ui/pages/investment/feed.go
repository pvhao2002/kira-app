package investment

import (
	"context"
	"fmt"
	"image/color"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"time"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type feedPage struct {
	env       *kit.Env
	root      *fyne.Container
	err       banner
	list      *fyne.Container
	more      *widget.Button
	status    *widget.Label
	accountID int64
	rows      []txn
	page      int
	pages     int
	loading   bool
	seq       int
}

func newFeed(env *kit.Env) fyne.CanvasObject {
	f := &feedPage{env: env, err: newBanner(), list: container.NewVBox(), status: widget.NewLabel("")}
	f.more = widget.NewButton(i18n.T("investmentFeed.loadMore"), func() { f.load(f.page + 1) })
	f.more.Hide()
	f.root = container.NewVBox(kit.PageHeader("", i18n.T("route.investmentFeed"), ""), f.err, f.status, f.list, f.more)
	kit.Async(func(ctx context.Context) ([]account, error) { return loadAccounts(ctx, env) }, func(accs []account, err error) {
		if err != nil {
			f.err.set(errText("investmentTransactions.errorAccountLoad", err))
			return
		}
		if len(accs) == 0 {
			return
		}
		f.accountID = accs[0].ID
		pk := newPicker(accs, "", account.label, f.accountID, func(id int64) {
			f.accountID, f.rows = id, nil
			f.load(0)
		})
		f.root.Objects = append([]fyne.CanvasObject{f.root.Objects[0], labeled(i18n.T("investmentTransactions.account"), pk)}, f.root.Objects[1:]...)
		f.root.Refresh()
		f.load(0)
	})
	return f.root
}

func (f *feedPage) load(page int) {
	f.seq++
	seq, id := f.seq, f.accountID
	f.loading = true
	f.err.set("")
	f.render()
	kit.Async(func(ctx context.Context) (api.Page[txn], error) {
		return api.GetPage[txn](ctx, f.env.API, fmt.Sprintf("investment/accounts/%d/transactions", id), map[string][]string{"sort": {"transactionAt,desc"}}, page, 30)
	}, func(res api.Page[txn], err error) {
		if seq != f.seq {
			return
		}
		f.loading = false
		if err != nil {
			f.err.set(i18n.T("investmentTransactions.errorHistoryLoad"))
			f.render()
			return
		}
		if page == 0 {
			f.rows = nil
		}
		f.rows = append(f.rows, res.Data...)
		f.page, f.pages = res.Meta.Page, res.Meta.TotalPages
		f.render()
	})
}

func toneStyle(tone string) (glyph string, c color.Color) {
	switch tone {
	case "pending":
		return "◷", kit.ColorAmber
	case "failed":
		return "×", kit.ColorRed
	case "out":
		return "−", kit.ColorRed
	}
	return "+", kit.ColorGreen
}

func (f *feedPage) render() {
	switch {
	case f.loading:
		f.status.SetText("…")
	case len(f.rows) == 0 && f.accountID != 0 && f.err.Hidden:
		f.status.SetText(i18n.T("investmentTransactions.emptyHistoryTitle"))
	default:
		f.status.SetText("")
	}
	f.list.Objects = nil
	for _, g := range groupDays(f.rows) {
		f.list.Add(kit.Heading(g.Day))
		for _, x := range g.Rows {
			tone := feedTone(x.TransactionType, x.TransactionStatus)
			glyph, c := toneStyle(tone)
			title := strings.TrimSpace(str(x.Description))
			if title == "" {
				title = strings.TrimSpace(str(x.RawText))
			}
			if title == "" {
				title = typeLabel(x.TransactionType)
			}
			left := container.NewHBox(kit.Muted(format.Timestamp(x.TransactionAt, func(t time.Time) string { return t.Format("15:04") })),
				coloredText(glyph, c, true), widget.NewLabel(title))
			if tone == "pending" || tone == "failed" {
				left.Add(kit.Muted(statusLabel(x.TransactionStatus)))
			}
			sign := "+"
			if x.TransactionType == "WITHDRAWAL" {
				sign = "−"
			}
			f.list.Add(container.NewBorder(nil, nil, nil, coloredText(sign+format.Num(x.Amount, 2)+" "+x.Currency, c, true), left))
		}
		f.list.Add(widget.NewSeparator())
	}
	f.list.Refresh()
	if !f.loading && f.page+1 < f.pages {
		f.more.Show()
	} else {
		f.more.Hide()
	}
}
