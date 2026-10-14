package admin

import (
	"context"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

// visitPage is the {items,total,page,size} paging shape of the login-visit API.
type visitPage[T any] struct {
	Items []T `json:"items"`
	Total int `json:"total"`
	Page  int `json:"page"`
	Size  int `json:"size"`
}

type visitTotals struct {
	Views    int `json:"views"`
	Reloads  int `json:"reloads"`
	IPs      int `json:"ips"`
	Visitors int `json:"visitors"`
}

type ipRow struct {
	IP        string `json:"ip"`
	Views     int    `json:"views"`
	Reloads   int    `json:"reloads"`
	Visitors  int    `json:"visitors"`
	Sessions  int    `json:"sessions"`
	FirstSeen string `json:"firstSeen"`
	LastSeen  string `json:"lastSeen"`
}

type visitSummary struct {
	Totals        visitTotals      `json:"totals"`
	IPs           visitPage[ipRow] `json:"ips"`
	RetentionDays int              `json:"retentionDays"`
}

type visit struct {
	ID           string `json:"id"`
	VisitedAt    string `json:"visitedAt"`
	IP           string `json:"ip"`
	PeerIP       string `json:"peerIp"`
	IPSource     string `json:"ipSource"`
	VisitorID    string `json:"visitorId"`
	SessionID    string `json:"sessionId"`
	Navigation   string `json:"navigation"`
	UserAgent    string `json:"userAgent"`
	Language     string `json:"language"`
	Timezone     string `json:"timezone"`
	ScreenWidth  int    `json:"screenWidth"`
	ScreenHeight int    `json:"screenHeight"`
	Referrer     string `json:"referrer"`
}

// visitFilter is the validated filter as API query values (UTC instants).
type visitFilter struct{ from, to, ip string }

// newVisitFilter validates the local-date range (from < to, at most 91 days; `to`
// becomes the exclusive next-day midnight) and returns UTC instants.
func newVisitFilter(from, to time.Time, ip string, loc *time.Location) (visitFilter, bool) {
	f := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, loc)
	t := time.Date(to.Year(), to.Month(), to.Day()+1, 0, 0, 0, 0, loc)
	if !f.Before(t) || t.Sub(f) > 92*24*time.Hour {
		return visitFilter{}, false
	}
	const iso = "2006-01-02T15:04:05.000Z"
	return visitFilter{f.UTC().Format(iso), t.UTC().Format(iso), strings.TrimSpace(ip)}, true
}

func (f visitFilter) query(ip string, page, size int) url.Values {
	return url.Values{"from": {f.from}, "to": {f.to}, "ip": {ip},
		"page": {strconv.Itoa(page)}, "size": {strconv.Itoa(size)}}
}

var uaBrowsers = []struct {
	name string
	re   *regexp.Regexp
}{
	{"Edge", regexp.MustCompile(`Edg(?:A|iOS)?/(\d+)`)},
	{"Opera", regexp.MustCompile(`OPR/(\d+)`)},
	{"Firefox", regexp.MustCompile(`(?:Firefox|FxiOS)/(\d+)`)},
	{"Chrome", regexp.MustCompile(`(?:Chrome|CriOS)/(\d+)`)},
	{"Safari", regexp.MustCompile(`Version/(\d+).*Safari`)},
}

// parseBrowser returns "Name major" or "" when unknown.
func parseBrowser(ua string) string {
	for _, b := range uaBrowsers {
		if m := b.re.FindStringSubmatch(ua); m != nil {
			return b.name + " " + m[1]
		}
	}
	return ""
}

// parseDevice returns the OS label or "" when unknown.
func parseDevice(ua string) string {
	switch {
	case strings.Contains(ua, "Android"):
		return "Android"
	case strings.Contains(ua, "iPhone"), strings.Contains(ua, "iPad"):
		return "iOS / iPadOS"
	case strings.Contains(ua, "Windows"):
		return "Windows"
	case strings.Contains(ua, "Macintosh"):
		return "macOS"
	case strings.Contains(ua, "Linux"):
		return "Linux"
	}
	return ""
}

func orUnknown(s string) string {
	if s == "" {
		return i18n.T("visits.unknown")
	}
	return s
}

// toPage adapts {items,total,page,size} to the kit {data,meta} shape.
func toPage[T any](p visitPage[T], size int) api.Page[T] {
	return api.Page[T]{Data: p.Items, Meta: api.Meta{Page: p.Page, Size: size,
		TotalElements: int64(p.Total), TotalPages: (p.Total + size - 1) / size}}
}

func buildVisits(env *kit.Env) fyne.CanvasObject {
	const size = 25
	now := time.Now()
	from, to := kit.NewDateEntry(), kit.NewDateEntry()
	f0, t0 := now.AddDate(0, 0, -6), now
	from.SetDate(&f0)
	to.SetDate(&t0)
	ipEntry := widget.NewEntry()
	ipEntry.SetPlaceHolder(i18n.T("visits.allIps"))

	var (
		mu     sync.Mutex
		filter visitFilter
	)
	cur := func() visitFilter { mu.Lock(); defer mu.Unlock(); return filter }
	filter, _ = newVisitFilter(f0, t0, "", time.Local)

	tiles := container.NewGridWithColumns(4)
	updated := kit.Muted("")
	setTiles := func(s visitSummary) {
		tiles.Objects = []fyne.CanvasObject{
			kit.Tile(i18n.T("visits.views"), strconv.Itoa(s.Totals.Views)),
			kit.Tile(i18n.T("visits.reloads"), strconv.Itoa(s.Totals.Reloads)),
			kit.Tile(i18n.T("visits.ips"), strconv.Itoa(s.Totals.IPs)),
			kit.Tile(i18n.T("visits.visitors"), strconv.Itoa(s.Totals.Visitors))}
		tiles.Refresh()
		updated.SetText(fmt.Sprintf("%s: %s · %s: %s", i18n.T("visits.updated"), format.TimeShort(time.Now()),
			i18n.T("visits.zone"), time.Local))
	}

	var events *kit.PagedTable[visit]
	eventsBox := container.NewVBox()
	showEvents := func(ip string) {
		src := func(ctx context.Context, page, _ int, _ string) (api.Page[visit], error) {
			var out visitPage[visit]
			err := env.API.Get(ctx, "admin/login-visits/events", cur().query(ip, page, size), &out)
			return toPage(out, size), err
		}
		events = kit.NewPagedTable(env, src, kit.PagedOptions{Size: size, NoSearch: true}, eventCols(),
			kit.RowAction[visit]{Label: i18n.T("visits.detail"), Do: func(v visit) { showVisit(env, v) }})
		events.Table.SetEmpty(i18n.T("visits.empty"))
		eventsBox.Objects = []fyne.CanvasObject{kit.Sep(), kit.Heading(i18n.T("visits.history") + " · " + ip), events}
		eventsBox.Refresh()
	}

	ipSrc := func(ctx context.Context, page, _ int, _ string) (api.Page[ipRow], error) {
		f := cur()
		var out visitSummary
		if err := env.API.Get(ctx, "admin/login-visits", f.query(f.ip, page, size), &out); err != nil {
			if api.StatusOf(err) == 400 {
				err = &api.ApiError{Status: 400, Code: "MAPPED", Message: i18n.T("visits.invalidFilter")}
			}
			return api.Page[ipRow]{}, err
		}
		fyne.Do(func() { setTiles(out) })
		return toPage(out.IPs, size), nil
	}
	ips := kit.NewPagedTable(env, ipSrc, kit.PagedOptions{Size: size, NoSearch: true}, []kit.Col[ipRow]{
		{Title: "IP", Weight: 1.5, MinWidth: 120, Cell: func(r ipRow) fyne.CanvasObject {
			l := widget.NewLabel(r.IP)
			l.TextStyle = fyne.TextStyle{Monospace: true}
			return l
		}},
		{Title: i18n.T("visits.views"), Text: func(r ipRow) string { return strconv.Itoa(r.Views) }},
		{Title: i18n.T("visits.reloads"), Text: func(r ipRow) string { return strconv.Itoa(r.Reloads) }},
		{Title: i18n.T("visits.visitors"), Text: func(r ipRow) string { return strconv.Itoa(r.Visitors) }},
		{Title: i18n.T("visits.sessions"), Text: func(r ipRow) string { return strconv.Itoa(r.Sessions) }},
		{Title: i18n.T("visits.first"), MinWidth: 110, Text: func(r ipRow) string { return format.Timestamp(r.FirstSeen, format.DateTimeShort) }},
		{Title: i18n.T("visits.last"), MinWidth: 110, Text: func(r ipRow) string { return format.Timestamp(r.LastSeen, format.DateTimeShort) }},
	}, kit.RowAction[ipRow]{Label: i18n.T("visits.detail"), Do: func(r ipRow) { showEvents(r.IP) }})
	ips.Table.SetEmpty(i18n.T("visits.empty"))

	applyBtn := widget.NewButton(i18n.T("visits.apply"), func() {
		if from.Date == nil || to.Date == nil {
			env.Toast(kit.ToastError, i18n.T("visits.invalidRange"))
			return
		}
		f, ok := newVisitFilter(*from.Date, *to.Date, ipEntry.Text, time.Local)
		if !ok {
			env.Toast(kit.ToastError, i18n.T("visits.invalidRange"))
			return
		}
		mu.Lock()
		filter = f
		mu.Unlock()
		eventsBox.Objects = nil
		eventsBox.Refresh()
		ips.SetSearch("") // reloads page 0
	})
	applyBtn.Importance = widget.HighImportance
	refresh := widget.NewButton(i18n.T("visits.refresh"), func() {
		ips.Reload()
		if len(eventsBox.Objects) > 0 {
			events.Reload()
		}
	})

	form := container.NewGridWithColumns(4,
		labeled(i18n.T("visits.from"), from), labeled(i18n.T("visits.to"), to),
		labeled(i18n.T("visits.ip"), ipEntry), container.NewVBox(widget.NewLabel(""), applyBtn))
	about := widget.NewCard(i18n.T("visits.about"), "", container.NewVBox(
		kit.Muted(i18n.T("visits.definitions")), kit.Muted(i18n.T("visits.accuracy")), kit.Muted(i18n.T("visits.proxyHelp"))))
	return container.NewVScroll(container.NewVBox(
		kit.PageHeader("ADMIN · KIRA LIFE", i18n.T("visits.title"), i18n.T("visits.subtitle"), refresh),
		form, kit.Muted(i18n.T("visits.retention")), updated, tiles,
		kit.Heading(i18n.T("visits.byIp")), ips, eventsBox, about))
}

func labeled(label string, o fyne.CanvasObject) fyne.CanvasObject {
	return container.NewVBox(kit.Muted(label), o)
}

func eventCols() []kit.Col[visit] {
	return []kit.Col[visit]{
		{Title: i18n.T("visits.updated"), MinWidth: 130, Text: func(v visit) string { return format.Timestamp(v.VisitedAt, format.DateTimeShort) }},
		{Title: i18n.T("visits.navigate"), MinWidth: 120, Text: func(v visit) string { return i18n.T("visits." + v.Navigation) }},
		{Title: "UA", Weight: 3, MinWidth: 220, Text: func(v visit) string {
			return fmt.Sprintf("%s · %s · %d × %d", orUnknown(parseBrowser(v.UserAgent)), orUnknown(parseDevice(v.UserAgent)), v.ScreenWidth, v.ScreenHeight)
		}},
	}
}

func showVisit(env *kit.Env, v visit) {
	row := func(k, val string) fyne.CanvasObject {
		l := widget.NewLabel(val)
		l.Wrapping = fyne.TextWrapBreak
		return container.NewVBox(kit.Muted(k), l)
	}
	ref := v.Referrer
	if ref == "" {
		ref = i18n.T("visits.direct")
	}
	body := container.NewVBox(
		row(i18n.T("visits.ipSource"), i18n.T("visits."+v.IPSource)+" · "+i18n.T("visits.peer")+": "+v.PeerIP),
		row(i18n.T("visits.visitorId"), v.VisitorID), row(i18n.T("visits.sessionId"), v.SessionID),
		row(i18n.T("visits.language"), v.Language), row(i18n.T("visits.zone"), v.Timezone),
		row(i18n.T("visits.referrer"), ref), row("User-Agent", v.UserAgent), row(i18n.T("visits.eventId"), v.ID))
	sc := container.NewVScroll(body)
	sc.SetMinSize(fyne.NewSize(480, 380))
	dialog.ShowCustom(i18n.T("visits.history")+" · "+v.IP, i18n.T("common.close"), sc, env.Window)
}
