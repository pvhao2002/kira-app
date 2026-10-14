package kit

import (
	"context"
	"encoding/json"
	"sort"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
)

// groupOrder is the sidebar group order (spec §3). Unknown groups go last.
var groupOrder = []string{
	"", "travel.title", "health.overview", "shell.groupCredit", "shell.groupInvestment",
	"shell.groupReports", "shell.groupPersonal", "shell.groupLodging", "shell.groupTutor",
	"shell.groupAdmin", "shell.groupSystem",
}

type host struct {
	env     *Env
	pages   []Page
	byID    map[string]Page
	login   func(*Env) fyne.CanvasObject
	current string
	params  map[string]string
	toast   *widget.PopUp
	expand  map[string]bool

	sidebar *fyne.Container
	topbar  *fyne.Container
	content *fyne.Container
	unread  int
	inShell bool
}

// Run wires the shell and starts the app: tries to restore the stored session,
// then shows the shell or the login view. It blocks until the window closes.
// login builds the login screen; it must call env.LoggedIn() on success.
func Run(env *Env, pages []Page, login func(*Env) fyne.CanvasObject) {
	h := &host{env: env, byID: map[string]Page{}, login: login, expand: map[string]bool{}}
	for _, p := range pages {
		if p.MenuKey == "" {
			p.MenuKey = p.TitleKey
		}
		h.pages = append(h.pages, p)
		h.byID[p.ID] = p
	}
	env.host = h
	var saved []string
	_ = json.Unmarshal([]byte(env.Pref("kira-nav-expanded", "[]")), &saved)
	for _, g := range saved {
		h.expand[g] = true
	}
	i18n.SetLang(env.Pref("kira-language", "en"))
	ApplyTheme(env)

	env.API.OnSessionExpired = func(err error) {
		fyne.Do(func() {
			h.showLogin()
			env.Toast(ToastError, api.Message(err, i18n.T("error.serverUnavailable")))
		})
	}
	i18n.OnChange(func() { fyne.Do(h.relayout) })
	// Pages paint theme colours at build time, so rebuild the shell when the theme changes.
	env.App.Settings().AddListener(func(fyne.Settings) {
		fyne.Do(func() {
			if h.inShell {
				h.navigate(h.current, h.params)
			}
		})
	})

	env.Window.SetContent(container.NewCenter(widget.NewProgressBarInfinite()))
	env.Window.Resize(fyne.NewSize(1280, 800))
	Async(func(ctx context.Context) (struct{}, error) { return struct{}{}, env.API.Restore(ctx) },
		func(_ struct{}, err error) {
			if err != nil {
				h.showLogin()
				return
			}
			h.showShell()
		})
	env.Window.SetCloseIntercept(func() {
		for _, f := range env.onClose {
			f()
		}
		env.Window.Close()
	})
	env.Window.ShowAndRun()
}

func (h *host) showLogin() {
	h.inShell = false
	h.env.Window.SetTitle(i18n.T("route.login") + " - Kira Life")
	h.env.Window.SetContent(h.login(h.env))
}

func (h *host) showShell() {
	h.inShell = true
	h.sidebar = container.NewStack()
	h.topbar = container.NewStack()
	h.content = container.NewStack()
	h.env.Window.SetContent(container.NewBorder(h.topbar, nil, h.sidebar, nil, h.content))
	h.navigate("/app", nil)
}

// relayout rebuilds everything after a language change.
func (h *host) relayout() {
	if h.inShell {
		h.navigate(h.current, h.params)
	} else {
		h.showLogin()
	}
}

func (h *host) navigate(id string, params map[string]string) {
	p, ok := h.byID[id]
	if !ok || (p.AdminOnly && !h.env.IsAdmin()) {
		id = "/app"
		p, ok = h.byID[id]
		if !ok {
			return
		}
	}
	h.current, h.params = id, params
	if p.Group != "" {
		h.setExpanded(p.Group, true)
	}
	h.env.Window.SetTitle(i18n.T(p.TitleKey) + " - Kira Life")
	h.buildSidebar()
	h.buildTopbar()
	var body fyne.CanvasObject = widget.NewLabel("")
	if p.Build != nil {
		body = p.Build()
	}
	page := container.New(layout.NewCustomPaddedLayout(18, 24, 22, 22), body)
	h.content.Objects = []fyne.CanvasObject{canvas.NewRectangle(theme.Color(ColorCanvas)), container.NewVScroll(page)}
	h.content.Refresh()
	h.refreshUnread()
}

// ---- sidebar ----

func (h *host) isExpanded(g string) bool { return h.expand[g] }

func (h *host) setExpanded(g string, v bool) {
	h.expand[g] = v
	var list []string
	for k, on := range h.expand {
		if on {
			list = append(list, k)
		}
	}
	sort.Strings(list)
	b, _ := json.Marshal(list)
	h.env.SetPref("kira-nav-expanded", string(b))
}

func (h *host) buildSidebar() {
	groups := map[string][]Page{}
	for _, p := range h.pages {
		if p.Hidden || (p.AdminOnly && !h.env.IsAdmin()) {
			continue
		}
		groups[p.Group] = append(groups[p.Group], p)
	}
	order := append([]string{}, groupOrder...)
	var extra []string
	for g := range groups {
		if !contains(order, g) {
			extra = append(extra, g)
		}
	}
	sort.Strings(extra)
	order = append(order, extra...)

	col := container.NewVBox()
	name := canvas.NewText("Kira Life", theme.Color(theme.ColorNameForeground))
	name.TextSize = 17
	name.TextStyle = fyne.TextStyle{Bold: true}
	col.Add(container.New(layout.NewCustomPaddedLayout(6, 12, 4, 0),
		container.NewHBox(BrandMark(34), container.NewCenter(name))))
	for _, g := range order {
		items := groups[g]
		if len(items) == 0 {
			continue
		}
		sort.SliceStable(items, func(i, j int) bool { return items[i].Order < items[j].Order })
		if g != "" {
			g := g
			icon := theme.MenuDropDownIcon()
			if !h.isExpanded(g) {
				icon = theme.NavigateNextIcon()
			}
			hd := widget.NewButtonWithIcon(strings.ToUpper(i18n.T(g)), icon, func() {
				h.setExpanded(g, !h.isExpanded(g))
				h.buildSidebar()
			})
			hd.Alignment = widget.ButtonAlignLeading
			hd.Importance = widget.LowImportance
			col.Add(hd)
			if !h.isExpanded(g) {
				continue
			}
		}
		for _, p := range items {
			id := p.ID
			b := widget.NewButtonWithIcon(i18n.T(p.MenuKey), p.Icon, func() { h.navigate(id, nil) })
			b.Alignment = widget.ButtonAlignLeading
			b.Importance = widget.LowImportance
			if id == h.current {
				b.Importance = widget.HighImportance
			}
			col.Add(b)
		}
	}
	shield := widget.NewIcon(theme.ConfirmIcon())
	col.Add(container.New(layout.NewCustomPaddedLayout(14, 0, 0, 0), Surface(container.NewBorder(nil, nil, container.NewCenter(shield), nil,
		Muted(i18n.T("shell.secureConnection")+"\n"+i18n.T("shell.dataProtected"))))))
	side := container.NewVScroll(container.New(layout.NewCustomPaddedLayout(8, 12, 10, 10), col))
	side.SetMinSize(fyne.NewSize(256, 0))
	edge := canvas.NewRectangle(theme.Color(theme.ColorNameSeparator))
	edge.SetMinSize(fyne.NewSize(1, 0))
	h.sidebar.Objects = []fyne.CanvasObject{canvas.NewRectangle(theme.Color(ColorSidebar)),
		container.NewBorder(nil, nil, nil, edge, side)}
	h.sidebar.Refresh()
}

func contains(l []string, s string) bool {
	for _, x := range l {
		if x == s {
			return true
		}
	}
	return false
}

// ---- top bar ----

func (h *host) buildTopbar() {
	env := h.env
	p := h.byID[h.current]
	t := canvas.NewText(i18n.T(p.TitleKey), theme.Color(theme.ColorNameForeground))
	t.TextSize = 18
	t.TextStyle = fyne.TextStyle{Bold: true}
	title := container.NewVBox(t)
	if p.Group != "" {
		g := canvas.NewText(strings.ToUpper(i18n.T(p.Group)), theme.Color(theme.ColorNamePlaceHolder))
		g.TextSize = 11
		g.TextStyle = fyne.TextStyle{Bold: true}
		title.Objects = []fyne.CanvasObject{g, t}
	}

	lang := widget.NewSelect([]string{"EN", "VI"}, func(s string) { env.SetLanguage(strings.ToLower(s)) })
	lang.SetSelected(strings.ToUpper(i18n.Lang()))

	themeBtn := widget.NewButtonWithIcon(i18n.T("theme."+env.Pref("kira-theme", "system")), theme.ColorPaletteIcon(), func() {
		next := map[string]string{"system": "light", "light": "dark", "dark": "system"}[env.Pref("kira-theme", "system")]
		env.SetPref("kira-theme", next)
		ApplyTheme(env) // the settings listener rebuilds the shell
	})

	bell := widget.NewButtonWithIcon("", theme.InfoIcon(), func() { env.Navigate("/app/notifications", nil) })
	if h.unread > 0 {
		bell.SetText(itoa(h.unread))
		bell.Importance = widget.DangerImportance
	}

	user := env.User()
	acct := widget.NewButton(Initials(user), nil)
	acct.Importance = widget.HighImportance
	acct.OnTapped = func() {
		menu := fyne.NewMenu("",
			fyne.NewMenuItem(user.FullName, nil),
			fyne.NewMenuItem(user.Email, nil),
			fyne.NewMenuItemSeparator(),
			fyne.NewMenuItem(i18n.T("shell.profile"), func() { env.Navigate("/app/profile", nil) }),
			fyne.NewMenuItem(i18n.T("shell.logout"), env.Logout),
		)
		menu.Items[0].Disabled, menu.Items[1].Disabled = true, true
		pop := widget.NewPopUpMenu(menu, env.Window.Canvas())
		pos := fyne.CurrentApp().Driver().AbsolutePositionForObject(acct)
		pop.ShowAtPosition(pos.Add(fyne.NewPos(0, acct.Size().Height)))
	}
	right := container.NewHBox(lang, themeBtn, bell, acct)
	bar := container.New(layout.NewCustomPaddedLayout(8, 8, 22, 16), container.NewBorder(nil, nil, container.NewCenter(title), container.NewCenter(right)))
	h.topbar.Objects = []fyne.CanvasObject{canvas.NewRectangle(theme.Color(theme.ColorNameBackground)),
		container.NewVBox(bar, widget.NewSeparator())}
	h.topbar.Refresh()
}

// Initials are the first letters of the last two words of the name ("KL" fallback).
func Initials(u *api.Profile) string {
	if u == nil {
		return "KL"
	}
	w := strings.Fields(u.FullName)
	if len(w) == 0 {
		return "KL"
	}
	if len(w) > 2 {
		w = w[len(w)-2:]
	}
	var out string
	for _, x := range w {
		out += strings.ToUpper(string([]rune(x)[:1]))
	}
	return out
}

func itoa(n int) string { b, _ := json.Marshal(n); return string(b) }

func (h *host) refreshUnread() {
	Async(func(ctx context.Context) (int, error) {
		var r struct {
			Count int `json:"count"`
		}
		err := h.env.API.Get(ctx, "notifications/unread-count", nil, &r)
		return r.Count, err
	}, func(n int, err error) {
		if err == nil && n != h.unread && h.env.API.Authenticated() {
			h.unread = n
			h.buildTopbar()
		}
	})
}
