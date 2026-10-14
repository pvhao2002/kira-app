// Package tutor is the teaching schedule (/app/tutor-schedule): week calendar,
// agenda, students, recurring series and single-occurrence exceptions.
// All times are Asia/Ho_Chi_Minh (UTC+7), weeks start on Monday.
package tutor

import (
	"context"
	"errors"
	"fmt"
	"image/color"
	"strconv"
	"strings"
	"sync"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type student struct {
	ID      int64   `json:"id"`
	Name    string  `json:"name"`
	Phone   *string `json:"phone"`
	Color   string  `json:"color"`
	Note    *string `json:"note"`
	Version int64   `json:"version"`
}

type lesson struct {
	SeriesID         int64           `json:"seriesId"`
	SeriesVersion    int64           `json:"seriesVersion"`
	StudentID        int64           `json:"studentId"`
	StudentName      string          `json:"studentName"`
	StudentColor     string          `json:"studentColor"`
	OriginalDate     string          `json:"originalDate"`
	Date             string          `json:"date"`
	StartTime        string          `json:"startTime"`
	EndTime          string          `json:"endTime"`
	Subject          string          `json:"subject"`
	TeachingMode     string          `json:"teachingMode"`
	Location         *string         `json:"location"`
	Fee              decimal.Decimal `json:"fee"`
	Note             *string         `json:"note"`
	ExceptionAction  *string         `json:"exceptionAction"`
	ExceptionVersion *int64          `json:"exceptionVersion"`
	Cancelled        bool            `json:"cancelled"`
	Conflict         bool            `json:"conflict"`
}

type week struct {
	WeekStart   string          `json:"weekStart"`
	WeekEnd     string          `json:"weekEnd"`
	ReadOnly    bool            `json:"readOnly"`
	LessonCount int             `json:"lessonCount"`
	TotalHours  decimal.Decimal `json:"totalHours"`
	TotalFee    decimal.Decimal `json:"totalFee"`
	Conflicts   []struct {
		Description string `json:"description"`
	} `json:"conflicts"`
	Lessons []lesson `json:"lessons"`
}

type loaded struct {
	w *week
	s []student
}

const (
	conflictCode = "TUTOR_SCHEDULE_CONFLICT"
	dateLayout   = "2006-01-02"
	hourH        = 64   // dp per hour in the week grid
	gutterW      = 52.0 // time gutter width
)

var palette = []string{"#2563EB", "#7C3AED", "#DB2777", "#EA580C", "#059669", "#0891B2"}

// Pages registers the schedule in the Tutoring group.
func Pages(env *kit.Env) []kit.Page {
	return []kit.Page{{ID: "/app/tutor-schedule", Group: "shell.groupTutor", TitleKey: "route.tutorSchedule",
		MenuKey: "shell.tutorSchedule", Icon: theme.HistoryIcon(), Order: 10,
		Build: func() fyne.CanvasObject { return build(env) }}}
}

type page struct {
	env       *kit.Env
	weekStart time.Time
	week      *week
	students  []student
	agenda    bool
	fullDay   bool
	loading   bool
	failed    bool
	seq       int

	body       *fyne.Container
	addBtn     *widget.Button
	onStudents func() // refreshes an open students dialog
}

func mondayOf(t time.Time) time.Time {
	t = t.In(format.ICT)
	d := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, format.ICT)
	return d.AddDate(0, 0, -((int(d.Weekday()) + 6) % 7))
}

func build(env *kit.Env) fyne.CanvasObject {
	p := &page{env: env, weekStart: mondayOf(time.Now()), body: container.NewVBox()}
	p.addBtn = widget.NewButtonWithIcon(i18n.T("tutor.addLesson"), theme.ContentAddIcon(), func() { p.addLesson(p.weekStart) })
	p.addBtn.Importance = widget.HighImportance
	p.addBtn.Disable()
	studentsBtn := widget.NewButtonWithIcon(i18n.T("tutor.students"), theme.AccountIcon(), p.studentsDialog)

	p.loadAll()
	return container.NewBorder(
		kit.PageHeader(i18n.T("tutor.eyebrow"), i18n.T("tutor.title"), i18n.T("tutor.description"), studentsBtn, p.addBtn),
		nil, nil, nil, container.NewVScroll(p.body))
}

func (p *page) canEdit() bool { return p.week != nil && !p.loading && !p.week.ReadOnly }

func (p *page) loadAll() {
	p.seq++
	seq := p.seq
	p.loading, p.failed = true, false
	p.render()
	ws := p.weekStart.Format(dateLayout)
	kit.Async(func(ctx context.Context) (loaded, error) {
		var (
			l      loaded
			wk     week
			e1, e2 error
			wg     sync.WaitGroup
		)
		wg.Add(2)
		go func() {
			defer wg.Done()
			e1 = p.env.API.Get(ctx, "tutoring/week", map[string][]string{"weekStart": {ws}}, &wk)
		}()
		go func() { defer wg.Done(); e2 = p.env.API.Get(ctx, "tutoring/students", nil, &l.s) }()
		wg.Wait()
		l.w = &wk
		return l, errors.Join(e1, e2)
	}, func(l loaded, err error) {
		if seq != p.seq {
			return
		}
		p.loading = false
		if err != nil {
			p.failed = true
			p.env.Toast(kit.ToastError, api.Message(err, i18n.T("tutor.loadFailed")))
		} else {
			p.week, p.students = l.w, l.s
		}
		p.render()
		if p.onStudents != nil {
			p.onStudents()
		}
	})
}

// ---- rendering ----

func (p *page) render() {
	if p.canEdit() {
		p.addBtn.Enable()
	} else {
		p.addBtn.Disable()
	}
	prev := widget.NewButtonWithIcon("", theme.NavigateBackIcon(), func() { p.shift(-7) })
	next := widget.NewButtonWithIcon("", theme.NavigateNextIcon(), func() { p.shift(7) })
	today := widget.NewButton(i18n.T("tutor.today"), func() { p.weekStart = mondayOf(time.Now()); p.loadAll() })
	title := kit.Heading(format.DateDMY(p.weekStart) + " – " + format.DateDMY(p.weekStart.AddDate(0, 0, 6)))
	view := widget.NewRadioGroup([]string{i18n.T("tutor.weekView"), i18n.T("tutor.agendaView")}, func(s string) {
		p.agenda = s == i18n.T("tutor.agendaView")
		p.render()
	})
	view.Horizontal = true
	if p.agenda {
		view.Selected = i18n.T("tutor.agendaView")
	} else {
		view.Selected = i18n.T("tutor.weekView")
	}
	objs := []fyne.CanvasObject{
		container.NewHBox(prev, today, next, title, kit.Muted(i18n.T("tutor.timezone")+" · UTC+7"), view),
	}
	if p.loading {
		objs = append(objs, widget.NewProgressBarInfinite())
	}
	if p.failed {
		objs = append(objs, container.NewHBox(widget.NewLabel(i18n.T("tutor.loadFailed")), widget.NewButton(i18n.T("tutor.retry"), p.loadAll)))
	}
	if p.week != nil {
		w := p.week
		if w.ReadOnly {
			objs = append(objs, kit.Muted(i18n.T("tutor.pastReadOnly")))
		}
		objs = append(objs, container.NewGridWithColumns(4,
			kit.Tile(i18n.T("tutor.lessonCount"), strconv.Itoa(w.LessonCount)),
			kit.Tile(i18n.T("tutor.totalHours"), format.Num(w.TotalHours, 2)),
			kit.Tile(i18n.T("tutor.expectedFee"), format.Money(w.TotalFee, "VND")),
			kit.Tile(i18n.T("tutor.conflicts"), strconv.Itoa(len(w.Conflicts)))))
		if len(p.students) == 0 && !p.loading {
			add := widget.NewButton(i18n.T("tutor.addStudent"), p.studentsDialog)
			objs = append(objs, kit.Heading(i18n.T("tutor.noStudents")), kit.Muted(i18n.T("tutor.noStudentsDescription")), add)
		}
		if p.agenda {
			objs = append(objs, p.agendaView())
		} else {
			full := widget.NewCheck(i18n.T("tutor.showFullDay"), func(b bool) { p.fullDay = b; p.render() })
			full.SetChecked(p.fullDay)
			hint := i18n.T("tutor.focusHoursHint")
			if p.fullDay {
				hint = i18n.T("tutor.fullDayHint")
			}
			objs = append(objs, container.NewHBox(full, kit.Muted(hint)), p.calendar())
		}
	}
	p.body.Objects = objs
	p.body.Refresh()
}

func (p *page) shift(days int) {
	p.weekStart = p.weekStart.AddDate(0, 0, days)
	p.loadAll()
}

var viShort = []string{"CN", "T2", "T3", "T4", "T5", "T6", "T7"}

func dayLabel(t time.Time) string {
	wd := t.Weekday().String()[:3]
	if i18n.Lang() == "vi" {
		wd = viShort[t.Weekday()]
	}
	return wd + " " + format.DateShort(t)
}

func minutes(hhmm string) int {
	h, _ := strconv.Atoi(hhmm[:2])
	m, _ := strconv.Atoi(hhmm[3:5])
	return h*60 + m
}

func hex(c string) color.Color {
	if len(c) == 7 && c[0] == '#' {
		if v, err := strconv.ParseUint(c[1:], 16, 32); err == nil {
			return color.NRGBA{uint8(v >> 16), uint8(v >> 8), uint8(v), 255}
		}
	}
	return color.NRGBA{0x25, 0x63, 0xEB, 255}
}

func (p *page) byDate() map[string][]lesson {
	m := map[string][]lesson{}
	for _, l := range p.week.Lessons {
		m[l.Date] = append(m[l.Date], l)
	}
	return m
}

// ---- free-position layout ----

type placeFn func(size fyne.Size) (fyne.Position, fyne.Size)

type freeLayout struct {
	fns map[fyne.CanvasObject]placeFn
	min fyne.Size
}

func (l *freeLayout) Layout(objs []fyne.CanvasObject, size fyne.Size) {
	for _, o := range objs {
		if f := l.fns[o]; f != nil {
			pos, sz := f(size)
			o.Move(pos)
			o.Resize(sz)
		}
	}
}
func (l *freeLayout) MinSize([]fyne.CanvasObject) fyne.Size { return l.min }

func (l *freeLayout) add(c *fyne.Container, o fyne.CanvasObject, f placeFn) {
	l.fns[o] = f
	c.Add(o)
}

func colX(size fyne.Size, day int) (x, w float32) {
	w = (size.Width - gutterW) / 7
	return gutterW + float32(day)*w, w
}

// tap is a transparent tappable overlay.
type tap struct {
	widget.BaseWidget
	on func()
}

func newTap(on func()) *tap            { t := &tap{on: on}; t.ExtendBaseWidget(t); return t }
func (t *tap) Tapped(*fyne.PointEvent) { t.on() }
func (t *tap) CreateRenderer() fyne.WidgetRenderer {
	return widget.NewSimpleRenderer(canvas.NewRectangle(color.Transparent))
}

func (p *page) calendar() fyne.CanvasObject {
	by := p.byDate()
	var spans []Span
	for _, l := range p.week.Lessons {
		spans = append(spans, Span{minutes(l.StartTime), minutes(l.EndTime), l.SeriesID})
	}
	rs, re := HourRange(p.fullDay, spans)
	rows := re - rs + 1

	// header
	hl := &freeLayout{fns: map[fyne.CanvasObject]placeFn{}, min: fyne.NewSize(gutterW+7*100, 64)}
	header := container.New(hl)
	hl.add(header, widget.NewLabel("UTC+7"), func(s fyne.Size) (fyne.Position, fyne.Size) {
		return fyne.NewPos(0, 0), fyne.NewSize(gutterW, s.Height)
	})
	todayStr := time.Now().In(format.ICT).Format(dateLayout)
	for i := 0; i < 7; i++ {
		i := i
		d := p.weekStart.AddDate(0, 0, i)
		ds := d.Format(dateLayout)
		lbl := widget.NewLabelWithStyle(dayLabel(d), fyne.TextAlignCenter, fyne.TextStyle{Bold: ds == todayStr})
		if ds == todayStr {
			lbl.Importance = widget.HighImportance
		}
		box := container.NewVBox(lbl,
			widget.NewLabelWithStyle(strconv.Itoa(len(by[ds]))+" "+i18n.T("tutor.lessonsUnit"), fyne.TextAlignCenter, fyne.TextStyle{}))
		if p.canEdit() {
			box.Add(widget.NewButtonWithIcon("", theme.ContentAddIcon(), func() { p.addLesson(d) }))
		}
		hl.add(header, box, func(s fyne.Size) (fyne.Position, fyne.Size) {
			x, w := colX(s, i)
			return fyne.NewPos(x, 0), fyne.NewSize(w, s.Height)
		})
	}

	// grid
	gl := &freeLayout{fns: map[fyne.CanvasObject]placeFn{}, min: fyne.NewSize(gutterW+7*100, float32(rows*hourH))}
	grid := container.New(gl)
	line := color.NRGBA{128, 128, 128, 60}
	for h := 0; h < rows; h++ {
		h := h
		gl.add(grid, canvas.NewRectangle(line), func(s fyne.Size) (fyne.Position, fyne.Size) {
			return fyne.NewPos(0, float32(h*hourH)), fyne.NewSize(s.Width, 1)
		})
		t := widget.NewLabel(fmt.Sprintf("%02d:00", rs+h))
		t.Importance = widget.LowImportance
		gl.add(grid, t, func(s fyne.Size) (fyne.Position, fyne.Size) {
			return fyne.NewPos(0, float32(h*hourH)), fyne.NewSize(gutterW, 30)
		})
	}
	for i := 1; i < 7; i++ {
		i := i
		gl.add(grid, canvas.NewRectangle(line), func(s fyne.Size) (fyne.Position, fyne.Size) {
			x, _ := colX(s, i)
			return fyne.NewPos(x, 0), fyne.NewSize(1, s.Height)
		})
	}
	for i := 0; i < 7; i++ {
		i := i
		day := by[p.weekStart.AddDate(0, 0, i).Format(dateLayout)]
		ds := make([]Span, len(day))
		for k, l := range day {
			ds[k] = Span{minutes(l.StartTime), minutes(l.EndTime), l.SeriesID}
		}
		pl := Columns(ds)
		for k, l := range day {
			l, pk, sp := l, pl[k], ds[k]
			gl.add(grid, p.card(l), func(s fyne.Size) (fyne.Position, fyne.Size) {
				x, w := colX(s, i)
				sub := w / float32(pk.Cols)
				top := float32(sp.Start-rs*60) * hourH / 60
				h := max(42, float32(max(30, sp.End-sp.Start))*hourH/60-4)
				return fyne.NewPos(x+float32(pk.Col)*sub+4, top), fyne.NewSize(sub-8, h)
			})
		}
	}
	return container.NewVBox(header, grid)
}

func (p *page) card(l lesson) fyne.CanvasObject {
	c := hex(l.StudentColor).(color.NRGBA)
	c.A = 70
	if l.Cancelled {
		c.A = 25
	}
	bg := canvas.NewRectangle(c)
	bg.CornerRadius = 6
	bg.StrokeColor = hex(l.StudentColor)
	bg.StrokeWidth = 1
	mk := func(t string, bold bool) *widget.Label {
		x := widget.NewLabelWithStyle(t, fyne.TextAlignLeading, fyne.TextStyle{Bold: bold})
		x.Truncation = fyne.TextTruncateEllipsis
		if l.Cancelled {
			x.Importance = widget.LowImportance
		}
		return x
	}
	box := container.NewVBox(mk(format.HHmm(l.StartTime)+"–"+format.HHmm(l.EndTime), true), mk(l.StudentName, true), mk(l.Subject, false))
	if st := p.status(l); st != "" {
		box.Add(mk(st, false))
	}
	return container.NewStack(bg, box, newTap(func() { p.lessonTapped(l) }))
}

func (p *page) status(l lesson) string {
	var parts []string
	if l.Conflict {
		parts = append(parts, i18n.T("tutor.conflicts"))
	}
	if l.ExceptionAction != nil {
		if l.Cancelled || *l.ExceptionAction == "CANCEL" {
			parts = append(parts, i18n.T("tutor.cancelled"))
		} else {
			parts = append(parts, i18n.T("tutor.movedOnce"))
		}
	}
	return strings.Join(parts, " · ")
}

func (p *page) lessonTapped(l lesson) {
	switch {
	case l.Cancelled && p.canEdit():
		p.restore(l)
	case !l.Cancelled:
		p.lessonDialog(&l, l.Date)
	}
}

func (p *page) agendaView() fyne.CanvasObject {
	by := p.byDate()
	box := container.NewVBox()
	todayStr := time.Now().In(format.ICT).Format(dateLayout)
	for i := 0; i < 7; i++ {
		d := p.weekStart.AddDate(0, 0, i)
		ds := d.Format(dateLayout)
		inner := container.NewVBox()
		if len(by[ds]) == 0 {
			inner.Add(kit.Muted(i18n.T("tutor.noLesson")))
		}
		for _, l := range by[ds] {
			l := l
			mode := i18n.T("tutor.inPerson")
			if l.TeachingMode == "ONLINE" {
				mode = i18n.T("tutor.online")
			}
			info := container.NewVBox(
				widget.NewLabelWithStyle(format.HHmm(l.StartTime)+"–"+format.HHmm(l.EndTime)+"  "+l.StudentName, fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
				kit.Muted(l.Subject+" · "+mode))
			if loc := strOf(l.Location); loc != "" {
				info.Add(kit.Muted(loc))
			}
			if st := p.status(l); st != "" {
				info.Add(kit.Muted(st))
			}
			right := container.NewHBox(widget.NewLabel(format.Money(l.Fee, "VND")))
			if l.Cancelled && l.ExceptionVersion != nil && p.canEdit() {
				right.Add(widget.NewButton(i18n.T("tutor.restore"), func() { p.restore(l) }))
			}
			open := widget.NewButton(i18n.T("common.edit"), func() { p.lessonTapped(l) })
			if l.Cancelled {
				open.Disable()
			}
			right.Add(open)
			dot := kit.Rect(hex(l.StudentColor), 6, 40)
			inner.Add(container.NewBorder(nil, nil, dot, right, info))
		}
		title := dayLabel(d)
		if ds == todayStr {
			title += " · " + i18n.T("tutor.today")
		}
		var action fyne.CanvasObject
		if p.canEdit() {
			action = widget.NewButtonWithIcon(i18n.T("tutor.add"), theme.ContentAddIcon(), func() { p.addLesson(d) })
		}
		card := widget.NewCard(title, "", inner)
		if action != nil {
			card = widget.NewCard(title, "", container.NewVBox(action, inner))
		}
		box.Add(card)
	}
	return box
}

func strOf(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// ---- mutations ----

// run performs a request, handling the 409 TUTOR_SCHEDULE_CONFLICT confirm-and-retry flow.
// done gets nil on success, the error otherwise, and (false,nil) is not reported when the user declines.
func (p *page) run(do func(ctx context.Context, confirm bool) error, done func(err error), declined func()) {
	kit.Async(func(ctx context.Context) (struct{}, error) { return struct{}{}, do(ctx, false) }, func(_ struct{}, err error) {
		var ae *api.ApiError
		if errors.As(err, &ae) && ae.Status == 409 && ae.Code == conflictCode {
			dialog.NewConfirm("", i18n.T("tutor.conflictConfirm"), func(ok bool) {
				if !ok {
					declined()
					return
				}
				kit.Async(func(ctx context.Context) (struct{}, error) { return struct{}{}, do(ctx, true) },
					func(_ struct{}, err error) { done(err) })
			}, p.env.Window).Show()
			return
		}
		done(err)
	})
}

// afterOK reloads and toasts on success; errors toast with the generic save text.
func (p *page) afterOK(err error) {
	if err != nil {
		p.env.Toast(kit.ToastError, api.Message(err, i18n.T("tutor.saveFailed")))
		return
	}
	p.env.Toast(kit.ToastSuccess, i18n.T("tutor.saved"))
	p.loadAll()
}

func (p *page) restore(l lesson) {
	if l.ExceptionVersion == nil {
		return
	}
	path := fmt.Sprintf("tutoring/series/%d/occurrences/%s", l.SeriesID, l.OriginalDate)
	p.run(func(ctx context.Context, c bool) error {
		return p.env.API.Do(ctx, "DELETE", path, nil, map[string]any{"version": *l.ExceptionVersion, "confirmConflict": c}, nil)
	}, p.afterOK, func() {})
}

func (p *page) cancelOnce(l lesson, onDone func(error), declined func()) {
	path := fmt.Sprintf("tutoring/series/%d/occurrences/%s", l.SeriesID, l.OriginalDate)
	p.run(func(ctx context.Context, c bool) error {
		body := map[string]any{"action": "CANCEL", "movedDate": nil, "movedStartTime": nil, "movedEndTime": nil,
			"version": l.ExceptionVersion, "confirmConflict": c}
		return p.env.API.Put(ctx, path, body, nil)
	}, onDone, declined)
}

func (p *page) deleteFuture(l lesson, onDone func(error)) {
	path := fmt.Sprintf("tutoring/series/%d", l.SeriesID)
	p.run(func(ctx context.Context, _ bool) error {
		return p.env.API.Do(ctx, "DELETE", path, nil, map[string]any{"effectiveFrom": p.weekStart.Format(dateLayout), "version": l.SeriesVersion}, nil)
	}, onDone, func() {})
}

// ---- lesson dialog ----

var timeRe = timePattern()

func (p *page) addLesson(day time.Time) {
	if len(p.students) == 0 {
		p.studentsDialog()
		return
	}
	p.lessonDialog(nil, day.Format(dateLayout))
}

func validTime(v any) string {
	s, _ := v.(string)
	if s == "" {
		return ""
	}
	m := minutes(s)
	if m < 360 || m > 1380 {
		return i18n.T("tutor.timeInvalid")
	}
	return ""
}

func (p *page) lessonDialog(l *lesson, date string) {
	opts := make([]kit.Option, len(p.students))
	for i, s := range p.students {
		opts[i] = kit.Option{Value: strconv.FormatInt(s.ID, 10), Label: s.Name}
	}
	init := lesson{StartTime: "18:00", EndTime: "19:30", TeachingMode: "IN_PERSON", Date: date}
	title := i18n.T("tutor.addLesson")
	var studentInit, feeInit any
	if l != nil {
		init, title = *l, i18n.T("tutor.editLesson")
		studentInit = strconv.FormatInt(l.StudentID, 10)
		feeInit = l.Fee
	}
	ws, we := p.weekStart, p.weekStart.AddDate(0, 0, 6).Format(dateLayout)
	dis := !p.canEdit()
	locLabel := func(mode string) string {
		if mode == "ONLINE" {
			return i18n.T("tutor.meetingLink")
		}
		return i18n.T("tutor.location")
	}
	form := kit.NewForm([]kit.Field{
		{Key: "studentId", Label: i18n.T("tutor.student"), Kind: kit.KindSelect, Required: true, Options: opts, Initial: studentInit, Disabled: dis},
		{Key: "subject", Label: i18n.T("tutor.subject"), Required: true, MaxLen: 150, Initial: strOrNil(init.Subject), Disabled: dis},
		{Key: "date", Label: i18n.T("tutor.date"), Kind: kit.KindDate, Required: true, Initial: init.Date, Disabled: dis,
			Validate: func(v any) string {
				if s, _ := v.(string); s < ws.Format(dateLayout) || s > we {
					return i18n.T("form.invalidValue")
				}
				return ""
			}},
		{Key: "startTime", Label: i18n.T("tutor.start"), Required: true, Pattern: timeRe, Initial: format.HHmm(init.StartTime), Disabled: dis, Validate: validTime},
		{Key: "endTime", Label: i18n.T("tutor.end"), Required: true, Pattern: timeRe, Initial: format.HHmm(init.EndTime), Disabled: dis, Validate: validTime},
		{Key: "teachingMode", Label: i18n.T("tutor.mode"), Kind: kit.KindSelect, Required: true, Initial: init.TeachingMode, Disabled: dis,
			Options: []kit.Option{{Value: "IN_PERSON", Label: i18n.T("tutor.inPerson")}, {Value: "ONLINE", Label: i18n.T("tutor.online")}}},
		{Key: "location", Label: locLabel(init.TeachingMode), MaxLen: 500, Initial: strOrNil(strOf(init.Location)), Disabled: dis},
		{Key: "fee", Label: i18n.T("tutor.fee"), Kind: kit.KindMoney, MaxFrac: 0, Min: kit.Dec("0"), Initial: feeInit, Disabled: dis},
		{Key: "note", Label: i18n.T("tutor.note"), Kind: kit.KindTextArea, MaxLen: 2000, Initial: strOrNil(strOf(init.Note)), Disabled: dis},
	})
	onceOnly := []string{"studentId", "subject", "teachingMode", "location", "fee", "note"}

	body := container.NewVBox()
	once := false
	if l != nil {
		hint := kit.Muted(i18n.T("tutor.onceHint"))
		hint.Hide()
		scope := widget.NewRadioGroup([]string{i18n.T("tutor.fromThisWeek"), i18n.T("tutor.onlyThisLesson")}, nil)
		scope.Selected = i18n.T("tutor.fromThisWeek")
		scope.OnChanged = func(s string) {
			once = s == i18n.T("tutor.onlyThisLesson")
			for _, k := range onceOnly {
				form.SetDisabled(k, once || dis)
			}
			if once {
				hint.Show()
			} else {
				hint.Hide()
			}
		}
		body.Add(scope)
		body.Add(hint)
	}
	body.Add(form.Content())

	var d *dialog.CustomDialog
	save := widget.NewButton(i18n.T("common.save"), nil)
	save.Importance = widget.HighImportance
	cancel := widget.NewButton(i18n.T("common.cancel"), func() { d.Hide() })
	busy := func(b bool) {
		if b {
			save.Disable()
			save.SetText(i18n.T("tutor.saving"))
		} else {
			save.Enable()
			save.SetText(i18n.T("common.save"))
		}
	}
	finish := func(err error) {
		busy(false)
		if err != nil {
			form.SetFormError(api.Message(err, i18n.T("tutor.saveFailed")))
			return
		}
		d.Hide()
		p.afterOK(nil)
	}
	save.OnTapped = func() {
		v, ok := form.Values()
		if !ok {
			return
		}
		st, _ := v["startTime"].(string)
		en, _ := v["endTime"].(string)
		if minutes(en) <= minutes(st) {
			form.SetFieldError("endTime", i18n.T("tutor.timeInvalid"))
			return
		}
		date, _ := v["date"].(string)
		busy(true)
		if l != nil && once {
			path := fmt.Sprintf("tutoring/series/%d/occurrences/%s", l.SeriesID, l.OriginalDate)
			p.run(func(ctx context.Context, c bool) error {
				return p.env.API.Put(ctx, path, map[string]any{"action": "MOVE", "movedDate": date, "movedStartTime": st,
					"movedEndTime": en, "version": l.ExceptionVersion, "confirmConflict": c}, nil)
			}, finish, func() { busy(false) })
			return
		}
		dt, err := time.Parse(dateLayout, date)
		if err != nil {
			busy(false)
			return
		}
		sid, _ := strconv.ParseInt(fmt.Sprint(v["studentId"]), 10, 64)
		var version any
		method, path := "POST", "tutoring/series"
		if l != nil {
			version = l.SeriesVersion
			method, path = "PUT", fmt.Sprintf("tutoring/series/%d", l.SeriesID)
		}
		p.run(func(ctx context.Context, c bool) error {
			req := map[string]any{"studentId": sid, "dayOfWeek": (int(dt.Weekday())+6)%7 + 1, "startTime": st, "endTime": en,
				"subject": v["subject"], "teachingMode": v["teachingMode"], "location": v["location"], "fee": feeOrZero(v["fee"]),
				"note": v["note"], "effectiveFrom": p.weekStart.Format(dateLayout), "version": version, "confirmConflict": c}
			return p.env.API.Do(ctx, method, path, nil, req, nil)
		}, finish, func() { busy(false) })
	}

	buttons := container.NewHBox()
	if l != nil && p.canEdit() {
		df := widget.NewButton(i18n.T("tutor.deleteFuture"), func() {
			p.env.Confirm(i18n.T("tutor.deleteFutureConfirm"), func() {
				p.deleteFuture(*l, func(err error) {
					if err != nil {
						form.SetFormError(api.Message(err, i18n.T("tutor.saveFailed")))
						return
					}
					d.Hide()
					p.afterOK(nil)
				})
			})
		})
		df.Importance = widget.DangerImportance
		co := widget.NewButton(i18n.T("tutor.cancelOnce"), func() {
			p.env.Confirm(i18n.T("tutor.cancelOnceConfirm"), func() {
				p.cancelOnce(*l, func(err error) {
					if err != nil {
						form.SetFormError(api.Message(err, i18n.T("tutor.saveFailed")))
						return
					}
					d.Hide()
					p.afterOK(nil)
				}, func() {})
			})
		})
		buttons.Add(df)
		buttons.Add(co)
	}
	buttons.Add(cancel)
	if p.canEdit() {
		buttons.Add(save)
	}
	body.Add(buttons)
	d = dialog.NewCustomWithoutButtons(title, container.NewVScroll(container.NewPadded(body)), p.env.Window)
	cs := p.env.Window.Canvas().Size()
	d.Resize(fyne.NewSize(min(560, cs.Width-40), min(680, cs.Height-60)))
	d.Show()
}

func feeOrZero(v any) decimal.Decimal {
	if d, ok := v.(decimal.Decimal); ok {
		return d
	}
	return decimal.Zero
}

func strOrNil(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// ---- students ----

func (p *page) studentsDialog() {
	list := container.NewVBox()
	right := container.NewStack()
	var d *dialog.CustomDialog

	var show func(s *student)
	refresh := func() {
		list.Objects = nil
		for _, s := range p.students {
			s := s
			phone := strOf(s.Phone)
			if phone == "" {
				phone = i18n.T("tutor.noPhone")
			}
			b := widget.NewButton(s.Name+" · "+phone, func() { show(&s) })
			b.Alignment = widget.ButtonAlignLeading
			b.Importance = widget.LowImportance
			list.Add(container.NewBorder(nil, nil, kit.Rect(hex(s.Color), 8, 24), nil, b))
		}
		list.Refresh()
	}
	show = func(s *student) {
		init := student{Color: palette[len(p.students)%len(palette)]}
		title := i18n.T("tutor.addStudent")
		if s != nil {
			init, title = *s, i18n.T("tutor.editStudent")
		}
		form := kit.NewForm([]kit.Field{
			{Key: "name", Label: i18n.T("tutor.studentName"), Required: true, MaxLen: 150, Initial: strOrNil(init.Name)},
			{Key: "phone", Label: i18n.T("tutor.phone"), MaxLen: 30, Initial: strOrNil(strOf(init.Phone))},
			{Key: "color", Label: i18n.T("tutor.color"), Required: true, Pattern: colorPattern(), Initial: init.Color},
			{Key: "note", Label: i18n.T("tutor.note"), Kind: kit.KindTextArea, MaxLen: 1000, Initial: strOrNil(strOf(init.Note))},
		})
		sw := container.NewHBox()
		for _, c := range palette {
			c := c
			sw.Add(container.NewStack(kit.Rect(hex(c), 28, 28), newTap(func() { form.Set("color", c) })))
		}
		save := widget.NewButton(i18n.T("common.save"), nil)
		save.Importance = widget.HighImportance
		save.OnTapped = func() {
			v, ok := form.Values()
			if !ok {
				return
			}
			var version any
			method, path := "POST", "tutoring/students"
			if s != nil {
				version = s.Version
				method, path = "PUT", fmt.Sprintf("tutoring/students/%d", s.ID)
			}
			v["version"] = version
			save.Disable()
			kit.Async(func(ctx context.Context) (struct{}, error) {
				return struct{}{}, p.env.API.Do(ctx, method, path, nil, v, nil)
			}, func(_ struct{}, err error) {
				save.Enable()
				if err != nil {
					form.ShowAPIError(err)
					return
				}
				p.env.Toast(kit.ToastSuccess, i18n.T("tutor.studentSaved"))
				show(nil)
				p.loadAll()
			})
		}
		btns := container.NewHBox(save)
		if s != nil {
			del := widget.NewButton(i18n.T("tutor.deleteStudent"), func() {
				p.env.Confirm(i18n.T("tutor.deleteStudentConfirm"), func() {
					kit.Async(func(ctx context.Context) (struct{}, error) {
						return struct{}{}, p.env.API.Do(ctx, "DELETE", fmt.Sprintf("tutoring/students/%d", s.ID), nil, map[string]int64{"version": s.Version}, nil)
					}, func(_ struct{}, err error) {
						if err != nil {
							p.env.Toast(kit.ToastError, api.Message(err, i18n.T("tutor.saveFailed")))
							return
						}
						p.env.Toast(kit.ToastSuccess, i18n.T("tutor.studentDeleted"))
						show(nil)
						p.loadAll()
					})
				})
			})
			del.Importance = widget.DangerImportance
			btns.Add(del)
		}
		right.Objects = []fyne.CanvasObject{container.NewVScroll(container.NewVBox(kit.Heading(title), form.Content(), sw, btns))}
		right.Refresh()
	}
	p.onStudents = refresh
	refresh()
	show(nil)
	closeBtn := widget.NewButton(i18n.T("common.close"), func() { d.Hide() })
	split := container.NewHSplit(container.NewVScroll(list), right)
	split.Offset = 0.4
	d = dialog.NewCustomWithoutButtons(i18n.T("tutor.students"), container.NewBorder(kit.Muted(i18n.T("tutor.directory")), closeBtn, nil, nil, split), p.env.Window)
	d.SetOnClosed(func() { p.onStudents = nil })
	cs := p.env.Window.Canvas().Size()
	d.Resize(fyne.NewSize(min(780, cs.Width-40), min(560, cs.Height-60)))
	d.Show()
}
