package creditcard

import (
	"context"
	"crypto/rand"
	"fmt"
	"net/url"
	"strconv"
	"strings"

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

type cardTx struct {
	ID              int64           `json:"id"`
	CardID          int64           `json:"cardId"`
	CardNickname    *string         `json:"cardNickname"`
	CardLastFour    *string         `json:"cardLastFour"`
	StatementID     *int64          `json:"statementId"`
	TransactionDate string          `json:"transactionDate"`
	Description     string          `json:"description"`
	Amount          decimal.Decimal `json:"amount"`
	Currency        string          `json:"currency"`
	TransactionType string          `json:"transactionType"`
	MCCCode         *string         `json:"mccCode"`
	CashbackRuleID  *int64          `json:"cashbackRuleId"`
	CategoryName    *string         `json:"categoryName"`
	Source          string          `json:"source"`
	Version         int64           `json:"version"`
}

type merchantRule struct {
	ID      int64   `json:"id"`
	Pattern string  `json:"pattern"`
	MCCCode string  `json:"mccCode"`
	Label   *string `json:"label"`
	Version int64   `json:"version"`
}

// newUUID returns a random RFC 4122 v4 UUID (Idempotency-Key values).
func newUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

type txPage struct {
	env      *kit.Env
	cards    []userCard
	benefits []benefit

	cardSel, typeSel *optSelect
	from, to         *widget.DateEntry
	search           *widget.Entry
	table            *kit.Table[cardTx]
	errs             errBox
	busy             *widget.ProgressBarInfinite
	page, seq        int

	rules    []merchantRule
	rulesBox *fyne.Container
	rulesErr errBox
	tabs     *container.AppTabs
	rulesTab *container.TabItem
	addBtn   *widget.Button
}

func buildTransactions(env *kit.Env) fyne.CanvasObject {
	p := &txPage{env: env, errs: newErrBox(), rulesErr: newErrBox(), busy: widget.NewProgressBarInfinite(), rulesBox: container.NewVBox()}
	p.busy.Hide()

	p.cardSel = newOptSelect(nil, func(string) { p.apply() })
	p.typeSel = newOptSelect(append([]kit.Option{{Value: "", Label: i18n.T("cardTransactions.allTypes")}}, typeOptions()...), func(string) { p.apply() })
	p.typeSel.SetValue("")
	p.from, p.to = kit.NewDateEntry(), kit.NewDateEntry()
	p.search = widget.NewEntry()
	p.search.SetPlaceHolder(i18n.T("cardTransactions.searchPlaceholder"))
	p.search.OnSubmitted = func(string) { p.apply() }
	apply := widget.NewButton(i18n.T("cardTransactions.apply"), p.apply)
	apply.Importance = widget.HighImportance
	reset := widget.NewButton(i18n.T("cardTransactions.reset"), func() {
		p.cardSel.SetValue("")
		p.typeSel.SetValue("")
		p.from.SetDate(nil)
		p.to.SetDate(nil)
		p.search.SetText("")
		p.errs.set("")
		p.page = 0
		p.load()
	})
	field := func(key string, w fyne.CanvasObject) fyne.CanvasObject {
		return container.NewVBox(widget.NewLabel(i18n.T(key)), w)
	}
	filters := container.NewVBox(
		container.NewGridWithColumns(4, field("cardImport.card", p.cardSel), field("cardTransactions.from", p.from),
			field("cardTransactions.to", p.to), field("cardImport.type", p.typeSel)),
		field("cardTransactions.search", p.search), container.NewHBox(apply, reset))

	p.table = kit.NewTable([]kit.Col[cardTx]{
		{Title: i18n.T("cardImport.date"), MinWidth: 95, Text: func(t cardTx) string { return t.TransactionDate }},
		{Title: i18n.T("cardImport.card"), MinWidth: 110, Text: func(t cardTx) string {
			s := str(t.CardNickname)
			if t.CardLastFour != nil && *t.CardLastFour != "" {
				s += " · " + *t.CardLastFour
			}
			return s
		}},
		{Title: i18n.T("field.description"), Weight: 2, MinWidth: 160, Cell: func(t cardTx) fyne.CanvasObject {
			src := i18n.T("creditBenefits.sourceImport")
			if t.Source == "MANUAL" {
				src = i18n.T("creditBenefits.sourceManual")
			}
			return container.NewVBox(label(t.Description, widget.MediumImportance, fyne.TextAlignLeading), kit.Muted(src))
		}},
		{Title: i18n.T("cardImport.type"), MinWidth: 80, Text: func(t cardTx) string { return typeLabel(t.TransactionType) }},
		{Title: i18n.T("cardImport.category"), MinWidth: 100, Text: func(t cardTx) string { return orDash(t.CategoryName) }},
		{Title: "MCC", MinWidth: 55, Text: func(t cardTx) string { return orDash(t.MCCCode) }},
		{Title: i18n.T("field.amount"), MinWidth: 120, Align: fyne.TextAlignTrailing, Cell: func(t cardTx) fyne.CanvasObject {
			imp := widget.MediumImportance
			if t.TransactionType == "REFUND" || t.TransactionType == "CASHBACK" {
				imp = widget.SuccessImportance
			}
			return label(format.Money(t.Amount, t.Currency), imp, fyne.TextAlignTrailing)
		}},
	},
		kit.RowAction[cardTx]{Label: i18n.T("common.edit"), Do: func(t cardTx) { p.txDialog(&t) }},
		kit.RowAction[cardTx]{Label: i18n.T("cardTransactions.remember"), Do: func(t cardTx) {
			p.tabs.SelectIndex(1)
			p.ruleDialog(nil, rulePattern(t.Description), str(t.MCCCode))
		}},
		kit.RowAction[cardTx]{Icon: theme.DeleteIcon(), Do: func(t cardTx) {
			env.Confirm(i18n.T("creditBenefits.deleteTransactionConfirm", i18n.P{"description": t.Description}), func() {
				kit.Async(func(ctx context.Context) (struct{}, error) {
					return struct{}{}, env.API.Delete(ctx, "card-transactions/"+strconv.FormatInt(t.ID, 10), url.Values{"version": {strconv.FormatInt(t.Version, 10)}})
				}, func(_ struct{}, err error) {
					if err != nil {
						p.errs.set(errText(err, "creditBenefits.deleteFailed", ""))
						return
					}
					env.Toast(kit.ToastSuccess, i18n.T("creditBenefits.transactionDeleted"))
					p.load()
				})
			})
		}})
	p.table.SetEmpty(i18n.T("cardTransactions.empty") + "\n" + i18n.T("cardTransactions.emptyHint"))
	txTab := container.NewVBox(filters, p.errs, p.busy, p.table)

	p.rulesTab = container.NewTabItem(i18n.T("cardTransactions.tabRules"), container.NewVBox(kit.Muted(i18n.T("cardTransactions.rulesHint")), p.rulesErr, p.rulesBox))
	p.tabs = container.NewAppTabs(container.NewTabItem(i18n.T("cardTransactions.tabTransactions"), txTab), p.rulesTab)

	p.addBtn = widget.NewButtonWithIcon(i18n.T("cardTransactions.add"), theme.ContentAddIcon(), func() { p.onAdd() })
	p.addBtn.Importance = widget.HighImportance
	p.addBtn.Disable()
	p.tabs.OnSelected = func(ti *container.TabItem) {
		if ti == p.rulesTab {
			p.addBtn.SetText(i18n.T("cardTransactions.addRule"))
		} else {
			p.addBtn.SetText(i18n.T("cardTransactions.add"))
		}
	}
	root := pageRoot(kit.PageHeader(i18n.T("cardTransactions.eyebrow"), i18n.T("route.cardTransactions"), i18n.T("cardTransactions.description"), p.addBtn), p.tabs)

	if env.Params()["tab"] == "rules" {
		p.tabs.SelectIndex(1)
	}
	p.bootstrap()
	return root
}

func orDash(s *string) string {
	if s == nil || *s == "" {
		return format.Dash
	}
	return *s
}

func (p *txPage) onAdd() {
	if p.tabs.Selected() == p.rulesTab {
		p.ruleDialog(nil, "", "")
	} else {
		p.txDialog(nil)
	}
}

type txBoot struct {
	cards    []userCard
	benefits []benefit
}

func (p *txPage) bootstrap() {
	want := p.env.Params()["cardId"]
	kit.Async(func(ctx context.Context) (txBoot, error) {
		var b txBoot
		var err error
		if b.cards, err = loadCards(ctx, p.env); err != nil {
			return b, err
		}
		b.benefits, _ = loadBenefits(ctx, p.env) // categories are optional
		return b, nil
	}, func(b txBoot, err error) {
		if err != nil {
			p.errs.set(errText(err, "cardTransactions.loadError", ""))
		} else {
			p.cards, p.benefits = b.cards, b.benefits
			p.addBtn.Enable()
			opts := []kit.Option{{Value: "", Label: i18n.T("cardTransactions.allCards")}}
			for _, c := range b.cards {
				opts = append(opts, kit.Option{Value: strconv.FormatInt(c.ID, 10), Label: c.label()})
			}
			p.cardSel.SetOptions(opts)
			p.cardSel.SetValue(want)
		}
		p.load()
		p.loadRules()
	})
}

// apply validates the filters and reloads page 0.
func (p *txPage) apply() {
	if p.from.Date != nil && p.to.Date != nil && p.to.Date.Before(*p.from.Date) {
		p.errs.set(i18n.T("cardTransactions.invalidRange"))
		return
	}
	p.errs.set("")
	p.page = 0
	p.load()
}

func (p *txPage) load() {
	p.seq++
	seq, page := p.seq, p.page
	query := q("cardId", p.cardSel.Value(), "fromDate", dateStr(p.from), "toDate", dateStr(p.to), "type", p.typeSel.Value(), "q", strings.TrimSpace(p.search.Text))
	p.busy.Show()
	kit.Async(func(ctx context.Context) (api.Page[cardTx], error) {
		return api.GetPage[cardTx](ctx, p.env.API, "card-transactions", query, page, 20)
	}, func(res api.Page[cardTx], err error) {
		if seq != p.seq {
			return
		}
		p.busy.Hide()
		if err != nil {
			p.errs.set(errText(err, "cardTransactions.loadError", ""))
			return
		}
		p.table.SetRows(res.Data)
		p.table.SetMeta(res.Meta, func(n int) { p.page = n; p.load() })
	})
}

// ---- add / edit transaction ----

func (p *txPage) txDialog(edit *cardTx) {
	env := p.env
	key := newUUID() // one idempotency key per opened dialog; reused on retry
	var cardOpts []kit.Option
	for _, c := range p.cards {
		cardOpts = append(cardOpts, kit.Option{Value: strconv.FormatInt(c.ID, 10), Label: c.label()})
	}
	catSel := newOptSelect(categoryOptions(p.benefits, 0), nil)
	cardSel := newOptSelect(cardOpts, nil)
	cardSel.OnChanged = func(v string) {
		id, _ := strconv.ParseInt(v, 10, 64)
		catSel.SetOptions(categoryOptions(p.benefits, id))
		catSel.SetValue("")
	}
	date := kit.NewDateEntry()
	amount := kit.NewMoneyEntry(4)
	desc := widget.NewEntry()
	typ := newOptSelect(typeOptions(), nil)
	mcc := widget.NewEntry()
	mcc.SetPlaceHolder(i18n.T("cardTransactions.mccAuto"))
	mcc.OnChanged = func(s string) {
		if len(s) > 4 {
			mcc.SetText(s[:4])
		}
	}
	errMsg := newErrBox()

	title := i18n.T("cardTransactions.addTitle")
	if edit != nil {
		title = i18n.T("cardTransactions.editTitle")
		cardSel.SetValue(strconv.FormatInt(edit.CardID, 10))
		cardSel.Disable()
		catSel.SetOptions(categoryOptions(p.benefits, edit.CardID))
		if edit.CashbackRuleID != nil {
			catSel.SetValue(strconv.FormatInt(*edit.CashbackRuleID, 10))
		} else {
			catSel.SetValue("")
		}
		setDate(date, edit.TransactionDate)
		amount.SetValue(edit.Amount)
		desc.SetText(edit.Description)
		typ.SetValue(edit.TransactionType)
		mcc.SetText(str(edit.MCCCode))
	} else {
		first := p.cardSel.Value()
		if first == "" && len(p.cards) > 0 {
			first = strconv.FormatInt(p.cards[0].ID, 10)
		}
		cardSel.SetValue(first)
		id, _ := strconv.ParseInt(first, 10, 64)
		catSel.SetOptions(categoryOptions(p.benefits, id))
		catSel.SetValue("")
		setDate(date, format.Today())
		typ.SetValue("SPENDING")
	}

	var dlg *dialog.CustomDialog
	save := widget.NewButton(i18n.T("common.save"), nil)
	save.Importance = widget.HighImportance
	save.OnTapped = func() {
		cardID, _ := strconv.ParseInt(cardSel.Value(), 10, 64)
		amt, amtOK := amount.Value()
		m := strings.TrimSpace(mcc.Text)
		switch {
		case cardID == 0:
			errMsg.set(i18n.T("cardTransactions.validation.card"))
			return
		case dateStr(date) == "":
			errMsg.set(i18n.T("cardTransactions.validation.date"))
			return
		case strings.TrimSpace(desc.Text) == "":
			errMsg.set(i18n.T("cardTransactions.validation.description"))
			return
		case !amtOK || !amt.IsPositive():
			errMsg.set(i18n.T("cardTransactions.validation.amount"))
			return
		case m != "" && !mccRe.MatchString(m):
			errMsg.set(i18n.T("cardRecommend.invalidMcc"))
			return
		}
		var rule any
		if v := catSel.Value(); v != "" {
			rule, _ = strconv.ParseInt(v, 10, 64)
		}
		t := typ.Value()
		if t == "" {
			t = "SPENDING"
		}
		body := map[string]any{"transactionDate": dateStr(date), "description": strings.TrimSpace(desc.Text), "amount": amt,
			"transactionType": t, "mccCode": nilIfEmpty(m), "cashbackRuleId": rule}
		errMsg.set("")
		save.Disable()
		save.SetText(i18n.T("form.saving"))
		kit.Async(func(ctx context.Context) (struct{}, error) {
			if edit != nil {
				body["version"] = edit.Version
				return struct{}{}, env.API.Put(ctx, "card-transactions/"+strconv.FormatInt(edit.ID, 10), body, nil)
			}
			return struct{}{}, env.API.Post(ctx, "credit-cards/"+strconv.FormatInt(cardID, 10)+"/transactions", body, nil, api.WithHeader("Idempotency-Key", key))
		}, func(_ struct{}, err error) {
			save.Enable()
			save.SetText(i18n.T("common.save"))
			if err != nil {
				errMsg.set(errText(err, "cardTransactions.saveError", ""))
				return
			}
			dlg.Hide()
			if edit != nil {
				env.Toast(kit.ToastSuccess, i18n.T("cardTransactions.updated"))
			} else {
				env.Toast(kit.ToastSuccess, i18n.T("cardTransactions.created"))
			}
			p.load()
		})
	}
	cancel := widget.NewButton(i18n.T("common.cancel"), func() { dlg.Hide() })
	f := func(key string, w fyne.CanvasObject) fyne.CanvasObject {
		return container.NewVBox(widget.NewLabel(i18n.T(key)+" *"), w)
	}
	g := func(label string, w fyne.CanvasObject) fyne.CanvasObject {
		return container.NewVBox(widget.NewLabel(label), w)
	}
	body := container.NewVBox()
	if edit != nil && edit.StatementID != nil {
		body.Add(kit.Muted(i18n.T("cardTransactions.statementNote")))
	}
	body.Objects = append(body.Objects, f("cardImport.card", cardSel), f("cardImport.date", date), f("field.amount", amount),
		f("field.description", desc), g(i18n.T("cardImport.type"), typ), g("MCC", mcc), g(i18n.T("cardImport.category"), catSel),
		errMsg, container.NewHBox(cancel, save))
	dlg = dialog.NewCustomWithoutButtons(title, container.NewVScroll(container.NewPadded(body)), env.Window)
	cs := env.Window.Canvas().Size()
	dlg.Resize(fyne.NewSize(min(520, cs.Width-40), min(640, cs.Height-60)))
	dlg.Show()
}

// ---- merchant rules ----

func (p *txPage) loadRules() {
	kit.Async(func(ctx context.Context) ([]merchantRule, error) {
		var r []merchantRule
		return r, p.env.API.Get(ctx, "card-merchant-rules", nil, &r)
	}, func(r []merchantRule, err error) {
		if err != nil {
			p.rulesErr.set(errText(err, "cardTransactions.rulesLoadError", ""))
			return
		}
		p.rulesErr.set("")
		p.rules = r
		p.rulesTab.Text = i18n.T("cardTransactions.tabRules") + fmt.Sprintf(" (%d)", len(r))
		p.tabs.Refresh()
		p.rulesBox.Objects = nil
		if len(r) == 0 {
			p.rulesBox.Add(kit.Muted(i18n.T("cardTransactions.rulesEmpty")))
		}
		for _, rule := range r {
			rule := rule
			del := widget.NewButtonWithIcon("", theme.DeleteIcon(), func() {
				p.env.Confirm(i18n.T("cardTransactions.ruleDeleteConfirm", i18n.P{"pattern": rule.Pattern}), func() { p.deleteRule(rule) })
			})
			del.Importance = widget.LowImportance
			p.rulesBox.Add(container.NewBorder(nil, nil, nil,
				container.NewHBox(widget.NewButton(i18n.T("common.edit"), func() { p.ruleDialog(&rule, "", "") }), del),
				container.NewVBox(bold(`"`+rule.Pattern+`" → MCC `+rule.MCCCode), kit.Muted(str(rule.Label)))))
			p.rulesBox.Add(kit.Sep())
		}
		p.rulesBox.Refresh()
	})
}

func (p *txPage) deleteRule(r merchantRule) {
	kit.Async(func(ctx context.Context) (struct{}, error) {
		return struct{}{}, p.env.API.Delete(ctx, "card-merchant-rules/"+strconv.FormatInt(r.ID, 10), url.Values{"version": {strconv.FormatInt(r.Version, 10)}})
	}, func(_ struct{}, err error) {
		if err != nil {
			p.rulesErr.set(errText(err, "cardTransactions.rulesLoadError", ""))
			return
		}
		p.env.Toast(kit.ToastSuccess, i18n.T("cardTransactions.ruleDeleted"))
		p.loadRules()
	})
}

// ruleDialog adds (edit == nil, optionally prefilled) or edits a merchant rule.
func (p *txPage) ruleDialog(edit *merchantRule, pattern, mccCode string) {
	title, apply := i18n.T("cardTransactions.addRule"), true
	if edit != nil {
		title, pattern, mccCode, apply = i18n.T("cardTransactions.editRule"), edit.Pattern, edit.MCCCode, false
	}
	fields := []kit.Field{
		{Key: "pattern", Label: i18n.T("cardTransactions.pattern"), Required: true, MaxLen: 100, Initial: pattern,
			Validate: func(v any) string {
				if s, _ := v.(string); len([]rune(s)) < 2 {
					return i18n.T("cardTransactions.ruleInvalid")
				}
				return ""
			}},
		{Key: "mccCode", Label: "MCC", Required: true, MaxLen: 4, Pattern: mccRe, Initial: mccCode},
		{Key: "label", Label: i18n.T("cardTransactions.label"), MaxLen: 150, Initial: str(editLabel(edit))},
	}
	if edit == nil {
		fields = append(fields, kit.Field{Key: "applyToExisting", Label: i18n.T("cardTransactions.applyToExisting"), Kind: kit.KindCheckbox, Initial: apply})
	}
	updated := 0
	p.env.FormDialog(kit.FormSpec{
		Title: title, Description: i18n.T("cardTransactions.ruleHelp"), Fields: fields,
		Submit: func(ctx context.Context, v map[string]any) error {
			body := map[string]any{"pattern": v["pattern"], "mccCode": v["mccCode"], "label": v["label"]}
			if edit != nil {
				body["applyToExisting"] = false
				body["version"] = edit.Version
				return p.env.API.Put(ctx, "card-merchant-rules/"+strconv.FormatInt(edit.ID, 10), body, nil)
			}
			body["applyToExisting"] = v["applyToExisting"]
			body["version"] = nil
			var out struct {
				UpdatedTransactions int `json:"updatedTransactions"`
			}
			err := p.env.API.Post(ctx, "card-merchant-rules", body, &out)
			updated = out.UpdatedTransactions
			return err
		},
		OnSaved: func() {
			if edit == nil {
				p.env.Toast(kit.ToastSuccess, i18n.T("cardTransactions.ruleCreated", i18n.P{"count": updated}))
				if updated > 0 {
					p.load()
				}
			} else {
				p.env.Toast(kit.ToastSuccess, i18n.T("cardTransactions.ruleUpdated"))
			}
			p.loadRules()
		},
	})
}

func editLabel(r *merchantRule) *string {
	if r == nil {
		return nil
	}
	return r.Label
}
