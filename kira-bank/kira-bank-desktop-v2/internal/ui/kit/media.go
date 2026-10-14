package kit

import (
	"context"
	"io"
	"path"
	"strings"
	"sync"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
)

var imgCache = struct {
	sync.Mutex
	m map[string]fyne.Resource
}{m: map[string]fyne.Resource{}}

// Image shows a remote image (bank logo, lodging photo) at a fixed size. It is
// loaded asynchronously with the api client (server-relative or same-host URLs
// carry the bearer token) and cached in memory. Broken or empty refs render nothing.
func (e *Env) Image(ref string, size fyne.Size) fyne.CanvasObject {
	img := canvas.NewImageFromResource(nil)
	img.FillMode = canvas.ImageFillContain
	img.SetMinSize(size)
	img.Hide()
	if ref == "" {
		return container.NewGridWrap(size)
	}
	imgCache.Lock()
	res, hit := imgCache.m[ref]
	imgCache.Unlock()
	if hit {
		img.Resource = res
		img.Show()
		return container.NewGridWrap(size, img)
	}
	Async(func(ctx context.Context) (fyne.Resource, error) {
		b, err := e.API.FetchImage(ctx, ref)
		if err != nil {
			return nil, err
		}
		return fyne.NewStaticResource(path.Base(strings.SplitN(ref, "?", 2)[0]), b), nil
	}, func(r fyne.Resource, err error) {
		if err != nil || r == nil {
			return // broken image: stay hidden
		}
		imgCache.Lock()
		if len(imgCache.m) > 300 {
			imgCache.m = map[string]fyne.Resource{}
		}
		imgCache.m[ref] = r
		imgCache.Unlock()
		img.Resource = r
		img.Show()
		img.Refresh()
	})
	return container.NewGridWrap(size, img)
}

// ReadPicked asks for one file with the OS dialog and returns it as api.File. UI thread.
func (e *Env) ReadPicked(onFile func(api.File)) {
	dialog.NewFileOpen(func(r fyne.URIReadCloser, err error) {
		if err != nil {
			e.ShowError(err)
			return
		}
		if r == nil {
			return
		}
		defer r.Close()
		data, err := io.ReadAll(io.LimitReader(r, 64<<20))
		if err != nil {
			e.ShowError(err)
			return
		}
		name := r.URI().Name()
		onFile(api.File{Name: name, ContentType: ContentTypeOf(name), Data: data})
	}, e.Window).Show()
}

// ContentTypeOf maps a file name extension to a MIME type.
func ContentTypeOf(name string) string {
	switch strings.ToLower(path.Ext(name)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".pdf":
		return "application/pdf"
	case ".csv":
		return "text/csv"
	case ".txt":
		return "text/plain"
	}
	return "application/octet-stream"
}

// FileRules constrain a FilePicker. Err* are i18n keys for the messages
// (defaults: the credit-card import wording).
type FileRules struct {
	MaxFiles      int      // 0 = unlimited
	MaxFileBytes  int64    // 0 = unlimited; empty files are always rejected
	MaxTotalBytes int64    // 0 = unlimited
	Accept        []string // allowed MIME types; empty = any
	ErrTooMany    string   // key, gets {max}
	ErrInvalid    string   // key
	ErrTotal      string   // key
}

// ImageRules are the statement/import upload rules: JPEG/PNG/WebP, <=10 MiB each.
func ImageRules(maxFiles int) FileRules {
	return FileRules{MaxFiles: maxFiles, MaxFileBytes: 10 << 20,
		Accept: []string{"image/jpeg", "image/png", "image/webp"}}
}

// FilePicker lets the user build a list of files (one OS dialog per Add click)
// with per-file remove buttons. Read Files() when submitting.
//
// ponytail: no drag&drop / clipboard-paste (Fyne has window-level drop only); add if users ask.
type FilePicker struct {
	widget.BaseWidget
	OnChanged func()
	env       *Env
	rules     FileRules
	files     []api.File
	list      *fyne.Container
	add       *widget.Button
}

func NewFilePicker(env *Env, rules FileRules) *FilePicker {
	p := &FilePicker{env: env, rules: rules, list: container.NewVBox()}
	p.add = widget.NewButtonWithIcon(i18n.T("common.addNew"), theme.ContentAddIcon(), p.pick)
	p.ExtendBaseWidget(p)
	return p
}

func (p *FilePicker) CreateRenderer() fyne.WidgetRenderer {
	return widget.NewSimpleRenderer(container.NewVBox(p.list, p.add))
}

// Files returns the chosen files.
func (p *FilePicker) Files() []api.File { return p.files }

// Clear removes all files.
func (p *FilePicker) Clear() { p.files = nil; p.redraw() }

func (p *FilePicker) pick() {
	p.env.ReadPicked(func(f api.File) {
		if msg := p.check(f); msg != "" {
			p.env.Toast(ToastError, msg)
			return
		}
		p.files = append(p.files, f)
		p.redraw()
	})
}

func (p *FilePicker) check(f api.File) string {
	r := p.rules
	key := func(k, def string) string {
		if k == "" {
			return def
		}
		return k
	}
	if r.MaxFiles > 0 && len(p.files) >= r.MaxFiles {
		return i18n.T(key(r.ErrTooMany, "cardImport.errorTooManyFiles"), i18n.P{"max": r.MaxFiles})
	}
	size := int64(len(f.Data))
	okType := len(r.Accept) == 0
	for _, a := range r.Accept {
		okType = okType || a == f.ContentType
	}
	if size == 0 || !okType || (r.MaxFileBytes > 0 && size > r.MaxFileBytes) {
		return i18n.T(key(r.ErrInvalid, "cardImport.errorInvalidFiles"))
	}
	if r.MaxTotalBytes > 0 {
		total := size
		for _, x := range p.files {
			total += int64(len(x.Data))
		}
		if total > r.MaxTotalBytes {
			return i18n.T(key(r.ErrTotal, "investmentTransactions.errorTotalSize"))
		}
	}
	return ""
}

func (p *FilePicker) redraw() {
	p.list.Objects = nil
	for i, f := range p.files {
		i := i
		rm := widget.NewButtonWithIcon("", theme.DeleteIcon(), func() {
			p.files = append(p.files[:i:i], p.files[i+1:]...)
			p.redraw()
		})
		rm.Importance = widget.LowImportance
		p.list.Add(container.NewBorder(nil, nil, widget.NewIcon(theme.FileImageIcon()), rm, widget.NewLabel(f.Name)))
	}
	if p.rules.MaxFiles > 0 && len(p.files) >= p.rules.MaxFiles {
		p.add.Disable()
	} else {
		p.add.Enable()
	}
	p.list.Refresh()
	if p.OnChanged != nil {
		p.OnChanged()
	}
}
