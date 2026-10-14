// Package creditcard holds the credit-card feature pages: dashboard, benefits &
// cashback, card recommendation, AI statement import and card transactions.
package creditcard

import (
	"context"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

const (
	routeDashboard = "/app/credit-card/dashboard"
	routeBenefits  = "/app/credit-card/benefits"
	routeTx        = "/app/credit-card/transactions"
	routeImport    = "/app/credit-card/statement-import"
	routeRecommend = "/app/credit-card/recommend"
	routeCards     = "/app/credit-cards"
)

// Pages registers the five credit-card pages in the "Credit cards" sidebar group.
func Pages(env *kit.Env) []kit.Page {
	g := "shell.groupCredit"
	return []kit.Page{
		{ID: routeDashboard, Group: g, TitleKey: "route.creditDashboard", MenuKey: "shell.dashboard", Icon: theme.GridIcon(), Order: 10,
			Build: func() fyne.CanvasObject {
				return page(func(ctx context.Context) fyne.CanvasObject { return buildDashboard(env) })
			}},
		{ID: routeBenefits, Group: g, TitleKey: "route.creditBenefits", MenuKey: "shell.creditBenefits", Icon: theme.ConfirmIcon(), Order: 30,
			Build: func() fyne.CanvasObject {
				return page(func(ctx context.Context) fyne.CanvasObject { return buildBenefits(env, ctx) })
			}},
		{ID: routeTx, Group: g, TitleKey: "route.cardTransactions", MenuKey: "shell.cardTransactions", Icon: theme.ListIcon(), Order: 40,
			Build: func() fyne.CanvasObject {
				return page(func(ctx context.Context) fyne.CanvasObject { return buildTransactions(env) })
			}},
		{ID: routeImport, Group: g, TitleKey: "route.cardImport", MenuKey: "shell.cardImport", Icon: theme.UploadIcon(), Order: 50,
			Build: func() fyne.CanvasObject {
				return page(func(ctx context.Context) fyne.CanvasObject { return buildImport(env, ctx) })
			}},
		{ID: routeRecommend, Group: g, TitleKey: "route.cardRecommend", MenuKey: "shell.cardRecommend", Icon: theme.SearchIcon(), Order: 60,
			Build: func() fyne.CanvasObject {
				return page(func(ctx context.Context) fyne.CanvasObject { return buildRecommend(env) })
			}},
	}
}

// ---- page lifetime ----
// Building a page cancels the previous page's context immediately; leaving to a
// page from another package is noticed when Fyne destroys the anchor's renderer
// (it is no longer painted), which cancels the context too. Pollers select on it.

var current struct {
	sync.Mutex
	cancel context.CancelFunc
}

type anchor struct {
	widget.BaseWidget
	body   fyne.CanvasObject
	cancel context.CancelFunc
}

type anchorRenderer struct{ a *anchor }

func (r anchorRenderer) Layout(s fyne.Size)           { r.a.body.Resize(s) }
func (r anchorRenderer) MinSize() fyne.Size           { return r.a.body.MinSize() }
func (r anchorRenderer) Refresh()                     { r.a.body.Refresh() }
func (r anchorRenderer) Objects() []fyne.CanvasObject { return []fyne.CanvasObject{r.a.body} }
func (r anchorRenderer) Destroy()                     { r.a.cancel() }

func (a *anchor) CreateRenderer() fyne.WidgetRenderer { return anchorRenderer{a} }

func page(build func(ctx context.Context) fyne.CanvasObject) fyne.CanvasObject {
	ctx, cancel := context.WithCancel(context.Background())
	current.Lock()
	if current.cancel != nil {
		current.cancel()
	}
	current.cancel = cancel
	current.Unlock()
	a := &anchor{body: build(ctx), cancel: cancel}
	a.ExtendBaseWidget(a)
	return a
}

// ---- shared API shapes ----

type userCard struct {
	ID          int64   `json:"id"`
	BankID      int64   `json:"bankId"`
	BankName    string  `json:"bankName"`
	BankLogoURL *string `json:"bankLogoUrl"`
	CardType    *string `json:"cardType"`
	Nickname    string  `json:"nickname"`
	LastFour    *string `json:"lastFour"`
	Currency    string  `json:"currency"`
	Status      string  `json:"status"`
}

// label is "nickname · •••• 1234".
func (c userCard) label() string {
	if c.LastFour != nil && *c.LastFour != "" {
		return c.Nickname + " · •••• " + *c.LastFour
	}
	return c.Nickname
}

type group struct {
	ID                int64           `json:"id"`
	CategoryName      string          `json:"categoryName"`
	CashbackRate      decimal.Decimal `json:"cashbackRate"`
	MaxCashbackAmount decimal.Decimal `json:"maxCashbackAmount"`
	MCCCodes          []string        `json:"mccCodes"`
	Version           int64           `json:"version"`
}

type program struct {
	ID       int64   `json:"id"`
	Name     string  `json:"name"`
	Notes    *string `json:"notes"`
	TermsURL *string `json:"termsUrl"`
	Active   bool    `json:"active"`
	Version  int64   `json:"version"`
	Groups   []group `json:"groups"`
}

type benefit struct {
	CardID             int64            `json:"cardId"`
	BankID             int64            `json:"bankId"`
	BankName           string           `json:"bankName"`
	BankLogoURL        *string          `json:"bankLogoUrl"`
	CardType           *string          `json:"cardType"`
	Nickname           string           `json:"nickname"`
	LastFour           *string          `json:"lastFour"`
	Status             string           `json:"status"`
	Currency           string           `json:"currency"`
	MonthlyCashbackCap *decimal.Decimal `json:"monthlyCashbackCap"`
	ConfigVersion      *int64           `json:"configVersion"`
	Programs           []program        `json:"programs"`
}

func loadCards(ctx context.Context, env *kit.Env) ([]userCard, error) {
	return api.GetAll[userCard](ctx, env.API, "credit-cards", nil, 100)
}

func loadBenefits(ctx context.Context, env *kit.Env) ([]benefit, error) {
	var b []benefit
	return b, env.API.Get(ctx, "credit-card-benefits", nil, &b)
}

// categoryOptions: "no category" + every group of the card's active programs
// (the value is the group id, which is what cashbackRuleId holds).
func categoryOptions(bs []benefit, cardID int64) []kit.Option {
	opts := []kit.Option{{Value: "", Label: i18n.T("cardImport.noCategory")}}
	for _, b := range bs {
		if b.CardID != cardID {
			continue
		}
		for _, p := range b.Programs {
			if !p.Active {
				continue
			}
			for _, g := range p.Groups {
				opts = append(opts, kit.Option{Value: strconv.FormatInt(g.ID, 10), Label: g.CategoryName + " — " + p.Name})
			}
		}
	}
	return opts
}

// firstMCC returns the first MCC of the given group of the card ("" if unknown).
func firstMCC(bs []benefit, cardID, groupID int64) string {
	for _, b := range bs {
		if b.CardID != cardID {
			continue
		}
		for _, p := range b.Programs {
			for _, g := range p.Groups {
				if g.ID == groupID && len(g.MCCCodes) > 0 {
					return g.MCCCodes[0]
				}
			}
		}
	}
	return ""
}

// ---- small helpers ----

var mccRe = regexp.MustCompile(`^\d{4}$`)

var txTypes = []string{"SPENDING", "REFUND", "FEE", "INTEREST", "CASHBACK"}

func typeLabel(t string) string { return i18n.T("cardImport.type." + strings.ToLower(t)) }

func typeOptions() []kit.Option {
	var o []kit.Option
	for _, t := range txTypes {
		o = append(o, kit.Option{Value: t, Label: typeLabel(t)})
	}
	return o
}

// trOr translates key when it exists, otherwise returns raw (unknown codes).
func trOr(key, raw string) string {
	if i18n.Has(key) {
		return i18n.T(key)
	}
	return raw
}

func str(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func num4(d decimal.Decimal) string { return format.Num(d, 4) }

func num4p(d *decimal.Decimal) string {
	if d == nil {
		return format.Dash
	}
	return num4(*d)
}

func round4(d decimal.Decimal) decimal.Decimal { return d.Round(4) }

// usedPercent = clamp(round((1 - remaining/cap) * 100), 0, 100); 0 when unknown.
func usedPercent(remaining, limit *decimal.Decimal) int {
	if remaining == nil || limit == nil || !limit.IsPositive() {
		return 0
	}
	p := decimal.NewFromInt(1).Sub(remaining.Div(*limit)).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
	return int(min(100, max(0, p)))
}

func bar(percent float64) *widget.ProgressBar {
	b := widget.NewProgressBar()
	b.TextFormatter = func() string { return "" }
	b.Value = min(100, max(0, percent)) / 100
	return b
}

func logo(env *kit.Env, ref *string) fyne.CanvasObject {
	return env.Image(str(ref), fyne.NewSize(24, 24))
}

func bold(text string) *widget.Label {
	l := widget.NewLabel(text)
	l.TextStyle = fyne.TextStyle{Bold: true}
	return l
}

func label(text string, imp widget.Importance, align fyne.TextAlign) *widget.Label {
	l := widget.NewLabel(text)
	l.Importance = imp
	l.Alignment = align
	l.Truncation = fyne.TextTruncateEllipsis
	return l
}

// errBox is a hidden danger label for page-level errors.
type errBox struct{ *widget.Label }

func newErrBox() errBox {
	l := widget.NewLabel("")
	l.Importance = widget.DangerImportance
	l.Wrapping = fyne.TextWrapWord
	l.Hide()
	return errBox{l}
}

func (e errBox) set(msg string) {
	e.SetText(msg)
	if msg == "" {
		e.Hide()
	} else {
		e.Show()
	}
}

// optSelect is a Select over kit.Option values (labels may repeat).
type optSelect struct {
	*widget.Select
	opts []kit.Option
}

func newOptSelect(opts []kit.Option, onChange func(value string)) *optSelect {
	s := &optSelect{opts: opts}
	s.Select = widget.NewSelect(labelsOf(opts), nil)
	s.PlaceHolder = i18n.T("form.selectPlaceholder")
	s.OnChanged = func(string) {
		if onChange != nil {
			onChange(s.Value())
		}
	}
	return s
}

func labelsOf(opts []kit.Option) []string {
	l := make([]string, len(opts))
	for i, o := range opts {
		l[i] = o.Label
	}
	return l
}

// Value is the selected option value ("" when nothing is selected).
func (s *optSelect) Value() string {
	if i := s.SelectedIndex(); i >= 0 && i < len(s.opts) {
		return s.opts[i].Value
	}
	return ""
}

// SetValue selects the option with that value without notifying (clears when unknown).
func (s *optSelect) SetValue(v string) {
	cb := s.OnChanged
	s.OnChanged = nil
	s.ClearSelected()
	for _, o := range s.opts {
		if o.Value == v {
			s.SetSelected(o.Label)
			break
		}
	}
	s.OnChanged = cb
}

// SetOptions replaces the options and keeps the selection when its value still exists.
func (s *optSelect) SetOptions(opts []kit.Option) {
	old := s.Value()
	s.opts = opts
	cb := s.OnChanged
	s.OnChanged = nil
	s.Options = labelsOf(opts)
	s.Refresh()
	s.OnChanged = cb
	s.SetValue(old)
}

func dateStr(d *widget.DateEntry) string {
	if d.Date == nil {
		return ""
	}
	return d.Date.Format("2006-01-02")
}

func setDate(d *widget.DateEntry, s string) {
	if t, err := time.ParseInLocation("2006-01-02", s, time.Local); err == nil {
		d.SetDate(&t)
	} else {
		d.SetDate(nil)
	}
}

func newDate(s string) *widget.DateEntry {
	d := kit.NewDateEntry()
	setDate(d, s)
	return d
}

func pageRoot(header fyne.CanvasObject, parts ...fyne.CanvasObject) *fyne.Container {
	return container.NewVBox(append([]fyne.CanvasObject{header}, parts...)...)
}

func link(text string, tapped func()) *widget.Button {
	b := widget.NewButton(text, tapped)
	b.Importance = widget.LowImportance
	return b
}

// heading with a canvas-text look used for section titles inside panels.
func section(text string) fyne.CanvasObject {
	t := canvas.NewText(text, theme.Color(theme.ColorNameForeground))
	t.TextStyle = fyne.TextStyle{Bold: true}
	t.TextSize = 16
	return t
}

func intParam(env *kit.Env, key string) int64 {
	n, _ := strconv.ParseInt(env.Params()[key], 10, 64)
	return n
}

func q(kv ...string) url.Values {
	v := url.Values{}
	for i := 0; i+1 < len(kv); i += 2 {
		if kv[i+1] != "" {
			v.Set(kv[i], kv[i+1])
		}
	}
	return v
}

// errText maps an API error to a message; 409 means the data went stale.
func errText(err error, fallbackKey string, staleKey string) string {
	if staleKey != "" && api.StatusOf(err) == 409 {
		return i18n.T(staleKey)
	}
	return api.Message(err, i18n.T(fallbackKey))
}
