package invreports

import (
	"image/color"
	"strconv"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

const maxTableRows = 500 // ponytail: tables are not virtualised; export CSV for the full set

// rc is the render context of one tab: currency, money formatting and shell hooks.
type rc struct {
	sh       *shell
	cur      string
	from, to string // report range
}

func (c *rc) money(d D) string  { return format.Money(d, c.cur) }
func (c *rc) t(k string) string { return i18n.T("investmentReports." + k) }

func pct(p *D) string {
	if p == nil {
		return format.Dash
	}
	return format.Percent(*p, 2)
}

func intp(p *int) string {
	if p == nil {
		return format.Dash
	}
	return strconv.Itoa(*p)
}

func strp(p *string) string {
	if p == nil || *p == "" {
		return format.Dash
	}
	return *p
}

func dp(p *D) string {
	if p == nil {
		return format.Dash
	}
	return format.Num(*p, 2)
}

// sign colours a value: blue positive, red negative, default otherwise.
func sign(d D) color.Color {
	switch {
	case d.IsPositive():
		return kit.ColorBlue
	case d.IsNegative():
		return kit.ColorRed
	}
	return nil
}

// metric is a tile whose value can be coloured.
func metric(caption, value string, c color.Color) fyne.CanvasObject {
	if c == nil {
		return kit.Tile(caption, value)
	}
	v := canvas.NewText(value, c)
	v.TextSize = 20
	v.TextStyle = fyne.TextStyle{Bold: true}
	cap := widget.NewLabel(caption)
	cap.Importance = widget.LowImportance
	return container.NewVBox(cap, container.NewPadded(v))
}

func metrics(items ...fyne.CanvasObject) fyne.CanvasObject {
	return container.NewGridWrap(fyne.NewSize(210, 76), items...)
}

func (c *rc) mt(caption string, d D) fyne.CanvasObject { return metric(caption, c.money(d), sign(d)) }

// cell is one table cell: plain, coloured, or a clickable link.
type cell struct {
	S     string
	C     color.Color
	Click func()
}

func txt(s string) cell          { return cell{S: s} }
func (c *rc) mc(d D) cell        { return cell{S: c.money(d), C: sign(d)} }
func plainMoney(c *rc, d D) cell { return cell{S: c.money(d)} }

func cellObj(x cell, right bool) fyne.CanvasObject {
	al := fyne.TextAlignLeading
	if right {
		al = fyne.TextAlignTrailing
	}
	switch {
	case x.Click != nil:
		b := widget.NewButton(x.S, x.Click)
		b.Importance = widget.LowImportance
		b.Alignment = widget.ButtonAlignLeading
		return b
	case x.C != nil:
		t := canvas.NewText(x.S, x.C)
		t.TextStyle = fyne.TextStyle{Bold: true}
		t.Alignment = al
		return container.NewPadded(t)
	}
	l := widget.NewLabel(x.S)
	l.Alignment = al
	l.Truncation = fyne.TextTruncateEllipsis
	return l
}

// dataTable renders headings and rows; the first `left` columns are left aligned.
func dataTable(heads []string, rows [][]cell, left int) fyne.CanvasObject {
	cols := make([]kit.Col[[]cell], len(heads))
	for i, h := range heads {
		i := i
		al := fyne.TextAlignTrailing
		if i < left {
			al = fyne.TextAlignLeading
		}
		w := float32(1)
		if i == 0 {
			w = 1.5
		}
		cols[i] = kit.Col[[]cell]{Title: h, Align: al, Weight: w, MinWidth: 90,
			Cell: func(r []cell) fyne.CanvasObject { return cellObj(r[i], i >= left) }}
	}
	t := kit.NewTable(cols)
	shown := rows
	if len(shown) > maxTableRows {
		shown = shown[:maxTableRows]
	}
	t.SetRows(shown)
	if len(rows) > len(shown) {
		return container.NewVBox(t, kit.Muted(strconv.Itoa(len(shown))+" / "+strconv.Itoa(len(rows))))
	}
	return t
}

func section(title string, body fyne.CanvasObject) fyne.CanvasObject {
	return container.NewVBox(kit.Heading(title), body)
}

// toolbar: right-aligned controls above a body.
func hint(key string, c *rc) fyne.CanvasObject { return kit.Muted(c.t(key)) }

func (c *rc) csvBtn(d csvData) fyne.CanvasObject {
	b := widget.NewButtonWithIcon(c.t("exportCsv"), theme.DownloadIcon(), func() { c.sh.env.SaveCSV(d.File, d.Header, d.Rows) })
	if len(d.Rows) == 0 {
		b.Disable()
	}
	c.sh.csv = func() { c.sh.env.SaveCSV(d.File, d.Header, d.Rows) }
	return b
}

// heat is a tinted cell: base colour at pct (0..100) opacity under a small text.
func heat(text string, base color.Color, pct float64) fyne.CanvasObject {
	r, g, b, _ := base.RGBA()
	a := uint8(max(0, min(100, pct)) / 100 * 255)
	rect := canvas.NewRectangle(color.NRGBA{uint8(r >> 8), uint8(g >> 8), uint8(b >> 8), a})
	rect.SetMinSize(fyne.NewSize(44, 26))
	l := canvas.NewText(text, theme.Color(theme.ColorNameForeground))
	l.TextSize = 10
	l.Alignment = fyne.TextAlignCenter
	return container.NewStack(rect, container.NewCenter(l))
}

func signedCompact(d D) string {
	if d.IsZero() {
		return "·"
	}
	s := format.Compact(d)
	if d.IsPositive() {
		s = "+" + s
	}
	return s
}

func tintBase(d D) color.Color {
	if d.IsNegative() {
		return kit.ColorRed
	}
	return kit.ColorBlue
}

// signedBars draws net values as bars, blue above and red below the zero line.
func signedBars(labels []string, vals []D, tip func(i int) string) fyne.CanvasObject {
	pos, neg := make([]float64, len(vals)), make([]float64, len(vals))
	for i, v := range vals {
		f := v.InexactFloat64()
		if f >= 0 {
			pos[i] = f
		} else {
			neg[i] = f
		}
	}
	ch := kit.NewBarChart(labels, kit.Series{Color: kit.ColorBlue, Values: pos}, kit.Series{Color: kit.ColorRed, Values: neg})
	ch.Tooltip = tip
	ch.LabelEvery = labelEvery(len(labels))
	return ch
}

func floats(v []D) []float64 {
	out := make([]float64, len(v))
	for i, d := range v {
		out[i] = d.InexactFloat64()
	}
	return out
}

// axisRow shows first label, value range and last label below a line chart.
func (c *rc) axisRow(first, last string, vals ...[]D) fyne.CanvasObject {
	lo, hi := D{}, D{}
	for _, vs := range vals {
		for _, v := range vs {
			lo, hi = min2(lo, v, true), min2(hi, v, false)
		}
	}
	mid := widget.NewLabel(c.t("equity.range") + ": " + c.money(lo) + " … " + c.money(hi))
	mid.Alignment = fyne.TextAlignCenter
	return container.NewBorder(nil, nil, widget.NewLabel(first), widget.NewLabel(last), mid)
}

func min2(a, b D, wantMin bool) D {
	if wantMin == b.LessThan(a) {
		return b
	}
	return a
}

func weekdayLabel(n int) string { return i18n.T("investmentReports.activity.d" + strconv.Itoa(n)) }

func lower(s string) string { return strings.ToLower(s) }
