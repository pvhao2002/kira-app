// Package kit is the shared UI toolkit: app shell, page registry types and the
// reusable widgets every feature page is built from. See README.md.
package kit

import (
	"bytes"
	"context"
	"net/url"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
)

// Page is one navigable screen. Feature packages export Pages(env) []kit.Page.
type Page struct {
	ID        string // route path, e.g. "/app/banks"; used with Env.Navigate
	Group     string // sidebar group header i18n key ("" = top level)
	TitleKey  string // i18n key for window/page title
	MenuKey   string // i18n key for the sidebar label (defaults to TitleKey)
	Icon      fyne.Resource
	AdminOnly bool
	Hidden    bool // navigable but not in the sidebar
	Order     int  // sort order inside the group (then registry order)
	Build     func() fyne.CanvasObject
}

// Env is handed to every feature package. Methods are safe to call from any
// goroutine unless noted; widget construction/updates must be on the UI thread
// (use Async or fyne.Do).
type Env struct {
	API    *api.Client
	App    fyne.App
	Window fyne.Window

	host    *host
	onClose []func()
}

func NewEnv(a fyne.App, w fyne.Window, c *api.Client) *Env {
	return &Env{API: c, App: a, Window: w}
}

// OnClose registers f to run (UI thread) when the user closes the window,
// before the app exits. Keep it fast: it delays shutdown.
func (e *Env) OnClose(f func()) { e.onClose = append(e.onClose, f) }

// User is the signed-in user (nil when signed out).
func (e *Env) User() *api.Profile { return e.API.User() }

// IsAdmin reports ROLE_ADMIN.
func (e *Env) IsAdmin() bool { return e.API.User().IsAdmin() }

// Navigate opens a page by ID with optional query-like params (read them in
// Build via Params()). Call on the UI thread.
func (e *Env) Navigate(id string, params map[string]string) {
	if e.host != nil {
		e.host.navigate(id, params)
	}
}

// Params returns the params of the navigation currently building a page.
func (e *Env) Params() map[string]string {
	if e.host == nil || e.host.params == nil {
		return map[string]string{}
	}
	return e.host.params
}

// Pref / SetPref wrap fyne Preferences (string values).
func (e *Env) Pref(key, def string) string { return e.App.Preferences().StringWithFallback(key, def) }
func (e *Env) SetPref(key, val string)     { e.App.Preferences().SetString(key, val) }

// SetLanguage switches en/vi, persists it and re-renders the shell.
func (e *Env) SetLanguage(l string) {
	e.SetPref("kira-language", l)
	i18n.SetLang(l)
}

// BaseURL returns the configured server URL.
func (e *Env) BaseURL() string { return e.API.BaseURL() }

// SetBaseURL validates (see api.NormalizeBaseURL), saves and applies a server URL.
func (e *Env) SetBaseURL(raw string) error {
	if err := e.API.SetBaseURL(raw); err != nil {
		return err
	}
	e.SetPref("kira-base-url", e.API.BaseURL())
	return nil
}

// LoggedIn is called by the login page after a successful Login; it opens the shell.
func (e *Env) LoggedIn() {
	if e.host != nil {
		e.host.showShell()
	}
}

// Logout revokes the session and shows the login screen. Call on the UI thread.
func (e *Env) Logout() {
	Async(func(ctx context.Context) (struct{}, error) { e.API.Logout(ctx); return struct{}{}, nil },
		func(struct{}, error) {
			if e.host != nil {
				e.host.showLogin()
			}
		})
}

// ---- toasts, errors, dialogs ----

// ToastKind selects toast styling.
type ToastKind int

const (
	ToastInfo ToastKind = iota
	ToastSuccess
	ToastError
)

// Toast shows a 4 second message at the bottom of the window. Goroutine-safe.
func (e *Env) Toast(kind ToastKind, msg string) {
	fyne.Do(func() {
		h := e.host
		if h == nil || e.Window == nil {
			return
		}
		if h.toast != nil {
			h.toast.Hide()
		}
		lbl := widget.NewLabel(msg)
		lbl.Wrapping = fyne.TextWrapWord
		lbl.Importance = map[ToastKind]widget.Importance{ToastInfo: widget.MediumImportance, ToastSuccess: widget.SuccessImportance, ToastError: widget.DangerImportance}[kind]
		p := widget.NewPopUp(container.NewPadded(lbl), e.Window.Canvas())
		cs := e.Window.Canvas().Size()
		w := min(cs.Width-40, 520)
		p.Resize(fyne.NewSize(w, p.MinSize().Height))
		p.ShowAtPosition(fyne.NewPos((cs.Width-w)/2, cs.Height-p.Size().Height-24))
		h.toast = p
		time.AfterFunc(4*time.Second, func() {
			fyne.Do(func() {
				p.Hide()
				if h.toast == p {
					h.toast = nil
				}
			})
		})
	})
}

// ShowError toasts the user-facing text of err (server message when safe,
// otherwise the generic "unable to connect" text). Goroutine-safe.
func (e *Env) ShowError(err error) {
	e.Toast(ToastError, api.Message(err, i18n.T("error.serverUnavailable")))
}

// Confirm asks a yes/no question and calls onYes on confirmation. UI thread.
func (e *Env) Confirm(message string, onYes func()) {
	dialog.NewConfirm("", message, func(ok bool) {
		if ok {
			onYes()
		}
	}, e.Window).Show()
}

// OpenURL opens an http(s) link in the OS browser.
func (e *Env) OpenURL(raw string) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return
	}
	_ = e.App.OpenURL(u)
}

// SaveFile asks where to save data and writes it. UI thread.
func (e *Env) SaveFile(filename string, data []byte) {
	d := dialog.NewFileSave(func(w fyne.URIWriteCloser, err error) {
		if err != nil {
			e.ShowError(err)
			return
		}
		if w == nil {
			return
		}
		defer w.Close()
		if _, err := w.Write(data); err != nil {
			e.ShowError(err)
			return
		}
		e.Toast(ToastSuccess, filename)
	}, e.Window)
	d.SetFileName(filename)
	d.Show()
}

// SaveCSV exports header+rows as UTF-8 CSV with BOM, every cell quoted. UI thread.
// With no rows it only shows the "no data" info toast.
func (e *Env) SaveCSV(filename string, header []string, rows [][]string) {
	if len(rows) == 0 {
		e.Toast(ToastInfo, i18n.T("desktop.noExportData"))
		return
	}
	var b bytes.Buffer
	b.Write([]byte{0xEF, 0xBB, 0xBF}) // UTF-8 BOM
	for _, rec := range append([][]string{header}, rows...) {
		for i, c := range rec {
			if i > 0 {
				b.WriteByte(',')
			}
			b.WriteString(`"` + strings.ReplaceAll(csvCell(c), `"`, `""`) + `"`)
		}
		b.WriteString("\r\n")
	}
	e.SaveFile(filename, b.Bytes())
}
