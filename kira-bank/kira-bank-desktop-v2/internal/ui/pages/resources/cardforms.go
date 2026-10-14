package resources

import (
	"context"
	"image/color"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type bankRef struct {
	ID        int64  `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	ShortName string `json:"shortName"`
}

func (b bankRef) label() string {
	if b.ShortName != "" {
		return b.ShortName
	}
	return b.Name
}

type bankLimit struct {
	BankID      int64           `json:"bankId"`
	CreditLimit decimal.Decimal `json:"creditLimit"`
}

type formRefs struct {
	banks  []bankRef
	limits []bankLimit
}

var lastFourRe = regexp.MustCompile(`^\d{4}$`)

func intValidator(v any) string {
	if d, ok := v.(decimal.Decimal); ok && !d.IsInteger() {
		return i18n.T("form.invalidFormat")
	}
	return ""
}

// openCardForm opens the create (card == nil) or edit dialog for a credit card.
func openCardForm(env *kit.Env, card *Card, reload func()) {
	if card != nil {
		showCardForm(env, card, formRefs{}, reload)
		return
	}
	kit.Async(func(ctx context.Context) (formRefs, error) {
		var r formRefs
		var wg sync.WaitGroup
		var berr error
		wg.Add(1)
		go func() {
			defer wg.Done()
			r.banks, berr = api.GetAll[bankRef](ctx, env.API, "public/banks", nil, 100)
		}()
		lerr := env.API.Get(ctx, "credit-card-bank-limits", nil, &r.limits)
		wg.Wait()
		if berr != nil {
			return r, berr
		}
		_ = lerr // without limits every bank simply starts with an editable limit
		return r, nil
	}, func(r formRefs, err error) {
		if err != nil {
			env.ShowError(err)
			return
		}
		showCardForm(env, nil, r, reload)
	})
}

func showCardForm(env *kit.Env, card *Card, refs formRefs, reload func()) {
	edit := card != nil
	if card == nil {
		card = &Card{}
	}
	prev := newCardPreview()
	bankName := func(f *kit.Form) string {
		if edit {
			return card.BankName
		}
		id, _ := f.Get("bankId").(string)
		for _, b := range refs.banks {
			if idStr(b.ID) == id {
				return b.label()
			}
		}
		return ""
	}
	refresh := func(f *kit.Form) {
		limit, _ := f.Get("creditLimit").(decimal.Decimal)
		sd, _ := f.Get("statementDay").(decimal.Decimal)
		dd, _ := f.Get("dueDay").(decimal.Decimal)
		prev.update(bankName(f), str(f.Get("cardType")), str(f.Get("nickname")), str(f.Get("lastFour")),
			limit, sd, dd)
	}
	sharedLimit := func(f *kit.Form) {
		if edit {
			return
		}
		id, _ := f.Get("bankId").(string)
		for _, l := range refs.limits {
			if idStr(l.BankID) == id {
				f.Set("creditLimit", l.CreditLimit)
				f.SetDisabled("creditLimit", true)
				f.SetHint("creditLimit", i18n.T("form.sharedCreditLimitExistingHint"))
				return
			}
		}
		f.Set("creditLimit", nil)
		f.SetDisabled("creditLimit", false)
		f.SetHint("creditLimit", "")
	}
	var fields []kit.Field
	if !edit {
		var opts []kit.Option
		for _, b := range refs.banks {
			opts = append(opts, kit.Option{Value: idStr(b.ID), Label: b.label() + " (" + b.Code + ")"})
		}
		fields = append(fields, kit.Field{Key: "bankId", Label: i18n.T("field.bankId"), Kind: kit.KindSelect,
			Required: true, Options: opts, OnChange: func(f *kit.Form) { sharedLimit(f); refresh(f) }})
	}
	var limitInit any
	hint := ""
	if edit {
		limitInit, hint = card.CreditLimit, i18n.T("form.sharedCreditLimitEditHint")
	}
	fields = append(fields,
		kit.Field{Key: "cardType", Label: i18n.T("field.cardType"), Required: true, MaxLen: 150, Initial: card.CardType, OnChange: refresh},
		kit.Field{Key: "nickname", Label: i18n.T("field.nickname"), Required: true, MaxLen: 100, Initial: card.Nickname, OnChange: refresh},
		kit.Field{Key: "lastFour", Label: i18n.T("field.lastFour"), MaxLen: 4, Pattern: lastFourRe, Initial: card.LastFour, OnChange: refresh},
		kit.Field{Key: "creditLimit", Label: i18n.T("field.creditLimit"), Kind: kit.KindMoney, Required: true, Min: kit.Dec("0.0001"),
			Initial: limitInit, Hint: hint, OnChange: refresh},
		kit.Field{Key: "statementDay", Label: i18n.T("field.statementDay"), Kind: kit.KindNumber, Required: true,
			Min: kit.Dec("1"), Max: kit.Dec("31"), Validate: intValidator, Initial: dayInit(card.StatementDay), OnChange: refresh},
		kit.Field{Key: "dueDay", Label: i18n.T("field.dueDay"), Kind: kit.KindNumber, Required: true,
			Min: kit.Dec("1"), Max: kit.Dec("31"), Validate: intValidator, Initial: dayInit(card.DueDay), OnChange: refresh},
		kit.Field{Key: "note", Label: i18n.T("field.note"), Kind: kit.KindTextArea, MaxLen: 1000, Initial: card.Note})
	if edit {
		fields = append(fields, kit.Field{Key: "status", Label: i18n.T("field.status"), Kind: kit.KindSelect,
			Required: true, Options: statusOpts(), Initial: card.Status})
	}
	form := kit.NewForm(fields)
	refresh(form)

	ttl, desc := "form.addCard", "form.addCardDescription"
	if edit {
		ttl, desc = "form.editCard", "form.editCardDescription"
	}
	submit := func(ctx context.Context, v map[string]any) error {
		if !edit {
			id, _ := strconv.ParseInt(str(v["bankId"]), 10, 64)
			v["bankId"] = id
			return env.API.Post(ctx, "credit-cards", v, nil)
		}
		v["version"] = card.Version
		v["creditLimitVersion"] = card.CreditLimitVersion
		return env.API.Put(ctx, "credit-cards/"+idStr(card.ID), v, nil)
	}
	formModal(env, i18n.T(ttl), i18n.T(desc), form, prev, submit, reload)
}

func dayInit(n int) any {
	if n == 0 {
		return nil
	}
	return decimal.NewFromInt(int64(n))
}

func str(v any) string { s, _ := v.(string); return s }

// formModal shows form (plus an optional extra widget above it) in a dialog;
// the submit/saved handling mirrors kit.Env.FormDialog.
func formModal(env *kit.Env, title, desc string, form *kit.Form, extra fyne.CanvasObject,
	submit func(ctx context.Context, v map[string]any) error, onSaved func()) {
	var d *dialog.CustomDialog
	save := widget.NewButton(i18n.T("common.save"), nil)
	save.Importance = widget.HighImportance
	cancel := widget.NewButton(i18n.T("common.cancel"), func() { d.Hide() })
	save.OnTapped = func() {
		vals, ok := form.Values()
		if !ok {
			return
		}
		save.Disable()
		save.SetText(i18n.T("form.saving"))
		kit.Async(func(ctx context.Context) (struct{}, error) { return struct{}{}, submit(ctx, vals) },
			func(_ struct{}, err error) {
				save.Enable()
				save.SetText(i18n.T("common.save"))
				if err != nil {
					form.ShowAPIError(err)
					return
				}
				d.Hide()
				env.Toast(kit.ToastSuccess, i18n.T("form.saved"))
				onSaved()
			})
	}
	body := container.NewVBox()
	if desc != "" {
		body.Add(kit.Muted(desc))
	}
	if extra != nil {
		body.Add(extra)
	}
	body.Add(form.Content())
	body.Add(container.NewHBox(cancel, save))
	d = dialog.NewCustomWithoutButtons(title, container.NewVScroll(container.NewPadded(body)), env.Window)
	cs := env.Window.Canvas().Size()
	d.Resize(fyne.NewSize(min(540, cs.Width-40), min(680, cs.Height-60)))
	d.Show()
}

// ---- billing cycle ----

func openBillingForm(env *kit.Env, c Card, reload func()) {
	var frm *kit.Form
	zero := false
	var prevMin, prevStatus any
	var initBal, initMin any
	if c.StatementBalance != nil {
		initBal = *c.StatementBalance
	}
	if c.MinimumPayment != nil {
		initMin = *c.MinimumPayment
	}
	onBalance := func(f *kit.Form) {
		bal, _ := f.Get("statementBalance").(decimal.Decimal)
		isZero := f.Get("statementBalance") != nil && bal.IsZero()
		switch {
		case isZero && !zero:
			zero, prevMin, prevStatus = true, f.Get("minimumPayment"), f.Get("paymentStatus")
			f.Set("minimumPayment", decimal.Zero)
			f.Set("paymentStatus", "PAID")
			f.SetDisabled("minimumPayment", true)
			f.SetDisabled("paymentStatus", true)
			f.SetHint("minimumPayment", i18n.T("form.zeroStatementHint"))
		case !isZero && zero:
			zero = false
			f.Set("minimumPayment", prevMin)
			f.Set("paymentStatus", prevStatus)
			f.SetDisabled("minimumPayment", false)
			f.SetDisabled("paymentStatus", false)
			f.SetHint("minimumPayment", "")
		}
	}
	env.FormDialog(kit.FormSpec{Title: i18n.T("form.billingCycle"), Description: i18n.T("form.billingCycleDescription"),
		OnSaved: reload,
		Fields: []kit.Field{
			{Key: "statementBalance", Label: i18n.T("field.statementBalance"), Kind: kit.KindMoney, Required: true,
				Min: kit.Dec("0"), Initial: initBal, OnChange: onBalance},
			{Key: "minimumPayment", Label: i18n.T("field.minimumPayment"), Kind: kit.KindMoney, Required: true,
				Min: kit.Dec("0"), Initial: initMin, Validate: func(v any) string {
					bal, _ := frm.Get("statementBalance").(decimal.Decimal)
					mn, _ := v.(decimal.Decimal)
					if k := BillingError(bal, mn); k != "" {
						return i18n.T(k)
					}
					return ""
				}},
			{Key: "paymentStatus", Label: i18n.T("field.paymentStatus"), Kind: kit.KindSelect, Required: true, Initial: "UNPAID",
				Options: []kit.Option{{Value: "UNPAID", Label: i18n.T("billing.unpaid")}, {Value: "PAID", Label: i18n.T("billing.paid")}}},
		},
		Setup: func(f *kit.Form) { frm = f; onBalance(f) },
		Submit: func(ctx context.Context, v map[string]any) error {
			v["billingCycleId"] = c.BillingCycleID
			v["version"] = c.BillingVersion
			return env.API.Put(ctx, "credit-cards/"+idStr(c.ID)+"/billing-cycle", v, nil)
		}})
}

// ---- bank balance ----

func openBalanceDialog(env *kit.Env, g Group, reload func()) {
	remaining := Remaining(g.CreditLimit, g.CurrentBalance)
	env.FormDialog(kit.FormSpec{
		Title:       i18n.T("creditBalance.editFor", i18n.P{"bank": g.BankName}),
		Description: i18n.T("creditBalance.editDescription") + "\n" + i18n.T("creditBalance.currentValue") + ": " + format.MoneyCell(remaining, g.Currency),
		OnSaved:     reload,
		Fields: []kit.Field{
			{Key: "remaining", Label: i18n.T("field.currentBalance"), Kind: kit.KindMoney, Required: true,
				Min: kit.Dec("0"), Max: &g.CreditLimit, Initial: remaining,
				Hint: i18n.T("creditBalance.rangeHint", i18n.P{"limit": format.Money(g.CreditLimit, g.Currency)})},
			{Key: "reason", Label: i18n.T("creditBalance.reason"), Kind: kit.KindTextArea, Required: true, MaxLen: 500,
				Validate: func(v any) string {
					if s, _ := v.(string); strings.TrimSpace(s) == "" {
						return i18n.T("creditBalance.reasonRequired")
					}
					return ""
				}},
		},
		Submit: func(ctx context.Context, v map[string]any) error {
			rem, _ := v["remaining"].(decimal.Decimal)
			body := map[string]any{"currentBalance": Used(g.CreditLimit, rem), "reason": v["reason"], "version": g.BalanceVersion}
			return env.API.Put(ctx, "credit-card-bank-balances/"+idStr(g.BankID), body, nil)
		}})
}

// ---- live card preview ----

type cardPreview struct {
	fyne.CanvasObject
	bg                              *canvas.Rectangle
	bank, name, number, limit, days *canvas.Text
}

func newCardPreview() *cardPreview {
	p := &cardPreview{bg: canvas.NewRectangle(color.NRGBA{0x1e, 0x40, 0xaf, 0xff})}
	p.bg.CornerRadius = 12
	mk := func(size float32) *canvas.Text {
		t := canvas.NewText(" ", color.White)
		t.TextSize = size
		t.TextStyle = fyne.TextStyle{Bold: true}
		return t
	}
	p.bank, p.name, p.number, p.limit, p.days = mk(14), mk(12), mk(20), mk(12), mk(11)
	body := container.NewVBox(p.bank, p.name, p.number, p.limit, p.days)
	p.CanvasObject = container.NewStack(p.bg, container.NewPadded(body))
	return p
}

// previewColor picks the card colour from tier/network keywords in the card type.
func previewColor(cardType string) color.NRGBA {
	t := strings.ToUpper(cardType)
	has := func(words ...string) bool {
		for _, w := range words {
			if strings.Contains(t, w) {
				return true
			}
		}
		return false
	}
	switch {
	case has("SIGNATURE", "INFINITE"):
		return color.NRGBA{0x11, 0x18, 0x27, 0xff}
	case has("PLATINUM"):
		return color.NRGBA{0x47, 0x55, 0x69, 0xff}
	case has("GOLD"):
		return color.NRGBA{0xb4, 0x83, 0x09, 0xff}
	case has("VISA"):
		return color.NRGBA{0x1e, 0x40, 0xaf, 0xff}
	case has("MASTER"):
		return color.NRGBA{0xb9, 0x1c, 0x1c, 0xff}
	case has("JCB"):
		return color.NRGBA{0x04, 0x78, 0x57, 0xff}
	}
	return color.NRGBA{0x33, 0x41, 0x55, 0xff}
}

func (p *cardPreview) update(bank, cardType, nickname, lastFour string, limit, stmt, due decimal.Decimal) {
	p.bg.FillColor = previewColor(cardType)
	or := func(s, d string) string {
		if strings.TrimSpace(s) == "" {
			return d
		}
		return s
	}
	p.bank.Text = strings.ToUpper(or(bank, "KIRA BANK"))
	p.name.Text = strings.ToUpper(or(nickname, "CARDHOLDER NAME")) + "  " + cardType
	last := or(lastFour, "8899")
	for len(last) < 4 {
		last = "0" + last
	}
	p.number.Text = "•••• •••• •••• " + last
	p.limit.Text = i18n.T("field.creditLimit") + ": " + format.MoneyCell(limit, "")
	day := func(d decimal.Decimal) string {
		if d.IsZero() {
			return "--"
		}
		return d.String()
	}
	p.days.Text = i18n.T("field.statementDay") + " " + day(stmt) + "  ·  " + i18n.T("field.dueDay") + " " + day(due)
	for _, t := range []*canvas.Text{p.bank, p.name, p.number, p.limit, p.days} {
		t.Refresh()
	}
	p.bg.Refresh()
}
