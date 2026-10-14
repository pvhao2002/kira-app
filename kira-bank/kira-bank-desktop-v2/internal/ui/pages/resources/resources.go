// Package resources holds the generic resource screens: credit cards (grouped by
// bank), investment accounts, favorite karaoke songs, job applications and notifications.
package resources

import (
	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/theme"

	"kira-bank-desktop-v2/internal/ui/kit"
)

// Pages registers the resource screens.
func Pages(env *kit.Env) []kit.Page {
	p := func(id, group, title, menu string, order int, icon fyne.Resource, build func(*kit.Env) fyne.CanvasObject) kit.Page {
		return kit.Page{ID: id, Group: group, TitleKey: title, MenuKey: menu, Order: order, Icon: icon,
			Build: func() fyne.CanvasObject { return build(env) }}
	}
	return []kit.Page{
		p("/app/credit-cards", "shell.groupCredit", "route.myCards", "shell.myCards", 20, theme.ListIcon(), cardsPage),
		p("/app/investment/accounts", "shell.groupInvestment", "route.investmentAccounts", "shell.accounts", 10, theme.AccountIcon(), accountPage),
		p("/app/karaoke", "shell.groupPersonal", "route.favoriteSongs", "shell.favoriteSongs", 10, theme.MediaMusicIcon(), songPage),
		p("/app/job-applications", "shell.groupPersonal", "route.jobApplications", "shell.jobApplications", 20, theme.DocumentIcon(), jobPage),
		p("/app/notifications", "shell.groupSystem", "route.notifications", "shell.notifications", 20, theme.InfoIcon(), notificationPage),
	}
}
