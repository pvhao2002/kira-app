package kit

import (
	"image/color"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
)

// Heading is a bold page/section title.
func Heading(text string) *widget.Label {
	l := widget.NewLabel(text)
	l.TextStyle = fyne.TextStyle{Bold: true}
	return l
}

// Muted is secondary text (wraps).
func Muted(text string) *widget.Label {
	l := widget.NewLabel(text)
	l.Importance = widget.LowImportance
	l.Wrapping = fyne.TextWrapWord
	return l
}

// importanceColor maps a widget importance to its theme colour (pills, accents).
func importanceColor(imp widget.Importance) color.Color {
	switch imp {
	case widget.SuccessImportance:
		return theme.Color(theme.ColorNameSuccess)
	case widget.WarningImportance:
		return theme.Color(theme.ColorNameWarning)
	case widget.DangerImportance:
		return theme.Color(theme.ColorNameError)
	case widget.HighImportance:
		return theme.Color(theme.ColorNamePrimary)
	}
	return theme.Color(theme.ColorNamePlaceHolder)
}

func tint(c color.Color, a uint8) color.NRGBA {
	n := color.NRGBAModel.Convert(c).(color.NRGBA)
	n.A = a
	return n
}

// Badge is a small status pill (importance colours text and a soft background).
func Badge(text string, imp widget.Importance) fyne.CanvasObject {
	l := widget.NewLabel(text)
	l.Importance = imp
	l.TextStyle = fyne.TextStyle{Bold: true}
	bg := canvas.NewRectangle(tint(importanceColor(imp), 0x22))
	bg.CornerRadius = 999
	pill := container.NewStack(bg, container.New(layout.NewCustomPaddedLayout(-7, -7, 4, 4), l))
	return container.NewHBox(pill)
}

// Card groups content under an optional title and subtitle.
func Card(title, subtitle string, content fyne.CanvasObject) fyne.CanvasObject {
	return widget.NewCard(title, subtitle, content)
}

// Surface puts content on a rounded, bordered panel in the card colour.
func Surface(content fyne.CanvasObject) fyne.CanvasObject {
	bg := canvas.NewRectangle(theme.Color(theme.ColorNameBackground))
	bg.CornerRadius = theme.Size(theme.SizeNameCardRadius)
	bg.StrokeColor = theme.Color(theme.ColorNameSeparator)
	bg.StrokeWidth = 1
	return container.NewStack(bg, container.New(layout.NewCustomPaddedLayout(10, 12, 14, 14), content))
}

// Tile is a metric tile: small caption above a large value, on its own surface.
func Tile(caption, value string) fyne.CanvasObject {
	v := canvas.NewText(value, theme.Color(theme.ColorNameForeground))
	v.TextSize = 22
	v.TextStyle = fyne.TextStyle{Bold: true}
	c := canvas.NewText(strings.ToUpper(caption), theme.Color(theme.ColorNamePlaceHolder))
	c.TextSize = 11
	c.TextStyle = fyne.TextStyle{Bold: true}
	bar := Rect(theme.Color(theme.ColorNamePrimary), 28, 3)
	bar.CornerRadius = 2
	return Surface(container.NewVBox(container.NewHBox(bar), c, v))
}

// BrandMark is the rounded "K" logo square.
func BrandMark(size float32) fyne.CanvasObject {
	bg := canvas.NewRectangle(theme.Color(theme.ColorNamePrimary))
	bg.CornerRadius = size * 0.3
	k := canvas.NewText("K", theme.Color(theme.ColorNameForegroundOnPrimary))
	k.TextSize = size * 0.55
	k.TextStyle = fyne.TextStyle{Bold: true}
	return container.NewGridWrap(fyne.NewSize(size, size), container.NewStack(bg, container.NewCenter(k)))
}

// PageHeader lays out eyebrow (optional), title, optional description and right-side actions.
func PageHeader(eyebrow, title, desc string, actions ...fyne.CanvasObject) fyne.CanvasObject {
	left := container.NewVBox()
	if eyebrow != "" {
		e := canvas.NewText(strings.ToUpper(eyebrow), theme.Color(theme.ColorNamePrimary))
		e.TextSize = 11
		e.TextStyle = fyne.TextStyle{Bold: true}
		left.Add(e)
	}
	t := canvas.NewText(title, theme.Color(theme.ColorNameForeground))
	t.TextSize = 24
	t.TextStyle = fyne.TextStyle{Bold: true}
	left.Add(t)
	if desc != "" {
		left.Add(Muted(desc))
	}
	if len(actions) == 0 {
		return left
	}
	return container.NewBorder(nil, nil, nil, container.NewCenter(container.NewHBox(actions...)), left)
}

// Sep is a thin horizontal rule.
func Sep() fyne.CanvasObject { return widget.NewSeparator() }

// Rect is a coloured block of a fixed minimum size (legend swatches, charts).
func Rect(c color.Color, w, h float32) *canvas.Rectangle {
	r := canvas.NewRectangle(c)
	r.SetMinSize(fyne.NewSize(w, h))
	return r
}
