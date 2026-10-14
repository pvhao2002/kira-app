package investment

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type importFile struct {
	AttachmentID int64   `json:"attachmentId"`
	OriginalName string  `json:"originalName"`
	ContentURL   string  `json:"contentUrl"`
	Status       string  `json:"status"`
	ErrorCode    *string `json:"errorCode"`
}

type importItem struct {
	ItemID                string           `json:"itemId"`
	Version               int64            `json:"version"`
	TransactionType       *string          `json:"transactionType"`
	TransactionStatus     *string          `json:"transactionStatus"`
	Amount                *decimal.Decimal `json:"amount"`
	Currency              *string          `json:"currency"`
	TransactionAt         *string          `json:"transactionAt"`
	ExternalTransactionID *string          `json:"externalTransactionId"`
	Description           *string          `json:"description"`
	RawText               *string          `json:"rawText"`
	Confidence            *decimal.Decimal `json:"confidence"`
	ProcessingAction      string           `json:"processingAction"`
	MatchedTransactionID  *int64           `json:"matchedTransactionId"`
	Warnings              []string         `json:"warnings"`
}

type importBatch struct {
	BatchID   string `json:"batchId"`
	AccountID int64  `json:"accountId"`
	Status    string `json:"status"`
	Summary   struct {
		Detected, Inserted, Updated, Skipped, Failed, Review int
	} `json:"summary"`
	Files        []importFile `json:"files"`
	Transactions []importItem `json:"transactions"`
}

type confirmResponse struct {
	Inserted int `json:"inserted"`
	Updated  int `json:"updated"`
	Skipped  int `json:"skipped"`
	Failed   int `json:"failed"`
}

type importPage struct {
	env  *kit.Env
	life *life
	root *fyne.Container
	err  banner
	body *fyne.Container
	head *fyne.Container

	accounts  []account
	accountID int64
	files     *kit.FilePicker
	create    *widget.Button
	uploading bool

	batch      *importBatch
	rows       []*reviewRow
	table      *kit.Table[*reviewRow]
	result     *confirmResponse
	confirming bool
	stopPoll   func()
}

func importPath(accountID int64, rest string) string {
	return fmt.Sprintf("investment/accounts/%d/transaction-imports%s", accountID, rest)
}

func newImport(env *kit.Env) fyne.CanvasObject {
	p := &importPage{env: env, life: newLife(), err: newBanner(), body: container.NewVBox(), head: container.NewVBox()}
	rules := kit.ImageRules(10)
	rules.MaxTotalBytes = 50 << 20
	rules.ErrTooMany, rules.ErrInvalid, rules.ErrTotal = "investmentTransactions.errorTooManyFiles", "investmentTransactions.errorInvalidFiles", "investmentTransactions.errorTotalSize"
	p.files = kit.NewFilePicker(env, rules)
	p.create = widget.NewButton(i18n.T("investmentTransactions.createBatch"), p.createBatch)
	p.files.OnChanged = p.syncCreate
	p.syncCreate()
	p.root = container.NewVBox(
		kit.PageHeader(i18n.T("investmentTransactions.eyebrow"), i18n.T("route.investmentTransactions"), i18n.T("investmentTransactions.description")),
		p.err, p.head, p.body, p.life)
	p.render()
	kit.Async(func(ctx context.Context) ([]account, error) { return loadAccounts(ctx, env) }, p.accountsLoaded)
	return p.root
}

func (p *importPage) accountsLoaded(accs []account, err error) {
	if err != nil {
		p.err.set(errText("investmentTransactions.errorAccountLoad", err))
		return
	}
	p.accounts = accs
	params := p.env.Params()
	want := parseID(params["accountId"])
	if want != 0 {
		found := false
		for _, a := range accs {
			found = found || a.ID == want
		}
		if !found {
			p.err.set(i18n.T("investmentTransactions.errorReviewTarget"))
			want = 0
		}
	}
	if want == 0 && len(accs) > 0 {
		want = accs[0].ID
	}
	p.accountID = want
	pk := newPicker(accs, "", account.labelWithStatus, want, p.selectAccount)
	pk.PlaceHolder = i18n.T("investmentTransactions.accountPlaceholder")
	p.head.Objects = []fyne.CanvasObject{labeled(i18n.T("investmentTransactions.account"), pk)}
	p.head.Refresh()
	p.syncCreate()
	if bid := params["batchId"]; bid != "" && want == parseID(params["accountId"]) {
		p.loadBatch(bid)
	}
}

func (p *importPage) selectAccount(id int64) {
	p.stop()
	p.accountID, p.batch, p.rows, p.result = id, nil, nil, nil
	p.files.Clear()
	p.err.set("")
	p.syncCreate()
	p.render()
}

func (p *importPage) stop() {
	if p.stopPoll != nil {
		p.stopPoll()
		p.stopPoll = nil
	}
}

func (p *importPage) syncCreate() {
	if p.uploading {
		p.create.SetText(i18n.T("investmentTransactions.uploading"))
	} else {
		p.create.SetText(i18n.T("investmentTransactions.createBatch"))
	}
	if p.uploading || p.accountID == 0 || len(p.files.Files()) == 0 {
		p.create.Disable()
	} else {
		p.create.Enable()
	}
}

func (p *importPage) createBatch() {
	id, files := p.accountID, p.files.Files()
	p.uploading = true
	p.err.set("")
	p.syncCreate()
	kit.Async(func(ctx context.Context) (importBatch, error) {
		var b importBatch
		return b, p.env.API.Upload(ctx, importPath(id, ""), nil, "files", files, &b)
	}, func(b importBatch, err error) {
		p.uploading = false
		p.syncCreate()
		if err != nil {
			p.err.set(errText("investmentTransactions.errorCreateBatch", err))
			return
		}
		if id != p.accountID {
			return
		}
		p.files.Clear()
		p.result = nil
		p.setBatch(b)
	})
}

func (p *importPage) loadBatch(batchID string) {
	id := p.accountID
	kit.Async(func(ctx context.Context) (importBatch, error) {
		var b importBatch
		return b, p.env.API.Get(ctx, importPath(id, "/"+batchID), nil, &b)
	}, func(b importBatch, err error) {
		if err != nil {
			p.err.set(errText("investmentTransactions.errorBatchLoad", err))
			return
		}
		if id == p.accountID {
			p.setBatch(b)
		}
	})
}

// setBatch stores the batch, keeps row choices, and (re)starts polling while it is in flight.
func (p *importPage) setBatch(b importBatch) {
	p.batch = &b
	p.rows = mergeRows(p.rows, b.Transactions)
	p.render()
	p.stop()
	if batchActive(b.Status) {
		p.startPolling(b.AccountID, b.BatchID)
	}
}

// startPolling: first poll after 3 s, then every 5 s, until the batch leaves QUEUED/PROCESSING.
func (p *importPage) startPolling(accountID int64, batchID string) {
	p.stopPoll = p.life.poll(3*time.Second, 5*time.Second, func(ctx context.Context) bool {
		cctx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		var b importBatch
		err := p.env.API.Get(cctx, importPath(accountID, "/"+batchID), nil, &b)
		if ctx.Err() != nil {
			return true
		}
		fyne.Do(func() {
			if p.batch == nil || p.batch.BatchID != batchID || p.accountID != accountID {
				return
			}
			if err != nil {
				p.err.set(errText("investmentTransactions.errorPolling", err))
				return
			}
			p.batch = &b
			p.rows = mergeRows(p.rows, b.Transactions)
			p.render()
		})
		return err != nil || !batchActive(b.Status)
	})
}

func (p *importPage) retryFile(f importFile) {
	b := p.batch
	kit.Async(func(ctx context.Context) (importBatch, error) {
		var out importBatch
		return out, p.env.API.Post(ctx, importPath(b.AccountID, fmt.Sprintf("/%s/files/%d/retry", b.BatchID, f.AttachmentID)), struct{}{}, &out)
	}, func(out importBatch, err error) {
		if err != nil {
			p.err.set(errText("investmentTransactions.errorRetryFile", err))
			return
		}
		if p.batch != nil && p.batch.BatchID == b.BatchID {
			p.setBatch(out)
		}
	})
}

func (p *importPage) confirm() {
	b, items := p.batch, buildConfirm(p.rows)
	p.confirming = true
	p.err.set("")
	p.render()
	kit.Async(func(ctx context.Context) (confirmResponse, error) {
		var out confirmResponse
		return out, p.env.API.Post(ctx, importPath(b.AccountID, "/"+b.BatchID+"/confirm"), map[string]any{"transactions": items}, &out)
	}, func(out confirmResponse, err error) {
		p.confirming = false
		if err != nil {
			p.err.set(errText("investmentTransactions.errorConfirm", err))
			p.render()
			return
		}
		p.result = &out
		p.env.Toast(kit.ToastSuccess, i18n.T("investmentTransactions.processedToast", i18n.P{"count": out.Inserted + out.Updated + out.Skipped}))
		if p.batch != nil && p.batch.BatchID == b.BatchID {
			p.loadBatch(b.BatchID)
		}
		p.render()
	})
}

// ---- rendering ----

func statusImportance(s string) widget.Importance {
	switch s {
	case "READY", "CONFIRMED":
		return widget.SuccessImportance
	case "FAILED", "CANCELLED":
		return widget.DangerImportance
	case "READY_WITH_ERRORS", "PARTIALLY_CONFIRMED":
		return widget.WarningImportance
	}
	return widget.MediumImportance
}

func importStatusLabel(s string) string {
	key := "investmentTransactions.importStatus." + camel(s)
	if s == "" || !i18n.Has(key) {
		return i18n.T("investmentTransactions.unknownValue")
	}
	return i18n.T(key)
}

func (p *importPage) render() {
	upload := kit.Card(i18n.T("investmentTransactions.uploadTitle"), i18n.T("investmentTransactions.uploadDescription"),
		container.NewVBox(kit.Muted(i18n.T("investmentTransactions.dropTitle")+" — "+i18n.T("investmentTransactions.dropHint")), p.files, p.create))
	objs := []fyne.CanvasObject{upload}
	if p.batch != nil {
		objs = append(objs, p.batchPanel())
		if batchReviewable(p.batch.Status) && len(p.rows) > 0 {
			objs = append(objs, p.reviewPanel())
		} else {
			objs = append(objs, p.stateNote())
		}
	}
	p.body.Objects = objs
	p.body.Refresh()
}

func (p *importPage) stateNote() fyne.CanvasObject {
	var k string
	switch s := p.batch.Status; {
	case batchActive(s):
		k = "reviewWaiting"
	case s == "CONFIRMED":
		k = "reviewConfirmed"
	case s == "FAILED" || s == "CANCELLED":
		k = "reviewUnavailable"
	default:
		return container.NewVBox()
	}
	return kit.Card(i18n.T("investmentTransactions."+k+"Title"), i18n.T("investmentTransactions."+k+"Description"), container.NewVBox())
}

func (p *importPage) batchPanel() fyne.CanvasObject {
	b := p.batch
	s := b.Summary
	box := container.NewVBox(
		container.NewHBox(widget.NewLabelWithStyle(b.BatchID, fyne.TextAlignLeading, fyne.TextStyle{Monospace: true}),
			kit.Badge(importStatusLabel(b.Status), statusImportance(b.Status))),
		container.NewGridWithColumns(5,
			kit.Tile(i18n.T("investmentTransactions.detected"), strconv.Itoa(s.Detected)),
			kit.Tile(i18n.T("investmentTransactions.review"), strconv.Itoa(s.Review)),
			kit.Tile(i18n.T("investmentTransactions.inserted"), strconv.Itoa(s.Inserted)),
			kit.Tile(i18n.T("investmentTransactions.updated"), strconv.Itoa(s.Updated)),
			kit.Tile(i18n.T("investmentTransactions.failed"), strconv.Itoa(s.Failed))))
	for _, f := range b.Files {
		f := f
		right := container.NewHBox(kit.Badge(importStatusLabel(f.Status), statusImportance(f.Status)))
		if f.ErrorCode != nil && *f.ErrorCode != "" {
			right.Add(widget.NewLabelWithStyle(*f.ErrorCode, fyne.TextAlignLeading, fyne.TextStyle{Monospace: true}))
		}
		if f.Status == "FAILED" || f.Status == "CANCELLED" {
			right.Add(widget.NewButton(i18n.T("investmentTransactions.retryFile"), func() { p.retryFile(f) }))
		}
		box.Add(container.NewBorder(nil, nil, nil, right,
			widget.NewLabel(f.OriginalName+" #"+strconv.FormatInt(f.AttachmentID, 10))))
	}
	return kit.Card(i18n.T("investmentTransactions.batchTitle"), "", box)
}

func (p *importPage) reviewPanel() fyne.CanvasObject {
	t := i18n.T
	cols := []kit.Col[*reviewRow]{
		{Title: "", MinWidth: 40, Weight: 0.3, Cell: func(r *reviewRow) fyne.CanvasObject {
			c := widget.NewCheck("", nil)
			c.Checked = r.selected
			c.OnChanged = func(v bool) { r.selected = v }
			return c
		}},
		{Title: t("investmentTransactions.action"), MinWidth: 110, Cell: func(r *reviewRow) fyne.CanvasObject {
			imp := widget.MediumImportance
			switch r.item.ProcessingAction {
			case "REVIEW":
				imp = widget.WarningImportance
			case "DUPLICATE":
				imp = widget.LowImportance
			}
			box := container.NewVBox(kit.Badge(i18n.T("investmentTransactions.action."+strings.ToLower(r.item.ProcessingAction)), imp))
			if n := len(r.item.Warnings); n > 0 {
				box.Add(kit.Muted(i18n.T("investmentTransactions.warnings", i18n.P{"count": n}) + ": " + strings.Join(r.item.Warnings, ", ")))
			}
			return box
		}},
		{Title: t("investmentTransactions.dateTime"), MinWidth: 120, Text: func(r *reviewRow) string {
			if r.item.TransactionAt == nil {
				return format.Dash
			}
			ts, err := format.ParseTimestamp(*r.item.TransactionAt)
			if err != nil {
				return format.Dash
			}
			return ts.Format("2006-01-02 15:04")
		}},
		{Title: t("investmentTransactions.type"), Text: func(r *reviewRow) string {
			switch s := str(r.item.TransactionType); s {
			case "DEPOSIT", "WITHDRAWAL", "BONUS":
				return i18n.T("investmentTransactions.type." + strings.ToLower(s))
			}
			return format.Dash
		}},
		{Title: t("field.status"), Text: func(r *reviewRow) string {
			switch s := str(r.item.TransactionStatus); s {
			case "PENDING", "COMPLETED", "FAILED", "CANCELLED":
				return i18n.T("investmentTransactions.status." + strings.ToLower(s))
			}
			return format.Dash
		}},
		{Title: t("field.amount"), Align: fyne.TextAlignTrailing, Text: func(r *reviewRow) string {
			if r.item.Amount == nil {
				return format.Dash
			}
			return format.Num(*r.item.Amount, 4) + " " + str(r.item.Currency)
		}},
		{Title: t("investmentTransactions.externalId"), Text: func(r *reviewRow) string { return dashIfEmpty(r.item.ExternalTransactionID) }},
		{Title: t("field.description"), Weight: 2, Text: func(r *reviewRow) string { return dashIfEmpty(r.item.Description) }},
		{Title: t("investmentTransactions.resolution"), MinWidth: 130, Cell: func(r *reviewRow) fyne.CanvasObject {
			return widget.NewButton(i18n.T("investmentTransactions.resolution."+camel(r.resolution)), func() { p.pickResolution(r) })
		}},
	}
	p.table = kit.NewTable(cols)
	p.table.SetRows(p.rows)

	all := widget.NewCheck(t("common.all"), func(v bool) {
		for _, r := range p.rows {
			r.selected = v
		}
		p.table.SetRows(p.rows)
	})
	all.Checked = true
	for _, r := range p.rows {
		all.Checked = all.Checked && r.selected
	}
	btn := widget.NewButton(t("investmentTransactions.confirmSelected"), p.confirm)
	if p.confirming {
		btn.Disable()
	}
	box := container.NewVBox(container.NewBorder(nil, nil, all, btn), p.table)
	if r := p.result; r != nil {
		box.Add(kit.Muted(t("investmentTransactions.confirmResult") + ": " +
			t("investmentTransactions.createdCount", i18n.P{"count": r.Inserted}) + " · " +
			t("investmentTransactions.updatedCount", i18n.P{"count": r.Updated}) + " · " +
			t("investmentTransactions.skippedCount", i18n.P{"count": r.Skipped}) + " · " +
			t("investmentTransactions.failedCount", i18n.P{"count": r.Failed})))
	}
	return kit.Card(t("investmentTransactions.reviewTitle"), t("investmentTransactions.reviewDescription"), box)
}

func (p *importPage) pickResolution(r *reviewRow) {
	action := i18n.T("investmentTransactions.action." + strings.ToLower(r.item.ProcessingAction))
	box := container.NewVBox(kit.Muted(i18n.T("investmentTransactions.resolutionDescription")))
	var d dialog.Dialog
	for _, res := range []string{"ACCEPT", "MERGE_EXISTING", "SAVE_AS_NEW", "SKIP"} {
		res := res
		k := "investmentTransactions.resolution." + camel(res)
		b := widget.NewButton(i18n.T(k), func() {
			r.resolution = res
			d.Hide()
			p.table.SetRows(p.rows)
		})
		box.Add(container.NewVBox(b, kit.Muted(i18n.T(k+"Description"))))
	}
	d = dialog.NewCustom(i18n.T("investmentTransactions.resolutionTitle", i18n.P{"action": action}), i18n.T("common.close"), box, p.env.Window)
	d.Show()
}
