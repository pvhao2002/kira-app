// Package settings is the settings/profile screen (/app/settings and /app/profile).
package settings

import (
	"context"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

// Pages registers settings (in the System group) and profile (same screen, hidden).
func Pages(env *kit.Env) []kit.Page {
	build := func() fyne.CanvasObject { return build(env) }
	return []kit.Page{
		{ID: "/app/settings", Group: "shell.groupSystem", TitleKey: "route.settings", MenuKey: "shell.settings",
			Icon: theme.SettingsIcon(), Order: 30, Build: build},
		{ID: "/app/profile", TitleKey: "route.profile", Hidden: true, Build: build},
	}
}

func build(env *kit.Env) fyne.CanvasObject {
	return container.NewVBox(
		kit.PageHeader(i18n.T("resource.flowSystem"), i18n.T("settings.title"), i18n.T("settings.description")),
		profileCard(env), securityCard(env), telegramCard(env), appearanceCard(env))
}

func profileCard(env *kit.Env) fyne.CanvasObject {
	form := kit.NewForm([]kit.Field{
		{Key: "email", Label: i18n.T("field.email"), Disabled: true},
		{Key: "fullName", Label: i18n.T("field.fullName"), Required: true, MaxLen: 150},
		{Key: "phone", Label: i18n.T("settings.phone"), MaxLen: 30},
	})
	save := widget.NewButton(i18n.T("settings.saveProfile"), nil)
	save.Importance = widget.HighImportance
	save.Disable() // until the profile (and its version) is loaded
	var version int64
	body := container.NewVBox(form.Content(), save)

	kit.Async(func(ctx context.Context) (api.Profile, error) {
		var p api.Profile
		return p, env.API.Get(ctx, "auth/profile", nil, &p)
	}, func(p api.Profile, err error) {
		if err != nil {
			env.ShowError(err)
			return
		}
		version = p.Version
		form.Set("email", p.Email)
		form.Set("fullName", p.FullName)
		if p.Phone != nil {
			form.Set("phone", *p.Phone)
		}
		save.Enable()
	})
	save.OnTapped = func() {
		v, ok := form.Values()
		if !ok {
			return
		}
		phone, _ := v["phone"].(string) // empty is sent as ""
		req := map[string]any{"fullName": v["fullName"], "phone": phone, "version": version}
		save.Disable()
		save.SetText(i18n.T("form.saving"))
		kit.Async(func(ctx context.Context) (api.Profile, error) {
			var p api.Profile
			return p, env.API.Put(ctx, "auth/profile", req, &p)
		}, func(p api.Profile, err error) {
			save.Enable()
			save.SetText(i18n.T("settings.saveProfile"))
			if err != nil {
				form.ShowAPIError(err)
				return
			}
			version = p.Version
			env.API.SetUser(p)
			env.Toast(kit.ToastSuccess, i18n.T("settings.profileSaved"))
			env.Navigate("/app/settings", nil) // refresh the shell's name/initials
		})
	}
	return kit.Card(i18n.T("settings.profileTitle"), i18n.T("settings.profileDescription"), body)
}

func securityCard(env *kit.Env) fyne.CanvasObject {
	var form *kit.Form
	form = kit.NewForm([]kit.Field{
		{Key: "currentPassword", Label: i18n.T("settings.currentPassword"), Kind: kit.KindPassword, Required: true},
		{Key: "newPassword", Label: i18n.T("settings.newPassword"), Kind: kit.KindPassword, Required: true, MaxLen: 72,
			Validate: func(v any) string {
				if s, _ := v.(string); len(s) < 8 {
					return i18n.T("auth.invalidPassword")
				}
				return ""
			}},
		{Key: "confirmPassword", Label: i18n.T("settings.confirmPassword"), Kind: kit.KindPassword, Required: true,
			Validate: func(v any) string {
				if v != form.Get("newPassword") {
					return i18n.T("settings.passwordMismatch")
				}
				return ""
			}},
	})
	btn := widget.NewButton(i18n.T("settings.changePassword"), nil)
	btn.Importance = widget.HighImportance
	btn.OnTapped = func() {
		v, ok := form.Values()
		if !ok {
			return
		}
		req := map[string]any{"currentPassword": v["currentPassword"], "newPassword": v["newPassword"]}
		btn.Disable()
		btn.SetText(i18n.T("form.saving"))
		kit.Async(func(ctx context.Context) (struct{}, error) {
			return struct{}{}, env.API.Post(ctx, "auth/change-password", req, nil)
		}, func(_ struct{}, err error) {
			btn.Enable()
			btn.SetText(i18n.T("settings.changePassword"))
			if err != nil {
				form.ShowAPIError(err)
				return
			}
			for _, k := range []string{"currentPassword", "newPassword", "confirmPassword"} {
				form.Set(k, nil)
			}
			env.Toast(kit.ToastSuccess, i18n.T("settings.passwordChanged"))
		})
	}
	return kit.Card(i18n.T("settings.securityTitle"), i18n.T("settings.securityDescription"), container.NewVBox(form.Content(), btn))
}

func telegramCard(env *kit.Env) fyne.CanvasObject {
	result := container.NewVBox()
	btn := widget.NewButton(i18n.T("settings.telegramLink"), nil)
	btn.OnTapped = func() {
		btn.Disable()
		btn.SetText(i18n.T("settings.telegramLinking"))
		kit.Async(func(ctx context.Context) (struct {
			Code      string `json:"code"`
			ExpiresAt string `json:"expiresAt"`
		}, error) {
			var r struct {
				Code      string `json:"code"`
				ExpiresAt string `json:"expiresAt"`
			}
			return r, env.API.Post(ctx, "telegram/link-code", map[string]any{}, &r)
		}, func(r struct {
			Code      string `json:"code"`
			ExpiresAt string `json:"expiresAt"`
		}, err error) {
			btn.Enable()
			btn.SetText(i18n.T("settings.telegramLink"))
			if err != nil {
				env.ShowError(err)
				return
			}
			cmd := "/login " + r.Code
			copyBtn := widget.NewButtonWithIcon("", theme.ContentCopyIcon(), func() { env.Window.Clipboard().SetContent(cmd) })
			exp := format.Timestamp(r.ExpiresAt, func(t time.Time) string { return format.TimeShort(t) })
			result.Objects = []fyne.CanvasObject{
				kit.Muted(i18n.T("settings.telegramInstruction")),
				container.NewHBox(kit.Heading(cmd), copyBtn),
				kit.Muted(i18n.T("settings.telegramExpires") + " " + exp),
			}
			result.Refresh()
		})
	}
	return kit.Card(i18n.T("settings.telegramTitle"), i18n.T("settings.telegramDescription"), container.NewVBox(btn, result))
}

func appearanceCard(env *kit.Env) fyne.CanvasObject {
	lang := widget.NewSelect([]string{i18n.T("language.english"), i18n.T("language.vietnamese")}, nil)
	langs := map[string]string{i18n.T("language.english"): "en", i18n.T("language.vietnamese"): "vi"}
	if i18n.Lang() == "vi" {
		lang.SetSelected(i18n.T("language.vietnamese"))
	} else {
		lang.SetSelected(i18n.T("language.english"))
	}
	lang.OnChanged = func(s string) { env.SetLanguage(langs[s]) }

	modes := []string{"system", "light", "dark"}
	var labels []string
	for _, m := range modes {
		labels = append(labels, i18n.T("theme."+m))
	}
	th := widget.NewSelect(labels, nil)
	for i, m := range modes {
		if m == env.Pref("kira-theme", "system") {
			th.SetSelected(labels[i])
		}
	}
	th.OnChanged = func(string) {
		env.SetPref("kira-theme", modes[th.SelectedIndex()])
		kit.ApplyTheme(env)
	}
	return kit.Card(i18n.T("settings.appearanceTitle"), i18n.T("settings.appearanceDescription"),
		container.NewVBox(
			widget.NewLabel(i18n.T("settings.language")), kit.Muted(i18n.T("settings.languageDescription")), lang,
			widget.NewLabel(i18n.T("theme.label")), th))
}
