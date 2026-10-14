package resources

import (
	"context"
	"net/url"
	"strings"
	"sync"
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

const cardsPageSize = 50

type cardTotals struct {
	TotalCreditLimit decimal.Decimal `json:"totalCreditLimit"`
	CurrentBalance   decimal.Decimal `json:"currentBalance"`
	Currency         string          `json:"currency"`
}

type cardsData struct {
	page   api.Page[Card]
	totals *cardTotals // nil on error: totals are hidden
}

type cardsView struct {
	env    *kit.Env
	body   *fyne.Container
	bar    *widget.ProgressBarInfinite
	page   int
	search string
	status string
	seq    int
	timer  *time.Timer
	data   cardsData
}

func cardsPage(env *kit.Env) fyne.CanvasObject {
	v := &cardsView{env: env, body: container.NewVBox(), bar: widget.NewProgressBarInfinite()}
	v.bar.Hide()

	add := widget.NewButtonWithIcon(i18n.T("common.addNew"), theme.ContentAddIcon(), func() { openCardForm(env, nil, v.reload) })
	add.Importance = widget.HighImportance

	searchEntry := widget.NewEntry()
	searchEntry.SetPlaceHolder(i18n.T("resource.searchPlaceholder"))
	searchEntry.OnChanged = func(q string) {
		if v.timer != nil {
			v.timer.Stop()
		}
		v.timer = time.AfterFunc(250*time.Millisecond, func() {
			fyne.Do(func() { v.search, v.page = q, 0; v.reload() })
		})
	}
	all := i18n.T("common.all")
	statusSel := widget.NewSelect(append([]string{all}, statusValues...), func(s string) {
		v.status = s
		if s == all {
			v.status = ""
		}
		v.render()
	})
	statusSel.PlaceHolder = i18n.T("common.filter")
	export := widget.NewButtonWithIcon(i18n.T("common.export"), theme.DownloadIcon(), v.export)

	head := container.NewVBox(
		kit.PageHeader(i18n.T("resource.flowCredit"), i18n.T("route.myCards"), i18n.T("resource.description"), add),
		container.NewBorder(nil, nil, nil, container.NewHBox(statusSel, export), searchEntry), v.bar)
	if q := env.Params()["search"]; q != "" {
		v.search = q
		searchEntry.Text = q
	}
	v.reload()
	return container.NewBorder(head, nil, nil, nil, v.body)
}

func (v *cardsView) reload() {
	v.seq++
	seq, page, q := v.seq, v.page, v.search
	v.bar.Show()
	kit.Async(func(ctx context.Context) (cardsData, error) {
		var d cardsData
		var wg sync.WaitGroup
		var err error
		wg.Add(1)
		go func() {
			defer wg.Done()
			d.page, err = api.GetPage[Card](ctx, v.env.API, "credit-cards", url.Values{"search": {q}}, page, cardsPageSize)
		}()
		var t cardTotals
		terr := v.env.API.Get(ctx, "dashboards/credit-cards", nil, &t)
		wg.Wait()
		if terr == nil {
			d.totals = &t
		}
		return d, err
	}, func(d cardsData, err error) {
		if seq != v.seq {
			return
		}
		v.bar.Hide()
		if err != nil {
			v.env.ShowError(err)
			return
		}
		v.data = d
		v.render()
	})
}

func (v *cardsView) visible() []Card {
	if v.status == "" {
		return v.data.page.Data
	}
	var out []Card
	for _, c := range v.data.page.Data {
		if strings.EqualFold(c.Status, v.status) {
			out = append(out, c)
		}
	}
	return out
}

func (v *cardsView) export() {
	header := []string{i18n.T("field.sequence"), i18n.T("field.bankName"), i18n.T("field.cardType"), i18n.T("field.nickname"),
		i18n.T("field.lastFour"), i18n.T("field.creditLimit"), i18n.T("field.currentBalance"), i18n.T("field.statementDay"),
		i18n.T("field.dueDay"), i18n.T("field.billingStatus"), i18n.T("field.status")}
	var rows [][]string
	gs := GroupCards(v.visible())
	seq := Sequence(gs)
	for _, g := range gs {
		for _, c := range g.Cards {
			rows = append(rows, []string{itoa(seq[c.ID]), c.BankName, c.CardType, c.Nickname, c.LastFour,
				c.CreditLimit.String(), Remaining(c.CreditLimit, c.CurrentBalance).String(),
				itoa(c.StatementDay), itoa(c.DueDay), c.BillingStatus, c.Status})
		}
	}
	v.env.SaveCSV("creditCards_export.csv", header, rows)
}

func (v *cardsView) totalsRow() fyne.CanvasObject {
	t := v.data.totals
	if t == nil {
		return container.NewVBox()
	}
	return container.NewVBox(widget.NewSeparator(), container.NewHBox(
		kit.Heading(i18n.T("creditCards.totalAllBanks")),
		kit.Muted(i18n.T("creditCards.totalCreditLimit")+": "+format.MoneyCell(t.TotalCreditLimit, t.Currency)),
		kit.Muted(i18n.T("creditCards.totalBalance")+": "+format.MoneyCell(t.CurrentBalance, t.Currency))))
}

func (v *cardsView) render() {
	gs := GroupCards(v.visible())
	seq := Sequence(gs)
	objs := []fyne.CanvasObject{v.totalsRow()}
	if len(gs) == 0 {
		objs = append(objs, widget.NewLabel(i18n.T("resource.emptyTitle")+". "+emptyBody(true)))
	}
	for _, g := range gs {
		objs = append(objs, v.groupHeader(g), v.groupTable(g, seq))
	}
	objs = append(objs, v.totalsRow(), v.pager())
	v.body.Objects = []fyne.CanvasObject{container.NewVScroll(container.NewVBox(objs...))}
	v.body.Refresh()
}

func (v *cardsView) pager() fyne.CanvasObject {
	m := v.data.page.Meta
	prev := widget.NewButton(i18n.T("common.previous"), func() { v.page--; v.reload() })
	next := widget.NewButton(i18n.T("common.next"), func() { v.page++; v.reload() })
	if m.Page <= 0 {
		prev.Disable()
	}
	if m.Page+1 >= m.TotalPages {
		next.Disable()
	}
	info := widget.NewLabel(i18n.T("resource.recordCount", i18n.P{"shown": len(v.data.page.Data), "total": m.TotalElements}))
	return container.NewHBox(prev, next, info)
}

func (v *cardsView) groupHeader(g Group) fyne.CanvasObject {
	logo := v.env.Image(g.LogoURL, fyne.NewSize(32, 32))
	edit := widget.NewButtonWithIcon(i18n.T("creditBalance.edit"), theme.DocumentCreateIcon(), func() { openBalanceDialog(v.env, g, v.reload) })
	remaining := Remaining(g.CreditLimit, g.CurrentBalance)
	return container.NewVBox(widget.NewSeparator(), container.NewHBox(logo, kit.Heading(g.BankName),
		kit.Muted(i18n.T("creditCards.cardCount", i18n.P{"count": len(g.Cards)})),
		kit.Muted(i18n.T("field.creditLimit")+": "+format.MoneyCell(g.CreditLimit, g.Currency)),
		kit.Muted(i18n.T("field.currentBalance")+": "+format.MoneyCell(remaining, g.Currency)), edit))
}

func (v *cardsView) groupTable(g Group, seq map[int64]int) fyne.CanvasObject {
	cols := []kit.Col[Card]{
		{Title: i18n.T("field.sequence"), MinWidth: 40, Weight: 0.3, Text: func(c Card) string { return itoa(seq[c.ID]) }},
		{Title: i18n.T("field.cardType"), Weight: 1.5, Text: func(c Card) string {
			if strings.TrimSpace(c.CardType) == "" {
				return i18n.T("creditCards.cardTypeMissing")
			}
			return c.CardType
		}},
		{Title: i18n.T("field.nickname"), Weight: 1.5, Text: func(c Card) string {
			if c.LastFour == "" {
				return c.Nickname
			}
			return c.Nickname + "  •••• " + c.LastFour
		}},
		{Title: i18n.T("field.statementDay"), MinWidth: 70, Text: func(c Card) string {
			return i18n.T("format.dayOfMonth", i18n.P{"value": c.StatementDay})
		}},
		{Title: i18n.T("field.dueDay"), MinWidth: 70, Text: func(c Card) string {
			return i18n.T("format.dayOfMonth", i18n.P{"value": c.DueDay})
		}},
		{Title: i18n.T("field.billingStatus"), Weight: 2, MinWidth: 150, Cell: billingCell},
		{Title: i18n.T("field.status"), MinWidth: 80, Cell: func(c Card) fyne.CanvasObject { return statusBadge(c.Status) }},
		{Title: "", Weight: 2, MinWidth: 330, Cell: func(c Card) fyne.CanvasObject { return v.cardActions(c) }},
	}
	t := kit.NewTable(cols)
	t.SetRows(g.Cards)
	return t
}

func billingCell(c Card) fyne.CanvasObject {
	st := strings.ToUpper(c.BillingStatus)
	if st == "" {
		return widget.NewLabel("—")
	}
	imp := widget.LowImportance
	switch st {
	case "NEEDS_INPUT", "UNPAID":
		imp = widget.WarningImportance
	case "OVERDUE":
		imp = widget.DangerImportance
	case "PAID":
		imp = widget.SuccessImportance
	}
	box := container.NewVBox(kit.Badge(i18n.T("billing."+strings.ToLower(st)), imp))
	if c.StatementBalance != nil && !c.StatementBalance.IsZero() {
		box.Add(widget.NewLabel(format.MoneyCell(*c.StatementBalance, c.Currency)))
	}
	if c.StatementDate != "" {
		box.Add(kit.Muted(i18n.T("billing.statementOn", i18n.P{"date": format.DateOnly(c.StatementDate, format.DateDMY)})))
	}
	if c.PaymentDueDate != "" {
		box.Add(kit.Muted(i18n.T("billing.dueOn", i18n.P{"date": format.DateOnly(c.PaymentDueDate, format.DateDMY)})))
	}
	return box
}

func (v *cardsView) cardActions(c Card) fyne.CanvasObject {
	btn := func(label string, f func()) *widget.Button {
		b := widget.NewButton(label, f)
		b.Importance = widget.LowImportance
		return b
	}
	box := container.NewHBox(btn(i18n.T("common.edit"), func() {
		editWith(v.env, "credit-cards/"+idStr(c.ID), func(d Card) { openCardForm(v.env, &d, v.reload) })
	}))
	switch c.BillingStatus {
	case "NEEDS_INPUT":
		box.Add(btn(i18n.T("action.enterStatement"), func() { openBillingForm(v.env, c, v.reload) }))
		box.Add(btn(i18n.T("action.importStatementAi"), func() {
			v.env.Navigate("/app/credit-card/statement-import", map[string]string{"cardId": idStr(c.ID)})
		}))
	case "UNPAID", "OVERDUE":
		box.Add(btn(i18n.T("action.updatePayment"), func() { openBillingForm(v.env, c, v.reload) }))
	}
	return box
}

func itoa(n int) string { return idStr(int64(n)) }
