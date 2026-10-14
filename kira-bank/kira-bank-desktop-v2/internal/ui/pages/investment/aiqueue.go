package investment

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type reviewTarget struct {
	AccountID        int64  `json:"accountId"`
	AccountName      string `json:"accountName"`
	BatchID          string `json:"batchId"`
	BatchStatus      string `json:"batchStatus"`
	CreatedAt        string `json:"createdAt"`
	PendingItemCount int    `json:"pendingItemCount"`
}

type aiJob struct {
	AttachmentID int64 `json:"attachmentId"`
	Owner        *struct {
		UserID   int64   `json:"userId"`
		FullName *string `json:"fullName"`
		Email    *string `json:"email"`
	} `json:"owner"`
	OriginalName        string          `json:"originalName"`
	Size                int64           `json:"size"`
	Status              string          `json:"status"`
	AttemptCount        int             `json:"attemptCount"`
	MaxAttempts         int             `json:"maxAttempts"`
	Model               *string         `json:"model"`
	Error               *string         `json:"error"`
	ProcessingStartedAt *string         `json:"processingStartedAt"`
	CompletedAt         *string         `json:"completedAt"`
	CreatedAt           string          `json:"createdAt"`
	ContentAvailable    bool            `json:"contentAvailable"`
	CanCancel           bool            `json:"canCancel"`
	CanRun              bool            `json:"canRun"`
	ReviewTargets       []reviewTarget  `json:"reviewTargets"`
	DetectedJSON        json.RawMessage `json:"detectedJson"`
}

func (j aiJob) hasJSON() bool {
	s := strings.TrimSpace(string(j.DetectedJSON))
	return s != "" && s != "null"
}

// aiQuery is the filter state; read by the poller goroutine, so guarded.
type aiQuery struct {
	all    bool // admin "all jobs" scope
	status string
	page   int
}

type aiPage struct {
	env  *kit.Env
	life *life
	root *fyne.Container
	err  banner

	mu   sync.Mutex
	q    aiQuery
	prev map[int64]string // job id -> status of the last snapshot (nil = no snapshot yet)

	rows     []aiJob
	meta     api.Meta
	loaded   bool
	inflight map[int64]bool
	tableBox *fyne.Container
	footer   *fyne.Container
	count    *widget.Label
	scopeBox *fyne.Container
}

func (p *aiPage) query() aiQuery {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.q
}

func (p *aiPage) setQuery(f func(q *aiQuery)) {
	p.mu.Lock()
	f(&p.q)
	p.prev = nil
	p.mu.Unlock()
	p.loaded, p.rows, p.meta = false, nil, api.Meta{}
}

func aiBase(all bool) string {
	if all {
		return "admin/investment/ai-jobs"
	}
	return "investment/ai-jobs"
}

func newAIQueue(env *kit.Env) fyne.CanvasObject {
	p := &aiPage{env: env, life: newLife(), err: newBanner(), inflight: map[int64]bool{},
		tableBox: container.NewStack(), footer: container.NewHBox(), count: widget.NewLabel(""), scopeBox: container.NewHBox()}
	p.q.all = env.IsAdmin()
	refresh := widget.NewButton(i18n.T("investmentAiQueue.refresh"), func() { go p.fetch(context.Background()) })

	filter := widget.NewSelect(nil, nil)
	statuses := []string{"", "PENDING", "PROCESSING", "READY", "FAILED", "CANCELLED", "CONFIRMED"}
	for _, s := range statuses {
		if s == "" {
			filter.Options = append(filter.Options, i18n.T("investmentAiQueue.status.all"))
		} else {
			filter.Options = append(filter.Options, i18n.T("investmentAiQueue.status."+strings.ToLower(s)))
		}
	}
	filter.SetSelectedIndex(0)
	filter.OnChanged = func(string) {
		p.setQuery(func(q *aiQuery) { q.status, q.page = statuses[filter.SelectedIndex()], 0 })
		p.render()
		go p.fetch(context.Background())
	}

	bar := container.NewHBox(labeled(i18n.T("investmentAiQueue.statusLabel"), filter), kit.Muted(i18n.T("investmentAiQueue.liveRefresh")))
	if env.IsAdmin() {
		p.buildScope()
		bar.Objects = append([]fyne.CanvasObject{p.scopeBox}, bar.Objects...)
	}
	p.root = container.NewVBox(
		kit.PageHeader(i18n.T("investmentAiQueue.eyebrow"), i18n.T("investmentAiQueue.title"), i18n.T("investmentAiQueue.description"), refresh),
		bar, p.err, p.count, p.tableBox, p.footer, p.life)
	p.render()
	p.life.poll(0, 5*time.Second, func(ctx context.Context) bool { p.fetch(ctx); return false })
	return p.root
}

func (p *aiPage) buildScope() {
	all := widget.NewButton(i18n.T("investmentAiQueue.allJobs"), nil)
	mine := widget.NewButton(i18n.T("investmentAiQueue.myJobs"), nil)
	mark := func() {
		a := p.query().all
		all.Importance, mine.Importance = widget.LowImportance, widget.LowImportance
		if a {
			all.Importance = widget.HighImportance
		} else {
			mine.Importance = widget.HighImportance
		}
		all.Refresh()
		mine.Refresh()
	}
	set := func(a bool) func() {
		return func() {
			p.setQuery(func(q *aiQuery) { q.all, q.page = a, 0 })
			mark()
			p.render()
			go p.fetch(context.Background())
		}
	}
	all.OnTapped, mine.OnTapped = set(true), set(false)
	mark()
	p.scopeBox.Objects = []fyne.CanvasObject{all, mine}
}

// fetch loads the current query off the UI thread and applies it if the query is unchanged.
func (p *aiPage) fetch(ctx context.Context) {
	q := p.query()
	cctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	v := url.Values{"sort": {"createdAt,desc"}}
	if q.status != "" {
		v.Set("statuses", q.status)
	}
	res, err := api.GetPage[aiJob](cctx, p.env.API, aiBase(q.all), v, q.page, 20)
	if ctx.Err() != nil {
		return
	}
	fyne.Do(func() {
		if p.query() != q {
			return
		}
		if err != nil {
			p.err.set(i18n.T("investmentAiQueue.errorTitle") + ": " + i18n.T("investmentAiQueue.loadError"))
			return
		}
		p.err.set("")
		p.toastCompleted(res.Data)
		p.rows, p.meta, p.loaded = res.Data, res.Meta, true
		p.render()
	})
}

// toastCompleted announces jobs that left PENDING/PROCESSING since the previous snapshot.
func (p *aiPage) toastCompleted(jobs []aiJob) {
	p.mu.Lock()
	prev := p.prev
	next := make(map[int64]string, len(jobs))
	for _, j := range jobs {
		next[j.AttachmentID] = j.Status
	}
	p.prev = next
	p.mu.Unlock()
	if prev == nil {
		return
	}
	for _, j := range jobs {
		if old := prev[j.AttachmentID]; (old == "PENDING" || old == "PROCESSING") && j.Status != old && j.Status != "PENDING" && j.Status != "PROCESSING" {
			kind := kit.ToastSuccess
			if j.Status == "FAILED" {
				kind = kit.ToastError
			}
			p.env.Toast(kind, i18n.T("investmentAiQueue.completedToast", i18n.P{"id": j.AttachmentID, "status": i18n.T("investmentAiQueue.status." + strings.ToLower(j.Status))}))
		}
	}
}

func statusGlyph(s string) string {
	return map[string]string{"PENDING": "◷", "PROCESSING": "⟳", "READY": "✓", "FAILED": "!", "CANCELLED": "×", "CONFIRMED": "◆"}[s]
}

func jobImportance(s string) widget.Importance {
	switch s {
	case "READY", "CONFIRMED":
		return widget.SuccessImportance
	case "FAILED":
		return widget.DangerImportance
	case "PENDING", "PROCESSING":
		return widget.WarningImportance
	}
	return widget.LowImportance
}

func tl(ts *string, key string) fyne.CanvasObject {
	v := format.Dash
	if ts != nil {
		v = format.Timestamp(*ts, func(t time.Time) string { return format.DateMedium(t) + " " + format.TimeShort(t) })
	}
	return kit.Muted(i18n.T(key) + ": " + v)
}

func (p *aiPage) render() {
	admin := p.query().all
	t := i18n.T
	cols := []kit.Col[aiJob]{
		{Title: t("investmentAiQueue.job"), Weight: 2, MinWidth: 160, Cell: func(j aiJob) fyne.CanvasObject {
			model := t("investmentAiQueue.modelPending")
			if j.Model != nil && *j.Model != "" {
				model = *j.Model
			}
			return container.NewVBox(widget.NewLabelWithStyle(j.OriginalName, fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
				kit.Muted("#"+strconv.FormatInt(j.AttachmentID, 10)+" · "+fmtBytes(j.Size)), kit.Muted(model))
		}},
	}
	if admin {
		cols = append(cols, kit.Col[aiJob]{Title: t("investmentAiQueue.owner"), Weight: 1.2, Cell: func(j aiJob) fyne.CanvasObject {
			if j.Owner == nil {
				return widget.NewLabel(format.Dash)
			}
			second := "#" + strconv.FormatInt(j.Owner.UserID, 10)
			if e := str(j.Owner.Email); e != "" {
				second = e
			}
			return container.NewVBox(widget.NewLabel(dashIfEmpty(j.Owner.FullName)), kit.Muted(second))
		}})
	}
	cols = append(cols,
		kit.Col[aiJob]{Title: t("investmentAiQueue.statusLabel"), MinWidth: 110, Cell: func(j aiJob) fyne.CanvasObject {
			box := container.NewVBox(kit.Badge(statusGlyph(j.Status)+" "+t("investmentAiQueue.status."+strings.ToLower(j.Status)), jobImportance(j.Status)))
			if e := str(j.Error); e != "" {
				box.Add(widget.NewLabelWithStyle(e, fyne.TextAlignLeading, fyne.TextStyle{Monospace: true}))
			}
			return box
		}},
		kit.Col[aiJob]{Title: t("investmentAiQueue.attempts"), MinWidth: 70, Text: func(j aiJob) string { return fmt.Sprintf("%d/%d", j.AttemptCount, j.MaxAttempts) }},
		kit.Col[aiJob]{Title: t("investmentAiQueue.timeline"), Weight: 1.6, MinWidth: 170, Cell: func(j aiJob) fyne.CanvasObject {
			c := j.CreatedAt
			return container.NewVBox(tl(&c, "investmentAiQueue.created"), tl(j.ProcessingStartedAt, "investmentAiQueue.started"), tl(j.CompletedAt, "investmentAiQueue.completed"))
		}},
		kit.Col[aiJob]{Title: t("common.actions"), Weight: 1.8, MinWidth: 230, Cell: p.actionsCell},
	)
	tbl := kit.NewTable(cols)
	tbl.SetEmpty(t("investmentAiQueue.emptyTitle") + "\n" + t("investmentAiQueue.emptyDescription"))
	tbl.SetRows(p.rows)

	switch {
	case !p.loaded:
		p.tableBox.Objects = []fyne.CanvasObject{kit.Muted(t("investmentAiQueue.loading"))}
		p.count.SetText("")
	default:
		p.tableBox.Objects = []fyne.CanvasObject{tbl}
		p.count.SetText(t("investmentAiQueue.jobs") + " · " + t("investmentAiQueue.resultCount", i18n.P{"count": p.meta.TotalElements}))
	}
	p.tableBox.Refresh()

	p.footer.Objects = nil
	if p.meta.TotalElements > 0 {
		start := p.meta.Page*p.meta.Size + 1
		end := min(int64((p.meta.Page+1)*p.meta.Size), p.meta.TotalElements)
		p.footer.Objects = []fyne.CanvasObject{pager(
			t("investmentAiQueue.pagination", i18n.P{"start": start, "end": end, "total": p.meta.TotalElements})+" · "+fmt.Sprintf("%d / %d", p.meta.Page+1, max(p.meta.TotalPages, 1)),
			p.meta.Page, p.meta.TotalPages, func(n int) {
				p.setQuery(func(q *aiQuery) { q.page = n })
				p.render()
				go p.fetch(context.Background())
			})}
	}
	p.footer.Refresh()
}

func (p *aiPage) actionsCell(j aiJob) fyne.CanvasObject {
	t := i18n.T
	busy := p.inflight[j.AttachmentID]
	btn := func(label string, on bool, f func()) *widget.Button {
		b := widget.NewButton(label, f)
		if !on || busy {
			b.Disable()
		}
		return b
	}
	run := t("investmentAiQueue.run")
	if j.Status == "READY" {
		run = t("investmentAiQueue.rerun")
	}
	row1 := container.NewHBox(btn(t("investmentAiQueue.viewImage"), j.ContentAvailable, func() { p.viewImage(j) }),
		btn(t("investmentAiQueue.viewJson"), j.hasJSON(), func() { p.viewJSON(j) }))
	row2 := container.NewHBox()
	if j.Status == "READY" {
		review := btn(t("investmentAiQueue.reviewAndConfirm"), true, func() { p.review(j) })
		switch {
		case p.query().all && (j.Owner == nil || j.Owner.UserID != p.env.User().ID):
			review.Disable()
		case len(j.ReviewTargets) == 0:
			review.Disable()
		}
		row2.Add(review)
	}
	row2.Add(btn(run, j.CanRun, func() { p.act(j, "run") }))
	row2.Add(btn(t("common.cancel"), j.CanCancel, func() {
		p.env.Confirm(t("investmentAiQueue.confirmCancelTitle")+"\n"+t("investmentAiQueue.confirmCancelDescription", i18n.P{"id": j.AttachmentID}),
			func() { p.act(j, "cancel") })
	}))
	return container.NewVBox(row1, row2)
}

func (p *aiPage) act(j aiJob, verb string) {
	all := p.query().all
	p.inflight[j.AttachmentID] = true
	p.render()
	kit.Async(func(ctx context.Context) (aiJob, error) {
		var out aiJob
		return out, p.env.API.Post(ctx, fmt.Sprintf("%s/%d/%s", aiBase(all), j.AttachmentID, verb), struct{}{}, &out)
	}, func(out aiJob, err error) {
		delete(p.inflight, j.AttachmentID)
		if err != nil {
			p.err.set(i18n.T("investmentAiQueue.actionError"))
			p.render()
			return
		}
		p.err.set("")
		for i := range p.rows {
			if p.rows[i].AttachmentID == out.AttachmentID {
				p.rows[i] = out
			}
		}
		key := "investmentAiQueue.cancelledToast"
		kind := kit.ToastInfo
		if verb == "run" {
			key = "investmentAiQueue.runningToast"
		}
		p.env.Toast(kind, i18n.T(key, i18n.P{"id": j.AttachmentID}))
		p.render()
		go p.fetch(context.Background())
	})
}

func (p *aiPage) viewImage(j aiJob) {
	all := p.query().all
	holder := container.NewStack(widget.NewLabel(i18n.T("investmentAiQueue.loadingImage")))
	d := dialog.NewCustom(i18n.T("investmentAiQueue.sourceImage"), i18n.T("common.close"), holder, p.env.Window)
	d.Resize(fyne.NewSize(640, 520))
	d.Show()
	kit.Async(func(ctx context.Context) ([]byte, error) {
		b, _, err := p.env.API.Bytes(ctx, fmt.Sprintf("%s/%d/content", aiBase(all), j.AttachmentID), nil)
		return b, err
	}, func(b []byte, err error) {
		if err != nil {
			holder.Objects = []fyne.CanvasObject{widget.NewLabel(i18n.T("investmentAiQueue.imageError"))}
		} else {
			img := canvas.NewImageFromReader(bytes.NewReader(b), j.OriginalName)
			img.FillMode = canvas.ImageFillContain
			img.SetMinSize(fyne.NewSize(600, 440))
			holder.Objects = []fyne.CanvasObject{img}
		}
		holder.Refresh()
	})
}

func (p *aiPage) viewJSON(j aiJob) {
	var buf bytes.Buffer
	text := string(j.DetectedJSON)
	if json.Indent(&buf, j.DetectedJSON, "", "  ") == nil {
		text = buf.String()
	}
	body := widget.NewMultiLineEntry()
	body.SetText(text)
	body.TextStyle = fyne.TextStyle{Monospace: true}
	body.Wrapping = fyne.TextWrapOff
	scroll := container.NewScroll(body)
	scroll.SetMinSize(fyne.NewSize(560, 380))
	d := dialog.NewCustom(i18n.T("investmentAiQueue.detectedJson"), i18n.T("common.close"),
		container.NewBorder(kit.Muted(i18n.T("investmentAiQueue.normalizedJsonNotice")), nil, nil, nil, scroll), p.env.Window)
	d.Show()
}

func (p *aiPage) review(j aiJob) {
	go1 := func(t reviewTarget) {
		p.env.Navigate("/app/investment/transactions", map[string]string{
			"accountId": strconv.FormatInt(t.AccountID, 10), "batchId": t.BatchID})
	}
	if len(j.ReviewTargets) == 1 {
		go1(j.ReviewTargets[0])
		return
	}
	box := container.NewVBox(kit.Muted(i18n.T("investmentAiQueue.reviewTargetDescription", i18n.P{"id": j.AttachmentID})))
	var d dialog.Dialog
	for _, t := range j.ReviewTargets {
		t := t
		name := t.AccountName
		if name == "" {
			name = "#" + strconv.FormatInt(t.AccountID, 10)
		}
		b := widget.NewButton(name, func() { d.Hide(); go1(t) })
		box.Add(container.NewVBox(b, kit.Muted(importStatusLabel(t.BatchStatus)+" · "+t.BatchID+" · "+
			format.Timestamp(t.CreatedAt, format.DateTimeShort)+" · "+
			i18n.T("investmentAiQueue.pendingItems", i18n.P{"count": t.PendingItemCount}))))
	}
	d = dialog.NewCustom(i18n.T("investmentAiQueue.reviewTargetEyebrow")+" — "+i18n.T("investmentAiQueue.reviewTargetTitle"),
		i18n.T("common.close"), box, p.env.Window)
	d.Show()
}
