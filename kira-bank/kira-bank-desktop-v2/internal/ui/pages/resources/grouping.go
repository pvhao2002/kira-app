package resources

import (
	"sort"
	"strings"

	"github.com/shopspring/decimal"
)

// Card is a UserCreditCard row.
type Card struct {
	ID                 int64            `json:"id"`
	BankID             int64            `json:"bankId"`
	BankName           string           `json:"bankName"`
	BankLogoURL        string           `json:"bankLogoUrl"`
	CardType           string           `json:"cardType"`
	Nickname           string           `json:"nickname"`
	LastFour           string           `json:"lastFour"`
	CreditLimit        decimal.Decimal  `json:"creditLimit"`
	CreditLimitVersion int64            `json:"creditLimitVersion"`
	CurrentBalance     decimal.Decimal  `json:"currentBalance"`
	BalanceVersion     int64            `json:"balanceVersion"`
	Currency           string           `json:"currency"`
	StatementDay       int              `json:"statementDay"`
	DueDay             int              `json:"dueDay"`
	Status             string           `json:"status"`
	Note               string           `json:"note"`
	Version            int64            `json:"version"`
	BillingCycleID     *int64           `json:"billingCycleId"`
	StatementDate      string           `json:"statementDate"`
	PaymentDueDate     string           `json:"paymentDueDate"`
	StatementBalance   *decimal.Decimal `json:"statementBalance"`
	MinimumPayment     *decimal.Decimal `json:"minimumPayment"`
	BillingStatus      string           `json:"billingStatus"`
	BillingVersion     int64            `json:"billingVersion"`
}

// Group is the cards of one bank; limit and balance are shared per bank.
type Group struct {
	BankID         int64
	BankName       string
	LogoURL        string
	Currency       string
	CreditLimit    decimal.Decimal
	CurrentBalance decimal.Decimal // USED amount
	BalanceVersion int64
	Cards          []Card
}

// Remaining is the credit left (limit - used), rounded to 4 dp: what the UI shows
// in the "current balance" cells while the API stores the used amount.
func Remaining(limit, used decimal.Decimal) decimal.Decimal { return limit.Sub(used).Round(4) }

// Used converts a remaining amount back to the used amount the API stores.
func Used(limit, remaining decimal.Decimal) decimal.Decimal { return limit.Sub(remaining).Round(4) }

// GroupCards groups by bankId, groups sorted by case-insensitive bank name.
func GroupCards(cards []Card) []Group {
	idx := map[int64]int{}
	var gs []Group
	for _, c := range cards {
		i, ok := idx[c.BankID]
		if !ok {
			i = len(gs)
			idx[c.BankID] = i
			gs = append(gs, Group{BankID: c.BankID, BankName: c.BankName, LogoURL: c.BankLogoURL,
				Currency: c.Currency, CreditLimit: c.CreditLimit, CurrentBalance: c.CurrentBalance,
				BalanceVersion: c.BalanceVersion})
		}
		gs[i].Cards = append(gs[i].Cards, c)
	}
	sort.SliceStable(gs, func(a, b int) bool {
		return strings.ToLower(gs[a].BankName) < strings.ToLower(gs[b].BankName)
	})
	return gs
}

// Sequence numbers cards 1..n across groups, in display order.
func Sequence(gs []Group) map[int64]int {
	seq := map[int64]int{}
	n := 0
	for _, g := range gs {
		for _, c := range g.Cards {
			n++
			seq[c.ID] = n
		}
	}
	return seq
}

// NeedsAttention is true for billing states highlighted in the table.
func NeedsAttention(status string) bool {
	return status == "NEEDS_INPUT" || status == "UNPAID" || status == "OVERDUE"
}

// BillingError returns the i18n key of a cross-field billing violation, or "".
func BillingError(balance, minimum decimal.Decimal) string {
	switch {
	case balance.IsPositive() && !minimum.IsPositive():
		return "form.minimumPaymentRequired"
	case minimum.GreaterThan(balance):
		return "form.minimumPaymentExceedsBalance"
	}
	return ""
}
