package kit

import (
	"image/color"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/theme"
)

// Custom colour names resolved by kiraTheme (use with theme.Color).
const (
	ColorCanvas  fyne.ThemeColorName = "kira.canvas"  // app backdrop behind cards
	ColorSidebar fyne.ThemeColorName = "kira.sidebar" // navigation rail surface
	ColorAccent  fyne.ThemeColorName = "kira.accent"  // secondary brand (teal)
)

func hex(v uint32) color.NRGBA {
	return color.NRGBA{R: uint8(v >> 16), G: uint8(v >> 8), B: uint8(v), A: 0xff}
}

func alpha(c color.NRGBA, a uint8) color.NRGBA { c.A = a; return c }

// Palettes mirror kira-bank-ui styles.css (navy/blue/teal brand, soft canvas, white surfaces).
var (
	navy, white = hex(0x102a46), hex(0xffffff)

	lightPalette = map[fyne.ThemeColorName]color.Color{
		ColorCanvas:                        hex(0xf3f7fb),
		ColorSidebar:                       white,
		ColorAccent:                        hex(0x008f78),
		theme.ColorNameBackground:          white,
		theme.ColorNameForeground:          navy,
		theme.ColorNamePrimary:             hex(0x1e5fbf),
		theme.ColorNameForegroundOnPrimary: white,
		theme.ColorNameButton:              hex(0xedf4fb),
		theme.ColorNameDisabledButton:      hex(0xe5eef8),
		theme.ColorNameDisabled:            hex(0x9aabbd),
		theme.ColorNameHover:               alpha(navy, 0x0f),
		theme.ColorNamePressed:             alpha(navy, 0x1f),
		theme.ColorNameFocus:               alpha(hex(0x1e5fbf), 0x99),
		theme.ColorNameSelection:           alpha(hex(0x1e5fbf), 0x26),
		theme.ColorNameInputBackground:     hex(0xf7fafd),
		theme.ColorNameInputBorder:         hex(0xd8e3ee),
		theme.ColorNamePlaceHolder:         hex(0x7b8ca0),
		theme.ColorNameSeparator:           hex(0xe3ebf3),
		theme.ColorNameShadow:              alpha(navy, 0x1c),
		theme.ColorNameScrollBar:           alpha(navy, 0x40),
		theme.ColorNameHeaderBackground:    hex(0xedf4fb),
		theme.ColorNameMenuBackground:      white,
		theme.ColorNameOverlayBackground:   white,
		theme.ColorNameHyperlink:           hex(0x1e5fbf),
		theme.ColorNameSuccess:             hex(0x008f78),
		theme.ColorNameWarning:             hex(0xc27c0e),
		theme.ColorNameError:               hex(0xd43c3c),
	}

	darkPalette = map[fyne.ThemeColorName]color.Color{
		ColorCanvas:                        hex(0x071426),
		ColorSidebar:                       hex(0x0b1b2f),
		ColorAccent:                        hex(0x63d7bf),
		theme.ColorNameBackground:          hex(0x0f2338),
		theme.ColorNameForeground:          hex(0xedf5fc),
		theme.ColorNamePrimary:             hex(0x79b8ff),
		theme.ColorNameForegroundOnPrimary: hex(0x071426),
		theme.ColorNameForegroundOnSuccess: hex(0x071426),
		theme.ColorNameForegroundOnWarning: hex(0x071426),
		theme.ColorNameButton:              hex(0x142d48),
		theme.ColorNameDisabledButton:      hex(0x1a3a5a),
		theme.ColorNameDisabled:            hex(0x5c7390),
		theme.ColorNameHover:               alpha(white, 0x12),
		theme.ColorNamePressed:             alpha(white, 0x22),
		theme.ColorNameFocus:               alpha(hex(0x7dd3fc), 0xaa),
		theme.ColorNameSelection:           alpha(hex(0x79b8ff), 0x33),
		theme.ColorNameInputBackground:     hex(0x0b1828),
		theme.ColorNameInputBorder:         hex(0x2c4864),
		theme.ColorNamePlaceHolder:         hex(0x7f95ae),
		theme.ColorNameSeparator:           hex(0x1f3550),
		theme.ColorNameShadow:              alpha(hex(0x000000), 0x66),
		theme.ColorNameScrollBar:           alpha(white, 0x40),
		theme.ColorNameHeaderBackground:    hex(0x142d48),
		theme.ColorNameMenuBackground:      hex(0x10263e),
		theme.ColorNameOverlayBackground:   hex(0x10263e),
		theme.ColorNameHyperlink:           hex(0x79b8ff),
		theme.ColorNameSuccess:             hex(0x63d7bf),
		theme.ColorNameWarning:             hex(0xf2b84b),
		theme.ColorNameError:               hex(0xff7b7b),
	}

	sizes = map[fyne.ThemeSizeName]float32{
		theme.SizeNamePadding:            5,
		theme.SizeNameInnerPadding:       10,
		theme.SizeNameHeadingText:        22,
		theme.SizeNameSubHeadingText:     16,
		theme.SizeNameSeparatorThickness: 1,
		theme.SizeNameInputBorder:        1,
		theme.SizeNameInputRadius:        10,
		theme.SizeNameButtonRadius:       10,
		theme.SizeNameSelectionRadius:    8,
		theme.SizeNameCardRadius:         14,
		theme.SizeNamePopupRadius:        12,
		theme.SizeNameMenuRadius:         12,
		theme.SizeNameDialogRadius:       16,
		theme.SizeNameScrollBarRadius:    4,
	}
)

// kiraTheme is the brand theme; force pins the light/dark variant (else follows the OS).
type kiraTheme struct {
	fyne.Theme
	force   bool
	variant fyne.ThemeVariant
}

func (t kiraTheme) Color(n fyne.ThemeColorName, v fyne.ThemeVariant) color.Color {
	if t.force {
		v = t.variant
	}
	p := lightPalette
	if v == theme.VariantDark {
		p = darkPalette
	}
	if c, ok := p[n]; ok {
		return c
	}
	return t.Theme.Color(n, v)
}

func (t kiraTheme) Size(n fyne.ThemeSizeName) float32 {
	if s, ok := sizes[n]; ok {
		return s
	}
	return t.Theme.Size(n)
}

// ApplyTheme applies the saved "kira-theme" preference (system|light|dark).
func ApplyTheme(env *Env) {
	t := kiraTheme{Theme: theme.DefaultTheme()}
	switch env.Pref("kira-theme", "system") {
	case "light":
		t.force, t.variant = true, theme.VariantLight
	case "dark":
		t.force, t.variant = true, theme.VariantDark
	}
	env.App.Settings().SetTheme(t)
}
