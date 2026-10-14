// Package investment holds the investment import, AI queue, history, feed,
// statistics, cash flow and admin summary pages.
package investment

import (
	"context"
	"errors"
	"image/color"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

// Pages registers the investment pages (accounts CRUD and the 22-tab reports live elsewhere).
func Pages(env *kit.Env) []kit.Page {
	const grp = "shell.groupInvestment"
	user := func(id, route, menu string, order int, build func(*kit.Env) fyne.CanvasObject) kit.Page {
		return kit.Page{ID: id, Group: grp, TitleKey: route, MenuKey: menu, Order: order,
			Build: func() fyne.CanvasObject { return build(env) }}
	}
	return []kit.Page{
		user("/app/investment/statistics", "route.investmentStatistics", "shell.investmentStatistics", 20, newStatistics),
		user("/app/investment/cashflow", "route.investmentCashflow", "shell.investmentCashflow", 40, newCashflow),
		user("/app/investment/transactions", "route.investmentTransactions", "shell.investmentTransactions", 50, newImport),
		user("/app/investment/ai-queue", "route.investmentAiQueue", "shell.investmentAiQueue", 60, newAIQueue),
		user("/app/investment/feed", "route.investmentFeed", "shell.investmentFeed", 70, newFeed),
		user("/app/investment/history", "route.investmentHistory", "shell.investmentHistory", 80, newHistory),
		{ID: "/app/admin/investment-reports", Group: "shell.groupAdmin", TitleKey: "investmentReports.admin.title",
			AdminOnly: true, Order: 30, Build: func() fyne.CanvasObject { return newAdminSummary(env) }},
	}
}

// ---- shared API shapes ----

type account struct {
	ID          int64   `json:"id"`
	AccountCode *string `json:"accountCode"`
	AccountName string  `json:"accountName"`
	Currency    string  `json:"currency"`
	Status      string  `json:"status"`
}

func (a account) label() string { return a.AccountName + " · " + a.Currency }

func (a account) labelWithStatus() string {
	key := map[string]string{"ACTIVE": "option.active", "INACTIVE": "option.inactive", "CLOSED": "option.closed"}[a.Status]
	if key == "" {
		key = "investmentTransactions.unknownValue"
	}
	return a.label() + " · " + i18n.T(key)
}

func loadAccounts(ctx context.Context, env *kit.Env) ([]account, error) {
	p, err := api.GetPage[account](ctx, env.API, "investment/accounts", url.Values{"search": {""}}, 0, 100)
	return p.Data, err
}

type txn struct {
	ID                    int64           `json:"id"`
	TransactionType       string          `json:"transactionType"`
	TransactionStatus     string          `json:"transactionStatus"`
	Amount                decimal.Decimal `json:"amount"`
	Currency              string          `json:"currency"`
	TransactionAt         string          `json:"transactionAt"`
	ExternalTransactionID *string         `json:"externalTransactionId"`
	Description           *string         `json:"description"`
	RawText               *string         `json:"rawText"`
	Version               int64           `json:"version"`
}

type dailyFlow struct {
	Date        string          `json:"date"`
	Deposits    decimal.Decimal `json:"deposits"`
	Withdrawals decimal.Decimal `json:"withdrawals"`
	Bonuses     decimal.Decimal `json:"bonuses"`
}

// ---- shared widgets ----

// picker is an account select whose options map to ids by index (labels may repeat).
type picker struct {
	*widget.Select
	ids []int64 // parallel to Options; 0 = "all"
}

// newPicker builds a select over accs (prefixed by an "all" option when allLabel != "").
// selected 0 with allLabel == "" selects nothing. onChange gets the account id (0 = all).
func newPicker(accs []account, allLabel string, label func(account) string, selected int64, onChange func(id int64)) *picker {
	p := &picker{}
	var opts []string
	if allLabel != "" {
		opts, p.ids = append(opts, allLabel), append(p.ids, 0)
	}
	for _, a := range accs {
		opts, p.ids = append(opts, label(a)), append(p.ids, a.ID)
	}
	p.Select = widget.NewSelect(opts, nil)
	for i, id := range p.ids {
		if id == selected && (id != 0 || allLabel != "") {
			p.SetSelectedIndex(i)
		}
	}
	p.OnChanged = func(string) {
		if i := p.SelectedIndex(); i >= 0 && i < len(p.ids) {
			onChange(p.ids[i])
		}
	}
	return p
}

func (p *picker) ID() int64 {
	if i := p.SelectedIndex(); i >= 0 && i < len(p.ids) {
		return p.ids[i]
	}
	return 0
}

func parseID(s string) int64 {
	n, _ := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
	return n
}

// errText is the i18n message plus the trace id suffix when the server sent one.
func errText(key string, err error) string {
	s := i18n.T(key)
	var ae *api.ApiError
	if errors.As(err, &ae) && ae.TraceID != "" {
		s += " · " + i18n.T("investmentTransactions.trace", i18n.P{"id": ae.TraceID})
	}
	return s
}

// banner is a hidden-by-default error line.
type banner struct{ *widget.Label }

func newBanner() banner {
	l := widget.NewLabel("")
	l.Importance, l.Wrapping = widget.DangerImportance, fyne.TextWrapWord
	l.Hide()
	return banner{l}
}

func (b banner) set(text string) {
	b.SetText(text)
	if text == "" {
		b.Hide()
	} else {
		b.Show()
	}
}

func dateText(e *widget.DateEntry) string {
	if e.Date == nil {
		return ""
	}
	return e.Date.Format("2006-01-02")
}

func newDate(s string) *widget.DateEntry {
	e := kit.NewDateEntry()
	if t, err := time.ParseInLocation("2006-01-02", s, time.Local); err == nil {
		e.SetDate(&t)
	}
	return e
}

func labeled(label string, w fyne.CanvasObject) fyne.CanvasObject {
	return container.NewBorder(nil, nil, widget.NewLabel(label), nil, w)
}

// signColor: green for >=0, red for negative.
func signColor(d decimal.Decimal) color.Color {
	if d.IsNegative() {
		return kit.ColorRed
	}
	return kit.ColorGreen
}

func coloredText(text string, c color.Color, bold bool) fyne.CanvasObject {
	t := canvas.NewText(text, c)
	t.TextStyle = fyne.TextStyle{Bold: bold}
	return t
}

// pager renders prev/next with caption; page is 0-based.
func pager(caption string, page, pages int, onPage func(int)) fyne.CanvasObject {
	prev := widget.NewButton(i18n.T("common.previous"), func() { onPage(page - 1) })
	next := widget.NewButton(i18n.T("common.next"), func() { onPage(page + 1) })
	if page <= 0 {
		prev.Disable()
	}
	if page+1 >= pages {
		next.Disable()
	}
	return container.NewHBox(prev, next, widget.NewLabel(caption))
}

// ---- page lifetime ----

var (
	lifeMu  sync.Mutex
	current *life
)

// life is an invisible marker added to a page. Its context ends when the page is
// rebuilt (any investment page) or Fyne destroys the widget after it was removed
// from the window (within about a minute); pollers hang off the context.
type life struct {
	widget.BaseWidget
	ctx    context.Context
	cancel context.CancelFunc
}

func newLife() *life {
	l := &life{}
	l.ctx, l.cancel = context.WithCancel(context.Background())
	lifeMu.Lock()
	if current != nil {
		current.cancel()
	}
	current = l
	lifeMu.Unlock()
	l.ExtendBaseWidget(l)
	return l
}

func (l *life) CreateRenderer() fyne.WidgetRenderer { return &lifeRenderer{l} }

type lifeRenderer struct{ l *life }

func (r *lifeRenderer) Layout(fyne.Size)             {}
func (r *lifeRenderer) MinSize() fyne.Size           { return fyne.NewSize(1, 1) }
func (r *lifeRenderer) Refresh()                     {}
func (r *lifeRenderer) Objects() []fyne.CanvasObject { return nil }
func (r *lifeRenderer) Destroy()                     { r.l.cancel() }

// poll runs tick off the UI thread after `first`, then every `every`, until tick
// returns true, the page goes away, or the returned stop func is called.
// tick must marshal UI updates with fyne.Do.
func (l *life) poll(first, every time.Duration, tick func(ctx context.Context) (stop bool)) (stop func()) {
	ctx, cancel := context.WithCancel(l.ctx)
	go func() {
		d := first
		for {
			t := time.NewTimer(d)
			select {
			case <-ctx.Done():
				t.Stop()
				return
			case <-t.C:
			}
			if tick(ctx) {
				return
			}
			d = every
		}
	}()
	return cancel
}
