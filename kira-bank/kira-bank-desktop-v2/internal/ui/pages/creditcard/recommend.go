package creditcard

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

var presets = []struct{ key, mcc string }{
	{"dining", "5812"}, {"fastFood", "5814"}, {"grocery", "5411"}, {"fuel", "5541"}, {"ecommerce", "5399"},
	{"rideHailing", "4121"}, {"airline", "4511"}, {"hotel", "7011"}, {"electronics", "5732"}, {"pharmacy", "5912"},
	{"cinema", "7832"}, {"education", "8299"}, {"utilities", "4900"},
}

type recCard struct {
	CardID             int64            `json:"cardId"`
	BankName           string           `json:"bankName"`
	BankLogoURL        *string          `json:"bankLogoUrl"`
	Nickname           string           `json:"nickname"`
	CardType           *string          `json:"cardType"`
	LastFour           *string          `json:"lastFour"`
	Currency           string           `json:"currency"`
	RuleID             *int64           `json:"ruleId"`
	ProgramName        *string          `json:"programName"`
	CategoryName       *string          `json:"categoryName"`
	CashbackRate       *decimal.Decimal `json:"cashbackRate"`
	EstimatedCashback  decimal.Decimal  `json:"estimatedCashback"`
	RuleCap            *decimal.Decimal `json:"ruleCap"`
	RuleRemaining      *decimal.Decimal `json:"ruleRemaining"`
	CardCap            *decimal.Decimal `json:"cardCap"`
	CardRemaining      *decimal.Decimal `json:"cardRemaining"`
	AvailableCredit    *decimal.Decimal `json:"availableCredit"`
	InsufficientCredit bool             `json:"insufficientCredit"`
	PeriodStart        string           `json:"periodStart"`
	PeriodEnd          string           `json:"periodEnd"`
	Reasons            []string         `json:"reasons"`
}

type recResult struct {
	MCCCode string           `json:"mccCode"`
	Amount  *decimal.Decimal `json:"amount"`
	Cards   []recCard        `json:"cards"`
}

type recPage struct {
	env      *kit.Env
	mcc      *widget.Entry
	amount   *kit.MoneyEntry
	search   *widget.Button
	chips    *fyne.Container
	errs     errBox
	results  *fyne.Container
	selected string // preset mcc highlighted
	seq      int
	loading  bool
	saving   int64  // card being recorded
	idemKey  string // Idempotency-Key kept until the same request succeeds
	idemSig  string // request the key belongs to
}

func buildRecommend(env *kit.Env) fyne.CanvasObject {
	p := &recPage{env: env, errs: newErrBox(), results: container.NewVBox(), chips: container.NewGridWrap(fyne.NewSize(150, 36)),
		mcc: widget.NewEntry(), amount: kit.NewMoneyEntry(0), selected: presets[0].mcc}
	p.mcc.SetText(presets[0].mcc)
	p.mcc.SetPlaceHolder("MCC")
	p.mcc.OnChanged = func(s string) {
		var digits []rune
		for _, r := range s {
			if r >= '0' && r <= '9' && len(digits) < 4 {
				digits = append(digits, r)
			}
		}
		if string(digits) != s {
			p.mcc.SetText(string(digits))
			return
		}
		p.selected = ""
		for _, pr := range presets {
			if pr.mcc == s {
				p.selected = s
			}
		}
		p.renderChips()
	}
	p.amount.SetPlaceHolder(i18n.T("cardRecommend.amountPlaceholder"))
	p.search = widget.NewButton(i18n.T("cardRecommend.search"), p.run)
	p.search.Importance = widget.HighImportance
	p.mcc.OnSubmitted = func(string) { p.run() }

	form := container.NewVBox(
		bold(i18n.T("cardRecommend.category")), p.chips,
		container.NewGridWithColumns(3, container.NewVBox(widget.NewLabel("MCC"), p.mcc),
			container.NewVBox(widget.NewLabel(i18n.T("cardRecommend.amount")), p.amount), container.NewVBox(widget.NewLabel(" "), p.search)),
		kit.Muted(i18n.T("cardRecommend.hint")))
	p.renderChips()
	root := pageRoot(kit.PageHeader(i18n.T("cardRecommend.eyebrow"), i18n.T("route.cardRecommend"), i18n.T("cardRecommend.description")),
		kit.Card("", "", form), p.errs, p.results)
	p.run()
	return root
}

func (p *recPage) renderChips() {
	p.chips.Objects = nil
	for _, pr := range presets {
		pr := pr
		b := widget.NewButton(i18n.T("mcc."+pr.key), func() { p.mcc.SetText(pr.mcc); p.selected = pr.mcc; p.renderChips(); p.run() })
		if pr.mcc == p.selected {
			b.Importance = widget.HighImportance
		}
		p.chips.Add(b)
	}
	p.chips.Refresh()
}

func (p *recPage) run() {
	m := p.mcc.Text
	if !mccRe.MatchString(m) {
		p.errs.set(i18n.T("cardRecommend.invalidMcc"))
		return
	}
	p.errs.set("")
	query := q("mcc", m)
	if v, ok := p.amount.Value(); ok && v.IsPositive() {
		query.Set("amount", v.String())
	}
	p.seq++
	seq := p.seq
	p.loading = true
	p.search.Disable()
	p.search.SetText(i18n.T("cardRecommend.searching"))
	p.results.Objects = []fyne.CanvasObject{widget.NewLabel(i18n.T("cardRecommend.searching"))}
	p.results.Refresh()
	kit.Async(func(ctx context.Context) (recResult, error) {
		var r recResult
		return r, p.env.API.Get(ctx, "credit-card-recommendations", query, &r)
	}, func(r recResult, err error) {
		if seq != p.seq {
			return
		}
		p.loading = false
		p.search.Enable()
		p.search.SetText(i18n.T("cardRecommend.search"))
		if err != nil {
			p.results.Objects = nil
			p.results.Refresh()
			p.errs.set(errText(err, "cardRecommend.error", ""))
			return
		}
		p.render(r)
	})
}

func (p *recPage) render(r recResult) {
	p.results.Objects = nil
	defer p.results.Refresh()
	if len(r.Cards) == 0 {
		p.results.Add(kit.Muted(i18n.T("cardRecommend.noCards")))
		p.results.Add(widget.NewButton(i18n.T("cardImport.addCard"), func() { p.env.Navigate(routeCards, nil) }))
		return
	}
	var best int64 = -1
	if c := r.Cards[0]; !c.InsufficientCredit && c.EstimatedCashback.IsPositive() {
		best = c.CardID
	}
	hasAmount := r.Amount != nil && r.Amount.IsPositive()
	for i, c := range r.Cards {
		p.results.Add(p.cardRow(r, i, c, best == c.CardID, hasAmount))
	}
}

func (p *recPage) cardRow(r recResult, i int, c recCard, best, hasAmount bool) fyne.CanvasObject {
	muted := c.InsufficientCredit || c.RuleID == nil
	name := c.Nickname
	if c.LastFour != nil && *c.LastFour != "" {
		name += " · •••• " + *c.LastFour
	}
	sub := c.BankName
	if c.CardType != nil && *c.CardType != "" {
		sub += " · " + *c.CardType
	}
	title := container.NewHBox(bold("#"+strconv.Itoa(i+1)), logo(p.env, c.BankLogoURL), bold(name), kit.Muted(sub))
	if best {
		title.Add(kit.Badge(i18n.T("cardRecommend.best"), widget.SuccessImportance))
	}
	imp := widget.MediumImportance
	if muted {
		imp = widget.LowImportance
	}
	metric := func(key, val, small string) fyne.CanvasObject {
		v := widget.NewLabel(val)
		v.Importance = imp
		v.TextStyle = fyne.TextStyle{Bold: true}
		box := container.NewVBox(kit.Muted(i18n.T(key)), v)
		if small != "" {
			box.Add(kit.Muted(small))
		}
		return box
	}
	est := format.Dash
	if hasAmount {
		est = format.Money(c.EstimatedCashback, c.Currency)
	}
	rate, rsub := format.Dash, ""
	if c.CashbackRate != nil {
		rate = format.Num(*c.CashbackRate, 2) + "%"
	}
	if c.CategoryName != nil {
		rsub = *c.CategoryName + " · " + str(c.ProgramName)
	}
	avail := format.Dash
	if c.AvailableCredit != nil {
		avail = format.Money(*c.AvailableCredit, c.Currency)
	}
	box := container.NewVBox(title, container.NewGridWithColumns(3,
		metric("cardRecommend.estimated", est, ""), metric("cardRecommend.rate", rate, rsub), metric("cardRecommend.available", avail, "")))
	capBar := func(key string, remaining, limit *decimal.Decimal) {
		if limit == nil {
			return
		}
		rem := format.Dash
		if remaining != nil {
			rem = format.Num(*remaining, 4)
		}
		box.Add(container.NewBorder(nil, nil, widget.NewLabel(i18n.T(key)),
			widget.NewLabel(i18n.T("cardRecommend.remainingOf", i18n.P{"remaining": rem, "cap": format.Num(*limit, 4)})), bar(float64(usedPercent(remaining, limit)))))
	}
	capBar("cardRecommend.groupCap", c.RuleRemaining, c.RuleCap)
	capBar("cardRecommend.cardCap", c.CardRemaining, c.CardCap)

	reasons := container.NewHBox(kit.Muted(i18n.T("cardRecommend.period", i18n.P{"from": c.PeriodStart, "to": c.PeriodEnd})))
	for _, code := range c.Reasons {
		reasons.Add(kit.Badge(trOr("cardRecommend.reason."+code, code), widget.LowImportance))
	}
	rec := widget.NewButton(i18n.T("cardRecommend.record"), func() { p.record(r, c) })
	switch {
	case !hasAmount:
		rec.Disable() // cardRecommend.recordNeedsAmount: an amount is needed
	case p.saving != 0:
		rec.Disable()
	}
	if p.saving == c.CardID {
		rec.SetText(i18n.T("cardImport.saving"))
	}
	box.Add(container.NewBorder(nil, nil, nil, rec, container.NewHScroll(reasons)))
	return widget.NewCard("", "", box)
}

func (p *recPage) record(r recResult, c recCard) {
	if p.saving != 0 || r.Amount == nil {
		return
	}
	desc := "MCC " + r.MCCCode
	for _, pr := range presets {
		if pr.mcc == r.MCCCode {
			desc = i18n.T("mcc." + pr.key)
		}
	}
	body := map[string]any{"transactionDate": format.Today(), "description": desc, "amount": r.Amount, "transactionType": "SPENDING",
		"mccCode": r.MCCCode, "cashbackRuleId": c.RuleID}
	// Reuse the key for an identical retry so a timed-out success is not recorded twice.
	sig, _ := json.Marshal(body)
	if s := fmt.Sprintf("%d:%s", c.CardID, sig); p.idemKey == "" || p.idemSig != s {
		p.idemKey, p.idemSig = newUUID(), s
	}
	key := p.idemKey
	p.saving = c.CardID
	p.render(r)
	kit.Async(func(ctx context.Context) (struct{}, error) {
		return struct{}{}, p.env.API.Post(ctx, "credit-cards/"+strconv.FormatInt(c.CardID, 10)+"/transactions", body, nil, api.WithHeader("Idempotency-Key", key))
	}, func(_ struct{}, err error) {
		p.saving = 0
		if err != nil {
			p.errs.set(errText(err, "cardRecommend.recordError", ""))
			p.render(r)
			return
		}
		p.idemKey, p.idemSig = "", ""
		p.errs.set("")
		p.env.Toast(kit.ToastSuccess, i18n.T("cardRecommend.recorded", i18n.P{"card": c.Nickname}))
		p.run()
	})
}
