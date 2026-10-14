package kit

import (
	"context"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/i18n"
)

// Async runs work off the UI thread (60s timeout) and delivers the result to
// done on the UI thread via fyne.Do. Call it from the UI thread or any goroutine.
func Async[T any](work func(ctx context.Context) (T, error), done func(T, error)) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		v, err := work(ctx)
		fyne.Do(func() { done(v, err) })
	}()
}

// AsyncView loads data with fetch, shows a progress bar while loading, an error
// line with a Retry button on failure (keeping the previous content), and
// renders the data with render. Stale responses are ignored.
type AsyncView[T any] struct {
	widget.BaseWidget
	env    *Env
	fetch  func(ctx context.Context) (T, error)
	render func(T) fyne.CanvasObject
	status *fyne.Container
	body   *fyne.Container
	seq    int
	loaded bool
}

// NewAsyncView builds the view and starts the first load.
func NewAsyncView[T any](env *Env, fetch func(ctx context.Context) (T, error), render func(T) fyne.CanvasObject) *AsyncView[T] {
	v := &AsyncView[T]{env: env, fetch: fetch, render: render,
		status: container.NewVBox(), body: container.NewStack()}
	v.ExtendBaseWidget(v)
	v.Reload()
	return v
}

func (v *AsyncView[T]) CreateRenderer() fyne.WidgetRenderer {
	return widget.NewSimpleRenderer(container.NewBorder(v.status, nil, nil, nil, v.body))
}

// Reload fetches again. UI thread.
func (v *AsyncView[T]) Reload() {
	v.seq++
	seq := v.seq
	v.status.Objects = []fyne.CanvasObject{widget.NewProgressBarInfinite()}
	v.status.Refresh()
	Async(v.fetch, func(data T, err error) {
		if seq != v.seq {
			return
		}
		if err != nil {
			v.env.ShowError(err)
			msg := widget.NewLabel(i18n.T("overview.loadFailed"))
			msg.Importance = widget.DangerImportance
			v.status.Objects = []fyne.CanvasObject{container.NewHBox(msg, widget.NewButton(i18n.T("overview.retry"), v.Reload))}
			v.status.Refresh()
			return
		}
		v.loaded = true
		v.status.Objects = nil
		v.status.Refresh()
		v.body.Objects = []fyne.CanvasObject{v.render(data)}
		v.body.Refresh()
	})
}
