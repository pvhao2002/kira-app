// Package login is the unauthenticated screen; it is not a registry page.
package login

import (
	"context"
	"regexp"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

var emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

// View builds the login screen. It calls env.LoggedIn() after a successful login.
func View(env *kit.Env) fyne.CanvasObject {
	server := widget.NewEntry()
	server.SetText(env.BaseURL())
	email := widget.NewEntry()
	email.SetPlaceHolder("you@example.com")
	pass := widget.NewPasswordEntry()
	pass.SetPlaceHolder(i18n.T("auth.passwordPlaceholder"))

	errLbl := widget.NewLabel("")
	errLbl.Importance = widget.DangerImportance
	errLbl.Wrapping = fyne.TextWrapWord
	errLbl.Hide()
	fail := func(msg string) { errLbl.SetText(msg); errLbl.Show() }

	lang := widget.NewSelect([]string{"EN", "VI"}, func(s string) { env.SetLanguage(strings.ToLower(s)) })
	lang.SetSelected(strings.ToUpper(i18n.Lang()))

	btn := widget.NewButton(i18n.T("common.login"), nil)
	btn.Importance = widget.HighImportance
	submit := func() {
		errLbl.Hide()
		switch {
		case !emailRe.MatchString(strings.TrimSpace(email.Text)):
			fail(i18n.T("auth.invalidEmail"))
			return
		case len(pass.Text) < 8:
			fail(i18n.T("auth.invalidPassword"))
			return
		}
		if err := env.SetBaseURL(server.Text); err != nil {
			fail(i18n.T("desktop.invalidServerUrl"))
			return
		}
		btn.Disable()
		btn.SetText(i18n.T("auth.processing"))
		addr, pw := strings.TrimSpace(email.Text), pass.Text
		kit.Async(func(ctx context.Context) (*api.Profile, error) { return env.API.Login(ctx, addr, pw) },
			func(_ *api.Profile, err error) {
				btn.Enable()
				btn.SetText(i18n.T("common.login"))
				switch {
				case err == nil:
					pass.SetText("")
					env.LoggedIn()
				case api.StatusOf(err) == 429:
					fail(i18n.T("auth.tooManyAttempts"))
				case api.StatusOf(err) == 0:
					fail(i18n.T("error.serverUnavailable"))
				default:
					fail(i18n.T("auth.invalidCredentials"))
				}
			})
	}
	btn.OnTapped = submit
	pass.OnSubmitted = func(string) { submit() }
	email.OnSubmitted = func(string) { submit() }

	form := container.NewVBox(
		container.NewBorder(nil, nil, nil, lang),
		kit.Muted(i18n.T("auth.loginEyebrow")),
		kit.PageHeader("", i18n.T("auth.loginTitle"), i18n.T("auth.loginDescription")),
		widget.NewLabel(i18n.T("desktop.serverUrl")), server,
		widget.NewLabel(i18n.T("auth.email")), email,
		widget.NewLabel(i18n.T("auth.password")), pass,
		errLbl, btn,
		kit.Muted(i18n.T("auth.adminNotice")),
	)
	hero := container.NewVBox(
		container.NewHBox(kit.BrandMark(44)),
		kit.PageHeader("Kira Life", i18n.T("auth.heroTitle"), i18n.T("auth.heroDescription")),
		kit.Card(i18n.T("auth.featureSeparationTitle"), i18n.T("auth.featureSeparationDesc"), nil),
		kit.Card(i18n.T("auth.featureSecurityTitle"), i18n.T("auth.featureSecurityDesc"), nil),
		kit.Muted(i18n.T("auth.systemOperational")),
	)
	return container.NewStack(canvas.NewRectangle(theme.Color(kit.ColorCanvas)), container.NewGridWithColumns(2,
		container.NewCenter(container.NewGridWrap(fyne.NewSize(440, 420), hero)),
		container.NewCenter(container.NewGridWrap(fyne.NewSize(440, 540), kit.Surface(form)))))
}
