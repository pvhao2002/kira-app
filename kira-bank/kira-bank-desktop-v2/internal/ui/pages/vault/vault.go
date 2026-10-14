// Package vault is the password manager (/app/password-manager). Encryption is
// server-side; the app only does the unlock-token handshake. Secrets and the
// unlock token live in memory only and are never logged.
package vault

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sync"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

const (
	hdrToken     = "X-Vault-Unlock-Token"
	clipboardTTL = 30 * time.Second
)

type module struct {
	ID           int64   `json:"id"`
	Name         string  `json:"name"`
	WebsiteURL   *string `json:"websiteUrl"`
	Description  *string `json:"description"`
	AccountCount int     `json:"accountCount"`
	Version      int64   `json:"version"`
}

type account struct {
	ID             int64  `json:"id"`
	ModuleID       int64  `json:"moduleId"`
	DisplayName    string `json:"displayName"`
	PasswordMasked string `json:"passwordMasked"`
	Version        int64  `json:"version"`
}

type secret struct {
	Username *string `json:"username"`
	Password *string `json:"password"`
	LoginURL *string `json:"loginUrl"`
	Note     *string `json:"note"`
	Value    *string `json:"value"`
}

func (s *secret) wipe() { *s = secret{} }

type unlockResp struct {
	Token     string `json:"unlockToken"`
	ExpiresAt string `json:"expiresAt"`
}

func str(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func strOrNil(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// Pages registers the vault in the System group, before notifications/settings.
func Pages(env *kit.Env) []kit.Page {
	return []kit.Page{{ID: "/app/password-manager", Group: "shell.groupSystem", TitleKey: "route.passwordManager",
		MenuKey: "shell.passwordManager", Icon: theme.VisibilityOffIcon(), Order: 10,
		Build: func() fyne.CanvasObject { return build(env) }}}
}

// current is the most recently built page; building a new one (navigation)
// locks the previous silently.
// ponytail: kit has no page-leave hook, so leaving locks on the next build or at token expiry (5 min).
var current *page

var closeHooked bool

type page struct {
	env *kit.Env

	mu      sync.Mutex
	token   string
	expires time.Time
	timer   *time.Timer
	closers []func() // close + wipe open reveal/account dialogs

	clipVal   string      // pending clipboard copy (UI thread only)
	clipTimer *time.Timer // clears it after clipboardTTL

	modules  []module
	accounts []account
	selID    int64
	query    string
	loadSeq  int
	accSeq   int
	loading  bool

	lockBtn, chip  *widget.Button
	modBox, accBox *fyne.Container
	accHead        *fyne.Container
}

func build(env *kit.Env) fyne.CanvasObject {
	if current != nil {
		current.lock(false)
	}
	p := &page{env: env}
	current = p
	if !closeHooked { // Env hooks cannot be removed: register once, act on the live page
		closeHooked = true
		env.OnClose(func() {
			if current != nil {
				current.shutdown()
			}
		})
	}

	p.lockBtn = widget.NewButtonWithIcon(i18n.T("passwordManager.lockNow"), theme.CancelIcon(), func() { p.lock(true) })
	p.chip = widget.NewButton("", nil)
	p.chip.Importance = widget.LowImportance
	p.chip.Disable()
	add := widget.NewButtonWithIcon(i18n.T("passwordManager.addModule"), theme.ContentAddIcon(), func() { p.moduleDialog(nil) })
	add.Importance = widget.HighImportance

	search := widget.NewEntry()
	search.SetPlaceHolder(i18n.T("passwordManager.search"))
	search.OnChanged = func(s string) { p.query = Normalize(s); p.renderModules(); p.renderAccounts() }

	p.modBox = container.NewVBox()
	p.accHead = container.NewVBox()
	p.accBox = container.NewVBox()
	left := container.NewBorder(kit.Heading(i18n.T("passwordManager.modules")), nil, nil, nil, container.NewVScroll(p.modBox))
	right := container.NewBorder(p.accHead, nil, nil, nil, container.NewVScroll(p.accBox))
	split := container.NewHSplit(left, right)
	split.Offset = 0.3

	p.refreshState()
	p.loadModules(0)
	return container.NewBorder(
		container.NewVBox(
			kit.PageHeader(i18n.T("passwordManager.eyebrow"), i18n.T("passwordManager.title"), i18n.T("passwordManager.description"), p.lockBtn, add),
			container.NewBorder(nil, nil, nil, p.chip, search)),
		nil, nil, nil, split)
}

// ---- unlock state ----

func (p *page) valid() (string, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.token, p.token != "" && time.Now().Before(p.expires)
}

func (p *page) refreshState() {
	if _, ok := p.valid(); ok {
		p.chip.SetText(i18n.T("passwordManager.unlocked"))
		p.chip.SetIcon(theme.ConfirmIcon())
		p.lockBtn.Show()
	} else {
		p.chip.SetText(i18n.T("passwordManager.lockedState"))
		p.chip.SetIcon(theme.VisibilityOffIcon())
		p.lockBtn.Hide()
	}
}

func (p *page) setToken(tok string, exp time.Time) {
	p.mu.Lock()
	if p.timer != nil {
		p.timer.Stop()
	}
	p.token, p.expires = tok, exp
	p.timer = time.AfterFunc(time.Until(exp), func() { fyne.Do(func() { p.lock(false) }) })
	p.mu.Unlock()
	p.refreshState()
}

// drop forgets the token locally (expired / server said VAULT_LOCKED).
func (p *page) drop() {
	p.mu.Lock()
	if p.timer != nil {
		p.timer.Stop()
	}
	p.token, p.timer = "", nil
	p.mu.Unlock()
	p.refreshState()
}

// lock revokes the token server-side (errors ignored) and wipes plaintext. UI thread.
func (p *page) lock(manual bool) {
	p.mu.Lock()
	tok := p.token
	cl := p.closers
	p.closers = nil
	p.mu.Unlock()
	p.drop()
	p.clearClip()
	for _, f := range cl {
		f()
	}
	if tok == "" {
		return
	}
	go p.revoke(tok, 10*time.Second)
	if manual {
		p.env.Toast(kit.ToastInfo, i18n.T("passwordManager.locked"))
	}
}

// revoke deletes the unlock token server-side (errors ignored).
func (p *page) revoke(tok string, timeout time.Duration) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	_ = p.env.API.Do(ctx, "DELETE", "password-vault/unlock", nil, nil, nil, api.WithHeader(hdrToken, tok))
}

// shutdown runs on window close: wipe, clear the clipboard and revoke synchronously (short timeout).
func (p *page) shutdown() {
	p.mu.Lock()
	tok, cl := p.token, p.closers
	p.closers = nil
	p.mu.Unlock()
	p.drop()
	p.clearClip()
	for _, f := range cl {
		f()
	}
	if tok != "" {
		p.revoke(tok, 2*time.Second)
	}
}

// clearClip empties the clipboard if it still holds the copied secret. UI thread.
func (p *page) clearClip() {
	if p.clipTimer != nil {
		p.clipTimer.Stop()
		p.clipTimer = nil
	}
	if p.clipVal != "" && p.env.App.Clipboard().Content() == p.clipVal {
		p.env.App.Clipboard().SetContent("")
	}
	p.clipVal = ""
}

func (p *page) track(f func()) {
	p.mu.Lock()
	p.closers = append(p.closers, f)
	p.mu.Unlock()
}

// ensure runs then(token) with a valid token, prompting for the password first if needed.
func (p *page) ensure(then func(tok string)) {
	if tok, ok := p.valid(); ok {
		then(tok)
		return
	}
	p.drop()
	p.promptUnlock(then)
}

func isLocked(err error) bool {
	var ae *api.ApiError
	return errors.As(err, &ae) && ae.Code == "VAULT_LOCKED"
}

// withVault runs a token-requiring call; on VAULT_LOCKED it re-prompts and retries.
func withVault[T any](p *page, work func(ctx context.Context, tok string) (T, error), done func(T, error)) {
	p.ensure(func(tok string) {
		kit.Async(func(ctx context.Context) (T, error) { return work(ctx, tok) }, func(v T, err error) {
			if isLocked(err) {
				p.drop()
				withVault(p, work, done)
				return
			}
			done(v, err)
		})
	})
}

func (p *page) promptUnlock(then func(tok string)) {
	pw := widget.NewPasswordEntry()
	pw.SetPlaceHolder(i18n.T("passwordManager.currentPassword"))
	errLbl := widget.NewLabel("")
	errLbl.Importance = widget.DangerImportance
	errLbl.Wrapping = fyne.TextWrapWord
	errLbl.Hide()
	var d *dialog.CustomDialog
	unlock := widget.NewButton(i18n.T("passwordManager.unlock"), nil)
	unlock.Importance = widget.HighImportance
	submit := func() {
		if pw.Text == "" {
			return
		}
		req := map[string]string{"currentPassword": pw.Text}
		unlock.Disable()
		unlock.SetText(i18n.T("passwordManager.unlocking"))
		kit.Async(func(ctx context.Context) (unlockResp, error) {
			var r unlockResp
			return r, p.env.API.Post(ctx, "password-vault/unlock", req, &r)
		}, func(r unlockResp, err error) {
			unlock.Enable()
			unlock.SetText(i18n.T("passwordManager.unlock"))
			if err != nil {
				errLbl.SetText(api.Message(err, i18n.T("passwordManager.actionFailed")))
				errLbl.Show()
				return
			}
			pw.SetText("")
			exp, perr := time.Parse(time.RFC3339Nano, r.ExpiresAt)
			if perr != nil {
				exp = time.Now().Add(5 * time.Minute)
			}
			p.setToken(r.Token, exp)
			d.Hide()
			then(r.Token)
		})
	}
	pw.OnSubmitted = func(string) { submit() }
	unlock.OnTapped = submit
	cancel := widget.NewButton(i18n.T("common.cancel"), func() { pw.SetText(""); d.Hide() })
	body := container.NewVBox(kit.Muted(i18n.T("passwordManager.unlockDescription")), pw, errLbl, container.NewHBox(cancel, unlock))
	d = dialog.NewCustomWithoutButtons(i18n.T("passwordManager.unlockTitle"), container.NewPadded(body), p.env.Window)
	d.Resize(fyne.NewSize(min(460, p.env.Window.Canvas().Size().Width-40), d.MinSize().Height))
	d.Show()
	p.env.Window.Canvas().Focus(pw)
}

// ---- data ----

func (p *page) loadModules(prefer int64) {
	p.loadSeq++
	seq := p.loadSeq
	p.loading = true
	kit.Async(func(ctx context.Context) ([]module, error) {
		var m []module
		return m, p.env.API.Get(ctx, "password-vault/modules", nil, &m)
	}, func(m []module, err error) {
		if seq != p.loadSeq {
			return
		}
		p.loading = false
		if err != nil {
			p.env.Toast(kit.ToastError, api.Message(err, i18n.T("passwordManager.actionFailed")))
			return
		}
		p.modules = m
		sel := prefer
		if !p.hasModule(sel) {
			sel = p.selID
		}
		if !p.hasModule(sel) && len(m) > 0 {
			sel = m[0].ID
		}
		if !p.hasModule(sel) {
			sel = 0
		}
		changed := sel != p.selID
		p.selID = sel
		p.renderModules()
		if changed || prefer != 0 || p.accounts == nil {
			p.loadAccounts()
		} else {
			p.renderAccounts()
		}
	})
}

func (p *page) hasModule(id int64) bool {
	for _, m := range p.modules {
		if m.ID == id && id != 0 {
			return true
		}
	}
	return false
}

func (p *page) selected() *module {
	for i := range p.modules {
		if p.modules[i].ID == p.selID {
			return &p.modules[i]
		}
	}
	return nil
}

func (p *page) loadAccounts() {
	p.accounts = nil
	p.accSeq++
	seq, id := p.accSeq, p.selID
	p.renderAccounts()
	if id == 0 {
		return
	}
	kit.Async(func(ctx context.Context) ([]account, error) {
		var a []account
		return a, p.env.API.Get(ctx, fmt.Sprintf("password-vault/modules/%d/accounts", id), nil, &a)
	}, func(a []account, err error) {
		if seq != p.accSeq {
			return
		}
		if err != nil {
			p.env.Toast(kit.ToastError, api.Message(err, i18n.T("passwordManager.actionFailed")))
			return
		}
		if a == nil {
			a = []account{}
		}
		p.accounts = a
		p.renderAccounts()
	})
}

// ---- rendering ----

func (p *page) renderModules() {
	p.modBox.Objects = nil
	defer p.modBox.Refresh()
	if len(p.modules) == 0 {
		if !p.loading {
			p.modBox.Add(kit.Heading(i18n.T("passwordManager.emptyTitle")))
			p.modBox.Add(kit.Muted(i18n.T("passwordManager.emptyDescription")))
		}
		return
	}
	shown := 0
	for _, m := range p.modules {
		if !Match(m.Name+" "+str(m.WebsiteURL), p.query) {
			continue
		}
		shown++
		m := m
		b := widget.NewButtonWithIcon(m.Name, theme.HomeIcon(), func() { p.selID = m.ID; p.renderModules(); p.loadAccounts() })
		b.Alignment = widget.ButtonAlignLeading
		if m.ID == p.selID {
			b.Importance = widget.HighImportance
		} else {
			b.Importance = widget.LowImportance
		}
		edit := widget.NewButtonWithIcon("", theme.SettingsIcon(), func() { p.moduleDialog(&m) })
		del := widget.NewButtonWithIcon("", theme.DeleteIcon(), func() {
			p.env.Confirm(i18n.T("passwordManager.deleteModuleConfirm", i18n.P{"name": m.Name, "count": m.AccountCount}), func() { p.deleteModule(m) })
		})
		p.modBox.Add(container.NewBorder(nil, nil, nil, container.NewHBox(edit, del), b))
		p.modBox.Add(kit.Muted(i18n.T("passwordManager.accountCount", i18n.P{"count": m.AccountCount})))
	}
	if shown == 0 {
		p.modBox.Add(kit.Muted(i18n.T("passwordManager.noMatch")))
	}
}

func (p *page) renderAccounts() {
	p.accHead.Objects, p.accBox.Objects = nil, nil
	defer func() { p.accHead.Refresh(); p.accBox.Refresh() }()
	m := p.selected()
	if m == nil {
		return
	}
	mod := *m
	addAcc := widget.NewButtonWithIcon(i18n.T("passwordManager.addAccount"), theme.ContentAddIcon(), func() { p.accountDialog(mod, nil, nil) })
	p.accHead.Add(container.NewBorder(nil, nil, nil, addAcc,
		container.NewVBox(kit.Muted(i18n.T("passwordManager.service")), kit.Heading(mod.Name))))
	if u := str(mod.WebsiteURL); u != "" {
		l := widget.NewButton(u, func() { p.env.OpenURL(u) })
		l.Importance = widget.LowImportance
		l.Alignment = widget.ButtonAlignLeading
		p.accHead.Add(l)
	}
	if d := str(mod.Description); d != "" {
		p.accHead.Add(kit.Muted(d))
	}
	if p.accounts == nil {
		p.accBox.Add(widget.NewProgressBarInfinite())
		return
	}
	shown := 0
	for _, a := range p.accounts {
		if !Match(a.DisplayName, p.query) {
			continue
		}
		shown++
		a := a
		p.accBox.Add(widget.NewCard(a.DisplayName, a.PasswordMasked, container.NewHBox(
			widget.NewButtonWithIcon(i18n.T("passwordManager.reveal"), theme.VisibilityIcon(), func() { p.reveal(a) }),
			widget.NewButtonWithIcon(i18n.T("passwordManager.copyPassword"), theme.ContentCopyIcon(), func() { p.copyField(a, "PASSWORD") }),
			widget.NewButton(i18n.T("common.edit"), func() { p.editAccount(mod, a) }),
			widget.NewButtonWithIcon(i18n.T("passwordManager.delete"), theme.DeleteIcon(), func() {
				p.env.Confirm(i18n.T("passwordManager.deleteAccountConfirm", i18n.P{"name": a.DisplayName}), func() { p.deleteAccount(a) })
			}))))
	}
	if shown == 0 {
		if p.query != "" {
			p.accBox.Add(kit.Muted(i18n.T("passwordManager.noMatch")))
		} else {
			p.accBox.Add(kit.Muted(i18n.T("passwordManager.emptyAccounts")))
		}
	}
}

// ---- module / account CRUD ----

var urlRe = regexp.MustCompile(`(?i)^https?://\S+$`)

func (p *page) moduleDialog(m *module) {
	title := i18n.T("passwordManager.addModule")
	var init module
	if m != nil {
		title, init = i18n.T("passwordManager.editModule"), *m
	}
	var out module
	p.env.FormDialog(kit.FormSpec{Title: title,
		Fields: []kit.Field{
			{Key: "name", Label: i18n.T("passwordManager.moduleName"), Required: true, MaxLen: 150, Initial: strOrNil(init.Name)},
			{Key: "websiteUrl", Label: i18n.T("passwordManager.website"), MaxLen: 1000, Pattern: urlRe, Initial: strOrNil(str(init.WebsiteURL))},
			{Key: "description", Label: i18n.T("passwordManager.descriptionField"), Kind: kit.KindTextArea, MaxLen: 1000, Initial: strOrNil(str(init.Description))},
		},
		Submit: func(ctx context.Context, v map[string]any) error {
			if m == nil {
				v["version"] = nil
				return p.env.API.Post(ctx, "password-vault/modules", v, &out)
			}
			v["version"] = m.Version
			return p.env.API.Put(ctx, fmt.Sprintf("password-vault/modules/%d", m.ID), v, &out)
		},
		OnSaved: func() { p.loadModules(out.ID) }})
}

func (p *page) deleteModule(m module) {
	kit.Async(func(ctx context.Context) (struct{}, error) {
		return struct{}{}, p.env.API.Do(ctx, "DELETE", fmt.Sprintf("password-vault/modules/%d", m.ID), nil, map[string]int64{"version": m.Version}, nil)
	}, func(_ struct{}, err error) {
		if err != nil {
			p.env.Toast(kit.ToastError, api.Message(err, i18n.T("passwordManager.actionFailed")))
			return
		}
		p.env.Toast(kit.ToastSuccess, i18n.T("passwordManager.moduleDeleted"))
		if p.selID == m.ID {
			p.selID = 0
		}
		p.loadModules(0)
	})
}

// conflict handles a 409 (stale version): offer to reload the lists. Reports whether it was one.
func (p *page) conflict(err error) bool {
	if api.StatusOf(err) != http.StatusConflict {
		return false
	}
	p.env.Confirm(i18n.T("passwordManager.conflictReload"), func() { p.loadModules(p.selID); p.loadAccounts() })
	return true
}

func (p *page) deleteAccount(a account) {
	kit.Async(func(ctx context.Context) (struct{}, error) {
		return struct{}{}, p.env.API.Do(ctx, "DELETE", fmt.Sprintf("password-vault/accounts/%d", a.ID), nil, map[string]int64{"version": a.Version}, nil)
	}, func(_ struct{}, err error) {
		if err != nil {
			if p.conflict(err) {
				return
			}
			p.env.Toast(kit.ToastError, api.Message(err, i18n.T("passwordManager.actionFailed")))
			return
		}
		p.env.Toast(kit.ToastSuccess, i18n.T("passwordManager.accountDeleted"))
		p.loadModules(0)
		p.loadAccounts()
	})
}

// ---- secrets ----

func (p *page) secretCall(a account, body map[string]string) func(ctx context.Context, tok string) (secret, error) {
	return func(ctx context.Context, tok string) (secret, error) {
		var s secret
		return s, p.env.API.Do(ctx, "POST", fmt.Sprintf("password-vault/accounts/%d/secret", a.ID), nil, body, &s, api.WithHeader(hdrToken, tok))
	}
}

func (p *page) reveal(a account) {
	withVault(p, p.secretCall(a, map[string]string{"action": "REVEAL"}), func(s secret, err error) {
		if err != nil {
			p.env.Toast(kit.ToastError, api.Message(err, i18n.T("passwordManager.actionFailed")))
			return
		}
		p.showReveal(a, s)
	})
}

func (p *page) showReveal(a account, s secret) {
	var d *dialog.CustomDialog
	body := container.NewVBox()
	row := func(label, val, field string, mono bool) {
		v := widget.NewLabel(val)
		v.Wrapping = fyne.TextWrapBreak
		v.TextStyle = fyne.TextStyle{Monospace: mono}
		cp := widget.NewButtonWithIcon("", theme.ContentCopyIcon(), func() { p.copyField(a, field) })
		body.Add(kit.Muted(label))
		body.Add(container.NewBorder(nil, nil, nil, cp, v))
	}
	u := str(s.Username)
	if u == "" {
		u = "—"
	}
	row(i18n.T("passwordManager.username"), u, "USERNAME", false)
	row(i18n.T("passwordManager.password"), str(s.Password), "PASSWORD", true)
	if str(s.LoginURL) != "" {
		row(i18n.T("passwordManager.loginUrl"), str(s.LoginURL), "LOGIN_URL", false)
	}
	if str(s.Note) != "" {
		row(i18n.T("passwordManager.note"), str(s.Note), "NOTE", false)
	}
	s.wipe() // the labels hold the text now; drop the struct
	body.Add(kit.Muted(i18n.T("passwordManager.clipboardNote")))
	closeFn := func() { d.Hide() }
	body.Add(widget.NewButton(i18n.T("common.close"), closeFn))
	p.track(closeFn)
	d = dialog.NewCustomWithoutButtons(a.DisplayName, container.NewVScroll(container.NewPadded(body)), p.env.Window)
	d.SetOnClosed(func() { body.Objects = nil }) // drop plaintext widgets
	cs := p.env.Window.Canvas().Size()
	d.Resize(fyne.NewSize(min(520, cs.Width-40), min(480, cs.Height-60)))
	d.Show()
}

// copyField fetches one field (server-audited) and puts it on the clipboard,
// clearing the clipboard after 30 s if it still holds that value.
func (p *page) copyField(a account, field string) {
	withVault(p, p.secretCall(a, map[string]string{"action": "COPY", "field": field}), func(s secret, err error) {
		if err != nil {
			p.env.Toast(kit.ToastError, api.Message(err, i18n.T("passwordManager.copyFailed")))
			return
		}
		v := str(s.Value)
		s.wipe()
		p.clearClip() // a newer copy supersedes the pending one
		p.env.App.Clipboard().SetContent(v)
		p.env.Toast(kit.ToastSuccess, i18n.T("passwordManager.copied"))
		p.clipVal = v
		p.clipTimer = time.AfterFunc(clipboardTTL, func() { fyne.Do(p.clearClip) })
	})
}

func (p *page) editAccount(m module, a account) {
	withVault(p, p.secretCall(a, map[string]string{"action": "REVEAL"}), func(s secret, err error) {
		if err != nil {
			p.env.Toast(kit.ToastError, api.Message(err, i18n.T("passwordManager.actionFailed")))
			return
		}
		p.accountDialog(m, &a, &s)
	})
}

// accountDialog creates (a == nil) or edits an account; s pre-fills an edit and is wiped.
func (p *page) accountDialog(m module, a *account, s *secret) {
	title := i18n.T("passwordManager.addAccount")
	var initName any
	if a != nil {
		title, initName = i18n.T("passwordManager.editAccount"), strOrNil(a.DisplayName)
	}
	var init secret
	if s != nil {
		init = *s
		s.wipe()
	}
	form := kit.NewForm([]kit.Field{
		{Key: "displayName", Label: i18n.T("passwordManager.accountName"), Required: true, MaxLen: 150, Initial: initName},
		{Key: "username", Label: i18n.T("passwordManager.username"), MaxLen: 500, Initial: strOrNil(str(init.Username))},
		{Key: "password", Label: i18n.T("passwordManager.password"), Kind: kit.KindPassword, Required: true, MaxLen: 4096, Initial: strOrNil(str(init.Password))},
		{Key: "loginUrl", Label: i18n.T("passwordManager.loginUrl"), MaxLen: 1000, Pattern: urlRe, Initial: strOrNil(str(init.LoginURL))},
		{Key: "note", Label: i18n.T("passwordManager.note"), Kind: kit.KindTextArea, MaxLen: 4000, Initial: strOrNil(str(init.Note))},
	})
	init.wipe()

	// generator
	length := kit.NewForm([]kit.Field{{Key: "len", Label: i18n.T("passwordManager.length"), Kind: kit.KindNumber, Initial: decimal.NewFromInt(20)}})
	up, lo := widget.NewCheck("A–Z", nil), widget.NewCheck("a–z", nil)
	dg, sy := widget.NewCheck("0–9", nil), widget.NewCheck("!@#", nil)
	for _, c := range []*widget.Check{up, lo, dg, sy} {
		c.SetChecked(true)
	}
	gen := widget.NewButton(i18n.T("passwordManager.generate"), func() {
		n := 20
		if v, ok := length.Get("len").(decimal.Decimal); ok {
			n = int(v.IntPart())
		}
		n = min(max(n, 16), 64)
		length.Set("len", decimal.NewFromInt(int64(n)))
		var sets []string
		for _, x := range []struct {
			c *widget.Check
			s string
		}{{up, Upper}, {lo, Lower}, {dg, Digits}, {sy, Symbols}} {
			if x.c.Checked {
				sets = append(sets, x.s)
			}
		}
		if pw := Generate(n, sets...); pw != "" {
			form.Set("password", pw)
		}
	})
	genBox := widget.NewCard(i18n.T("passwordManager.generator"), "",
		container.NewVBox(length.Content(), container.NewHBox(up, lo, dg, sy), gen))

	var d *dialog.CustomDialog
	save := widget.NewButton(i18n.T("common.save"), nil)
	save.Importance = widget.HighImportance
	closeFn := func() { d.Hide() }
	cancel := widget.NewButton(i18n.T("common.cancel"), closeFn)
	save.OnTapped = func() {
		v, ok := form.Values()
		if !ok {
			return
		}
		save.Disable()
		onDone := func(_ account, err error) {
			save.Enable()
			if err != nil {
				if a != nil && p.conflict(err) {
					return
				}
				form.ShowAPIError(err)
				return
			}
			closeFn()
			p.env.Toast(kit.ToastSuccess, i18n.T("passwordManager.accountSaved"))
			p.loadModules(m.ID)
			p.loadAccounts()
		}
		if a == nil {
			v["version"] = nil
			kit.Async(func(ctx context.Context) (account, error) {
				var out account
				return out, p.env.API.Post(ctx, fmt.Sprintf("password-vault/modules/%d/accounts", m.ID), v, &out)
			}, onDone)
			return
		}
		v["version"] = a.Version
		withVault(p, func(ctx context.Context, tok string) (account, error) {
			var out account
			return out, p.env.API.Do(ctx, "PUT", fmt.Sprintf("password-vault/accounts/%d", a.ID), nil, v, &out, api.WithHeader(hdrToken, tok))
		}, onDone)
	}
	p.track(closeFn)
	body := container.NewVBox(widget.NewLabel(m.Name), form.Content(), genBox,
		kit.Muted(i18n.T("passwordManager.encryptedHint")), container.NewHBox(cancel, save))
	d = dialog.NewCustomWithoutButtons(title, container.NewVScroll(container.NewPadded(body)), p.env.Window)
	d.SetOnClosed(func() { // wipe plaintext widgets
		form.Set("password", nil)
		form.Set("username", nil)
		form.Set("note", nil)
	})
	cs := p.env.Window.Canvas().Size()
	d.Resize(fyne.NewSize(min(560, cs.Width-40), min(720, cs.Height-60)))
	d.Show()
}
