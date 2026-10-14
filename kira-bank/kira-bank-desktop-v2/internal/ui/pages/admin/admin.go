// Package admin holds the ROLE_ADMIN screens: users, login visits, Cloudflare
// accounts / AI providers and file storage.
package admin

import (
	"errors"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/theme"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

const group = "shell.groupAdmin"

// Pages registers the admin screens (sidebar order: users, visits, ai providers, storage).
func Pages(env *kit.Env) []kit.Page {
	p := func(id, title, menu string, order int, ic fyne.Resource, b func(*kit.Env) fyne.CanvasObject) kit.Page {
		return kit.Page{ID: id, Group: group, TitleKey: title, MenuKey: menu, Icon: ic, AdminOnly: true, Order: order,
			Build: func() fyne.CanvasObject { return b(env) }}
	}
	return []kit.Page{
		p("/app/admin/users", "route.adminUsers", "shell.adminUsers", 10, theme.AccountIcon(), buildUsers),
		p("/app/admin/login-visits", "visits.title", "visits.title", 20, theme.VisibilityIcon(), buildVisits),
		p("/app/admin/cloudflare-accounts", "route.adminAiProviders", "shell.adminAiProviders", 50, theme.ComputerIcon(), buildProviders),
		{ID: "/app/admin/ai-providers", TitleKey: "route.adminAiProviders", AdminOnly: true, Hidden: true,
			Build: func() fyne.CanvasObject { return buildProviders(env) }},
		p("/app/admin/file-storage", "fileStorage.title", "fileStorage.title", 60, theme.StorageIcon(), buildStorage),
	}
}

// codeErr replaces an API error by a translated one when its code/status matches.
func codeErr(err error, code string, status int, key string) error {
	var ae *api.ApiError
	if errors.As(err, &ae) && ((code != "" && ae.Code == code) || (status != 0 && ae.Status == status)) {
		return &api.ApiError{Status: ae.Status, Code: "MAPPED", Message: i18n.T(key)}
	}
	return err
}

func dash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "—"
	}
	return s
}
