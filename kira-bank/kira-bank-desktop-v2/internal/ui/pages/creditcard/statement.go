package creditcard

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type stmtFile struct {
	AttachmentID int64   `json:"attachmentId"`
	PageNumber   int     `json:"pageNumber"`
	OriginalName *string `json:"originalName"`
}

type draftTx struct {
	LineNumber          int              `json:"lineNumber"`
	TransactionDate     *string          `json:"transactionDate"`
	PostingDate         *string          `json:"postingDate"`
	Description         *string          `json:"description"`
	Amount              *decimal.Decimal `json:"amount"`
	TransactionType     *string          `json:"transactionType"`
	MCCCode             *string          `json:"mccCode"`
	CashbackRuleID      *int64           `json:"cashbackRuleId"`
	Duplicate           bool             `json:"duplicate"`
	NeedsReview         bool             `json:"needsReview"`
	MerchantRuleApplied bool             `json:"merchantRuleApplied"`
	Warnings            []string         `json:"warnings"`
}

type stmtDraft struct {
	StatementDate    *string          `json:"statementDate"`
	DueDate          *string          `json:"dueDate"`
	PeriodStart      *string          `json:"periodStart"`
	PeriodEnd        *string          `json:"periodEnd"`
	OpeningBalance   *decimal.Decimal `json:"openingBalance"`
	TotalSpending    *decimal.Decimal `json:"totalSpending"`
	TotalRefund      *decimal.Decimal `json:"totalRefund"`
	TotalFee         *decimal.Decimal `json:"totalFee"`
	TotalInterest    *decimal.Decimal `json:"totalInterest"`
	StatementBalance *decimal.Decimal `json:"statementBalance"`
	MinimumPayment   *decimal.Decimal `json:"minimumPayment"`
	Warnings         []string         `json:"warnings"`
	AIWarnings       []string         `json:"aiWarnings"`
	Transactions     []draftTx        `json:"transactions"`
}

type stmtResult struct {
	TotalsApplied    bool            `json:"totalsApplied"`
	Inserted         int             `json:"inserted"`
	Skipped          int             `json:"skipped"`
	SupersededManual int             `json:"supersededManual"`
	ExpectedCashback decimal.Decimal `json:"expectedCashback"`
}

type stmtImport struct {
	ID            int64       `json:"id"`
	CardID        int64       `json:"cardId"`
	Status        string      `json:"status"`
	AttemptCount  int         `json:"attemptCount"`
	ErrorCode     *string     `json:"errorCode"`
	Version       int64       `json:"version"`
	AIConfigured  bool        `json:"aiConfigured"`
	StoragePurged bool        `json:"storagePurged"`
	Files         []stmtFile  `json:"files"`
	Draft         *stmtDraft  `json:"draft"`
	Result        *stmtResult `json:"result"`
}

func (s *stmtImport) waiting() bool { return s.Status == "QUEUED" || s.Status == "PROCESSING" }

type importPage struct {
	env      *kit.Env
	ctx      context.Context // page lifetime
	cards    []userCard
	benefits []benefit
	cardID   int64

	cardSel   *optSelect
	picker    *kit.FilePicker
	startBtn  *widget.Button
	errs      errBox
	recentBox *fyne.Container
	statusBox *fyne.Container
	reviewBox *fyne.Container
	body      *fyne.Container // everything below the card picker

	cur       *stmtImport
	reviewKey string
	result    *stmtResult
	busy      bool
	pollStop  context.CancelFunc
	seq       int

	// review widgets
	totals  totalsUI
	rows    []*draftRow
	rowsUI  map[*draftRow]*rowUI
	selInfo *widget.Label
	fmtErr  errBox
}

type totalsUI struct {
	statementDate, dueDate, periodStart, periodEnd *widget.DateEntry
	statementBalance, minimumPayment, opening      *kit.MoneyEntry
	spending, refund, fee, interest                *kit.MoneyEntry
}

type rowUI struct {
	chk *widget.Check
	mcc *widget.Entry
}

func buildImport(env *kit.Env, ctx context.Context) fyne.CanvasObject {
	p := &importPage{env: env, ctx: ctx, errs: newErrBox(), recentBox: container.NewVBox(), statusBox: container.NewVBox(),
		reviewBox: container.NewVBox(), body: container.NewVBox(), rowsUI: map[*draftRow]*rowUI{}, fmtErr: newErrBox()}
	p.cardSel = newOptSelect(nil, func(v string) {
		id, _ := strconv.ParseInt(v, 10, 64)
		if id != p.cardID {
			p.selectCard(id)
		}
	})
	p.cardSel.PlaceHolder = i18n.T("cardImport.cardPlaceholder")

	p.picker = kit.NewFilePicker(env, kit.ImageRules(3))
	p.startBtn = widget.NewButton(i18n.T("cardImport.startImport"), p.upload)
	p.startBtn.Importance = widget.HighImportance
	upload := kit.Card(i18n.T("cardImport.uploadTitle"), i18n.T("cardImport.uploadDescription"),
		container.NewVBox(bold(i18n.T("cardImport.dropTitle")), kit.Muted(i18n.T("cardImport.dropHint")), p.picker, p.startBtn))
	p.body.Objects = []fyne.CanvasObject{upload, p.recentBox, p.statusBox, p.reviewBox}
	p.body.Hide()

	loading := widget.NewLabel(i18n.T("cardImport.loading"))
	cardRow := container.NewVBox(widget.NewLabel(i18n.T("cardImport.card")), p.cardSel)
	root := pageRoot(kit.PageHeader(i18n.T("cardImport.eyebrow"), i18n.T("route.cardImport"), i18n.T("cardImport.description")),
		loading, p.errs, cardRow, p.body)

	importID, cardParam := intParam(env, "importId"), intParam(env, "cardId")
	kit.Async(func(ctx context.Context) (txBoot, error) {
		var b txBoot
		var err error
		if b.cards, err = loadCards(ctx, env); err != nil {
			return b, err
		}
		b.benefits, _ = loadBenefits(ctx, env)
		return b, nil
	}, func(b txBoot, err error) {
		loading.Hide()
		if err != nil {
			p.errs.set(errText(err, "cardImport.errorCards", ""))
			return
		}
		p.cards, p.benefits = b.cards, b.benefits
		if len(b.cards) == 0 {
			cardRow.Hide()
			p.errs.set("")
			root.Add(bold(i18n.T("cardImport.noCards")))
			root.Add(widget.NewButton(i18n.T("cardImport.addCard"), func() { env.Navigate(routeCards, nil) }))
			return
		}
		opts := make([]kit.Option, len(b.cards))
		for i, c := range b.cards {
			opts[i] = kit.Option{Value: strconv.FormatInt(c.ID, 10), Label: c.label() + " — " + c.BankName}
		}
		p.cardSel.SetOptions(opts)
		if importID > 0 {
			p.openByID(importID, true)
			return
		}
		pick := b.cards[0].ID
		for _, c := range b.cards {
			if c.ID == cardParam {
				pick = c.ID
			}
		}
		p.cardSel.SetValue(strconv.FormatInt(pick, 10))
		p.selectCard(pick)
	})
	return root
}

// selectCard clears the current import and loads the card's recent imports.
func (p *importPage) selectCard(id int64) {
	p.stopPoll()
	p.cardID = id
	p.cur, p.result, p.reviewKey = nil, nil, ""
	p.picker.Clear()
	p.statusBox.Objects, p.reviewBox.Objects = nil, nil
	p.statusBox.Refresh()
	p.reviewBox.Refresh()
	p.body.Show()
	p.loadRecent()
}

func (p *importPage) loadRecent() {
	id := p.cardID
	kit.Async(func(ctx context.Context) ([]stmtImport, error) {
		var l []stmtImport
		return l, p.env.API.Get(ctx, "credit-cards/"+strconv.FormatInt(id, 10)+"/statement-imports", nil, &l)
	}, func(l []stmtImport, err error) {
		if id != p.cardID || err != nil {
			return
		}
		p.recentBox.Objects = nil
		if len(l) > 0 {
			row := container.NewHBox()
			for _, it := range l {
				it := it
				txt := fmt.Sprintf("#%d · %s · %s", it.ID, i18n.T("cardImport.pages", i18n.P{"count": len(it.Files)}), statusLabel(it.Status))
				row.Add(widget.NewButton(txt, func() { p.openByID(it.ID, false) }))
			}
			p.recentBox.Add(kit.Card(i18n.T("cardImport.recentTitle"), "", container.NewHScroll(row)))
		}
		p.recentBox.Refresh()
	})
}

func statusLabel(s string) string { return trOr("cardImport.status."+strings.ToLower(s), s) }

// openByID loads an import; with syncCard the card picker follows the import's card.
func (p *importPage) openByID(id int64, syncCard bool) {
	kit.Async(func(ctx context.Context) (stmtImport, error) {
		var s stmtImport
		return s, p.env.API.Get(ctx, "statement-imports/"+strconv.FormatInt(id, 10), nil, &s)
	}, func(s stmtImport, err error) {
		if err != nil {
			p.errs.set(errText(err, "cardImport.errorLoad", ""))
			return
		}
		p.errs.set("")
		if syncCard || s.CardID != p.cardID {
			p.cardSel.SetValue(strconv.FormatInt(s.CardID, 10))
			p.selectCard(s.CardID)
		}
		p.result = s.Result
		p.show(&s)
	})
}

func (p *importPage) upload() {
	if p.busy || p.cardID == 0 {
		return
	}
	files := p.picker.Files()
	if len(files) == 0 {
		return
	}
	p.busy = true
	p.startBtn.Disable()
	p.startBtn.SetText(i18n.T("cardImport.uploading"))
	card := p.cardID
	kit.Async(func(ctx context.Context) (stmtImport, error) {
		var s stmtImport
		return s, p.env.API.Upload(ctx, "credit-cards/"+strconv.FormatInt(card, 10)+"/statement-imports", nil, "files", files, &s)
	}, func(s stmtImport, err error) {
		p.busy = false
		p.startBtn.Enable()
		p.startBtn.SetText(i18n.T("cardImport.startImport"))
		if err != nil {
			p.errs.set(errText(err, "cardImport.errorUpload", ""))
			return
		}
		p.errs.set("")
		if card != p.cardID {
			return
		}
		p.picker.Clear()
		p.result = nil
		p.show(&s)
		p.loadRecent()
	})
}

// ---- polling ----

func (p *importPage) stopPoll() {
	if p.pollStop != nil {
		p.pollStop()
		p.pollStop = nil
	}
}

// poll fetches the import after 3 s, then every 5 s, until it leaves QUEUED/PROCESSING,
// fails, the card changes, or the page is left (p.ctx).
func (p *importPage) poll(id int64) {
	p.stopPoll()
	ctx, cancel := context.WithCancel(p.ctx)
	p.pollStop = cancel
	go func() {
		wait := 3 * time.Second
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(wait):
			}
			wait = 5 * time.Second
			var s stmtImport
			err := p.env.API.Get(ctx, "statement-imports/"+strconv.FormatInt(id, 10), nil, &s)
			if ctx.Err() != nil {
				return
			}
			done := err != nil || !s.waiting()
			fyne.Do(func() {
				if ctx.Err() != nil {
					return
				}
				switch {
				case err != nil:
					p.errs.set(i18n.T("cardImport.errorPolling"))
				default:
					p.show(&s)
					if !s.waiting() {
						p.loadRecent()
					}
				}
			})
			if done {
				return
			}
		}
	}()
}

// ---- status panel ----

func (p *importPage) show(s *stmtImport) {
	p.cur = s
	if s.waiting() {
		if p.pollStop == nil {
			p.poll(s.ID)
		}
	} else {
		p.stopPoll()
	}
	p.renderStatus()
	key := fmt.Sprintf("%d:%s", s.ID, s.Status)
	if key != p.reviewKey { // never overwrite the user's edits while polling the same state
		p.reviewKey = key
		p.renderReview()
	}
}

func (p *importPage) renderStatus() {
	s := p.cur
	box := container.NewVBox()
	imp := widget.MediumImportance
	switch s.Status {
	case "FAILED":
		imp = widget.DangerImportance
	case "CONFIRMED", "READY":
		imp = widget.SuccessImportance
	}
	box.Add(container.NewBorder(nil, nil, container.NewVBox(bold(i18n.T("cardImport.importTitle", i18n.P{"id": s.ID})),
		kit.Muted(i18n.T("cardImport.attempts", i18n.P{"count": s.AttemptCount}))), kit.Badge(statusLabel(s.Status), imp)))
	switch s.Status {
	case "QUEUED", "PROCESSING":
		box.Add(bold(i18n.T("cardImport.waitingTitle")))
		if s.AIConfigured {
			box.Add(kit.Muted(i18n.T("cardImport.waitingDescription")))
		} else {
			box.Add(kit.Muted(i18n.T("cardImport.aiNotConfigured")))
		}
		box.Add(widget.NewProgressBarInfinite())
	case "FAILED":
		box.Add(bold(i18n.T("cardImport.failedTitle")))
		box.Add(kit.Muted(i18n.T("cardImport.failedDescription")))
		if s.ErrorCode != nil {
			l := widget.NewLabel(*s.ErrorCode)
			l.TextStyle = fyne.TextStyle{Monospace: true}
			box.Add(l)
		}
	case "CANCELLED":
		box.Add(bold(i18n.T("cardImport.cancelledTitle")))
	case "CONFIRMED":
		box.Add(bold(i18n.T("cardImport.confirmedTitle")))
		box.Add(link(i18n.T("cardImport.openCards"), func() { p.env.Navigate(routeCards, nil) }))
	}
	actions := container.NewHBox()
	if s.Status == "FAILED" && !s.StoragePurged {
		actions.Add(widget.NewButton(i18n.T("cardImport.retry"), func() { p.action("retry", "cardImport.errorRetry") }))
	}
	if s.Status == "QUEUED" || s.Status == "READY" || s.Status == "FAILED" {
		actions.Add(widget.NewButton(i18n.T("cardImport.cancel"), func() { p.action("cancel", "cardImport.errorCancel") }))
	}
	if len(actions.Objects) > 0 {
		box.Add(actions)
	}
	if r := p.result; r != nil {
		box.Add(kit.Sep())
		box.Add(bold(i18n.T("cardImport.resultTitle")))
		box.Add(widget.NewLabel(i18n.T("cardImport.resultInserted", i18n.P{"count": r.Inserted})))
		box.Add(widget.NewLabel(i18n.T("cardImport.resultSkipped", i18n.P{"count": r.Skipped})))
		if r.SupersededManual > 0 {
			box.Add(widget.NewLabel(i18n.T("cardImport.resultSuperseded", i18n.P{"count": r.SupersededManual})))
		}
		box.Add(widget.NewLabel(i18n.T("cardImport.resultCashback", i18n.P{"amount": num4(r.ExpectedCashback)})))
		if !r.TotalsApplied {
			l := widget.NewLabel(i18n.T("cardImport.totalsNotApplied"))
			l.Importance = widget.WarningImportance
			l.Wrapping = fyne.TextWrapWord
			box.Add(l)
		}
	}
	p.statusBox.Objects = []fyne.CanvasObject{kit.Card("", "", box)}
	p.statusBox.Refresh()
}

// action posts retry/cancel with the current version.
func (p *importPage) action(verb, errKey string) {
	if p.busy || p.cur == nil {
		return
	}
	p.busy = true
	s := p.cur
	kit.Async(func(ctx context.Context) (stmtImport, error) {
		var out stmtImport
		return out, p.env.API.Post(ctx, "statement-imports/"+strconv.FormatInt(s.ID, 10)+"/"+verb, map[string]any{"version": s.Version}, &out)
	}, func(out stmtImport, err error) {
		p.busy = false
		if err != nil {
			p.errs.set(errText(err, errKey, ""))
			return
		}
		p.errs.set("")
		p.show(&out)
		p.loadRecent()
	})
}

// ---- review panel ----

func (p *importPage) renderReview() {
	s := p.cur
	p.reviewBox.Objects = nil
	defer p.reviewBox.Refresh()
	if s.Status != "READY" || s.Draft == nil {
		return
	}
	d := s.Draft
	box := container.NewVBox(bold(i18n.T("cardImport.reviewTitle")), kit.Muted(i18n.T("cardImport.reviewDescription")))
	for _, w := range d.Warnings {
		l := widget.NewLabel("• " + trOr("cardImport.warning."+w, w))
		l.Importance = widget.WarningImportance
		box.Add(l)
	}
	for _, w := range d.AIWarnings {
		l := widget.NewLabel("• " + w)
		l.Importance = widget.WarningImportance
		l.Wrapping = fyne.TextWrapWord
		box.Add(l)
	}

	// totals form
	t := &p.totals
	t.statementDate, t.dueDate = newDate(str(d.StatementDate)), newDate(str(d.DueDate))
	t.periodStart, t.periodEnd = newDate(str(d.PeriodStart)), newDate(str(d.PeriodEnd))
	mk := func(v *decimal.Decimal) *kit.MoneyEntry {
		m := kit.NewMoneyEntry(4)
		if v != nil {
			m.SetValue(*v)
		}
		return m
	}
	t.statementBalance, t.minimumPayment, t.opening = mk(d.StatementBalance), mk(d.MinimumPayment), mk(d.OpeningBalance)
	t.spending, t.refund, t.fee, t.interest = mk(d.TotalSpending), mk(d.TotalRefund), mk(d.TotalFee), mk(d.TotalInterest)
	f := func(key string, req bool, w fyne.CanvasObject) fyne.CanvasObject {
		l := i18n.T(key)
		if req {
			l += " *"
		}
		return container.NewVBox(widget.NewLabel(l), w)
	}
	totals := container.NewVBox(
		container.NewGridWithColumns(2, f("cardImport.statementDate", true, t.statementDate), f("cardImport.dueDate", true, t.dueDate)),
		container.NewGridWithColumns(2, f("cardImport.periodStart", false, t.periodStart), f("cardImport.periodEnd", false, t.periodEnd)),
		container.NewGridWithColumns(2, f("cardImport.statementBalance", true, t.statementBalance), f("cardImport.minimumPayment", true, t.minimumPayment)),
		container.NewGridWithColumns(2, f("cardImport.openingBalance", false, t.opening), f("cardImport.totalSpending", false, t.spending)),
		container.NewGridWithColumns(2, f("cardImport.totalRefund", false, t.refund), f("cardImport.totalFee", false, t.fee)),
		f("cardImport.totalInterest", false, t.interest))
	box.Add(container.NewGridWithColumns(2, p.sourceViewer(s), totals))

	// transactions
	p.rows = nil
	p.rowsUI = map[*draftRow]*rowUI{}
	for _, tx := range d.Transactions {
		r := &draftRow{Line: tx.LineNumber, Include: !tx.Duplicate, Date: str(tx.TransactionDate), PostingDate: str(tx.PostingDate),
			Desc: str(tx.Description), Amount: tx.Amount, Type: str(tx.TransactionType), MCC: str(tx.MCCCode), RuleID: tx.CashbackRuleID,
			Duplicate: tx.Duplicate, NeedsReview: tx.NeedsReview, MerchantRule: tx.MerchantRuleApplied, Warnings: tx.Warnings}
		p.rows = append(p.rows, r)
	}
	p.selInfo = bold("")
	p.updateSelInfo()
	selAll := widget.NewButton(i18n.T("cardImport.selectAll"), func() { p.setAll(true) })
	selNone := widget.NewButton(i18n.T("cardImport.selectNone"), func() { p.setAll(false) })
	box.Add(container.NewBorder(nil, nil, p.selInfo, container.NewHBox(selAll, selNone)))
	if len(p.rows) == 0 {
		box.Add(kit.Muted(i18n.T("cardImport.noTransactions")))
	} else {
		box.Add(container.NewHScroll(p.rowsTable(s)))
	}

	// confirm bar
	confirm := widget.NewButton(i18n.T("cardImport.confirm"), nil)
	confirm.Importance = widget.HighImportance
	confirm.OnTapped = func() { p.confirm(confirm) }
	box.Add(kit.Muted(i18n.T("cardImport.confirmHint")))
	box.Add(p.fmtErr)
	p.fmtErr.set("")
	box.Add(confirm)
	p.reviewBox.Objects = []fyne.CanvasObject{kit.Card("", "", box)}
}

func (p *importPage) updateSelInfo() {
	p.selInfo.SetText(i18n.T("cardImport.transactionsTitle", i18n.P{"selected": includedCount(p.rows), "total": len(p.rows)}))
}

func (p *importPage) setAll(on bool) {
	for _, r := range p.rows {
		r.Include = on
		if u := p.rowsUI[r]; u != nil && u.chk != nil {
			u.chk.SetChecked(on)
		}
	}
	p.updateSelInfo()
}

func (p *importPage) rowsTable(s *stmtImport) fyne.CanvasObject {
	cardID := s.CardID
	catOpts := categoryOptions(p.benefits, cardID)
	ui := func(r *draftRow) *rowUI {
		u := p.rowsUI[r]
		if u == nil {
			u = &rowUI{}
			p.rowsUI[r] = u
		}
		return u
	}
	typeOpts := typeOptions()
	t := kit.NewTable([]kit.Col[*draftRow]{
		{Title: i18n.T("cardImport.include"), MinWidth: 60, Cell: func(r *draftRow) fyne.CanvasObject {
			c := widget.NewCheck("", func(on bool) { r.Include = on; p.updateSelInfo() })
			c.SetChecked(r.Include)
			ui(r).chk = c
			return c
		}},
		{Title: i18n.T("cardImport.date"), MinWidth: 150, Cell: func(r *draftRow) fyne.CanvasObject {
			d := newDate(r.Date)
			d.OnChanged = func(*time.Time) { r.Date = dateStr(d) }
			return d
		}},
		{Title: i18n.T("field.description"), Weight: 2, MinWidth: 220, Cell: func(r *draftRow) fyne.CanvasObject {
			e := widget.NewEntry()
			e.SetText(r.Desc)
			e.OnChanged = func(v string) {
				r.Desc = v
				if len([]rune(v)) > 500 {
					e.SetText(truncRunes(v, 500))
				}
			}
			return e
		}},
		{Title: i18n.T("field.amount"), MinWidth: 130, Cell: func(r *draftRow) fyne.CanvasObject {
			m := kit.NewMoneyEntry(4)
			if r.Amount != nil {
				m.SetValue(*r.Amount)
			}
			m.OnValueChanged = func() {
				if v, ok := m.Value(); ok {
					r.Amount = &v
				} else {
					r.Amount = nil
				}
			}
			return m
		}},
		{Title: i18n.T("cardImport.type"), MinWidth: 120, Cell: func(r *draftRow) fyne.CanvasObject {
			sel := newOptSelect(typeOpts, func(v string) { r.Type = v })
			sel.PlaceHolder = i18n.T("cardImport.notSelected")
			sel.SetValue(r.Type)
			return sel
		}},
		{Title: i18n.T("cardImport.category"), MinWidth: 170, Cell: func(r *draftRow) fyne.CanvasObject {
			sel := newOptSelect(catOpts, func(v string) {
				if v == "" {
					r.RuleID = nil
					return
				}
				id, _ := strconv.ParseInt(v, 10, 64)
				r.RuleID = &id
				if strings.TrimSpace(r.MCC) == "" {
					r.MCC = firstMCC(p.benefits, cardID, id)
					if u := ui(r); u.mcc != nil {
						u.mcc.SetText(r.MCC)
					}
				}
			})
			if r.RuleID != nil {
				sel.SetValue(strconv.FormatInt(*r.RuleID, 10))
			} else {
				sel.SetValue("")
			}
			return sel
		}},
		{Title: "MCC", MinWidth: 70, Cell: func(r *draftRow) fyne.CanvasObject {
			e := widget.NewEntry()
			e.SetText(r.MCC)
			e.OnChanged = func(v string) {
				if len(v) > 4 {
					e.SetText(v[:4])
					return
				}
				r.MCC = v
			}
			ui(r).mcc = e
			return e
		}},
		{Title: i18n.T("cardImport.remember"), MinWidth: 170, Cell: func(r *draftRow) fyne.CanvasObject {
			pat := widget.NewEntry()
			pat.SetPlaceHolder(i18n.T("cardImport.rememberPattern"))
			pat.OnChanged = func(v string) {
				if len([]rune(v)) > 100 {
					pat.SetText(truncRunes(v, 100))
					return
				}
				r.Pattern = v
			}
			pat.Hide()
			chk := widget.NewCheck(i18n.T("cardImport.rememberShort"), func(on bool) {
				r.Remember = on
				if on {
					if strings.TrimSpace(pat.Text) == "" {
						pat.SetText(suggestPattern(r.Desc))
					}
					pat.Show()
				} else {
					pat.Hide()
				}
			})
			return container.NewVBox(chk, pat)
		}},
		{Title: i18n.T("cardImport.warnings"), MinWidth: 170, Cell: func(r *draftRow) fyne.CanvasObject {
			box := container.NewVBox()
			if r.MerchantRule {
				box.Add(kit.Badge(i18n.T("cardImport.byMerchantRule"), widget.MediumImportance))
			}
			for _, w := range r.Warnings {
				imp := widget.WarningImportance
				if w == "DUPLICATE" {
					imp = widget.DangerImportance
				}
				box.Add(kit.Badge(trOr("cardImport.warning."+w, w), imp))
			}
			return box
		}},
	})
	t.SetRows(p.rows)
	return t
}

func (p *importPage) readTotals() draftTotals {
	val := func(m *kit.MoneyEntry) *decimal.Decimal {
		if v, ok := m.Value(); ok {
			return &v
		}
		return nil
	}
	t := &p.totals
	return draftTotals{StatementDate: dateStr(t.statementDate), DueDate: dateStr(t.dueDate),
		PeriodStart: dateStr(t.periodStart), PeriodEnd: dateStr(t.periodEnd),
		StatementBalance: val(t.statementBalance), MinimumPayment: val(t.minimumPayment), Opening: val(t.opening),
		Spending: val(t.spending), Refund: val(t.refund), Fee: val(t.fee), Interest: val(t.interest)}
}

func (p *importPage) confirm(btn *widget.Button) {
	if p.busy || p.cur == nil {
		return
	}
	totals := p.readTotals()
	if msg := validateDraft(totals, p.rows); msg != "" {
		p.fmtErr.set(msg)
		return
	}
	p.fmtErr.set("")
	s := p.cur
	body := confirmBody(s.Version, totals, p.rows)
	p.busy = true
	btn.Disable()
	btn.SetText(i18n.T("cardImport.saving"))
	kit.Async(func(ctx context.Context) (stmtResult, error) {
		var r stmtResult
		return r, p.env.API.Post(ctx, "statement-imports/"+strconv.FormatInt(s.ID, 10)+"/confirm", body, &r)
	}, func(r stmtResult, err error) {
		p.busy = false
		btn.Enable()
		btn.SetText(i18n.T("cardImport.confirm"))
		if err != nil {
			p.fmtErr.set(errText(err, "cardImport.errorConfirm", ""))
			return
		}
		p.result = &r
		p.env.Toast(kit.ToastSuccess, i18n.T("cardImport.confirmed", i18n.P{"count": r.Inserted}))
		p.openByID(s.ID, false)
		p.loadRecent()
	})
}

// ---- source page viewer ----

func (p *importPage) sourceViewer(s *stmtImport) fyne.CanvasObject {
	box := container.NewVBox(bold(i18n.T("cardImport.sourceTitle")))
	if s.StoragePurged {
		box.Add(kit.Muted(i18n.T("cardImport.sourcePurged")))
		return box
	}
	if len(s.Files) == 0 {
		box.Add(kit.Muted(i18n.T("cardImport.sourceNone")))
		return box
	}
	holder := container.NewStack()
	zoom := widget.NewButton(i18n.T("cardImport.zoomIn"), nil)
	zoom.Hide()
	var img *canvas.Image
	zoomed := false
	zoom.OnTapped = func() {
		zoomed = !zoomed
		if zoomed {
			img.FillMode = canvas.ImageFillOriginal
			img.SetMinSize(fyne.NewSize(0, 0))
			holder.Objects = []fyne.CanvasObject{container.NewScroll(img)}
			zoom.SetText(i18n.T("cardImport.zoomOut"))
		} else {
			img.FillMode = canvas.ImageFillContain
			img.SetMinSize(fyne.NewSize(300, 420))
			holder.Objects = []fyne.CanvasObject{img}
			zoom.SetText(i18n.T("cardImport.zoomIn"))
		}
		holder.Refresh()
	}
	var load func(f stmtFile)
	seq := 0
	load = func(f stmtFile) {
		seq++
		my := seq
		zoomed = false
		zoom.SetText(i18n.T("cardImport.zoomIn"))
		holder.Objects = []fyne.CanvasObject{widget.NewLabel(i18n.T("cardImport.loading"))}
		holder.Refresh()
		kit.Async(func(ctx context.Context) ([]byte, error) {
			b, _, err := p.env.API.Bytes(ctx, "attachments/"+strconv.FormatInt(f.AttachmentID, 10)+"/content", nil)
			return b, err
		}, func(b []byte, err error) {
			if my != seq {
				return
			}
			if err != nil || len(b) == 0 {
				holder.Objects = []fyne.CanvasObject{kit.Muted(i18n.T("cardImport.sourceFailed"))}
				holder.Refresh()
				return
			}
			img = canvas.NewImageFromResource(fyne.NewStaticResource(fmt.Sprintf("page-%d", f.PageNumber), b))
			img.FillMode = canvas.ImageFillContain
			img.SetMinSize(fyne.NewSize(300, 420))
			holder.Objects = []fyne.CanvasObject{img}
			holder.Refresh()
			zoom.Show()
		})
	}
	if len(s.Files) > 1 {
		tabs := container.NewHBox()
		for _, f := range s.Files {
			f := f
			tabs.Add(widget.NewButton(i18n.T("cardImport.page", i18n.P{"page": f.PageNumber}), func() { load(f) }))
		}
		box.Add(tabs)
	}
	box.Add(holder)
	box.Add(zoom)
	load(s.Files[0])
	return box
}
