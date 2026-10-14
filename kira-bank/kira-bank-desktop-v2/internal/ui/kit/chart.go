package kit

import (
	"image/color"
	"math"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/driver/desktop"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
)

// Palette used across charts (matches the web app).
var (
	ColorBlue   color.Color = color.NRGBA{0x25, 0x63, 0xeb, 0xff}
	ColorRed    color.Color = color.NRGBA{0xdc, 0x26, 0x26, 0xff}
	ColorAmber  color.Color = color.NRGBA{0xf5, 0x9e, 0x0b, 0xff}
	ColorPurple color.Color = color.NRGBA{0x7c, 0x3a, 0xed, 0xff}
	ColorGreen  color.Color = color.NRGBA{0x16, 0xa3, 0x4a, 0xff}
)

// Series is one data series. Values are plotted as float64 pixels-only; convert
// from decimal with d.InexactFloat64() (never feed floats back into money maths).
type Series struct {
	Name   string
	Color  color.Color
	Values []float64
}

type chartKind int

const (
	barKind chartKind = iota
	lineKind
)

// Chart draws grouped bars or lines over a shared category axis.
type Chart struct {
	widget.BaseWidget
	// Tooltip returns the hover text for category i (shown above the plot).
	Tooltip func(i int) string
	// LabelEvery draws every n-th x label (default 1) and always the last one.
	LabelEvery int

	kind   chartKind
	labels []string
	series []Series
	tip    *widget.Label
	height float32
}

// NewBarChart draws one bar per series for every label.
func NewBarChart(labels []string, series ...Series) *Chart { return newChart(barKind, labels, series) }

// NewLineChart draws one polyline per series.
func NewLineChart(labels []string, series ...Series) *Chart {
	return newChart(lineKind, labels, series)
}

func newChart(k chartKind, labels []string, series []Series) *Chart {
	c := &Chart{kind: k, labels: labels, series: series, tip: widget.NewLabel(""), height: 200, LabelEvery: 1}
	c.tip.Importance = widget.LowImportance
	c.ExtendBaseWidget(c)
	return c
}

// SetData replaces the data and redraws.
func (c *Chart) SetData(labels []string, series ...Series) {
	c.labels, c.series = labels, series
	c.Refresh()
}

// Legend returns a row of colour swatches with series names.
func Legend(series ...Series) fyne.CanvasObject {
	row := container.NewHBox()
	for _, s := range series {
		row.Add(Rect(s.Color, 12, 12))
		row.Add(widget.NewLabel(s.Name))
	}
	return row
}

func (c *Chart) MouseIn(*desktop.MouseEvent) {}
func (c *Chart) MouseOut()                   { c.tip.SetText("") }
func (c *Chart) MouseMoved(e *desktop.MouseEvent) {
	if c.Tooltip == nil || len(c.labels) == 0 {
		return
	}
	i := int(float32(len(c.labels)) * e.Position.X / c.Size().Width)
	if i >= 0 && i < len(c.labels) {
		c.tip.SetText(c.Tooltip(i))
	}
}

func (c *Chart) CreateRenderer() fyne.WidgetRenderer {
	r := &chartRenderer{c: c}
	r.rebuild()
	return r
}

type chartRenderer struct {
	c       *Chart
	objects []fyne.CanvasObject
}

func (r *chartRenderer) Destroy()                     {}
func (r *chartRenderer) Objects() []fyne.CanvasObject { return r.objects }
func (r *chartRenderer) MinSize() fyne.Size           { return fyne.NewSize(240, r.c.height) }
func (r *chartRenderer) Refresh()                     { r.rebuild(); r.Layout(r.c.Size()); canvas.Refresh(r.c) }

func (r *chartRenderer) rebuild() {
	c := r.c
	r.objects = []fyne.CanvasObject{c.tip}
	fg := theme.Color(theme.ColorNameDisabled)
	r.objects = append(r.objects, canvas.NewLine(fg)) // baseline
	for _, s := range c.series {
		for range s.Values {
			if c.kind == barKind {
				r.objects = append(r.objects, canvas.NewRectangle(s.Color))
			} else {
				r.objects = append(r.objects, canvas.NewLine(s.Color))
			}
		}
	}
	every := max(c.LabelEvery, 1)
	for i, l := range c.labels {
		if i%every == 0 || i == len(c.labels)-1 {
			t := canvas.NewText(l, theme.Color(theme.ColorNameForeground))
			t.TextSize = 10
			t.Alignment = fyne.TextAlignCenter
			r.objects = append(r.objects, t)
		}
	}
}

func (r *chartRenderer) Layout(size fyne.Size) {
	c := r.c
	const top, bottom = 24, 16
	r.c.tip.Move(fyne.NewPos(0, 0))
	r.c.tip.Resize(fyne.NewSize(size.Width, top))
	n := len(c.labels)
	plotH := size.Height - top - bottom
	if n == 0 || plotH <= 0 {
		return
	}
	lo, hi := 0.0, 1.0
	for _, s := range c.series {
		for _, v := range s.Values {
			lo, hi = math.Min(lo, v), math.Max(hi, v)
		}
	}
	yOf := func(v float64) float32 { return top + float32((hi-v)/(hi-lo))*plotH }
	base := yOf(0)
	slot := size.Width / float32(n)

	idx := 1
	r.objects[idx].(*canvas.Line).Position1 = fyne.NewPos(0, base)
	r.objects[idx].(*canvas.Line).Position2 = fyne.NewPos(size.Width, base)
	idx++
	ns := float32(len(c.series))
	for si, s := range c.series {
		for i, v := range s.Values {
			if i >= n {
				idx++
				continue
			}
			switch o := r.objects[idx].(type) {
			case *canvas.Rectangle:
				bw := slot * 0.8 / ns
				x := float32(i)*slot + slot*0.1 + float32(si)*bw
				y := yOf(v)
				o.Move(fyne.NewPos(x, min(y, base)))
				o.Resize(fyne.NewSize(max(bw-1, 1), max(float32(math.Abs(float64(y-base))), 1)))
			case *canvas.Line:
				o.StrokeWidth = 2
				x1 := float32(i)*slot + slot/2
				if i == 0 {
					o.Position1 = fyne.NewPos(x1, yOf(v))
				} else {
					o.Position1 = fyne.NewPos(x1-slot, yOf(s.Values[i-1]))
				}
				o.Position2 = fyne.NewPos(x1, yOf(v))
			}
			idx++
		}
	}
	every := max(c.LabelEvery, 1)
	for i := range c.labels {
		if i%every == 0 || i == n-1 {
			t := r.objects[idx].(*canvas.Text)
			t.Move(fyne.NewPos(float32(i)*slot+slot/2-t.MinSize().Width/2, size.Height-bottom))
			idx++
		}
	}
}
