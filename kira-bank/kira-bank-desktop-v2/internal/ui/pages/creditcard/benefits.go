package creditcard

import (
	"context"
	"net/url"
	"strconv"
	"strings"

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

type groupProgress struct {
	RuleID       int64           `json:"ruleId"`
	ProgramName  string          `json:"programName"`
	CategoryName string          `json:"categoryName"`
	CashbackRate decimal.Decimal `json:"cashbackRate"`
	Earned       decimal.Decimal `json:"earned"`
	Cap          decimal.Decimal `json:"cap"`
	Remaining    decimal.Decimal `json:"remaining"`
}

type cashbackProgress struct {
	CardID             int64            `json:"cardId"`
	Currency           string           `json:"currency"`
	PeriodStart        string           `json:"periodStart"`
	PeriodEnd          string           `json:"periodEnd"`
	CardCap            *decimal.Decimal `json:"cardCap"`
	CardEarned         decimal.Decimal  `json:"cardEarned"`
	CardRemaining      *decimal.Decimal `json:"cardRemaining"`
	UnassignedSpending decimal.Decimal  `json:"unassignedSpending"`
	Groups             []groupProgress  `json:"groups"`
}

type benefitsPage struct {
	env    *kit.Env
	all    []benefit
	sel    int64
	errs   errBox
	loadL  *widget.Label
	picker *optSelect
	body   *fyne.Container
	addBtn *widget.Button
	act    *fyne.Container // activity panel content
	actSeq int
	busy   bool // a delete/toggle is in flight
}

func buildBenefits(env *kit.Env, _ context.Context) fyne.CanvasObject {
	p := &benefitsPage{env: env, errs: newErrBox(), loadL: widget.NewLabel(i18n.T("creditBenefits.loading")), body: container.NewVBox()}
	p.addBtn = widget.NewButtonWithIcon(i18n.T("creditBenefits.addProgram"), theme.ContentAddIcon(), func() {
		if b := p.current(); b != nil {
			programDialog(env, *b, nil, p.replace)
		}
	})
	p.addBtn.Importance = widget.HighImportance
	p.addBtn.Hide()
	p.picker = newOptSelect(nil, func(v string) {
		p.sel, _ = strconv.ParseInt(v, 10, 64)
		p.errs.set("")
		p.renderBody()
	})
	reload := widget.NewButton(i18n.T("creditBenefits.reload"), func() { p.load() })
	root := pageRoot(kit.PageHeader(i18n.T("creditBenefits.eyebrow"), i18n.T("creditBenefits.title"), i18n.T("creditBenefits.description"), p.addBtn),
		container.NewBorder(nil, nil, nil, reload, p.errs), p.loadL,
		container.NewVBox(widget.NewLabel(i18n.T("creditBenefits.chooseCard")), p.picker), p.body)
	p.load()
	return root
}

func (p *benefitsPage) current() *benefit {
	for i := range p.all {
		if p.all[i].CardID == p.sel {
			return &p.all[i]
		}
	}
	return nil
}

func (p *benefitsPage) load() {
	p.loadL.Show()
	kit.Async(func(ctx context.Context) ([]benefit, error) { return loadBenefits(ctx, p.env) },
		func(bs []benefit, err error) {
			p.loadL.Hide()
			if err != nil {
				p.errs.set(errText(err, "creditBenefits.loadFailed", ""))
				return
			}
			p.errs.set("")
			p.all = bs
			opts := make([]kit.Option, len(bs))
			for i, b := range bs {
				l := b.BankName + " · " + b.Nickname
				if b.LastFour != nil && *b.LastFour != "" {
					l += " · •••• " + *b.LastFour
				}
				opts[i] = kit.Option{Value: strconv.FormatInt(b.CardID, 10), Label: l + " · " + b.Status}
			}
			if p.current() == nil && len(bs) > 0 {
				p.sel = bs[0].CardID
			}
			p.picker.SetOptions(opts)
			p.picker.SetValue(strconv.FormatInt(p.sel, 10))
			p.renderBody()
		})
}

// replace swaps in an updated card and re-renders.
func (p *benefitsPage) replace(b benefit) {
	for i := range p.all {
		if p.all[i].CardID == b.CardID {
			p.all[i] = b
		}
	}
	p.renderBody()
}

func (p *benefitsPage) renderBody() {
	b := p.current()
	p.body.Objects = nil
	defer p.body.Refresh()
	if b == nil {
		p.addBtn.Hide()
		if !p.loadL.Visible() && !p.errs.Visible() {
			p.body.Add(bold(i18n.T("creditBenefits.noCards")))
			p.body.Add(kit.Muted(i18n.T("creditBenefits.noCardsDescription")))
		}
		return
	}
	p.addBtn.Show()
	card := *b

	ctype := i18n.T("creditBenefits.cardTypeMissing")
	if card.CardType != nil && *card.CardType != "" {
		ctype = *card.CardType
	}
	st := widget.MediumImportance
	if card.Status != "ACTIVE" {
		st = widget.LowImportance
	}
	chip := container.NewHBox(logo(p.env, card.BankLogoURL), bold(card.Nickname), kit.Muted(card.BankName+" · "+ctype), kit.Badge(card.Status, st))

	// monthly cap
	capEntry := kit.NewMoneyEntry(4)
	if card.MonthlyCashbackCap != nil {
		capEntry.SetValue(*card.MonthlyCashbackCap)
	}
	saveCap := widget.NewButton(i18n.T("creditBenefits.saveCap"), nil)
	saveCap.OnTapped = func() {
		v, ok := capEntry.Value()
		if !ok || !v.IsPositive() {
			p.errs.set(i18n.T("creditBenefits.capInvalid"))
			return
		}
		p.errs.set("")
		saveCap.Disable()
		saveCap.SetText(i18n.T("creditBenefits.saving"))
		body := map[string]any{"monthlyCashbackCap": v, "version": card.ConfigVersion}
		kit.Async(func(ctx context.Context) (benefit, error) {
			var out benefit
			return out, p.env.API.Put(ctx, "credit-card-benefits/"+strconv.FormatInt(card.CardID, 10)+"/monthly-cap", body, &out)
		}, func(out benefit, err error) {
			saveCap.Enable()
			saveCap.SetText(i18n.T("creditBenefits.saveCap"))
			if err != nil {
				p.errs.set(errText(err, "creditBenefits.saveFailed", "creditBenefits.stale"))
				return
			}
			p.env.Toast(kit.ToastSuccess, i18n.T("creditBenefits.capSaved"))
			p.replace(out)
		})
	}
	capPanel := kit.Card(i18n.T("creditBenefits.monthlyCap"), i18n.T("creditBenefits.monthlyCapDescription"),
		container.NewVBox(widget.NewLabel(i18n.T("creditBenefits.amountIn", i18n.P{"currency": card.Currency})), capEntry, saveCap))

	p.act = container.NewVBox()
	actPanel := p.activityPanel(card)
	p.body.Objects = []fyne.CanvasObject{chip, capPanel, actPanel, p.programsSection(card)}
	p.loadActivity(card)
}

// ---- activity (cashback progress + recent transactions) ----

type activityData struct {
	progress cashbackProgress
	txs      []cardTx
}

func (p *benefitsPage) activityPanel(card benefit) fyne.CanvasObject {
	id := strconv.FormatInt(card.CardID, 10)
	links := container.NewHBox(
		link(i18n.T("shell.cardImport"), func() { p.env.Navigate(routeImport, map[string]string{"cardId": id}) }),
		link(i18n.T("shell.cardRecommend"), func() { p.env.Navigate(routeRecommend, nil) }))
	return kit.Card(i18n.T("creditBenefits.progressTitle"), "", container.NewVBox(links, p.act))
}

func (p *benefitsPage) loadActivity(card benefit) {
	p.actSeq++
	seq := p.actSeq
	id := strconv.FormatInt(card.CardID, 10)
	p.act.Objects = []fyne.CanvasObject{widget.NewProgressBarInfinite()}
	p.act.Refresh()
	kit.Async(func(ctx context.Context) (activityData, error) {
		var a activityData
		if err := p.env.API.Get(ctx, "credit-cards/"+id+"/cashback-progress", nil, &a.progress); err != nil {
			return a, err
		}
		pg, err := api.GetPage[cardTx](ctx, p.env.API, "credit-cards/"+id+"/transactions", nil, 0, 20)
		a.txs = pg.Data
		return a, err
	}, func(a activityData, err error) {
		if seq != p.actSeq {
			return
		}
		if err != nil {
			l := widget.NewLabel(errText(err, "creditBenefits.activityFailed", ""))
			l.Importance = widget.DangerImportance
			l.Wrapping = fyne.TextWrapWord
			p.act.Objects = []fyne.CanvasObject{l}
			p.act.Refresh()
			return
		}
		p.act.Objects = []fyne.CanvasObject{p.activityBody(card, a)}
		p.act.Refresh()
	})
}

func progressRow(title, sub, text string, percent int) fyne.CanvasObject {
	head := container.NewVBox(bold(title))
	if sub != "" {
		head.Add(kit.Muted(sub))
	}
	return container.NewVBox(container.NewBorder(nil, nil, head, widget.NewLabel(text)), bar(float64(percent)))
}

func (p *benefitsPage) activityBody(card benefit, a activityData) fyne.CanvasObject {
	pr := a.progress
	box := container.NewVBox(kit.Muted(i18n.T("creditBenefits.progressPeriod", i18n.P{"from": pr.PeriodStart, "to": pr.PeriodEnd})))
	if pr.CardCap != nil {
		box.Add(progressRow(i18n.T("creditBenefits.monthlyCap"), "", num4(pr.CardEarned)+" / "+num4(*pr.CardCap), usedPercent(pr.CardRemaining, pr.CardCap)))
	}
	for _, g := range pr.Groups {
		g := g
		box.Add(progressRow(g.CategoryName, g.ProgramName+" · "+format.Num(g.CashbackRate, 4)+"%",
			num4(g.Earned)+" / "+num4(g.Cap), usedPercent(&g.Remaining, &g.Cap)))
	}
	if len(pr.Groups) == 0 {
		box.Add(kit.Muted(i18n.T("creditBenefits.progressEmpty")))
	}
	if pr.UnassignedSpending.IsPositive() {
		box.Add(kit.Muted(i18n.T("creditBenefits.unassignedSpending", i18n.P{"amount": num4(pr.UnassignedSpending)})))
	}
	box.Add(kit.Sep())
	box.Add(container.NewBorder(nil, nil, bold(i18n.T("creditBenefits.recentTransactions")), link(i18n.T("creditBenefits.viewAllTransactions"), func() {
		p.env.Navigate(routeTx, map[string]string{"cardId": strconv.FormatInt(card.CardID, 10)})
	})))
	if len(a.txs) == 0 {
		box.Add(kit.Muted(i18n.T("creditBenefits.noTransactions")))
	}
	for _, t := range a.txs {
		t := t
		parts := []string{t.TransactionDate, typeLabel(t.TransactionType)}
		if t.CategoryName != nil && *t.CategoryName != "" {
			parts = append(parts, *t.CategoryName)
		}
		if t.MCCCode != nil && *t.MCCCode != "" {
			parts = append(parts, "MCC "+*t.MCCCode)
		}
		if t.Source == "MANUAL" {
			parts = append(parts, i18n.T("creditBenefits.sourceManual"))
		} else {
			parts = append(parts, i18n.T("creditBenefits.sourceImport"))
		}
		del := widget.NewButtonWithIcon("", theme.DeleteIcon(), func() {
			p.env.Confirm(i18n.T("creditBenefits.deleteTransactionConfirm", i18n.P{"description": t.Description}), func() { p.deleteTx(card, t) })
		})
		del.Importance = widget.LowImportance
		box.Add(container.NewBorder(nil, nil, nil, container.NewHBox(widget.NewLabel(num4(t.Amount)+" "+t.Currency), del),
			container.NewVBox(bold(t.Description), kit.Muted(strings.Join(parts, " · ")))))
	}
	return box
}

func (p *benefitsPage) deleteTx(card benefit, t cardTx) {
	if p.busy {
		return
	}
	p.busy = true
	kit.Async(func(ctx context.Context) (struct{}, error) {
		return struct{}{}, p.env.API.Delete(ctx, "card-transactions/"+strconv.FormatInt(t.ID, 10), url.Values{"version": {strconv.FormatInt(t.Version, 10)}})
	}, func(_ struct{}, err error) {
		p.busy = false
		if err != nil {
			p.errs.set(errText(err, "creditBenefits.deleteFailed", "creditBenefits.stale"))
			return
		}
		p.env.Toast(kit.ToastSuccess, i18n.T("creditBenefits.transactionDeleted"))
		p.loadActivity(card)
	})
}

// ---- programs ----

func (p *benefitsPage) programsSection(card benefit) fyne.CanvasObject {
	head := container.NewBorder(nil, nil,
		container.NewVBox(bold(i18n.T("creditBenefits.programs")), kit.Muted(i18n.T("creditBenefits.programsDescription"))),
		kit.Muted(i18n.T("creditBenefits.programCount", i18n.P{"count": len(card.Programs)})))
	if len(card.Programs) == 0 {
		add := widget.NewButton(i18n.T("creditBenefits.addProgram"), func() { programDialog(p.env, card, nil, p.replace) })
		return container.NewVBox(head, kit.Card(i18n.T("creditBenefits.emptyPrograms"), i18n.T("creditBenefits.emptyProgramsDescription"), add))
	}
	grid := container.NewGridWithColumns(2)
	for _, pr := range card.Programs {
		grid.Add(p.programCard(card, pr))
	}
	return container.NewVBox(head, grid)
}

func (p *benefitsPage) programCard(card benefit, pr program) fyne.CanvasObject {
	status, imp := i18n.T("creditBenefits.inactive"), widget.LowImportance
	if pr.Active {
		status, imp = i18n.T("creditBenefits.active"), widget.SuccessImportance
	}
	toggle := widget.NewCheck(i18n.T("creditBenefits.toggleProgram"), nil)
	toggle.SetChecked(pr.Active)
	toggle.OnChanged = func(on bool) {
		if p.busy {
			return
		}
		p.busy = true
		d := draftOf(&pr)
		d.Active = on
		body := d.request()
		kit.Async(func(ctx context.Context) (benefit, error) {
			var out benefit
			return out, p.env.API.Put(ctx, programPath(card.CardID, pr.ID), body, &out)
		}, func(out benefit, err error) {
			p.busy = false
			if err != nil {
				p.errs.set(errText(err, "creditBenefits.saveFailed", "creditBenefits.stale"))
				toggle.OnChanged = nil
				toggle.SetChecked(pr.Active)
				return
			}
			p.replace(out)
		})
	}
	box := container.NewVBox(container.NewBorder(nil, nil, kit.Badge(status, imp), toggle), bold(pr.Name))
	if n := str(pr.Notes); n != "" {
		box.Add(kit.Muted(n))
	}
	if u := str(pr.TermsURL); u != "" {
		box.Add(link(i18n.T("creditBenefits.terms"), func() { p.env.OpenURL(u) }))
	}
	for _, g := range pr.Groups {
		box.Add(container.NewBorder(nil, nil,
			container.NewVBox(bold(g.CategoryName), kit.Muted(strings.Join(g.MCCCodes, " · "))),
			container.NewVBox(bold(format.Num(g.CashbackRate, 4)+"%"),
				kit.Muted(i18n.T("creditBenefits.maxPerMonth", i18n.P{"amount": num4(g.MaxCashbackAmount), "currency": card.Currency})))))
	}
	edit := widget.NewButton(i18n.T("common.edit"), func() { programDialog(p.env, card, &pr, p.replace) })
	del := widget.NewButton(i18n.T("creditBenefits.delete"), func() {
		p.env.Confirm(i18n.T("creditBenefits.deleteConfirm", i18n.P{"name": pr.Name}), func() {
			kit.Async(func(ctx context.Context) (struct{}, error) {
				return struct{}{}, p.env.API.Do(ctx, "DELETE", programPath(card.CardID, pr.ID), nil, map[string]any{"version": pr.Version}, nil)
			}, func(_ struct{}, err error) {
				if err != nil {
					p.errs.set(errText(err, "creditBenefits.deleteFailed", "creditBenefits.stale"))
					return
				}
				p.env.Toast(kit.ToastSuccess, i18n.T("creditBenefits.programDeleted"))
				p.load()
			})
		})
	})
	del.Importance = widget.DangerImportance
	box.Add(container.NewHBox(edit, del))
	return widget.NewCard("", "", box)
}
