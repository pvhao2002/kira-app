package kit

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/i18n"
)

type FieldKind int

const (
	KindText     FieldKind = iota // string
	KindTextArea                  // string
	KindPassword                  // string (not trimmed)
	KindNumber                    // decimal.Decimal
	KindMoney                     // decimal.Decimal
	KindDate                      // string "yyyy-MM-dd"
	KindDateTime                  // string RFC3339 UTC instant
	KindSelect                    // string (Option.Value)
	KindCheckbox                  // bool
)

// Option is a Select choice; Label is shown, Value is submitted.
type Option struct{ Value, Label string }

// Dec parses a decimal literal for Field.Min/Max ("0.0001").
func Dec(s string) *decimal.Decimal { d := decimal.RequireFromString(s); return &d }

// Field describes one form control. Label must already be translated.
// Initial may be string, decimal.Decimal, bool or time.Time matching the kind.
// Empty values come back as nil (JSON null), like the web forms.
type Field struct {
	Key      string
	Label    string
	Kind     FieldKind
	Required bool
	MaxLen   int
	Pattern  *regexp.Regexp
	Min, Max *decimal.Decimal
	MaxFrac  int // Money only; default 4
	Options  []Option
	Initial  any
	Disabled bool
	Hint     string
	Validate func(v any) string // extra check on the parsed value (nil when empty); "" = ok
	OnChange func(f *Form)      // after the user edits this field
}

type control struct {
	obj      fyne.CanvasObject
	get      func() (v any, ok bool) // ok=false: text present but unparsable
	set      func(v any)
	disable  func(bool)
	hint     *widget.Label
	err      *widget.Label
	disabled bool
}

// Form is an inline form usable in a dialog or directly on a page.
type Form struct {
	fields   []Field
	ctl      map[string]*control
	root     *fyne.Container
	formErr  *widget.Label
	inChange bool
}

// NewForm builds the controls. Embed Content() in a page or use Env.FormDialog.
func NewForm(fields []Field) *Form {
	f := &Form{fields: fields, ctl: map[string]*control{}, formErr: widget.NewLabel("")}
	f.formErr.Importance = widget.DangerImportance
	f.formErr.Wrapping = fyne.TextWrapWord
	f.formErr.Hide()
	f.root = container.NewVBox()
	for _, fl := range fields {
		c := f.build(fl)
		f.ctl[fl.Key] = c
		c.hint = Muted(fl.Hint)
		if fl.Hint == "" {
			c.hint.Hide()
		}
		c.err = widget.NewLabel("")
		c.err.Importance = widget.DangerImportance
		c.err.Wrapping = fyne.TextWrapWord
		c.err.Hide()
		if fl.Kind != KindCheckbox {
			lbl := fl.Label
			if fl.Required {
				lbl += " *"
			}
			f.root.Add(widget.NewLabel(lbl))
		}
		f.root.Add(c.obj)
		f.root.Add(c.hint)
		f.root.Add(c.err)
		if fl.Initial != nil {
			f.inChange = true
			c.set(fl.Initial)
			f.inChange = false
		}
		if fl.Disabled {
			f.SetDisabled(fl.Key, true)
		}
	}
	f.root.Add(f.formErr)
	return f
}

// Content is the widget tree to place on a page or in a dialog.
func (f *Form) Content() fyne.CanvasObject { return f.root }

func (f *Form) changed(fl Field) {
	if fl.OnChange == nil || f.inChange {
		return
	}
	f.inChange = true
	defer func() { f.inChange = false }()
	fl.OnChange(f)
}

func (f *Form) build(fl Field) *control {
	ch := func() { f.changed(fl) }
	c := &control{}
	switch fl.Kind {
	case KindMoney:
		frac := fl.MaxFrac
		if frac == 0 {
			frac = 4
		}
		m := NewMoneyEntry(frac)
		m.OnValueChanged = ch
		c.obj = m
		c.get = func() (any, bool) {
			if strings.TrimSpace(m.Text) == "" {
				return nil, true
			}
			d, ok := m.Value()
			return d, ok
		}
		c.set = func(v any) {
			if d, ok := v.(decimal.Decimal); ok {
				m.SetValue(d)
			} else {
				m.Clear()
			}
		}
		c.disable = func(b bool) { setDisabled(&m.Entry, b) }
	case KindNumber:
		e := widget.NewEntry()
		e.OnChanged = func(string) { ch() }
		c.obj = e
		c.get = func() (any, bool) {
			s := strings.TrimSpace(e.Text)
			if s == "" {
				return nil, true
			}
			d, err := decimal.NewFromString(s)
			return d, err == nil
		}
		c.set = func(v any) {
			if d, ok := v.(decimal.Decimal); ok {
				e.SetText(d.String())
			} else {
				e.SetText("")
			}
		}
		c.disable = func(b bool) { setDisabled(e, b) }
	case KindDate:
		d := widget.NewDateEntry()
		d.OnChanged = func(*time.Time) { ch() }
		c.obj = d
		c.get = func() (any, bool) {
			if d.Date == nil {
				return nil, strings.TrimSpace(d.Text) == ""
			}
			return d.Date.Format("2006-01-02"), true
		}
		c.set = func(v any) {
			switch x := v.(type) {
			case string:
				if t, err := time.ParseInLocation("2006-01-02", x, time.Local); err == nil {
					d.SetDate(&t)
				}
			case time.Time:
				d.SetDate(&x)
			default:
				d.SetDate(nil)
			}
		}
		c.disable = func(b bool) {
			if b {
				d.Disable()
			} else {
				d.Enable()
			}
		}
	case KindDateTime:
		d := NewDateTimeEntry()
		d.Date.OnChanged = func(*time.Time) { ch() }
		d.Time.OnChanged = func(string) { ch() }
		c.obj = d
		c.get = func() (any, bool) {
			t, ok := d.Value()
			if !ok {
				return nil, d.Date.Date == nil && strings.TrimSpace(d.Date.Text) == ""
			}
			return t.UTC().Format(time.RFC3339), true
		}
		c.set = func(v any) {
			switch x := v.(type) {
			case time.Time:
				d.SetValue(x)
			case string:
				if t, err := time.Parse(time.RFC3339, x); err == nil {
					d.SetValue(t)
				}
			}
		}
		c.disable = func(b bool) {
			if b {
				d.Disable()
			} else {
				d.Enable()
			}
		}
	case KindSelect:
		var labels []string
		for _, o := range fl.Options {
			labels = append(labels, o.Label)
		}
		s := widget.NewSelect(labels, func(string) { ch() })
		s.PlaceHolder = i18n.T("form.selectPlaceholder")
		c.obj = s
		c.get = func() (any, bool) {
			for _, o := range fl.Options {
				if o.Label == s.Selected {
					return o.Value, true
				}
			}
			return nil, true
		}
		c.set = func(v any) {
			s.ClearSelected()
			for _, o := range fl.Options {
				if x, _ := v.(string); o.Value == x {
					s.SetSelected(o.Label)
				}
			}
		}
		c.disable = func(b bool) {
			if b {
				s.Disable()
			} else {
				s.Enable()
			}
		}
	case KindCheckbox:
		k := widget.NewCheck(fl.Label, func(bool) { ch() })
		c.obj = k
		c.get = func() (any, bool) { return k.Checked, true }
		c.set = func(v any) { b, _ := v.(bool); k.SetChecked(b) }
		c.disable = func(b bool) {
			if b {
				k.Disable()
			} else {
				k.Enable()
			}
		}
	default: // text kinds
		var e *widget.Entry
		switch fl.Kind {
		case KindPassword:
			e = widget.NewPasswordEntry()
		case KindTextArea:
			e = widget.NewMultiLineEntry()
			e.SetMinRowsVisible(4)
		default:
			e = widget.NewEntry()
		}
		e.OnChanged = func(string) { ch() }
		c.obj = e
		c.get = func() (any, bool) {
			s := e.Text
			if fl.Kind != KindPassword {
				s = strings.TrimSpace(s)
			}
			if s == "" {
				return nil, true
			}
			return s, true
		}
		c.set = func(v any) {
			s, _ := v.(string)
			e.SetText(s)
		}
		c.disable = func(b bool) { setDisabled(e, b) }
	}
	return c
}

func setDisabled(e *widget.Entry, b bool) {
	if b {
		e.Disable()
	} else {
		e.Enable()
	}
}

// Get returns the current parsed value of a field (nil when empty/invalid).
func (f *Form) Get(key string) any {
	if c := f.ctl[key]; c != nil {
		v, _ := c.get()
		return v
	}
	return nil
}

// Set programmatically sets a field (does not trigger OnChange).
func (f *Form) Set(key string, v any) {
	if c := f.ctl[key]; c != nil {
		was := f.inChange
		f.inChange = true
		c.set(v)
		f.inChange = was
	}
}

// SetDisabled enables/disables a field; disabled fields are still returned by
// Values but are not validated.
func (f *Form) SetDisabled(key string, b bool) {
	if c := f.ctl[key]; c != nil {
		c.disabled = b
		c.disable(b)
	}
}

// SetHint changes the hint under a field ("" hides it).
func (f *Form) SetHint(key, text string) {
	if c := f.ctl[key]; c != nil {
		c.hint.SetText(text)
		if text == "" {
			c.hint.Hide()
		} else {
			c.hint.Show()
		}
	}
}

// SetFieldError shows an inline error under a field ("" clears it).
func (f *Form) SetFieldError(key, msg string) {
	if c := f.ctl[key]; c != nil {
		c.err.SetText(msg)
		if msg == "" {
			c.err.Hide()
		} else {
			c.err.Show()
		}
	}
}

// SetFormError shows a general error under the form ("" clears it).
func (f *Form) SetFormError(msg string) {
	f.formErr.SetText(msg)
	if msg == "" {
		f.formErr.Hide()
	} else {
		f.formErr.Show()
	}
}

// ShowAPIError maps an API error onto the form: fieldErrors go under their
// fields, everything else becomes the form error (fallback is the generic save error).
func (f *Form) ShowAPIError(err error) {
	var ae *api.ApiError
	if errors.As(err, &ae) {
		for k, m := range ae.FieldErrors {
			f.SetFieldError(k, m)
		}
	}
	f.SetFormError(api.Message(err, i18n.T("form.saveFailed")))
}

// Values validates every enabled field and returns key -> value (nil for empty,
// so the map can be JSON-encoded as a request body). ok=false when invalid;
// inline errors are then shown.
func (f *Form) Values() (map[string]any, bool) {
	out := map[string]any{}
	valid := true
	f.SetFormError("")
	for _, fl := range f.fields {
		c := f.ctl[fl.Key]
		v, parsed := c.get()
		out[fl.Key] = v
		msg := ""
		if !c.disabled {
			msg = fieldError(fl, v, parsed)
		}
		f.SetFieldError(fl.Key, msg)
		if msg != "" {
			valid = false
		}
	}
	return out, valid
}

func fieldError(fl Field, v any, parsed bool) string {
	switch {
	case !parsed:
		return i18n.T("form.invalidFormat")
	case v == nil:
		if fl.Required && fl.Kind != KindCheckbox {
			return i18n.T("form.required")
		}
		return ""
	}
	switch x := v.(type) {
	case string:
		if fl.MaxLen > 0 && utf8.RuneCountInString(x) > fl.MaxLen {
			return i18n.T("form.maxLength", i18n.P{"value": fl.MaxLen})
		}
		if fl.Pattern != nil && !fl.Pattern.MatchString(x) {
			return i18n.T("form.invalidFormat")
		}
	case decimal.Decimal:
		if fl.Min != nil && x.LessThan(*fl.Min) {
			return i18n.T("form.minimum", i18n.P{"value": fl.Min.String()})
		}
		if fl.Max != nil && x.GreaterThan(*fl.Max) {
			return i18n.T("form.maximum", i18n.P{"value": fl.Max.String()})
		}
	}
	if fl.Validate != nil {
		return fl.Validate(v)
	}
	return ""
}

// FormSpec configures Env.FormDialog.
type FormSpec struct {
	Title       string
	Description string
	Fields      []Field
	SubmitLabel string // default common.save
	// Submit runs off the UI thread; return the API error to show it inline.
	Submit func(ctx context.Context, values map[string]any) error
	// OnSaved runs on the UI thread after success (reload your table here).
	OnSaved func()
	// Setup, if set, runs once after the form is built (wire dependent fields).
	Setup func(f *Form)
}

// FormDialog opens a modal form. On success it closes, toasts form.saved and
// calls OnSaved. UI thread.
func (e *Env) FormDialog(s FormSpec) *Form {
	form := NewForm(s.Fields)
	if s.Setup != nil {
		s.Setup(form)
	}
	label := s.SubmitLabel
	if label == "" {
		label = i18n.T("common.save")
	}
	var d *dialog.CustomDialog
	save := widget.NewButton(label, nil)
	save.Importance = widget.HighImportance
	cancel := widget.NewButton(i18n.T("common.cancel"), func() { d.Hide() })
	save.OnTapped = func() {
		vals, ok := form.Values()
		if !ok {
			return
		}
		save.Disable()
		save.SetText(i18n.T("form.saving"))
		Async(func(ctx context.Context) (struct{}, error) { return struct{}{}, s.Submit(ctx, vals) },
			func(_ struct{}, err error) {
				save.Enable()
				save.SetText(label)
				if err != nil {
					form.ShowAPIError(err)
					return
				}
				d.Hide()
				e.Toast(ToastSuccess, i18n.T("form.saved"))
				if s.OnSaved != nil {
					s.OnSaved()
				}
			})
	}
	body := container.NewVBox()
	if s.Description != "" {
		body.Add(Muted(s.Description))
	}
	body.Add(form.Content())
	body.Add(container.NewHBox(cancel, save))
	scroll := container.NewVScroll(container.NewPadded(body))
	d = dialog.NewCustomWithoutButtons(s.Title, scroll, e.Window)
	cs := e.Window.Canvas().Size()
	d.Resize(fyne.NewSize(min(520, cs.Width-40), min(640, cs.Height-60)))
	d.Show()
	return form
}
