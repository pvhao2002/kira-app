package kit

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
)

// Col describes one table column. Title must already be translated.
type Col[T any] struct {
	Title    string
	Weight   float32 // relative width, default 1
	MinWidth float32 // default 80
	Align    fyne.TextAlign
	Text     func(T) string            // plain text cell (truncated)
	Cell     func(T) fyne.CanvasObject // custom cell; overrides Text
}

// RowAction is a button in the trailing actions column.
type RowAction[T any] struct {
	Label   string // translated
	Icon    fyne.Resource
	Visible func(T) bool // nil = always
	Do      func(T)
}

// colsLayout lays cells of every row out on shared column widths.
type colsLayout struct {
	weights, mins []float32
	height        float32
}

func (l *colsLayout) widths(total float32) []float32 {
	var minSum, wSum float32
	for i := range l.mins {
		minSum += l.mins[i]
		wSum += l.weights[i]
	}
	extra := max(total-minSum, 0)
	out := make([]float32, len(l.mins))
	for i := range out {
		out[i] = l.mins[i]
		if wSum > 0 {
			out[i] += extra * l.weights[i] / wSum
		}
	}
	return out
}

func (l *colsLayout) Layout(objs []fyne.CanvasObject, size fyne.Size) {
	var x float32
	for i, w := range l.widths(size.Width) {
		if i >= len(objs) {
			break
		}
		objs[i].Move(fyne.NewPos(x, 0))
		objs[i].Resize(fyne.NewSize(w, size.Height))
		x += w
	}
}

func (l *colsLayout) MinSize(objs []fyne.CanvasObject) fyne.Size {
	var w, h float32
	for _, m := range l.mins {
		w += m
	}
	for _, o := range objs {
		h = max(h, o.MinSize().Height)
	}
	return fyne.NewSize(w, h)
}

// Table is a simple non-virtualised table (fine for page-sized data) whose cells
// can be arbitrary widgets. Build with NewTable, feed with SetRows/SetMeta.
type Table[T any] struct {
	widget.BaseWidget
	cols    []Col[T]
	actions []RowAction[T]
	layout  *colsLayout
	header  fyne.CanvasObject
	rows    *fyne.Container
	pager   *fyne.Container
	empty   *widget.Label
	data    []T
	emptyT  string
}

func NewTable[T any](cols []Col[T], actions ...RowAction[T]) *Table[T] {
	t := &Table[T]{cols: cols, actions: actions, layout: &colsLayout{},
		rows: container.NewVBox(), pager: container.NewHBox(), empty: widget.NewLabel("")}
	for _, c := range cols {
		w, m := c.Weight, c.MinWidth
		if w == 0 {
			w = 1
		}
		if m == 0 {
			m = 80
		}
		t.layout.weights = append(t.layout.weights, w)
		t.layout.mins = append(t.layout.mins, m)
	}
	if len(actions) > 0 {
		t.layout.weights = append(t.layout.weights, 0)
		t.layout.mins = append(t.layout.mins, float32(len(actions))*110)
	}
	t.empty.Wrapping = fyne.TextWrapWord
	t.empty.Hide()
	t.header = t.headerRow()
	t.ExtendBaseWidget(t)
	return t
}

func (t *Table[T]) headerRow() fyne.CanvasObject {
	var cells []fyne.CanvasObject
	for _, c := range t.cols {
		l := widget.NewLabel(c.Title)
		l.TextStyle = fyne.TextStyle{Bold: true}
		l.Alignment = c.Align
		l.Truncation = fyne.TextTruncateEllipsis
		cells = append(cells, l)
	}
	if len(t.actions) > 0 {
		cells = append(cells, widget.NewLabel(""))
	}
	return container.New(t.layout, cells...)
}

func (t *Table[T]) CreateRenderer() fyne.WidgetRenderer {
	return widget.NewSimpleRenderer(container.NewBorder(
		container.NewVBox(t.header, widget.NewSeparator()),
		t.pager, nil, nil,
		container.NewVBox(t.rows, t.empty)))
}

// SetEmpty sets the text shown when there are no rows (already translated).
func (t *Table[T]) SetEmpty(text string) { t.emptyT = text }

// Rows returns the rows currently displayed.
func (t *Table[T]) Rows() []T { return t.data }

// SetRows replaces the displayed rows. UI thread.
func (t *Table[T]) SetRows(rows []T) {
	t.data = rows
	t.rows.Objects = nil
	for _, r := range rows {
		t.rows.Add(t.row(r))
		t.rows.Add(widget.NewSeparator())
	}
	if len(rows) == 0 && t.emptyT != "" {
		t.empty.SetText(t.emptyT)
		t.empty.Show()
	} else {
		t.empty.Hide()
	}
	t.rows.Refresh()
}

func (t *Table[T]) row(r T) fyne.CanvasObject {
	var cells []fyne.CanvasObject
	for _, c := range t.cols {
		switch {
		case c.Cell != nil:
			cells = append(cells, c.Cell(r))
		case c.Text != nil:
			l := widget.NewLabel(c.Text(r))
			l.Alignment = c.Align
			l.Truncation = fyne.TextTruncateEllipsis
			cells = append(cells, l)
		default:
			cells = append(cells, widget.NewLabel(""))
		}
	}
	if len(t.actions) > 0 {
		box := container.NewHBox()
		for _, a := range t.actions {
			if a.Visible != nil && !a.Visible(r) {
				continue
			}
			a := a
			b := widget.NewButtonWithIcon(a.Label, a.Icon, func() { a.Do(r) })
			b.Importance = widget.LowImportance
			box.Add(b)
		}
		cells = append(cells, box)
	}
	return container.New(t.layout, cells...)
}

// SetMeta shows a pager for the given page meta; onPage receives the 0-based
// page to load. Pass a zero Meta to hide the pager. UI thread.
func (t *Table[T]) SetMeta(m api.Meta, onPage func(page int)) {
	t.pager.Objects = nil
	if m.TotalPages > 0 || m.TotalElements > 0 {
		prev := widget.NewButton(i18n.T("common.previous"), func() { onPage(m.Page - 1) })
		next := widget.NewButton(i18n.T("common.next"), func() { onPage(m.Page + 1) })
		if m.Page <= 0 {
			prev.Disable()
		}
		if m.Page+1 >= m.TotalPages {
			next.Disable()
		}
		info := widget.NewLabel(fmt.Sprintf("%s · %d / %d",
			i18n.T("resource.recordCount", i18n.P{"shown": len(t.data), "total": m.TotalElements}),
			m.Page+1, max(m.TotalPages, 1)))
		t.pager.Objects = []fyne.CanvasObject{prev, next, info}
	}
	t.pager.Refresh()
}

// PagedSource loads one page. Adapt any backend shape to api.Page[T].
type PagedSource[T any] func(ctx context.Context, page, size int, search string) (api.Page[T], error)

// PathSource is the standard source: GET {path}?page=&size=&search=&extra...
func PathSource[T any](env *Env, path string, extra url.Values) PagedSource[T] {
	return func(ctx context.Context, page, size int, search string) (api.Page[T], error) {
		q := url.Values{}
		for k, v := range extra {
			q[k] = v
		}
		q.Set("search", search)
		return api.GetPage[T](ctx, env.API, path, q, page, size)
	}
}

// PagedOptions tunes NewPagedTable.
type PagedOptions struct {
	Size     int                 // page size (default 20)
	NoSearch bool                // hide the search box
	Toolbar  []fyne.CanvasObject // extra widgets next to the search box (Add, Export, ...)
}

// PagedTable is a Table with a search box (250 ms debounce), a pager and
// loading/error handling. Call Reload() after mutations.
type PagedTable[T any] struct {
	widget.BaseWidget
	Table  *Table[T]
	env    *Env
	src    PagedSource[T]
	size   int
	page   int
	search *widget.Entry
	bar    *widget.ProgressBarInfinite
	top    *fyne.Container
	seq    int
	timer  *time.Timer
	silent bool
}

func NewPagedTable[T any](env *Env, src PagedSource[T], opt PagedOptions, cols []Col[T], actions ...RowAction[T]) *PagedTable[T] {
	if opt.Size == 0 {
		opt.Size = 20
	}
	p := &PagedTable[T]{Table: NewTable(cols, actions...), env: env, src: src, size: opt.Size,
		bar: widget.NewProgressBarInfinite(), search: widget.NewEntry()}
	p.bar.Hide()
	p.Table.SetEmpty(i18n.T("resource.emptyTitle"))
	bar := container.NewHBox()
	if !opt.NoSearch {
		p.search.SetPlaceHolder(i18n.T("resource.searchPlaceholder"))
		p.search.OnChanged = func(string) {
			if p.silent {
				return
			}
			if p.timer != nil {
				p.timer.Stop()
			}
			p.timer = time.AfterFunc(250*time.Millisecond, func() { fyne.Do(func() { p.page = 0; p.Reload() }) })
		}
		bar = container.NewBorder(nil, nil, nil, container.NewHBox(opt.Toolbar...), p.search)
	} else if len(opt.Toolbar) > 0 {
		bar = container.NewHBox(opt.Toolbar...)
	}
	p.top = container.NewVBox(bar, p.bar)
	p.ExtendBaseWidget(p)
	p.Reload()
	return p
}

func (p *PagedTable[T]) CreateRenderer() fyne.WidgetRenderer {
	return widget.NewSimpleRenderer(container.NewBorder(p.top, nil, nil, nil, p.Table))
}

// SetSearch sets the search text (e.g. from Env.Params()["search"]) and reloads page 0.
func (p *PagedTable[T]) SetSearch(q string) {
	if p.timer != nil {
		p.timer.Stop()
	}
	p.silent = true
	p.search.SetText(q)
	p.silent = false
	p.page = 0
	p.Reload()
}

// Reload refetches the current page. UI thread.
func (p *PagedTable[T]) Reload() {
	p.seq++
	seq, page, q := p.seq, p.page, p.search.Text
	p.bar.Show()
	Async(func(ctx context.Context) (api.Page[T], error) { return p.src(ctx, page, p.size, q) },
		func(res api.Page[T], err error) {
			if seq != p.seq {
				return
			}
			p.bar.Hide()
			if err != nil {
				p.env.ShowError(err) // keep the previous rows
				return
			}
			p.Table.SetRows(res.Data)
			p.Table.SetMeta(res.Meta, func(n int) { p.page = n; p.Reload() })
		})
}
