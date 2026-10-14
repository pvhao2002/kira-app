package resources

import (
	"context"
	"net/url"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
	"kira-bank-desktop-v2/internal/ui/pages/resources/fb"
)

func init() {
	fb.Add(map[string][2]string{
		"field.title":              {"Title", "Tiêu đề"},
		"field.message":            {"Message", "Nội dung"},
		"field.module":             {"Module", "Phân hệ"},
		"field.severity":           {"Severity", "Mức độ"},
		"notification.status":      {"Status", "Trạng thái"},
		"notification.unread":      {"Unread", "Chưa đọc"},
		"notification.read":        {"Read", "Đã đọc"},
		"notification.markAllRead": {"Mark all as read", "Đánh dấu đã đọc tất cả"},
	})
}

// listCfg describes one generic paged resource screen.
type listCfg[T any] struct {
	flow, title string // i18n keys
	path        string // list endpoint (relative to /api/v1)
	exportName  string
	readOnly    string              // optional notice key
	create      func(reload func()) // nil = no "Add new"
	statuses    []string            // client-side status filter options (per loaded page)
	statusOf    func(T) string
	cols        []kit.Col[T]
	actions     func(reload func()) []kit.RowAction[T]
	csvHeader   []string
	csvRow      func(T) []string
	headerExtra func(reload func()) []fyne.CanvasObject
}

func buildList[T any](env *kit.Env, c listCfg[T]) fyne.CanvasObject {
	var pt *kit.PagedTable[T]
	reload := func() { pt.Reload() }

	filter := ""
	src := kit.PathSource[T](env, c.path, url.Values{})
	filtered := func(ctx context.Context, page, size int, search string) (api.Page[T], error) {
		p, err := src(ctx, page, size, search)
		if err != nil || filter == "" || c.statusOf == nil {
			return p, err
		}
		var keep []T
		for _, r := range p.Data {
			if strings.EqualFold(c.statusOf(r), filter) {
				keep = append(keep, r)
			}
		}
		p.Data = keep
		return p, nil
	}

	var toolbar []fyne.CanvasObject
	if len(c.statuses) > 0 {
		all := i18n.T("common.all")
		sel := widget.NewSelect(append([]string{all}, c.statuses...), func(s string) {
			filter = s
			if s == all {
				filter = ""
			}
			pt.Reload()
		})
		sel.PlaceHolder = i18n.T("common.filter")
		toolbar = append(toolbar, sel)
	}
	toolbar = append(toolbar, widget.NewButtonWithIcon(i18n.T("common.export"), theme.DownloadIcon(), func() {
		var rows [][]string
		for _, r := range pt.Table.Rows() {
			rows = append(rows, c.csvRow(r))
		}
		env.SaveCSV(c.exportName+"_export.csv", c.csvHeader, rows)
	}))

	var actions []fyne.CanvasObject
	if c.create != nil {
		b := widget.NewButtonWithIcon(i18n.T("common.addNew"), theme.ContentAddIcon(), func() { c.create(reload) })
		b.Importance = widget.HighImportance
		actions = append(actions, b)
	}
	if c.headerExtra != nil {
		actions = append(actions, c.headerExtra(reload)...)
	}
	var acts []kit.RowAction[T]
	if c.actions != nil {
		acts = c.actions(reload)
	}
	pt = kit.NewPagedTable(env, filtered, kit.PagedOptions{Toolbar: toolbar}, c.cols, acts...)
	if q := env.Params()["search"]; q != "" {
		pt.SetSearch(q)
	}
	pt.Table.SetEmpty(i18n.T("resource.emptyTitle") + ". " + emptyBody(c.create != nil))

	head := container.NewVBox(kit.PageHeader(i18n.T(c.flow), i18n.T(c.title), i18n.T("resource.description"), actions...))
	if c.readOnly != "" {
		head.Add(kit.Muted(i18n.T(c.readOnly)))
	}
	return container.NewBorder(head, nil, nil, nil, pt)
}

func emptyBody(canCreate bool) string {
	if canCreate {
		return i18n.T("resource.emptyBody")
	}
	return i18n.T("resource.emptyReadOnlyBody")
}

// editWith loads the fresh detail row (for versions) and then opens the edit form.
func editWith[T any](env *kit.Env, path string, open func(T)) {
	kit.Async(func(ctx context.Context) (T, error) {
		var v T
		return v, env.API.Get(ctx, path, nil, &v)
	}, func(v T, err error) {
		if err != nil {
			env.ShowError(err)
			return
		}
		open(v)
	})
}

// opts builds select options from values, labelled by label(value).
func opts(label func(string) string, values ...string) []kit.Option {
	out := make([]kit.Option, len(values))
	for i, v := range values {
		out[i] = kit.Option{Value: v, Label: label(v)}
	}
	return out
}

func dash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "—"
	}
	return s
}

func statusBadge(s string) fyne.CanvasObject {
	imp := widget.MediumImportance
	switch strings.ToUpper(s) {
	case "ACTIVE":
		imp = widget.SuccessImportance
	case "CLOSED", "REJECTED":
		imp = widget.DangerImportance
	case "INACTIVE", "WITHDRAWN":
		imp = widget.LowImportance
	}
	return kit.Badge(dash(s), imp)
}
