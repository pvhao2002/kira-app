package admin

import (
	"context"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type adminUser struct {
	ID       int64    `json:"id"`
	Email    string   `json:"email"`
	FullName string   `json:"fullName"`
	Phone    *string  `json:"phone"`
	Roles    []string `json:"roles"`
	Status   string   `json:"status"`
}

var emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

func buildUsers(env *kit.Env) fyne.CanvasObject {
	var t *kit.PagedTable[adminUser]
	setStatus := func(u adminUser, status, okKey string) {
		kit.Async(func(ctx context.Context) (adminUser, error) {
			var out adminUser
			return out, env.API.Patch(ctx, "admin/users/"+strconv.FormatInt(u.ID, 10)+"/status", map[string]string{"status": status}, &out)
		}, func(_ adminUser, err error) {
			if err != nil {
				env.Toast(kit.ToastError, i18n.T("users.statusError"))
				return
			}
			env.Toast(kit.ToastSuccess, i18n.T(okKey))
			t.Reload()
		})
	}
	notAdmin := func(u adminUser) bool { return !slices.Contains(u.Roles, "ROLE_ADMIN") }
	add := widget.NewButtonWithIcon(i18n.T("users.add"), theme.ContentAddIcon(), func() { createUser(env, func() { t.SetSearch("") }) })
	t = kit.NewPagedTable(env, kit.PathSource[adminUser](env, "admin/users", nil),
		kit.PagedOptions{Toolbar: []fyne.CanvasObject{add}},
		[]kit.Col[adminUser]{
			{Title: i18n.T("users.fullName"), Weight: 2, Text: func(u adminUser) string { return u.FullName }},
			{Title: i18n.T("users.email"), Weight: 2, MinWidth: 160, Text: func(u adminUser) string { return u.Email }},
			{Title: i18n.T("users.phone"), Text: func(u adminUser) string {
				if u.Phone == nil {
					return "—"
				}
				return dash(*u.Phone)
			}},
			{Title: i18n.T("users.roles"), Weight: 1.5, Text: func(u adminUser) string { return strings.Join(u.Roles, ", ") }},
			{Title: i18n.T("users.status"), Text: func(u adminUser) string { return u.Status }},
		},
		kit.RowAction[adminUser]{Label: i18n.T("users.lock"), Icon: theme.VisibilityOffIcon(),
			Visible: func(u adminUser) bool { return notAdmin(u) && u.Status == "ACTIVE" },
			Do: func(u adminUser) {
				env.Confirm(i18n.T("users.lockConfirm", i18n.P{"email": u.Email}), func() { setStatus(u, "LOCKED", "users.locked") })
			}},
		kit.RowAction[adminUser]{Label: i18n.T("users.unlock"), Icon: theme.VisibilityIcon(),
			Visible: func(u adminUser) bool { return notAdmin(u) && u.Status == "LOCKED" },
			Do:      func(u adminUser) { setStatus(u, "ACTIVE", "users.unlocked") }})
	t.Table.SetEmpty(i18n.T("users.empty"))
	return container.NewBorder(kit.PageHeader("ADMIN · KIRA LIFE", i18n.T("route.adminUsers"), i18n.T("users.description")), nil, nil, nil, t)
}

func createUser(env *kit.Env, saved func()) {
	var form *kit.Form
	env.FormDialog(kit.FormSpec{
		Title: i18n.T("users.add"), SubmitLabel: i18n.T("users.add"),
		Fields: []kit.Field{
			{Key: "fullName", Label: i18n.T("users.fullName"), Required: true, MaxLen: 150},
			{Key: "email", Label: i18n.T("users.email"), Required: true, MaxLen: 254,
				Validate: func(v any) string {
					if s, _ := v.(string); !emailRe.MatchString(strings.TrimSpace(s)) {
						return i18n.T("users.invalid")
					}
					return ""
				}},
			{Key: "phone", Label: i18n.T("users.phone"), MaxLen: 30},
			{Key: "password", Label: i18n.T("users.password"), Kind: kit.KindPassword, Required: true, MaxLen: 72, Hint: i18n.T("users.passwordHint"),
				Validate: func(v any) string {
					if s, _ := v.(string); len(s) < 8 || strings.TrimSpace(s) == "" {
						return i18n.T("users.invalid")
					}
					return ""
				}},
			{Key: "confirmPassword", Label: i18n.T("users.confirmPassword"), Kind: kit.KindPassword, Required: true,
				Validate: func(v any) string {
					if form != nil && v != form.Get("password") {
						return i18n.T("users.mismatch")
					}
					return ""
				}},
		},
		Setup: func(f *kit.Form) { form = f },
		Submit: func(ctx context.Context, v map[string]any) error {
			s := func(k string) string { x, _ := v[k].(string); return strings.TrimSpace(x) }
			body := map[string]any{"fullName": s("fullName"), "email": s("email"), "password": v["password"]}
			if p := s("phone"); p != "" {
				body["phone"] = p
			} else {
				body["phone"] = nil
			}
			err := env.API.Post(ctx, "admin/users", body, nil)
			if err == nil {
				return nil
			}
			err = codeErr(err, "EMAIL_EXISTS", 0, "users.emailExists")
			return codeErr(err, "", 403, "users.forbidden")
		},
		OnSaved: func() { env.Toast(kit.ToastSuccess, i18n.T("users.created")); saved() },
	})
}
