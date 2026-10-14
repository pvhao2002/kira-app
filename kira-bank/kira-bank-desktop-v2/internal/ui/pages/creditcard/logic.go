package creditcard

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/i18n"
)

// ---- merchant patterns ----

var (
	spaces       = regexp.MustCompile(`\s+`)
	trailingJunk = regexp.MustCompile(`[\s\-.,:/_]+$`)
)

func cutAtDigit(s string) string {
	if i := strings.IndexAny(s, "0123456789*#"); i > 0 {
		s = s[:i]
	}
	return strings.TrimSpace(s)
}

func truncRunes(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
}

// rulePattern is the merchant keyword pre-filled when remembering a transaction:
// lower-case, collapsed spaces, cut at the first digit/*/#, at most 40 characters.
func rulePattern(desc string) string {
	s := strings.TrimSpace(spaces.ReplaceAllString(strings.ToLower(desc), " "))
	return strings.TrimSpace(truncRunes(cutAtDigit(s), 40))
}

// suggestPattern is the statement-import variant: rulePattern limited to the
// first three words, with trailing punctuation removed.
func suggestPattern(desc string) string {
	s := strings.TrimSpace(spaces.ReplaceAllString(strings.ToLower(desc), " "))
	words := strings.Split(cutAtDigit(s), " ")
	if len(words) > 3 {
		words = words[:3]
	}
	return trailingJunk.ReplaceAllString(truncRunes(strings.Join(words, " "), 40), "")
}

// ---- statement import draft ----

type draftRow struct {
	Line        int
	Include     bool
	Date        string
	PostingDate string
	Desc        string
	Amount      *decimal.Decimal
	Type        string
	MCC         string
	RuleID      *int64
	Remember    bool
	Pattern     string

	Duplicate, NeedsReview, MerchantRule bool
	Warnings                             []string
}

type draftTotals struct {
	StatementDate, DueDate, PeriodStart, PeriodEnd string
	StatementBalance, MinimumPayment               *decimal.Decimal
	Opening, Spending, Refund, Fee, Interest       *decimal.Decimal
}

func rowComplete(r *draftRow) bool {
	return r.Date != "" && strings.TrimSpace(r.Desc) != "" && r.Amount != nil && r.Amount.IsPositive() &&
		r.Type != "" && (strings.TrimSpace(r.MCC) == "" || mccRe.MatchString(strings.TrimSpace(r.MCC)))
}

func includedCount(rows []*draftRow) int {
	n := 0
	for _, r := range rows {
		if r.Include {
			n++
		}
	}
	return n
}

// validateDraft checks the confirm form in the spec's order; "" means valid.
func validateDraft(t draftTotals, rows []*draftRow) string {
	v := func(key string) string { return i18n.T("cardImport.validation." + key) }
	switch {
	case t.StatementDate == "" || t.DueDate == "":
		return v("dates")
	case t.DueDate < t.StatementDate:
		return v("dueBeforeStatement")
	case t.PeriodStart != "" && t.PeriodEnd != "" && t.PeriodEnd < t.PeriodStart:
		return v("period")
	case t.StatementBalance == nil || t.StatementBalance.IsNegative():
		return v("balance")
	case t.StatementBalance.IsPositive() && (t.MinimumPayment == nil || !t.MinimumPayment.IsPositive()):
		return v("minimumRequired")
	case t.MinimumPayment != nil && t.MinimumPayment.GreaterThan(*t.StatementBalance):
		return v("minimumExceeds")
	}
	for _, r := range rows {
		if r.Include && !rowComplete(r) {
			return i18n.T("cardImport.validation.row", i18n.P{"line": r.Line})
		}
	}
	for _, r := range rows {
		if !r.Include || !r.Remember {
			continue
		}
		if n := utf8.RuneCountInString(strings.TrimSpace(r.Pattern)); strings.TrimSpace(r.MCC) == "" || n < 2 || n > 100 {
			return i18n.T("cardImport.validation.remember", i18n.P{"line": r.Line})
		}
	}
	return ""
}

// confirmBody builds the CardStatementConfirmRequest.
func confirmBody(version int64, t draftTotals, rows []*draftRow) map[string]any {
	minimum := t.MinimumPayment
	if t.StatementBalance != nil && t.StatementBalance.IsZero() {
		z := decimal.Zero
		minimum = &z
	}
	txs := make([]map[string]any, 0, len(rows))
	for _, r := range rows {
		if !(r.Include || rowComplete(r)) {
			continue
		}
		mcc := strings.TrimSpace(r.MCC)
		var remember any
		if r.Include && r.Remember && mcc != "" {
			remember = strings.TrimSpace(r.Pattern)
		}
		txs = append(txs, map[string]any{"include": r.Include, "transactionDate": r.Date, "postingDate": nilIfEmpty(r.PostingDate),
			"description": strings.TrimSpace(r.Desc), "amount": r.Amount, "transactionType": r.Type, "mccCode": nilIfEmpty(mcc),
			"cashbackRuleId": r.RuleID, "rememberPattern": remember})
	}
	return map[string]any{"version": version, "statementDate": t.StatementDate, "dueDate": t.DueDate,
		"periodStart": nilIfEmpty(t.PeriodStart), "periodEnd": nilIfEmpty(t.PeriodEnd),
		"openingBalance": t.Opening, "totalSpending": t.Spending, "totalRefund": t.Refund, "totalFee": t.Fee, "totalInterest": t.Interest,
		"statementBalance": t.StatementBalance, "minimumPayment": minimum, "transactions": txs}
}
