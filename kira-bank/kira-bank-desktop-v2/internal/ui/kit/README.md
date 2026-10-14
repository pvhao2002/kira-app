# kit - shared UI toolkit

Feature packages live in `internal/ui/pages/<feature>/` and export
`func Pages(env *kit.Env) []kit.Page`; add them to `pages/registry.go` (two marked lines).
Do not edit `kit`/`api`; extra helpers go in a NEW file `kit/<feature>_*.go`.

Rules: network off the UI thread (`kit.Async`), widgets only on the UI thread (`fyne.Do`
is applied by `Async`/`Toast`/`ShowError`). Money is `decimal.Decimal` (JSON numbers both ways);
format with `internal/format`, translate with `i18n.T(key, i18n.P{"n": 1})`. Never log tokens/payloads.

## Pages and Env

```go
type Page struct {
    ID string          // route path e.g. "/app/banks" (also the Navigate target)
    Group string       // sidebar group header key: "shell.groupCredit", "shell.groupInvestment", "shell.groupReports",
                       // "shell.groupPersonal", "shell.groupLodging", "shell.groupTutor", "shell.groupAdmin",
                       // "shell.groupSystem", "travel.title", "health.overview"; "" = top level
    TitleKey, MenuKey string // window/page title key; sidebar label key (defaults to TitleKey)
    Icon fyne.Resource
    AdminOnly, Hidden bool   // Hidden = navigable, not in sidebar
    Order int                // order inside group (then registry order)
    Build func() fyne.CanvasObject // called on every navigation; read env.Params() inside
}
type Env struct { API *api.Client; App fyne.App; Window fyne.Window } // + methods:
func (e *Env) User() *api.Profile;  func (e *Env) IsAdmin() bool
func (e *Env) Navigate(id string, params map[string]string)   // UI thread
func (e *Env) Params() map[string]string                      // params of the page being built
func (e *Env) Pref(key, def string) string;  func (e *Env) SetPref(key, val string)
func (e *Env) Toast(kind ToastKind, msg string)               // ToastInfo|ToastSuccess|ToastError, goroutine-safe
func (e *Env) ShowError(err error)                            // toast of api.Message(err, generic), goroutine-safe
func (e *Env) Confirm(message string, onYes func())
func (e *Env) OpenURL(raw string)                             // http(s) only
func (e *Env) SaveFile(filename string, data []byte)          // save dialog
func (e *Env) SaveCSV(filename string, header []string, rows [][]string) // BOM + all cells quoted; toast if no rows
```

Page example:

```go
func Pages(env *kit.Env) []kit.Page {
    return []kit.Page{{ID: "/app/banks", Group: "shell.groupCredit", TitleKey: "route.banks",
        MenuKey: "shell.banks", Order: 60, Build: func() fyne.CanvasObject { return build(env) }}}
}
// Navigate with params:  env.Navigate("/app/banks", map[string]string{"search": q})
// In build():            q := env.Params()["search"]
```

## Async / AsyncView

```go
func Async[T any](work func(ctx context.Context) (T, error), done func(T, error)) // done on UI thread, 60s timeout
func NewAsyncView[T any](env *Env, fetch func(ctx context.Context) (T, error), render func(T) fyne.CanvasObject) *AsyncView[T] // .Reload()
```
```go
kit.Async(func(ctx context.Context) (Bank, error) { var b Bank; return b, env.API.Get(ctx, "public/banks/1", nil, &b) },
    func(b Bank, err error) { if err != nil { env.ShowError(err); return }; label.SetText(b.Name) })
```

## API client (`internal/api`)

```go
c.Get(ctx, path, url.Values, &out); c.Post(ctx, path, in, &out, opts...); c.Put(ctx, path, in, &out)
c.Patch(ctx, path, in, &out); c.Delete(ctx, path, url.Values)         // paths relative to /api/v1/
c.Do(ctx, method, path, q, in, out, api.WithHeader("Idempotency-Key", uuid)) error
api.GetPage[T](ctx, c, path, q, page, size) (api.Page[T], error)       // Page{Data []T; Meta{Page,Size,TotalElements,TotalPages}}
api.GetAll[T](ctx, c, path, q, size) ([]T, error)                      // walks all pages
c.Upload(ctx, path, fields map[string]string, field string, files []api.File, &out) error // multipart; field "files"/"file"
c.Bytes(ctx, path, q) (data []byte, contentType string, err error)     // authed download
api.Message(err, fallback) string;  api.StatusOf(err) int;  *api.ApiError{Status,Code,Message,FieldErrors,TraceID}
```
401 handling (single-flight refresh + one retry) is automatic. DELETE with version: `c.Delete(ctx, "jobs/3", url.Values{"version": {"2"}})`.

## Table with paging

```go
type Col[T any] struct { Title string; Weight, MinWidth float32; Align fyne.TextAlign
                         Text func(T) string; Cell func(T) fyne.CanvasObject }   // Cell overrides Text
type RowAction[T any] struct { Label string; Icon fyne.Resource; Visible func(T) bool; Do func(T) }
type PagedSource[T any] func(ctx context.Context, page, size int, search string) (api.Page[T], error)
func PathSource[T any](env *Env, path string, extra url.Values) PagedSource[T]   // GET path?page&size&search&extra
type PagedOptions struct { Size int; NoSearch bool; Toolbar []fyne.CanvasObject } // Size default 20
func NewPagedTable[T any](env *Env, src PagedSource[T], opt PagedOptions, cols []Col[T], actions ...RowAction[T]) *PagedTable[T]
// PagedTable: .Reload()  .SetSearch(q)  .Table (*Table[T]: .Rows() .SetEmpty(text)); search is debounced 250 ms
func NewTable[T any](cols []Col[T], actions ...RowAction[T]) *Table[T]  // .SetRows(rows) .SetMeta(api.Meta, onPage func(int))
```
```go
t := kit.NewPagedTable(env, kit.PathSource[Song](env, "karaoke/favorite-songs", nil),
    kit.PagedOptions{Toolbar: []fyne.CanvasObject{addBtn}},
    []kit.Col[Song]{{Title: i18n.T("field.title"), Weight: 2, Text: func(s Song) string { return s.Title }}},
    kit.RowAction[Song]{Label: i18n.T("common.edit"), Do: func(s Song) { edit(s) }})
// any other paged shape: write a PagedSource that returns api.Page[T]{Data, Meta}
// after a mutation: t.Reload()
```

## Forms

```go
type Field struct { Key, Label string; Kind FieldKind; Required bool; MaxLen int; Pattern *regexp.Regexp
    Min, Max *decimal.Decimal; MaxFrac int; Options []Option; Initial any; Disabled bool; Hint string
    Validate func(v any) string; OnChange func(f *Form) }
// Kinds: KindText KindTextArea KindPassword KindNumber KindMoney KindDate KindDateTime KindSelect KindCheckbox
// Values (nil when empty -> JSON null): string | decimal.Decimal (Number/Money) | string "yyyy-MM-dd" (Date)
//   | string RFC3339 UTC (DateTime) | string Option.Value (Select) | bool
type Option struct{ Value, Label string };  func Dec(s string) *decimal.Decimal
type FormSpec struct { Title, Description string; Fields []Field; SubmitLabel string
    Submit func(ctx context.Context, values map[string]any) error   // off UI thread; return api error to show inline
    OnSaved func(); Setup func(f *Form) }
func (e *Env) FormDialog(s FormSpec) *Form          // validates (form.required etc.), toasts form.saved, closes
func NewForm(fields []Field) *Form                  // inline use: .Content() .Values() (map, ok)
// Form: Get(key) any; Set(key, v); SetDisabled(key, bool); SetHint(key, text); SetFieldError(key, msg); SetFormError(msg); ShowAPIError(err)
```
```go
env.FormDialog(kit.FormSpec{Title: i18n.T("form.addFavoriteSong"),
    Fields: []kit.Field{{Key: "title", Label: i18n.T("field.title"), Required: true, MaxLen: 255},
                        {Key: "fee", Label: "Fee", Kind: kit.KindMoney, Min: kit.Dec("0.0001")}},
    Submit: func(ctx context.Context, v map[string]any) error { return env.API.Post(ctx, "karaoke/favorite-songs", v, nil) },
    OnSaved: table.Reload})
// edit: put "version" in the map yourself: v["version"] = row.Version; ConcurrentUpdate -> 409 shows api message
```

## MoneyEntry / dates

```go
func NewMoneyEntry(maxFrac int) *MoneyEntry   // Value() (decimal.Decimal, bool); SetValue(d); Clear(); OnValueChanged func()
m := kit.NewMoneyEntry(4); m.SetValue(decimal.RequireFromString("1500000")); amt, ok := m.Value()
func NewDateEntry() *widget.DateEntry          // read .Date (*time.Time); SetDate(&t)
func NewDateTimeEntry() *DateTimeEntry         // Value() (time.Time, bool); SetValue(t); Enable/Disable
```

## Charts

```go
type Series struct { Name string; Color color.Color; Values []float64 }   // floats are for drawing only
func NewBarChart(labels []string, series ...Series) *Chart; func NewLineChart(labels []string, series ...Series) *Chart
// Chart: .Tooltip func(i int) string (hover text); .LabelEvery int; .SetData(labels, series...)
func Legend(series ...Series) fyne.CanvasObject
// colors: kit.ColorBlue ColorRed ColorAmber ColorPurple ColorGreen
ch := kit.NewBarChart(labels, kit.Series{Name: "In", Color: kit.ColorBlue, Values: in.InexactFloat64s...}); ch.Tooltip = tip
box := container.NewVBox(ch, kit.Legend(series...))
```

## Images and uploads

```go
func (e *Env) Image(ref string, size fyne.Size) fyne.CanvasObject  // async + cached; "https://..." anonymous, "/api/..." or same host authed
logo := env.Image(bank.LogoURL, fyne.NewSize(42, 42))

type FileRules struct { MaxFiles int; MaxFileBytes, MaxTotalBytes int64; Accept []string; ErrTooMany, ErrInvalid, ErrTotal string /*i18n keys*/ }
func ImageRules(maxFiles int) FileRules                       // jpeg/png/webp, <=10 MiB each
func NewFilePicker(env *Env, r FileRules) *FilePicker         // .Files() []api.File  .Clear()  .OnChanged
func (e *Env) ReadPicked(onFile func(api.File))               // single file dialog
func ContentTypeOf(name string) string
p := kit.NewFilePicker(env, kit.ImageRules(3))
// submit: env.API.Upload(ctx, "credit-cards/statement-imports", nil, "files", p.Files(), &out)
```
Drag&drop and clipboard-image paste are not implemented (Fyne limitation / deferred).

## CSV export, downloads

```go
env.SaveCSV("karaoke_export.csv", []string{"Title"}, [][]string{{"Song"}})        // UTF-8 BOM, every cell quoted
data, _, err := env.API.Bytes(ctx, "admin/file-storage/files/1/content", nil); env.SaveFile("a.pdf", data)
```

## Small widgets

`Heading(text)`, `Muted(text)`, `Badge(text, widget.Importance)`, `Card(title, subtitle, content)`,
`Tile(caption, value)`, `PageHeader(eyebrow, title, desc, actions...)`, `Sep()`, `Rect(color, w, h)`.
`Surface(content)` (rounded bordered panel), `BrandMark(size)` (the "K" logo square).

## Theme

`theme.go` holds the brand palette (navy/blue/teal, mirroring `kira-bank-ui` `styles.css`) for light and dark, plus
radii/spacing. Extra colour names: `ColorCanvas` (backdrop behind cards), `ColorSidebar`, `ColorAccent` — read with
`theme.Color(kit.ColorCanvas)`. Colours read at build time are refreshed because the shell rebuilds the current page
whenever the theme setting changes.
