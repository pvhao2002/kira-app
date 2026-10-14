package creditcard

import (
	"context"
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

type dashCard struct {
	ID            int64           `json:"id"`
	Nickname      string          `json:"nickname"`
	LastFour      *string         `json:"lastFour"`
	Status        string          `json:"status"`
	StatementDebt decimal.Decimal `json:"statementDebt"`
	Currency      string          `json:"currency"`
}

type dashBank struct {
	BankID             int64           `json:"bankId"`
	BankName           string          `json:"bankName"`
	BankLogoURL        *string         `json:"bankLogoUrl"`
	CardCount          int             `json:"cardCount"`
	TotalCreditLimit   decimal.Decimal `json:"totalCreditLimit"`
	CreditLimitVersion int64           `json:"creditLimitVersion"`
	BalanceVersion     int64           `json:"balanceVersion"`
	StatementDebt      decimal.Decimal `json:"statementDebt"`
	CurrentBalance     decimal.Decimal `json:"currentBalance"`
	AvailableCredit    decimal.Decimal `json:"availableCredit"`
	UtilizationRate    decimal.Decimal `json:"utilizationRate"`
	Currency           string          `json:"currency"`
	Cards              []dashCard      `json:"cards"`
}

type dashboard struct {
	TotalCreditLimit   decimal.Decimal `json:"totalCreditLimit"`
	TotalStatementDebt decimal.Decimal `json:"totalStatementDebt"`
	CurrentBalance     decimal.Decimal `json:"currentBalance"`
	AvailableCredit    decimal.Decimal `json:"availableCredit"`
	UtilizationRate    decimal.Decimal `json:"utilizationRate"`
	Currency           string          `json:"currency"`
	Banks              []dashBank      `json:"banks"`
}

func buildDashboard(env *kit.Env) fyne.CanvasObject {
	var view *kit.AsyncView[dashboard]
	view = kit.NewAsyncView(env, func(ctx context.Context) (dashboard, error) {
		var d dashboard
		return d, env.API.Get(ctx, "dashboards/credit-cards", nil, &d)
	}, func(d dashboard) fyne.CanvasObject { return renderDashboard(env, d, func() { view.Reload() }) })
	return pageRoot(kit.PageHeader(i18n.T("creditDashboard.eyebrow"), i18n.T("creditDashboard.title"), i18n.T("creditDashboard.description")), view)
}

func renderDashboard(env *kit.Env, d dashboard, reload func()) fyne.CanvasObject {
	if len(d.Banks) == 0 {
		return container.NewVBox(bold(i18n.T("creditDashboard.emptyTitle")), kit.Muted(i18n.T("creditDashboard.emptyDescription")))
	}
	cur := d.Currency
	over := d.AvailableCredit.IsNegative()

	used := kit.Tile(i18n.T("creditDashboard.usedCredit"), format.Money(d.CurrentBalance, cur))
	if over {
		used = container.NewVBox(used, kit.Badge(i18n.T("creditDashboard.overLimit"), widget.DangerImportance))
	}
	avail := kit.Tile(i18n.T("creditDashboard.currentBalance"), format.Money(d.AvailableCredit, cur))
	kpis := container.NewGridWithColumns(4,
		kit.Tile(i18n.T("creditDashboard.totalStatementDebt"), format.Money(d.TotalStatementDebt, cur)),
		container.NewVBox(avail, kit.Muted(i18n.T("creditDashboard.utilization", i18n.P{"value": format.Num(d.UtilizationRate, 2)}))),
		kit.Tile(i18n.T("creditDashboard.totalCreditLimit"), format.Money(d.TotalCreditLimit, cur)),
		used)

	usage := container.NewVBox()
	for _, b := range d.Banks {
		over := b.UtilizationRate.GreaterThan(decimal.NewFromInt(100))
		head := container.NewHBox(logo(env, b.BankLogoURL), bold(b.BankName),
			kit.Muted(i18n.T("creditDashboard.cards", i18n.P{"count": b.CardCount})))
		vals := label(format.Money(b.CurrentBalance, b.Currency)+" / "+format.Money(b.TotalCreditLimit, b.Currency), widget.MediumImportance, fyne.TextAlignLeading)
		pct := bold(format.Num(b.UtilizationRate, 2) + "%")
		if over {
			pct.Importance = widget.DangerImportance
		}
		right := container.NewHBox(pct)
		if over {
			right.Add(kit.Badge(i18n.T("creditDashboard.overLimit"), widget.DangerImportance))
		}
		usage.Add(container.NewVBox(container.NewBorder(nil, nil, head, right, vals), bar(b.UtilizationRate.InexactFloat64())))
	}

	return container.NewVBox(kpis,
		kit.Card(i18n.T("creditDashboard.usageByBank"), i18n.T("creditDashboard.usageByBankDescription"), usage),
		kit.Card(i18n.T("creditDashboard.debtDetail"), i18n.T("creditDashboard.debtDetailDescription"), debtTable(env, d, reload)))
}

type dashRow struct {
	bank  *dashBank
	card  *dashCard
	total bool
}

func debtTable(env *kit.Env, d dashboard, reload func()) fyne.CanvasObject {
	expanded := map[int64]bool{}
	var t *kit.Table[dashRow]
	rows := func() []dashRow {
		var out []dashRow
		for i := range d.Banks {
			b := &d.Banks[i]
			out = append(out, dashRow{bank: b})
			if expanded[b.BankID] {
				for j := range b.Cards {
					out = append(out, dashRow{bank: b, card: &b.Cards[j]})
				}
			}
		}
		return append(out, dashRow{total: true})
	}
	refresh := func() { t.SetRows(rows()) }

	shared := func(key string) fyne.CanvasObject {
		l := label(i18n.T(key), widget.LowImportance, fyne.TextAlignTrailing)
		l.TextStyle = fyne.TextStyle{Italic: true}
		return l
	}
	money := func(get func(dashRow) (decimal.Decimal, string), danger func(dashRow) bool, sharedKey string) func(dashRow) fyne.CanvasObject {
		return func(r dashRow) fyne.CanvasObject {
			if r.card != nil && sharedKey != "" {
				return shared(sharedKey)
			}
			v, cur := get(r)
			imp := widget.MediumImportance
			if danger != nil && danger(r) {
				imp = widget.DangerImportance
			}
			return label(format.Money(v, cur), imp, fyne.TextAlignTrailing)
		}
	}
	neg := func(r dashRow) bool {
		if r.total {
			return d.AvailableCredit.IsNegative()
		}
		return r.bank != nil && r.card == nil && r.bank.AvailableCredit.IsNegative()
	}
	hundred := decimal.NewFromInt(100)
	t = kit.NewTable([]kit.Col[dashRow]{
		{Title: i18n.T("creditDashboard.bankCard"), Weight: 2, MinWidth: 180, Cell: func(r dashRow) fyne.CanvasObject {
			switch {
			case r.total:
				return bold(i18n.T("creditDashboard.totalAllBanks"))
			case r.card != nil:
				txt := r.card.Nickname
				if r.card.LastFour != nil && *r.card.LastFour != "" {
					txt += " · " + i18n.T("creditDashboard.lastFour", i18n.P{"value": *r.card.LastFour})
				}
				return container.NewHBox(widget.NewLabel("    "), widget.NewLabel(txt))
			}
			b := r.bank
			icon := theme.MenuDropDownIcon()
			if expanded[b.BankID] {
				icon = theme.MenuDropUpIcon()
			}
			btn := widget.NewButtonWithIcon("", icon, func() { expanded[b.BankID] = !expanded[b.BankID]; refresh() })
			btn.Importance = widget.LowImportance
			return container.NewHBox(btn, logo(env, b.BankLogoURL), bold(b.BankName),
				kit.Muted(i18n.T("creditDashboard.cards", i18n.P{"count": b.CardCount})))
		}},
		{Title: i18n.T("creditDashboard.statementDebt"), Align: fyne.TextAlignTrailing, MinWidth: 110, Cell: func(r dashRow) fyne.CanvasObject {
			switch {
			case r.total:
				return label(format.Money(d.TotalStatementDebt, d.Currency), widget.MediumImportance, fyne.TextAlignTrailing)
			case r.card != nil:
				return label(format.Money(r.card.StatementDebt, r.card.Currency), widget.MediumImportance, fyne.TextAlignTrailing)
			}
			return label(format.Money(r.bank.StatementDebt, r.bank.Currency), widget.MediumImportance, fyne.TextAlignTrailing)
		}},
		{Title: i18n.T("creditDashboard.currentBalance"), Align: fyne.TextAlignTrailing, MinWidth: 110, Cell: money(func(r dashRow) (decimal.Decimal, string) {
			if r.total {
				return d.AvailableCredit, d.Currency
			}
			return r.bank.AvailableCredit, r.bank.Currency
		}, neg, "creditDashboard.sharedBalance")},
		{Title: i18n.T("creditDashboard.creditLimit"), Align: fyne.TextAlignTrailing, MinWidth: 110, Cell: money(func(r dashRow) (decimal.Decimal, string) {
			if r.total {
				return d.TotalCreditLimit, d.Currency
			}
			return r.bank.TotalCreditLimit, r.bank.Currency
		}, nil, "creditDashboard.sharedLimit")},
		{Title: i18n.T("creditDashboard.used"), Align: fyne.TextAlignTrailing, MinWidth: 110, Cell: money(func(r dashRow) (decimal.Decimal, string) {
			if r.total {
				return d.CurrentBalance, d.Currency
			}
			return r.bank.CurrentBalance, r.bank.Currency
		}, nil, "creditDashboard.sharedLimit")},
		{Title: i18n.T("creditDashboard.utilizationColumn"), Align: fyne.TextAlignTrailing, MinWidth: 80, Cell: func(r dashRow) fyne.CanvasObject {
			if r.card != nil {
				return shared("creditDashboard.sharedLimit")
			}
			rate := d.UtilizationRate
			if !r.total {
				rate = r.bank.UtilizationRate
			}
			imp := widget.MediumImportance
			if rate.GreaterThan(hundred) {
				imp = widget.DangerImportance
			}
			return label(format.Num(rate, 2)+"%", imp, fyne.TextAlignTrailing)
		}},
		{Title: i18n.T("creditDashboard.status"), MinWidth: 80, Cell: func(r dashRow) fyne.CanvasObject {
			if r.card != nil {
				return kit.Badge(r.card.Status, widget.MediumImportance)
			}
			if r.total {
				return widget.NewLabel(format.Dash)
			}
			return widget.NewLabel("")
		}},
	},
		kit.RowAction[dashRow]{Label: i18n.T("creditBalance.edit"), Visible: func(r dashRow) bool { return r.bank != nil && r.card == nil },
			Do: func(r dashRow) {
				BankBalanceDialog(env, BankBalanceTarget{BankID: r.bank.BankID, BankName: r.bank.BankName, Remaining: r.bank.AvailableCredit,
					CreditLimit: r.bank.TotalCreditLimit, Currency: r.bank.Currency, Version: r.bank.BalanceVersion}, reload)
			}},
		kit.RowAction[dashRow]{Label: i18n.T("creditDashboard.editLimit"), Visible: func(r dashRow) bool { return r.bank != nil && r.card == nil },
			Do: func(r dashRow) { limitDialog(env, *r.bank, reload) }})
	refresh()
	return t
}

func limitDialog(env *kit.Env, b dashBank, reload func()) {
	env.FormDialog(kit.FormSpec{
		Title:       i18n.T("creditDashboard.editLimitFor", i18n.P{"bank": b.BankName}),
		Description: i18n.T("creditDashboard.editLimitDescription"),
		Fields: []kit.Field{{Key: "creditLimit", Label: i18n.T("field.creditLimit"), Kind: kit.KindMoney, Required: true,
			Min: kit.Dec("0.0001"), Initial: b.TotalCreditLimit}},
		Submit: func(ctx context.Context, v map[string]any) error {
			body := map[string]any{"creditLimit": v["creditLimit"], "version": b.CreditLimitVersion}
			return env.API.Put(ctx, "credit-card-bank-limits/"+strconv.FormatInt(b.BankID, 10), body, nil)
		},
		OnSaved: reload,
	})
}

// BankBalanceTarget identifies the bank whose shared balance is being adjusted.
// Remaining is the available credit (limit - used); Version is the balanceVersion.
type BankBalanceTarget struct {
	BankID      int64
	BankName    string
	Remaining   decimal.Decimal
	CreditLimit decimal.Decimal
	Currency    string
	Version     int64
}

// BankBalanceDialog edits the remaining credit of a bank; it stores the matching
// used amount (limit - remaining, 4 digits) via PUT credit-card-bank-balances.
func BankBalanceDialog(env *kit.Env, t BankBalanceTarget, onSaved func()) {
	env.FormDialog(kit.FormSpec{
		Title: i18n.T("creditBalance.editFor", i18n.P{"bank": t.BankName}),
		Description: i18n.T("creditBalance.editDescription") + "\n" +
			i18n.T("creditBalance.currentValue") + ": " + format.Money(t.Remaining, t.Currency),
		Fields: []kit.Field{
			{Key: "remaining", Label: i18n.T("field.currentBalance"), Kind: kit.KindMoney, Required: true,
				Min: kit.Dec("0"), Max: &t.CreditLimit, Initial: t.Remaining,
				Hint: i18n.T("creditBalance.rangeHint", i18n.P{"limit": format.Money(t.CreditLimit, t.Currency)})},
			{Key: "reason", Label: i18n.T("creditBalance.reason"), Kind: kit.KindTextArea, Required: true, MaxLen: 500},
		},
		Submit: func(ctx context.Context, v map[string]any) error {
			remaining, _ := v["remaining"].(decimal.Decimal)
			body := map[string]any{"currentBalance": round4(t.CreditLimit.Sub(remaining)), "reason": v["reason"], "version": t.Version}
			return env.API.Put(ctx, "credit-card-bank-balances/"+strconv.FormatInt(t.BankID, 10), body, nil)
		},
		OnSaved: onSaved,
	})
}
