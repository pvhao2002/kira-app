package resources

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
	"kira-bank-desktop-v2/internal/ui/pages/resources/fb"
)

func idStr(id int64) string { return strconv.FormatInt(id, 10) }

func capital(v string) string {
	v = strings.ToLower(v)
	if v == "" {
		return v
	}
	return strings.ToUpper(v[:1]) + v[1:]
}

func deleteVersioned(env *kit.Env, path string, version int64, reload func()) {
	kit.Async(func(ctx context.Context) (struct{}, error) {
		return struct{}{}, env.API.Delete(ctx, path, url.Values{"version": {idStr(version)}})
	}, func(_ struct{}, err error) {
		if err != nil {
			env.ShowError(err)
			return
		}
		reload()
	})
}

func editBtn[T any](do func(T)) kit.RowAction[T] {
	return kit.RowAction[T]{Label: i18n.T("common.edit"), Icon: theme.DocumentCreateIcon(), Do: do}
}

// ---- investment accounts ----

type invAccount struct {
	ID              int64  `json:"id"`
	AccountCode     string `json:"accountCode"`
	AccountName     string `json:"accountName"`
	AccountUsername string `json:"accountUsername"`
	AccountEmail    string `json:"accountEmail"`
	PhoneNumber     string `json:"phoneNumber"`
	RegisterDate    string `json:"registerDate"`
	Currency        string `json:"currency"`
	Status          string `json:"status"`
	Version         int64  `json:"version"`
}

var statusValues = []string{"ACTIVE", "INACTIVE", "CLOSED"}

func statusOpts() []kit.Option {
	return opts(func(v string) string { return i18n.T("option." + strings.ToLower(v)) }, statusValues...)
}

func accountPage(env *kit.Env) fyne.CanvasObject {
	return buildList(env, listCfg[invAccount]{
		flow: "resource.flowInvestment", title: "route.investmentAccounts", path: "investment/accounts",
		exportName: "investmentAccounts", statuses: statusValues,
		statusOf: func(a invAccount) string { return a.Status },
		create:   func(reload func()) { accountForm(env, nil, reload) },
		cols: []kit.Col[invAccount]{
			{Title: i18n.T("field.accountCode"), Text: func(a invAccount) string { return a.AccountCode }},
			{Title: i18n.T("field.accountName"), Weight: 2, Text: func(a invAccount) string { return a.AccountName }},
			{Title: i18n.T("field.accountUsername"), Text: func(a invAccount) string { return a.AccountUsername }},
			{Title: i18n.T("field.accountEmail"), Weight: 2, Text: func(a invAccount) string { return a.AccountEmail }},
			{Title: i18n.T("field.phoneNumber"), Text: func(a invAccount) string { return a.PhoneNumber }},
			{Title: i18n.T("field.registerDate"), Text: func(a invAccount) string {
				return format.DateOnly(a.RegisterDate, format.DateDMY)
			}},
			{Title: i18n.T("field.currency"), MinWidth: 60, Text: func(a invAccount) string { return a.Currency }},
			{Title: i18n.T("field.status"), MinWidth: 90, Cell: func(a invAccount) fyne.CanvasObject { return statusBadge(a.Status) }},
		},
		actions: func(reload func()) []kit.RowAction[invAccount] {
			return []kit.RowAction[invAccount]{editBtn(func(a invAccount) {
				editWith(env, "investment/accounts/"+idStr(a.ID), func(d invAccount) { accountForm(env, &d, reload) })
			})}
		},
		csvHeader: []string{i18n.T("field.accountCode"), i18n.T("field.accountName"), i18n.T("field.accountUsername"),
			i18n.T("field.accountEmail"), i18n.T("field.phoneNumber"), i18n.T("field.registerDate"),
			i18n.T("field.currency"), i18n.T("field.status")},
		csvRow: func(a invAccount) []string {
			return []string{a.AccountCode, a.AccountName, a.AccountUsername, a.AccountEmail, a.PhoneNumber,
				a.RegisterDate, a.Currency, a.Status}
		},
	})
}

func accountForm(env *kit.Env, a *invAccount, reload func()) {
	edit := a != nil
	if a == nil {
		a = &invAccount{}
	}
	fields := []kit.Field{
		{Key: "accountCode", Label: i18n.T("field.accountCode"), Required: true, MaxLen: 100, Initial: a.AccountCode},
		{Key: "accountName", Label: i18n.T("field.accountName"), Required: true, MaxLen: 150, Initial: a.AccountName},
		{Key: "accountUsername", Label: i18n.T("field.accountUsername"), Required: true, MaxLen: 100, Initial: a.AccountUsername},
		{Key: "accountEmail", Label: i18n.T("field.accountEmail"), Required: true, MaxLen: 150, Initial: a.AccountEmail},
		{Key: "phoneNumber", Label: i18n.T("field.phoneNumber"), Required: true, MaxLen: 50, Initial: a.PhoneNumber},
		{Key: "registerDate", Label: i18n.T("field.registerDate"), Kind: kit.KindDate, Required: true, Initial: a.RegisterDate},
		// the password is optional on edit (the backend keeps the old one when omitted)
		{Key: "accountPassword", Label: i18n.T("field.accountPassword"), Required: !edit, MaxLen: 100},
	}
	ttl, desc := "form.addAccount", "form.addAccountDescription"
	if edit {
		ttl, desc = "form.editAccount", "form.editAccountDescription"
		fields = append(fields, kit.Field{Key: "status", Label: i18n.T("field.status"), Kind: kit.KindSelect,
			Required: true, Options: statusOpts(), Initial: a.Status})
	} else { // currency is fixed after creation
		fields = append(fields, kit.Field{Key: "currency", Label: i18n.T("field.currency"), Kind: kit.KindSelect, Required: true,
			Initial: "VND", Options: []kit.Option{{Value: "VND", Label: i18n.T("option.currencyVnd")}, {Value: "USD", Label: i18n.T("option.currencyUsd")}}})
	}
	env.FormDialog(kit.FormSpec{Title: i18n.T(ttl), Description: i18n.T(desc), Fields: fields, OnSaved: reload,
		Submit: func(ctx context.Context, v map[string]any) error {
			if !edit {
				return env.API.Post(ctx, "investment/accounts", v, nil)
			}
			if v["accountPassword"] == nil {
				delete(v, "accountPassword")
			}
			v["version"] = a.Version
			return env.API.Put(ctx, "investment/accounts/"+idStr(a.ID), v, nil)
		}})
}

// ---- favorite songs ----

type song struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	Artist      string `json:"artist"`
	Genre       string `json:"genre"`
	KaraokeCode string `json:"karaokeCode"`
	Tone        string `json:"tone"`
	Link        string `json:"link"`
	Note        string `json:"note"`
	Version     int64  `json:"version"`
}

func songPage(env *kit.Env) fyne.CanvasObject {
	return buildList(env, listCfg[song]{
		flow: "resource.flowPersonal", title: "route.favoriteSongs", path: "karaoke/favorite-songs", exportName: "favoriteSongs",
		create: func(reload func()) { songForm(env, nil, reload) },
		cols: []kit.Col[song]{
			{Title: fb.T("field.title"), Weight: 2, Text: func(s song) string { return s.Title }},
			{Title: i18n.T("field.artist"), Weight: 2, Text: func(s song) string { return dash(s.Artist) }},
			{Title: i18n.T("field.genre"), Text: func(s song) string { return dash(s.Genre) }},
			{Title: i18n.T("field.karaokeCode"), Text: func(s song) string { return dash(s.KaraokeCode) }},
			{Title: i18n.T("field.tone"), MinWidth: 60, Text: func(s song) string { return dash(s.Tone) }},
			{Title: i18n.T("field.musicLink"), Weight: 2, Cell: func(s song) fyne.CanvasObject { return linkCell(env, s.Link) }},
		},
		actions: func(reload func()) []kit.RowAction[song] {
			return []kit.RowAction[song]{
				editBtn(func(s song) { songForm(env, &s, reload) }),
				{Label: i18n.T("common.delete"), Icon: theme.DeleteIcon(), Do: func(s song) {
					env.Confirm(i18n.T("karaoke.deleteConfirm"), func() {
						deleteVersioned(env, "karaoke/favorite-songs/"+idStr(s.ID), s.Version, reload)
					})
				}},
			}
		},
		csvHeader: []string{fb.T("field.title"), i18n.T("field.artist"), i18n.T("field.genre"), i18n.T("field.karaokeCode"),
			i18n.T("field.tone"), i18n.T("field.musicLink")},
		csvRow: func(s song) []string { return []string{s.Title, s.Artist, s.Genre, s.KaraokeCode, s.Tone, s.Link} },
	})
}

func linkCell(env *kit.Env, link string) fyne.CanvasObject {
	if strings.TrimSpace(link) == "" {
		return widget.NewLabel("—")
	}
	shown := link
	if r := []rune(shown); len(r) > 36 {
		shown = string(r[:36]) + "…"
	}
	b := widget.NewButton(shown, func() { env.OpenURL(link) })
	b.Importance = widget.LowImportance
	return b
}

func songForm(env *kit.Env, s *song, reload func()) {
	edit := s != nil
	if s == nil {
		s = &song{}
	}
	ttl, desc := "form.addFavoriteSong", "form.addFavoriteSongDescription"
	if edit {
		ttl, desc = "form.editFavoriteSong", "form.editFavoriteSongDescription"
	}
	env.FormDialog(kit.FormSpec{Title: i18n.T(ttl), Description: i18n.T(desc), OnSaved: reload,
		Fields: []kit.Field{
			{Key: "title", Label: fb.T("field.title"), Required: true, MaxLen: 255, Initial: s.Title},
			{Key: "artist", Label: i18n.T("field.artist"), MaxLen: 255, Initial: s.Artist},
			{Key: "genre", Label: i18n.T("field.genre"), MaxLen: 100, Initial: s.Genre},
			{Key: "karaokeCode", Label: i18n.T("field.karaokeCode"), MaxLen: 100, Initial: s.KaraokeCode},
			{Key: "tone", Label: i18n.T("field.tone"), MaxLen: 50, Initial: s.Tone},
			{Key: "link", Label: i18n.T("field.musicLink"), MaxLen: 1000, Initial: s.Link},
			{Key: "note", Label: i18n.T("field.note"), Kind: kit.KindTextArea, MaxLen: 10000, Initial: s.Note},
		},
		Submit: func(ctx context.Context, v map[string]any) error {
			if !edit {
				return env.API.Post(ctx, "karaoke/favorite-songs", v, nil)
			}
			v["version"] = s.Version
			return env.API.Put(ctx, "karaoke/favorite-songs/"+idStr(s.ID), v, nil)
		}})
}

// ---- job applications ----

type job struct {
	ID             int64  `json:"id"`
	CompanyName    string `json:"companyName"`
	PositionTitle  string `json:"positionTitle"`
	Location       string `json:"location"`
	JobURL         string `json:"jobUrl"`
	Salary         string `json:"salary"`
	EmploymentType string `json:"employmentType"`
	Status         string `json:"status"`
	Priority       string `json:"priority"`
	Deadline       string `json:"deadline"`
	ContactName    string `json:"contactName"`
	ContactEmail   string `json:"contactEmail"`
	Notes          string `json:"notes"`
	Version        int64  `json:"version"`
}

var jobStatuses = []string{"SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"}

func jobStatusLabel(v string) string   { return i18n.T("job.status" + capital(v)) }
func jobPriorityLabel(v string) string { return i18n.T("job.priority" + capital(v)) }

func jobPage(env *kit.Env) fyne.CanvasObject {
	return buildList(env, listCfg[job]{
		flow: "resource.flowPersonal", title: "route.jobApplications", path: "jobs", exportName: "jobApplications",
		statuses: jobStatuses, statusOf: func(j job) string { return j.Status },
		create: func(reload func()) { jobForm(env, nil, reload) },
		cols: []kit.Col[job]{
			{Title: i18n.T("field.companyName"), Weight: 2, Text: func(j job) string { return j.CompanyName }},
			{Title: i18n.T("field.positionTitle"), Weight: 2, Text: func(j job) string { return j.PositionTitle }},
			{Title: i18n.T("field.location"), Text: func(j job) string { return dash(j.Location) }},
			{Title: i18n.T("field.status"), Cell: func(j job) fyne.CanvasObject {
				return kit.Badge(jobStatusLabel(j.Status), widget.MediumImportance)
			}},
			{Title: i18n.T("field.priority"), MinWidth: 70, Cell: func(j job) fyne.CanvasObject {
				imp := widget.LowImportance
				switch j.Priority {
				case "HIGH":
					imp = widget.DangerImportance
				case "MEDIUM":
					imp = widget.WarningImportance
				}
				return kit.Badge(jobPriorityLabel(j.Priority), imp)
			}},
			{Title: i18n.T("field.deadline"), Text: func(j job) string { return format.DateOnly(j.Deadline, format.DateDMY) }},
			{Title: i18n.T("field.salary"), Text: func(j job) string { return dash(j.Salary) }},
		},
		actions: func(reload func()) []kit.RowAction[job] {
			return []kit.RowAction[job]{
				editBtn(func(j job) { jobForm(env, &j, reload) }),
				{Label: i18n.T("common.delete"), Icon: theme.DeleteIcon(), Do: func(j job) {
					env.Confirm(i18n.T("job.deleteConfirm"), func() {
						deleteVersioned(env, "jobs/"+idStr(j.ID), j.Version, reload)
					})
				}},
			}
		},
		csvHeader: []string{i18n.T("field.companyName"), i18n.T("field.positionTitle"), i18n.T("field.location"),
			i18n.T("field.status"), i18n.T("field.priority"), i18n.T("field.deadline"), i18n.T("field.salary")},
		csvRow: func(j job) []string {
			return []string{j.CompanyName, j.PositionTitle, j.Location, j.Status, j.Priority, j.Deadline, j.Salary}
		},
	})
}

func jobForm(env *kit.Env, j *job, reload func()) {
	edit := j != nil
	if j == nil {
		j = &job{Status: "SAVED", Priority: "MEDIUM"}
	}
	ttl, desc := "form.addJob", "form.addJobDescription"
	if edit {
		ttl, desc = "form.editJob", "form.editJobDescription"
	}
	empKey := map[string]string{"FULL_TIME": "fullTime", "PART_TIME": "partTime", "CONTRACT": "contract",
		"FREELANCE": "freelance", "INTERNSHIP": "internship", "OTHER": "other"}
	empTypes := opts(func(v string) string { return i18n.T("option." + empKey[v]) },
		"FULL_TIME", "PART_TIME", "CONTRACT", "FREELANCE", "INTERNSHIP", "OTHER")
	env.FormDialog(kit.FormSpec{Title: i18n.T(ttl), Description: i18n.T(desc), OnSaved: reload,
		Fields: []kit.Field{
			{Key: "companyName", Label: i18n.T("field.companyName"), Required: true, MaxLen: 255, Initial: j.CompanyName},
			{Key: "positionTitle", Label: i18n.T("field.positionTitle"), Required: true, MaxLen: 255, Initial: j.PositionTitle},
			{Key: "location", Label: i18n.T("field.location"), MaxLen: 255, Initial: j.Location},
			{Key: "jobUrl", Label: i18n.T("field.jobUrl"), MaxLen: 1000, Initial: j.JobURL},
			{Key: "salary", Label: i18n.T("field.salary"), MaxLen: 255, Initial: j.Salary},
			{Key: "employmentType", Label: i18n.T("field.employmentType"), Kind: kit.KindSelect, Options: empTypes, Initial: j.EmploymentType},
			{Key: "status", Label: i18n.T("job.status"), Kind: kit.KindSelect, Required: true, Initial: j.Status, Options: opts(jobStatusLabel, jobStatuses...)},
			{Key: "priority", Label: i18n.T("job.priority"), Kind: kit.KindSelect, Required: true, Initial: j.Priority,
				Options: opts(jobPriorityLabel, "LOW", "MEDIUM", "HIGH")},
			{Key: "deadline", Label: i18n.T("field.deadline"), Kind: kit.KindDate, Initial: j.Deadline},
			{Key: "contactName", Label: i18n.T("field.contactName"), MaxLen: 255, Initial: j.ContactName},
			{Key: "contactEmail", Label: i18n.T("field.contactEmail"), MaxLen: 255, Initial: j.ContactEmail},
			{Key: "notes", Label: i18n.T("field.note"), Kind: kit.KindTextArea, MaxLen: 10000, Initial: j.Notes},
		},
		Submit: func(ctx context.Context, v map[string]any) error {
			if !edit {
				return env.API.Post(ctx, "jobs", v, nil)
			}
			v["version"] = j.Version
			return env.API.Put(ctx, "jobs/"+idStr(j.ID), v, nil)
		}})
}

// ---- notifications ----

type notification struct {
	ID       int64  `json:"id"`
	Module   string `json:"module"`
	Title    string `json:"title"`
	Message  string `json:"message"`
	Severity string `json:"severity"`
	ReadAt   string `json:"readAt"`
	DeepLink string `json:"deepLink"`
	Created  string `json:"createdAt"`
}

// notificationRoute maps a backend deepLink to a screen and its params ("" = none).
func notificationRoute(link string) (string, map[string]string) {
	if !strings.HasPrefix(link, "/") {
		return "", nil
	}
	path, query, _ := strings.Cut(link, "?")
	path, _, _ = strings.Cut(path, "#")
	query, _, _ = strings.Cut(query, "#")
	seg := path[strings.LastIndex(path, "/")+1:]
	id := 0
	if vals, err := url.ParseQuery(query); err == nil {
		id, _ = strconv.Atoi(vals.Get("id"))
	}
	switch seg {
	case "statement-import":
		if id <= 0 {
			return "", nil
		}
		return "/app/credit-card/statement-import", map[string]string{"importId": strconv.Itoa(id)}
	case "billing-cycle", "statement-pay", "statements", "cards":
		return "/app/credit-cards", nil
	case "ai-result", "queue":
		return "/app/investment/ai-queue", nil
	case "credit-stats":
		return "/app/credit-card/dashboard", nil
	}
	return "", nil
}

func patchRead(ctx context.Context, env *kit.Env, id int64) error {
	return env.API.Patch(ctx, "notifications/"+idStr(id)+"/read", map[string]any{}, nil)
}

func notificationPage(env *kit.Env) fyne.CanvasObject {
	return buildList(env, listCfg[notification]{
		flow: "resource.flowSystem", title: "route.notifications", path: "notifications", exportName: "notifications",
		readOnly: "resource.notificationsReadOnly",
		cols: []kit.Col[notification]{
			{Title: fb.T("field.title"), Weight: 2, Text: func(n notification) string { return n.Title }},
			{Title: fb.T("field.message"), Weight: 3, Text: func(n notification) string { return n.Message }},
			{Title: fb.T("field.module"), Text: func(n notification) string { return dash(n.Module) }},
			{Title: fb.T("field.severity"), MinWidth: 80, Cell: func(n notification) fyne.CanvasObject {
				imp := widget.MediumImportance
				switch strings.ToUpper(n.Severity) {
				case "ERROR", "CRITICAL":
					imp = widget.DangerImportance
				case "WARNING":
					imp = widget.WarningImportance
				case "SUCCESS":
					imp = widget.SuccessImportance
				}
				return kit.Badge(dash(n.Severity), imp)
			}},
			{Title: i18n.T("field.createdAt"), Text: func(n notification) string { return format.Timestamp(n.Created, format.DateTimeShort) }},
			{Title: fb.T("notification.status"), MinWidth: 80, Cell: func(n notification) fyne.CanvasObject {
				if n.ReadAt == "" {
					return kit.Badge(fb.T("notification.unread"), widget.WarningImportance)
				}
				return kit.Badge(fb.T("notification.read"), widget.LowImportance)
			}},
		},
		actions: func(reload func()) []kit.RowAction[notification] {
			return []kit.RowAction[notification]{
				{Label: i18n.T("action.openNotification"), Icon: theme.NavigateNextIcon(),
					Visible: func(n notification) bool { r, _ := notificationRoute(n.DeepLink); return r != "" },
					Do: func(n notification) {
						r, p := notificationRoute(n.DeepLink)
						if n.ReadAt == "" { // fire and forget
							go func() {
								ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
								defer cancel()
								_ = patchRead(ctx, env, n.ID)
							}()
						}
						env.Navigate(r, p)
					}},
				{Label: i18n.T("action.markRead"), Icon: theme.ConfirmIcon(),
					Visible: func(n notification) bool { return n.ReadAt == "" },
					Do: func(n notification) {
						kit.Async(func(ctx context.Context) (struct{}, error) { return struct{}{}, patchRead(ctx, env, n.ID) },
							func(_ struct{}, err error) {
								if err != nil {
									env.ShowError(err)
									return
								}
								reload()
							})
					}},
			}
		},
		headerExtra: func(reload func()) []fyne.CanvasObject {
			return []fyne.CanvasObject{widget.NewButton(fb.T("notification.markAllRead"), func() {
				kit.Async(func(ctx context.Context) (struct{}, error) {
					return struct{}{}, env.API.Patch(ctx, "notifications/read-all", map[string]any{}, nil)
				}, func(_ struct{}, err error) {
					if err != nil {
						env.ShowError(err)
						return
					}
					reload()
				})
			})}
		},
		csvHeader: []string{fb.T("field.title"), fb.T("field.message"), fb.T("field.module"), fb.T("field.severity"), i18n.T("field.createdAt")},
		csvRow:    func(n notification) []string { return []string{n.Title, n.Message, n.Module, n.Severity, n.Created} },
	})
}
