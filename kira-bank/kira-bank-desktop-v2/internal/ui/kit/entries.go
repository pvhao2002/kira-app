package kit

import (
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/format"
)

// MoneyEntry is a text entry that groups digits with the locale separator while
// typing and holds a decimal.Decimal. Set OnValueChanged (not OnChanged).
//
// ponytail: reformatting moves the caret to the end; per-digit caret tracking if it annoys.
type MoneyEntry struct {
	widget.Entry
	OnValueChanged func()
	maxFrac        int
	busy           bool
}

// NewMoneyEntry: maxFrac is the max fraction digits (4 for backend amounts, 0 for whole VND).
func NewMoneyEntry(maxFrac int) *MoneyEntry {
	m := &MoneyEntry{maxFrac: maxFrac}
	m.ExtendBaseWidget(m)
	m.Entry.OnChanged = func(s string) {
		if m.busy {
			return
		}
		if r := format.ReformatInput(s, m.maxFrac); r != s {
			m.busy = true
			m.SetText(r)
			m.busy = false
		}
		if m.OnValueChanged != nil {
			m.OnValueChanged()
		}
	}
	return m
}

// Value returns the amount; ok=false when empty.
func (m *MoneyEntry) Value() (decimal.Decimal, bool) { return format.ParseInput(m.Text) }

// SetValue shows d.
func (m *MoneyEntry) SetValue(d decimal.Decimal) { m.SetText(format.Num(d, m.maxFrac)) }

// Clear empties the entry.
func (m *MoneyEntry) Clear() { m.SetText("") }

// NewDateEntry returns the Fyne date entry (calendar popup, OS date format);
// read the chosen day from its Date field (*time.Time, nil when empty).
func NewDateEntry() *widget.DateEntry { return widget.NewDateEntry() }

// DateTimeEntry is a date picker plus an "HH:mm" entry.
type DateTimeEntry struct {
	widget.BaseWidget
	Date *widget.DateEntry
	Time *widget.Entry
}

func NewDateTimeEntry() *DateTimeEntry {
	d := &DateTimeEntry{Date: widget.NewDateEntry(), Time: widget.NewEntry()}
	d.Time.SetPlaceHolder("HH:mm")
	d.ExtendBaseWidget(d)
	return d
}

func (d *DateTimeEntry) CreateRenderer() fyne.WidgetRenderer {
	return widget.NewSimpleRenderer(container.NewBorder(nil, nil, nil, container.NewGridWrap(fyne.NewSize(90, d.Time.MinSize().Height), d.Time), d.Date))
}

// Value returns the chosen local date-time; ok=false when the date is empty or the time invalid
// (an empty time means 00:00).
func (d *DateTimeEntry) Value() (time.Time, bool) {
	if d.Date.Date == nil {
		return time.Time{}, false
	}
	h, m := 0, 0
	if s := strings.TrimSpace(d.Time.Text); s != "" {
		t, err := time.Parse("15:04", s)
		if err != nil {
			return time.Time{}, false
		}
		h, m = t.Hour(), t.Minute()
	}
	y, mo, day := d.Date.Date.Date()
	return time.Date(y, mo, day, h, m, 0, 0, time.Local), true
}

// SetValue shows t in local time.
func (d *DateTimeEntry) SetValue(t time.Time) {
	t = t.In(time.Local)
	d.Date.SetDate(&t)
	d.Time.SetText(t.Format("15:04"))
}

func (d *DateTimeEntry) Enable()  { d.Date.Enable(); d.Time.Enable() }
func (d *DateTimeEntry) Disable() { d.Date.Disable(); d.Time.Disable() }
