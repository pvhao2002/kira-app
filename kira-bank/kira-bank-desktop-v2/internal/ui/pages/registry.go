// Package pages is the page registry: every feature package contributes its
// pages here. Stage B feature packages add ONE import line and ONE append line
// at the marked spots; nothing else in this file changes.
package pages

import (
	"kira-bank-desktop-v2/internal/ui/kit"
	"kira-bank-desktop-v2/internal/ui/pages/admin"
	"kira-bank-desktop-v2/internal/ui/pages/bank"
	"kira-bank-desktop-v2/internal/ui/pages/creditcard"
	"kira-bank-desktop-v2/internal/ui/pages/health"
	"kira-bank-desktop-v2/internal/ui/pages/investment"
	"kira-bank-desktop-v2/internal/ui/pages/invreports"
	"kira-bank-desktop-v2/internal/ui/pages/lodging"
	"kira-bank-desktop-v2/internal/ui/pages/overview"
	"kira-bank-desktop-v2/internal/ui/pages/reports"
	"kira-bank-desktop-v2/internal/ui/pages/resources"
	"kira-bank-desktop-v2/internal/ui/pages/settings"
	"kira-bank-desktop-v2/internal/ui/pages/travel"
	"kira-bank-desktop-v2/internal/ui/pages/tutor"
	"kira-bank-desktop-v2/internal/ui/pages/vault"
	// REGISTRY-IMPORTS: add `"kira-bank-desktop-v2/internal/ui/pages/<feature>"` above this line.
)

// All returns every page of the app. Sidebar order inside a group follows
// kit.Page.Order, then the order appended here.
func All(env *kit.Env) []kit.Page {
	var all []kit.Page
	all = append(all, overview.Pages(env)...)
	all = append(all, settings.Pages(env)...)
	all = append(all, resources.Pages(env)...)
	all = append(all, bank.Pages(env)...)
	all = append(all, creditcard.Pages(env)...)
	all = append(all, investment.Pages(env)...)
	all = append(all, invreports.Pages(env)...)
	all = append(all, reports.Pages(env)...)
	all = append(all, health.Pages(env)...)
	all = append(all, lodging.Pages(env)...)
	all = append(all, travel.Pages(env)...)
	all = append(all, tutor.Pages(env)...)
	all = append(all, vault.Pages(env)...)
	all = append(all, admin.Pages(env)...)
	// REGISTRY-PAGES: add `all = append(all, <feature>.Pages(env)...)` above this line.
	return all
}
