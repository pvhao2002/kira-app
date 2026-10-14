// Command kira-bank-desktop-v2 is the native Kira Life desktop client (Fyne).
package main

import (
	"os"
	"strings"

	"fyne.io/fyne/v2/app"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/ui/kit"
	"kira-bank-desktop-v2/internal/ui/pages"
	"kira-bank-desktop-v2/internal/ui/pages/login"
)

func main() {
	a := app.NewWithID("vn.kira.bank.desktopv2")
	w := a.NewWindow("Kira Life")

	// Server URL: saved preference, else KIRA_BANK_URL, else local dev backend.
	base := a.Preferences().String("kira-base-url")
	if base == "" {
		base = strings.TrimSpace(os.Getenv("KIRA_BANK_URL"))
	}
	if base == "" {
		base = "http://localhost:8080"
	}

	env := kit.NewEnv(a, w, api.NewClient(base, api.NewKeyringStore()))
	kit.Run(env, pages.All(env), login.View)
}
