// Package bank is the read-only bank directory (/app/banks).
package bank

import (
	"context"
	"strconv"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

// Bank is a public/banks row.
type Bank struct {
	ID          int64  `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	ShortName   string `json:"shortName"`
	LogoURL     string `json:"logoUrl"`
	Website     string `json:"website"`
	Hotline     string `json:"hotline"`
	Description string `json:"description"`
}

// Pages registers the directory in the Credit cards group.
func Pages(env *kit.Env) []kit.Page {
	return []kit.Page{{ID: "/app/banks", Group: "shell.groupCredit", TitleKey: "route.banks", MenuKey: "shell.banks",
		Order: 70, Icon: theme.HomeIcon(), Build: func() fyne.CanvasObject { return build(env) }}}
}

// Filter keeps banks whose name, shortName or code contains q (case-insensitive).
func Filter(banks []Bank, q string) []Bank {
	q = strings.ToLower(strings.TrimSpace(q))
	if q == "" {
		return banks
	}
	var out []Bank
	for _, b := range banks {
		if strings.Contains(strings.ToLower(b.Name), q) || strings.Contains(strings.ToLower(b.ShortName), q) ||
			strings.Contains(strings.ToLower(b.Code), q) {
			out = append(out, b)
		}
	}
	return out
}

func build(env *kit.Env) fyne.CanvasObject {
	var all []Bank
	grid := container.NewGridWrap(fyne.NewSize(300, 170))
	count := widget.NewLabel("")
	stat := kit.Tile(i18n.T("bank.statBanks"), "…")
	statBox := container.NewStack(stat)
	bar := widget.NewProgressBarInfinite()

	show := func(q string) {
		list := Filter(all, q)
		grid.Objects = nil
		for _, b := range list {
			grid.Add(card(env, b))
		}
		grid.Refresh()
		count.SetText(i18n.T("bank.bankCount", i18n.P{"n": len(list)}))
		statBox.Objects = []fyne.CanvasObject{kit.Tile(i18n.T("bank.statBanks"), strconv.Itoa(len(all)))}
		statBox.Refresh()
	}

	search := widget.NewEntry()
	search.SetPlaceHolder(i18n.T("bank.searchPlaceholder"))
	var timer *time.Timer
	search.OnChanged = func(q string) {
		if timer != nil {
			timer.Stop()
		}
		timer = time.AfterFunc(250*time.Millisecond, func() { fyne.Do(func() { show(q) }) })
	}
	if q := env.Params()["search"]; q != "" {
		search.Text = q
	}

	kit.Async(func(ctx context.Context) ([]Bank, error) {
		return api.GetAll[Bank](ctx, env.API, "public/banks", nil, 100)
	}, func(b []Bank, err error) {
		bar.Hide()
		if err != nil {
			env.ShowError(err)
			return
		}
		all = b
		show(search.Text)
	})

	head := container.NewVBox(
		kit.PageHeader(i18n.T("bank.eyebrow"), i18n.T("bank.title"), i18n.T("bank.description")),
		statBox, search,
		container.NewHBox(kit.Heading(i18n.T("bank.sectionBanks")), count), bar)
	return container.NewBorder(head, nil, nil, nil, container.NewVScroll(grid))
}

func card(env *kit.Env, b Bank) fyne.CanvasObject {
	title := b.ShortName
	if title == "" {
		title = b.Name
	}
	logo := fyne.CanvasObject(widget.NewLabel(firstRunes(b.Code, 3)))
	if b.LogoURL != "" {
		logo = env.Image(b.LogoURL, fyne.NewSize(42, 42))
	}
	body := container.NewVBox(
		container.NewHBox(logo, kit.Heading(title), kit.Badge(b.Code, widget.LowImportance)),
		kit.Muted(b.Name))
	if b.Hotline != "" {
		body.Add(widget.NewLabelWithStyle(b.Hotline, fyne.TextAlignLeading, fyne.TextStyle{}))
	}
	if b.Website != "" {
		link := widget.NewButtonWithIcon(i18n.T("bank.website"), theme.ComputerIcon(), func() { env.OpenURL(b.Website) })
		link.Importance = widget.LowImportance
		body.Add(link)
	}
	return widget.NewCard("", "", body)
}

func firstRunes(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		r = r[:n]
	}
	return string(r)
}
