package admin

import (
	"context"
	"strconv"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type cfAI struct {
	TokenConfigured bool    `json:"tokenConfigured"`
	Model           string  `json:"model"`
	Priority        int     `json:"priority"`
	Enabled         bool    `json:"enabled"`
	Status          string  `json:"status"`
	CooldownUntil   *string `json:"cooldownUntil"`
	LastErrorCode   *string `json:"lastErrorCode"`
	LastErrorAt     *string `json:"lastErrorAt"`
	LastTestedAt    *string `json:"lastTestedAt"`
	LastSuccessAt   *string `json:"lastSuccessAt"`
}

type cfR2 struct {
	AccessKeyConfigured bool    `json:"accessKeyConfigured"`
	SecretKeyConfigured bool    `json:"secretKeyConfigured"`
	MaskedBucketName    *string `json:"maskedBucketName"`
	MaskedPublicURL     *string `json:"maskedPublicUrl"`
	Primary             bool    `json:"primary"`
	Status              string  `json:"status"`
	LastErrorCode       *string `json:"lastErrorCode"`
	LastErrorAt         *string `json:"lastErrorAt"`
	LastTestedAt        *string `json:"lastTestedAt"`
	LastSuccessAt       *string `json:"lastSuccessAt"`
	AttachmentCount     int     `json:"attachmentCount"`
}

type cfAccount struct {
	ID                    int64  `json:"id"`
	DisplayName           string `json:"displayName"`
	MaskedAccountID       string `json:"maskedAccountId"`
	AI                    cfAI   `json:"ai"`
	R2                    cfR2   `json:"r2"`
	LegacyAttachmentCount int    `json:"legacyAttachmentCount"`
	Version               int64  `json:"version"`
}

func statusLabel(s string) string {
	switch s {
	case "VERIFIED":
		return i18n.T("aiProviders.statusVerified")
	case "COOLDOWN":
		return i18n.T("aiProviders.statusCooldown")
	case "BLOCKED":
		return i18n.T("aiProviders.statusBlocked")
	}
	return i18n.T("aiProviders.statusPending")
}

func statusImp(s string) widget.Importance {
	switch s {
	case "VERIFIED":
		return widget.SuccessImportance
	case "BLOCKED":
		return widget.DangerImportance
	case "COOLDOWN":
		return widget.WarningImportance
	}
	return widget.MediumImportance
}

func ptrDate(p *string) string {
	if p == nil {
		return "—"
	}
	return format.Timestamp(*p, format.DateTimeShort)
}

func buildProviders(env *kit.Env) fyne.CanvasObject {
	grid := container.NewGridWrap(fyne.NewSize(430, 560))
	banner := widget.NewLabel("")
	banner.Importance = widget.DangerImportance
	banner.Wrapping = fyne.TextWrapWord
	banner.Hide()
	status := kit.Muted(i18n.T("aiProviders.loading"))
	acting := false

	var load func()
	setBanner := func(msg string) {
		banner.SetText(msg)
		if msg == "" {
			banner.Hide()
		} else {
			banner.Show()
		}
	}
	// act posts {version} to the account sub-path; reloads on success and on failure.
	act := func(a cfAccount, sub, okKey string) {
		if acting {
			return
		}
		acting = true
		setBanner("")
		kit.Async(func(ctx context.Context) (struct{}, error) {
			return struct{}{}, env.API.Post(ctx, "admin/cloudflare-accounts/"+strconv.FormatInt(a.ID, 10)+"/"+sub,
				map[string]int64{"version": a.Version}, nil)
		}, func(_ struct{}, err error) {
			acting = false
			load()
			if err != nil {
				setBanner(api.Message(err, i18n.T("aiProviders.actionFailed")))
				return
			}
			env.Toast(kit.ToastSuccess, i18n.T(okKey))
		})
	}
	del := func(a cfAccount) {
		env.Confirm(i18n.T("aiProviders.deleteConfirm"), func() {
			if acting {
				return
			}
			acting = true
			kit.Async(func(ctx context.Context) (struct{}, error) {
				return struct{}{}, env.API.Do(ctx, "DELETE", "admin/cloudflare-accounts/"+strconv.FormatInt(a.ID, 10), nil,
					map[string]int64{"version": a.Version}, nil)
			}, func(_ struct{}, err error) {
				acting = false
				load()
				if err != nil {
					setBanner(api.Message(err, i18n.T("aiProviders.actionFailed")))
					return
				}
				env.Toast(kit.ToastSuccess, i18n.T("aiProviders.deleted"))
			})
		})
	}

	render := func(list []cfAccount) {
		grid.Objects = nil
		for _, a := range list {
			grid.Add(accountCard(env, a, act, del, func() { load() }))
		}
		grid.Refresh()
		switch {
		case len(list) == 0:
			status.SetText(i18n.T("aiProviders.emptyTitle") + ". " + i18n.T("aiProviders.emptyDescription"))
		default:
			status.SetText("")
		}
	}
	load = func() {
		kit.Async(func(ctx context.Context) ([]cfAccount, error) {
			var out []cfAccount
			return out, env.API.Get(ctx, "admin/cloudflare-accounts", nil, &out)
		}, func(list []cfAccount, err error) {
			if err != nil {
				status.SetText("")
				setBanner(api.Message(err, i18n.T("aiProviders.loadFailed")))
				return
			}
			render(list)
		})
	}
	load()

	add := widget.NewButtonWithIcon(i18n.T("aiProviders.add"), theme.ContentAddIcon(), func() { editAccount(env, nil, load) })
	add.Importance = widget.HighImportance
	return container.NewVScroll(container.NewVBox(
		kit.PageHeader(i18n.T("aiProviders.eyebrow"), i18n.T("aiProviders.title"), i18n.T("aiProviders.description"), add),
		banner, status, grid))
}

func kv(k, v string) fyne.CanvasObject {
	return container.NewBorder(nil, nil, kit.Muted(k), nil, widget.NewLabel(v))
}

func accountCard(env *kit.Env, a cfAccount, act func(cfAccount, string, string), del func(cfAccount), reload func()) fyne.CanvasObject {
	code := widget.NewLabel(a.MaskedAccountID)
	code.TextStyle = fyne.TextStyle{Monospace: true}
	edit := widget.NewButtonWithIcon(i18n.T("common.edit"), theme.DocumentCreateIcon(), func() { editAccount(env, &a, reload) })
	edit.Importance = widget.LowImportance
	head := container.NewBorder(nil, nil, nil, edit, container.NewVBox(kit.Heading(a.DisplayName), code))

	btn := func(label string, disabled bool, f func()) *widget.Button {
		b := widget.NewButton(label, f)
		if disabled {
			b.Disable()
		}
		return b
	}
	// Workers AI
	ai := container.NewVBox(kit.Heading("Workers AI"), kit.Badge(statusLabel(a.AI.Status), statusImp(a.AI.Status)),
		kv(i18n.T("aiProviders.model"), a.AI.Model), kv(i18n.T("aiProviders.priority"), strconv.Itoa(a.AI.Priority)),
		kv(i18n.T("aiProviders.lastTested"), ptrDate(a.AI.LastTestedAt)), kv(i18n.T("aiProviders.lastSuccess"), ptrDate(a.AI.LastSuccessAt)))
	if a.AI.CooldownUntil != nil {
		ai.Add(kv(i18n.T("aiProviders.cooldownUntil"), ptrDate(a.AI.CooldownUntil)))
	}
	if a.AI.LastErrorCode != nil {
		ai.Add(kv(i18n.T("aiProviders.lastError"), *a.AI.LastErrorCode))
	}
	toggleLabel, toggleSub, toggleKey := i18n.T("aiProviders.enable"), "ai/enable", "aiProviders.enabled"
	if a.AI.Enabled {
		toggleLabel, toggleSub, toggleKey = i18n.T("aiProviders.disable"), "ai/disable", "aiProviders.disabled"
	}
	ai.Add(container.NewHBox(
		btn(i18n.T("aiProviders.testAi"), !a.AI.TokenConfigured, func() { act(a, "ai/test", "aiProviders.aiTestPassed") }),
		btn(toggleLabel, !a.AI.Enabled && a.AI.Status != "VERIFIED", func() { act(a, toggleSub, toggleKey) })))
	if !a.AI.TokenConfigured {
		ai.Add(kit.Muted(i18n.T("aiProviders.aiCredentialHint")))
	}

	// R2
	bucket := "—"
	if a.R2.MaskedBucketName != nil && *a.R2.MaskedBucketName != "" {
		bucket = *a.R2.MaskedBucketName
	}
	r2Badge := kit.Badge(statusLabel(a.R2.Status), statusImp(a.R2.Status))
	if a.R2.Primary {
		r2Badge = kit.Badge(i18n.T("aiProviders.r2PrimaryStatus"), widget.HighImportance)
	}
	r2ok := a.R2.AccessKeyConfigured && a.R2.SecretKeyConfigured && bucket != "—"
	r2 := container.NewVBox(kit.Heading("R2"), r2Badge,
		kv(i18n.T("aiProviders.bucket"), bucket), kv(i18n.T("aiProviders.files"), strconv.Itoa(a.R2.AttachmentCount)),
		kv(i18n.T("aiProviders.lastTested"), ptrDate(a.R2.LastTestedAt)), kv(i18n.T("aiProviders.lastSuccess"), ptrDate(a.R2.LastSuccessAt)))
	if a.R2.LastErrorCode != nil {
		r2.Add(kv(i18n.T("aiProviders.lastError"), *a.R2.LastErrorCode))
	}
	primLabel, primSub, primKey := i18n.T("aiProviders.makePrimary"), "r2/make-primary", "aiProviders.r2Primary"
	if a.R2.Primary {
		primLabel, primSub, primKey = i18n.T("aiProviders.stopUploads"), "r2/stop-uploads", "aiProviders.r2Stopped"
	}
	r2.Add(container.NewHBox(
		btn(i18n.T("aiProviders.testR2"), !r2ok, func() { act(a, "r2/test", "aiProviders.r2TestPassed") }),
		btn(primLabel, !a.R2.Primary && a.R2.Status != "VERIFIED", func() { act(a, primSub, primKey) })))
	if a.LegacyAttachmentCount > 0 {
		n := strconv.Itoa(a.LegacyAttachmentCount)
		r2.Add(btn(i18n.T("aiProviders.adoptLegacy")+" ("+n+")", a.R2.Status != "VERIFIED", func() {
			env.Confirm(i18n.T("aiProviders.adoptConfirm", i18n.P{"count": n}), func() {
				act(a, "r2/adopt-legacy-attachments", "aiProviders.adopted")
			})
		}))
	}
	if !r2ok {
		r2.Add(kit.Muted(i18n.T("aiProviders.r2CredentialHint")))
	}
	delBtn := btn(i18n.T("aiProviders.delete"), a.R2.AttachmentCount > 0, func() { del(a) })
	delBtn.Importance = widget.DangerImportance
	return widget.NewCard("", "", container.NewVBox(head, kit.Sep(), ai, kit.Sep(), r2, kit.Sep(), delBtn))
}

// editAccount opens the create (a == nil) or edit dialog. Secrets are write-only:
// stored values are never shown, blank keeps them, and edit sends only changed fields.
func editAccount(env *kit.Env, a *cfAccount, saved func()) {
	title, keep := i18n.T("aiProviders.createTitle"), ""
	model, prio := "@cf/moonshotai/kimi-k2.7-code", int64(100)
	name := ""
	if a != nil {
		title, keep = i18n.T("aiProviders.editTitle"), i18n.T("aiProviders.secretKeep")
		model, prio, name = a.AI.Model, int64(a.AI.Priority), a.DisplayName
	}
	hint := func(k string) string {
		if a == nil {
			return ""
		}
		return i18n.T(k)
	}
	fields := []kit.Field{
		{Key: "displayName", Label: i18n.T("aiProviders.name"), Required: true, MaxLen: 100, Initial: name},
		{Key: "accountId", Label: i18n.T("aiProviders.accountId"), Required: a == nil, MaxLen: 64, Hint: hint("aiProviders.accountIdKeep")},
		{Key: "apiToken", Label: i18n.T("aiProviders.token"), Kind: kit.KindPassword, MaxLen: 2048, Hint: keep},
		{Key: "aiModel", Label: i18n.T("aiProviders.model"), Required: true, MaxLen: 180, Initial: model},
		{Key: "priority", Label: i18n.T("aiProviders.priority"), Kind: kit.KindNumber, Required: true, MaxFrac: 0,
			Min: kit.Dec("0"), Max: kit.Dec("100000"), Initial: decimal.NewFromInt(prio), Hint: i18n.T("aiProviders.priorityHint")},
		{Key: "r2AccessKeyId", Label: i18n.T("aiProviders.r2AccessKey"), Kind: kit.KindPassword, Hint: keep},
		{Key: "r2SecretAccessKey", Label: i18n.T("aiProviders.r2SecretKey"), Kind: kit.KindPassword, Hint: keep},
		{Key: "r2BucketName", Label: i18n.T("aiProviders.bucket"), MaxLen: 255, Hint: hint("aiProviders.bucketKeep")},
		{Key: "r2PublicUrl", Label: i18n.T("aiProviders.publicUrl"), MaxLen: 500,
			Validate: func(v any) string {
				if s, _ := v.(string); s != "" && !strings.HasPrefix(s, "http://") && !strings.HasPrefix(s, "https://") {
					return i18n.T("users.invalid")
				}
				return ""
			}},
	}
	env.FormDialog(kit.FormSpec{Title: title, SubmitLabel: i18n.T("aiProviders.save"), Fields: fields,
		Submit: func(ctx context.Context, v map[string]any) error {
			if a == nil {
				body := map[string]any{}
				for _, f := range fields {
					if f.Key == "priority" {
						body[f.Key] = v[f.Key]
						continue
					}
					s, _ := v[f.Key].(string)
					body[f.Key] = strings.TrimSpace(s)
				}
				return env.API.Post(ctx, "admin/cloudflare-accounts", body, nil)
			}
			body := map[string]any{"version": a.Version}
			for _, f := range fields {
				switch x := v[f.Key].(type) {
				case string:
					x = strings.TrimSpace(x)
					if x == "" || (f.Key == "displayName" && x == a.DisplayName) || (f.Key == "aiModel" && x == a.AI.Model) {
						continue
					}
					body[f.Key] = x
				case decimal.Decimal:
					if x.IntPart() != int64(a.AI.Priority) {
						body[f.Key] = x
					}
				}
			}
			return env.API.Put(ctx, "admin/cloudflare-accounts/"+strconv.FormatInt(a.ID, 10), body, nil)
		},
		OnSaved: func() { env.Toast(kit.ToastSuccess, i18n.T("aiProviders.saved")); saved() }})
}
