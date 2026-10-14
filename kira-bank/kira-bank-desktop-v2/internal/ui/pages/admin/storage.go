package admin

import (
	"context"
	"strconv"
	"time"

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

const (
	provHF        = "HUGGING_FACE"
	provR2        = "R2"
	prefPreferred = "kira.fileStorage.preferred"
	maxUpload     = 10 * 1024 * 1024
)

type storageOps struct {
	ClassA          *int64  `json:"classA"`
	ClassAFreeLimit int64   `json:"classAFreeLimit"`
	ClassB          *int64  `json:"classB"`
	ClassBFreeLimit int64   `json:"classBFreeLimit"`
	Exceeded        bool    `json:"exceeded"`
	ErrorCode       *string `json:"errorCode"`
}

type storageUsage struct {
	Provider       string      `json:"provider"`
	Label          string      `json:"label"`
	Configured     bool        `json:"configured"`
	UsedBytes      *int64      `json:"usedBytes"`
	FreeLimitBytes int64       `json:"freeLimitBytes"`
	Exceeded       bool        `json:"exceeded"`
	ErrorCode      *string     `json:"errorCode"`
	Operations     *storageOps `json:"operations"`
}

type storedFile struct {
	ID           int64  `json:"id"`
	Provider     string `json:"provider"`
	OriginalName string `json:"originalName"`
	MimeType     string `json:"mimeType"`
	SizeBytes    int64  `json:"sizeBytes"`
	CreatedAt    string `json:"createdAt"`
}

func providerName(p string) string {
	if p == provHF {
		return "Hugging Face"
	}
	return "Cloudflare R2"
}

// gb renders bytes as GB with at most 2 decimals ("—" when unknown).
func gb(b *int64) string {
	if b == nil {
		return "—"
	}
	return format.Num(decimal.NewFromInt(*b).Div(decimal.NewFromInt(1<<30)), 2)
}

// ratio is used/limit clamped to [0,1] for meter bars.
func ratio(used *int64, limit int64) float64 {
	if used == nil || limit <= 0 {
		return 0
	}
	return min(1, float64(*used)/float64(limit))
}

// fileSize: below 1 MB show KB (1 decimal), else MB (2 decimals).
func fileSize(b int64) string {
	d := decimal.NewFromInt(b)
	if b < 1<<20 {
		return format.Num(d.Div(decimal.NewFromInt(1<<10)), 1) + " KB"
	}
	return format.Num(d.Div(decimal.NewFromInt(1<<20)), 2) + " MB"
}

func meter(label, text string, r float64, bad bool) fyne.CanvasObject {
	bar := widget.NewProgressBar()
	bar.TextFormatter = func() string { return "" }
	bar.SetValue(r)
	col := kit.ColorBlue
	if bad {
		col = kit.ColorRed
	}
	return container.NewVBox(container.NewBorder(nil, nil, kit.Muted(label), widget.NewLabel(text)), bar, kit.Rect(col, 1, 2))
}

func usageCard(u storageUsage) fyne.CanvasObject {
	chip := kit.Badge(i18n.T("fileStorage.withinFree"), widget.SuccessImportance)
	switch {
	case !u.Configured:
		chip = kit.Badge(i18n.T("fileStorage.notConfigured"), widget.LowImportance)
	case u.ErrorCode != nil:
		chip = kit.Badge(i18n.T("fileStorage.usageUnavailable"), widget.WarningImportance)
	case u.Exceeded:
		chip = kit.Badge(i18n.T("fileStorage.exceeded"), widget.DangerImportance)
	}
	limit := int64(u.FreeLimitBytes)
	lim := &limit
	body := container.NewVBox(chip,
		meter(i18n.T("fileStorage.used"), gb(u.UsedBytes)+" GB / "+gb(lim)+" GB", ratio(u.UsedBytes, limit), u.Exceeded),
		kv(i18n.T("fileStorage.freeLimit"), gb(lim)+" GB"))
	if o := u.Operations; o != nil {
		body.Add(kit.Heading(i18n.T("fileStorage.opsTitle")))
		switch {
		case o.ErrorCode != nil && *o.ErrorCode == "OPS_TOKEN_MISSING":
			body.Add(kit.Muted(i18n.T("fileStorage.opsTokenMissing")))
		case o.ErrorCode != nil:
			body.Add(kit.Muted(i18n.T("fileStorage.opsUnavailable")))
		default:
			cnt := func(v *int64, l int64) string {
				if v == nil {
					return "— / " + format.Num(decimal.NewFromInt(l), 0)
				}
				return format.Num(decimal.NewFromInt(*v), 0) + " / " + format.Num(decimal.NewFromInt(l), 0)
			}
			over := func(v *int64, l int64) bool { return v != nil && *v > l }
			body.Add(meter("Class A", cnt(o.ClassA, o.ClassAFreeLimit), ratio(o.ClassA, o.ClassAFreeLimit), over(o.ClassA, o.ClassAFreeLimit)))
			body.Add(meter("Class B", cnt(o.ClassB, o.ClassBFreeLimit), ratio(o.ClassB, o.ClassBFreeLimit), over(o.ClassB, o.ClassBFreeLimit)))
		}
	}
	return widget.NewCard(u.Label, "", body)
}

func buildStorage(env *kit.Env) fyne.CanvasObject {
	banner := widget.NewLabel("")
	banner.Importance = widget.DangerImportance
	banner.Wrapping = fyne.TextWrapWord
	setBanner := func(m string) {
		banner.SetText(m)
		if m == "" {
			banner.Hide()
		} else {
			banner.Show()
		}
	}
	setBanner("")

	usageBox := container.NewGridWithColumns(2)
	synced := kit.Muted("")
	loadUsage := func() {
		kit.Async(func(ctx context.Context) ([]storageUsage, error) {
			var out []storageUsage
			return out, env.API.Get(ctx, "admin/file-storage/usage", nil, &out)
		}, func(list []storageUsage, err error) {
			if err != nil {
				setBanner(api.Message(err, i18n.T("fileStorage.loadFailed")))
				return
			}
			usageBox.Objects = nil
			for _, u := range list {
				usageBox.Add(usageCard(u))
			}
			usageBox.Refresh()
			synced.SetText(i18n.T("fileStorage.syncedAt") + ": " + format.TimeShort(time.Now()))
		})
	}
	loadUsage()

	var files *kit.PagedTable[storedFile]
	refresh := func() { loadUsage(); files.Reload() }
	files = kit.NewPagedTable(env, kit.PathSource[storedFile](env, "admin/file-storage/files", nil), kit.PagedOptions{NoSearch: true},
		[]kit.Col[storedFile]{
			{Title: i18n.T("fileStorage.name"), Weight: 3, MinWidth: 160, Text: func(f storedFile) string { return f.OriginalName }},
			{Title: i18n.T("fileStorage.provider"), MinWidth: 120, Cell: func(f storedFile) fyne.CanvasObject {
				return kit.Badge(providerName(f.Provider), widget.MediumImportance)
			}},
			{Title: i18n.T("fileStorage.size"), Text: func(f storedFile) string { return fileSize(f.SizeBytes) }},
			{Title: i18n.T("fileStorage.uploadedAt"), MinWidth: 110, Text: func(f storedFile) string { return format.Timestamp(f.CreatedAt, format.DateTimeShort) }},
		},
		kit.RowAction[storedFile]{Label: i18n.T("fileStorage.download"), Icon: theme.DownloadIcon(), Do: func(f storedFile) {
			kit.Async(func(ctx context.Context) ([]byte, error) {
				b, _, err := env.API.Bytes(ctx, "admin/file-storage/files/"+strconv.FormatInt(f.ID, 10)+"/content", nil)
				return b, err
			}, func(b []byte, err error) {
				if err != nil {
					env.Toast(kit.ToastError, i18n.T("fileStorage.downloadFailed"))
					return
				}
				env.SaveFile(f.OriginalName, b)
			})
		}},
		kit.RowAction[storedFile]{Label: i18n.T("fileStorage.delete"), Icon: theme.DeleteIcon(), Do: func(f storedFile) {
			env.Confirm(i18n.T("fileStorage.deleteConfirm", i18n.P{"name": f.OriginalName}), func() {
				kit.Async(func(ctx context.Context) (struct{}, error) {
					return struct{}{}, env.API.Delete(ctx, "admin/file-storage/files/"+strconv.FormatInt(f.ID, 10), nil)
				}, func(_ struct{}, err error) {
					if err != nil {
						setBanner(api.Message(err, i18n.T("fileStorage.deleteFailed")))
						return
					}
					env.Toast(kit.ToastSuccess, i18n.T("fileStorage.deleted"))
					refresh()
				})
			})
		}})
	files.Table.SetEmpty(i18n.T("fileStorage.empty"))

	// upload panel
	pref := env.Pref(prefPreferred, provR2)
	radio := widget.NewRadioGroup([]string{"Hugging Face", "Cloudflare R2"}, func(s string) {
		if s == "Hugging Face" {
			env.SetPref(prefPreferred, provHF)
		} else {
			env.SetPref(prefPreferred, provR2)
		}
	})
	radio.Horizontal = true
	radio.SetSelected(providerName(pref))
	preferred := func() string {
		if radio.Selected == "Hugging Face" {
			return provHF
		}
		return provR2
	}
	var picked *api.File
	fileLabel := widget.NewLabel("—")
	upload := widget.NewButtonWithIcon(i18n.T("fileStorage.upload"), theme.UploadIcon(), nil)
	upload.Importance = widget.HighImportance
	upload.Disable()
	choose := widget.NewButtonWithIcon(i18n.T("fileStorage.file"), theme.FileIcon(), func() {
		env.ReadPicked(func(f api.File) {
			if len(f.Data) > maxUpload {
				setBanner(i18n.T("fileStorage.tooLarge"))
				return
			}
			setBanner("")
			picked = &f
			fileLabel.SetText(f.Name + " · " + fileSize(int64(len(f.Data))))
			upload.Enable()
		})
	})
	upload.OnTapped = func() {
		if picked == nil {
			return
		}
		f, want := *picked, preferred()
		upload.Disable()
		upload.SetText(i18n.T("fileStorage.uploading"))
		setBanner("")
		kit.Async(func(ctx context.Context) (storedFile, error) {
			var out storedFile
			return out, env.API.Upload(ctx, "admin/file-storage/files", map[string]string{"preferred": want}, "file", []api.File{f}, &out)
		}, func(s storedFile, err error) {
			upload.SetText(i18n.T("fileStorage.upload"))
			upload.Enable()
			if err != nil {
				setBanner(api.Message(err, i18n.T("fileStorage.uploadFailed")))
				return
			}
			picked = nil
			fileLabel.SetText("—")
			upload.Disable()
			key, kind := "fileStorage.uploaded", kit.ToastSuccess
			if s.Provider != want {
				key, kind = "fileStorage.uploadedFallback", kit.ToastInfo
			}
			env.Toast(kind, i18n.T(key, i18n.P{"provider": providerName(s.Provider)}))
			refresh()
		})
	}
	uploadPanel := widget.NewCard(i18n.T("fileStorage.uploadTitle"), "", container.NewVBox(
		widget.NewLabel(i18n.T("fileStorage.preferred")), radio, kit.Muted(i18n.T("fileStorage.fallbackHint")),
		container.NewHBox(choose, fileLabel), kit.Muted(i18n.T("fileStorage.maxSize")), upload))

	sync := widget.NewButtonWithIcon(i18n.T("fileStorage.sync"), theme.ViewRefreshIcon(), loadUsage)
	refreshBtn := widget.NewButtonWithIcon(i18n.T("fileStorage.refresh"), theme.ViewRefreshIcon(), refresh)
	return container.NewVScroll(container.NewVBox(
		kit.PageHeader(i18n.T("fileStorage.eyebrow"), i18n.T("fileStorage.title"), i18n.T("fileStorage.description"), refreshBtn),
		banner,
		container.NewBorder(nil, nil, kit.Heading(i18n.T("fileStorage.usageTitle")), sync, synced),
		usageBox, uploadPanel,
		kit.Heading(i18n.T("fileStorage.filesTitle")), files))
}
